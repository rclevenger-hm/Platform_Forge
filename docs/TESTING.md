# Validation

```sh
npm ci
npm test
npm run test:server
npx playwright install --with-deps chromium
npm run test:e2e
```

Browser tests build with `/Platform_Forge/` as the base path, then exercise the actual production bundle. They cover a complete terminal mission, persisted notes, the design model, unavailable-backend fallback, real successful and failing Python executions, absence of third-party runtime requests, and mobile navigation/overflow. `PLAYWRIGHT_CHROMIUM_PATH` can select an existing Chromium executable when the default download is unavailable.

Unit checks cover all authored mission contracts, starter/solution distinction, protected simulated files, progress validation, assisted-versus-independent records, review timing, and capacity edge cases. Python tests cover authentication, origin checks, upstream outages, model availability, prompt grounding, server-side provider keys, runner constraints, and every Python worked solution.

The Docker CI job builds and starts the Compose application, checks HTTP health, then runs real isolated Python success/failure, timeout and read-only-filesystem checks on the disposable GitHub runner. Locally:

```sh
docker compose up --build --wait
docker pull python:3.13-alpine
python3 scripts/check_runner.py
docker compose down
```

Run the integration script only on a dedicated lab daemon. It launches and deletes short-lived containers with the `platform-forge.lab=true` label. It does not delete unrelated containers.

Remaining validation beyond v0.1: practitioner review of curriculum, screen-reader testing, representative model/provider compatibility, prolonged runner fault tests, host reboot/orphan cleanup, and adversarial multiuser isolation. These are release gates for the expanded hosted product, not claims made by the current demo.
