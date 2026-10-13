# Individual accounts and saved progress

Accounts work with the Docker or Python backend and need no model. The static Pages site includes the same account UI, but GitHub Pages cannot run the account database. Guest learning always remains available.

## Start locally

```sh
docker compose up --build -d
```

Open `http://localhost:8080`, select **Sign in → Create account**, and choose a username and a password of 12–128 characters. Usernames contain 3–32 ASCII letters, numbers, underscores or dashes and are case-insensitive. Registration is enabled by default for a locally operated learning group; set `REGISTRATION_OPEN=false` to close registration after accounts have been created.

Signed-in users can use the server's configured optional tutor and runner. They do not need the operator's `API_TOKEN`; keep that token private. This deployment is for trusted learners. Account separation does not turn the Docker daemon into a hardened hostile-code service.

## Progress behavior

- Missions, attempts, notes, incident notebooks, interview answers, design experiments, drafts, daily plans and retained run records are saved as one snapshot.
- Edits automatically sync after a short pause. **Account** shows pending, saving, saved, disconnected and conflict states.
- Each account has its own server record and a separate browser recovery copy. Guest progress keeps its original storage key. Signing out removes that account's recovery copy after a successful sync and restores guest work.
- **Import guest progress** is explicit. Existing account notes/drafts win conflicts; attempts and experiments are deduplicated. The guest copy remains intact.
- Updates use optimistic revision checks. If another device has saved first, autosync pauses. Export the device copy, then choose **Use server copy** or **Replace server copy with this device**. A second conflicting write is rejected again.
- A failed sync retains the device copy and shows a warning. Retry after reconnecting. Signing back in restores an unsynced recovery copy; if the server also changed, it asks which to keep.
- Progress is bounded to 2 MB per account. Export before trimming history. Browser exports and account data are practice records, not a tamper-proof assessment.

Use **Sign out** on a shared computer. Local recovery copies are not encrypted and browser storage is accessible to code in the learning origin. Browser Python is self-study execution, not a security boundary for untrusted pasted code.

## Persistence and recovery

Compose stores SQLite in the named `account-data` volume at `/data/accounts.sqlite3`. Recreating or restarting the API keeps accounts and progress. `docker compose down` keeps the volume; `docker compose down --volumes` deletes it. The application never stores plaintext passwords. SQLite stores progress unencrypted; control access to its volume and backups.

Create a consistent backup using SQLite's backup API, then copy it off the container:

```sh
docker compose exec api python -c "import sqlite3; source=sqlite3.connect('/data/accounts.sqlite3'); target=sqlite3.connect('/data/accounts-backup.sqlite3'); source.backup(target); target.close(); source.close()"
docker compose cp api:/data/accounts-backup.sqlite3 ./accounts-backup.sqlite3
```

To restore, stop the API, replace the database in the volume from a consistent backup, remove old WAL/SHM sidecars, then restart. Backups contain account credentials as password hashes and learner work. Practice restoration on a separate deployment before replacing a live database.

There is no email reset flow. The server owner can reset a password interactively; this revokes every session for that user:

```sh
docker compose exec api python server/manage_accounts.py reset-password USERNAME
```

For direct Python development, set `DATA_DIR` to a persistent directory and run `python3 server/app.py`. Its default is the repository's ignored `data/` directory.

## HTTPS and GitHub Pages

For a separately hosted backend:

1. Serve the backend over HTTPS and set `COOKIE_SECURE=true`.
2. Add the exact frontend origin, e.g. `https://rclevenger-hm.github.io`, to `ALLOWED_ORIGINS`.
3. For a cross-site frontend, set `COOKIE_SAMESITE=None`; it requires secure cookies.
4. Enter that backend's URL in **Settings → Check connection**, then open **Account**.

Browsers may block third-party cookies even with correct CORS and SameSite configuration. Serving the Docker frontend and API on the same HTTPS origin is the most reliable arrangement. This repository does not provision a public account backend merely by deploying Pages.

## Account controls

Passwords use salted scrypt (N=16384, r=8, p=5). Login creates a random opaque session; only its SHA-256 hash is stored in SQLite. Sessions expire after seven days, at most five are retained per user, and logout revokes the current one. Secure deployments use a `__Host-` HttpOnly cookie. Credentials never go to localStorage or progress exports.

Cookie-authenticated writes require a session-bound CSRF token. Origin allowlists, a custom application header and JSON-only writes cover login and other account actions. Authentication requests have per-username and per-peer limits; four backend slots also bound concurrent hashing. Behind the included proxy, the peer limit is shared by the deployment. The store caps accounts at 1,000.

These controls do not include MFA, OAuth, verified email, distributed abuse protection, account deletion UI or organization administration. Add those before operating a public learning service at scale.

References: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
