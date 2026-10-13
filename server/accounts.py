"""SQLite accounts, opaque cookie sessions and revisioned progress snapshots."""
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path

MAX_PROGRESS = 2_000_000
SESSION_SECONDS = 7 * 86400


class AccountError(Exception):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)


def password_hash(password, salt):
    # OWASP's 16 MiB scrypt profile; no optional native dependency.
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=5, dklen=32).hex()


def credentials(username, password):
    if not isinstance(username, str) or not re.fullmatch(r'[A-Za-z0-9_-]{3,32}', username):
        raise AccountError(400, 'Use 3–32 letters, numbers, underscores or dashes for your username.')
    if not isinstance(password, str) or not 12 <= len(password) <= 128:
        raise AccountError(400, 'Use a password with 12–128 characters.')
    return username.lower(), password


class RateLimiter:
    def __init__(self):
        self.lock = threading.Lock()
        self.entries = {}

    def check(self, key, limit=10, window=300):
        with self.lock:
            now = time.monotonic()
            self.entries = {k: v for k, v in self.entries.items() if now - v[0] < window}
            start, count = self.entries.get(key, (now, 0))
            if count >= limit or (key not in self.entries and len(self.entries) >= 2000):
                raise AccountError(429, 'Too many sign-in attempts. Try again in five minutes.')
            self.entries[key] = (start, count + 1)


class AccountStore:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.executescript('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
                    salt TEXT NOT NULL, password TEXT NOT NULL, created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires REAL NOT NULL);
                CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
                CREATE TABLE IF NOT EXISTS progress (
                    user_id TEXT PRIMARY KEY REFERENCES users(id), revision INTEGER NOT NULL,
                    body TEXT, updated REAL);
                CREATE TABLE IF NOT EXISTS job_owners (
                    job_id TEXT PRIMARY KEY, owner TEXT NOT NULL, expires REAL NOT NULL);
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    def register(self, username, password):
        username, password = credentials(username, password)
        salt = secrets.token_bytes(16)
        hashed = password_hash(password, salt)
        user = {'id': secrets.token_hex(16), 'username': username}
        try:
            with self.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                if db.execute('SELECT count(*) FROM users').fetchone()[0] >= 1000:
                    raise AccountError(409, 'This server has reached its account limit.')
                db.execute('INSERT INTO users VALUES (?, ?, ?, ?, ?)', (user['id'], username, salt.hex(), hashed, time.time()))
                db.execute('INSERT INTO progress VALUES (?, 0, NULL, NULL)', (user['id'],))
        except sqlite3.IntegrityError:
            raise AccountError(409, 'That username is unavailable.') from None
        return user

    def login(self, username, password):
        username, password = credentials(username, password)
        with self.connect() as db:
            user = db.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
        # Do the same expensive work for unknown usernames.
        salt = bytes.fromhex(user['salt']) if user else b'\0' * 16
        hashed = password_hash(password, salt)
        if not user or not hmac.compare_digest(hashed, user['password']):
            raise AccountError(401, 'Username or password is incorrect.')
        return {'id': user['id'], 'username': user['username']}

    def new_session(self, user):
        token = secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute('DELETE FROM sessions WHERE expires <= ?', (time.time(),))
            db.execute('INSERT INTO sessions VALUES (?, ?, ?)', (hashlib.sha256(token.encode()).hexdigest(), user['id'], time.time() + SESSION_SECONDS))
            db.execute('DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires DESC LIMIT 5)', (user['id'], user['id']))
        return token

    def session(self, token):
        if not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
            return None
        with self.connect() as db:
            user = db.execute('SELECT users.id, users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>?',
                (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
        return dict(user) if user else None

    def revoke(self, token):
        with self.connect() as db:
            db.execute('DELETE FROM sessions WHERE token_hash=?', (hashlib.sha256(token.encode()).hexdigest(),))

    def reset_password(self, username, password):
        username, password = credentials(username, password)
        salt = secrets.token_bytes(16)
        hashed = password_hash(password, salt)
        with self.connect() as db:
            user = db.execute('SELECT id FROM users WHERE username=?', (username,)).fetchone()
            if not user:
                raise AccountError(404, 'Account not found.')
            db.execute('UPDATE users SET salt=?, password=? WHERE id=?', (salt.hex(), hashed, user['id']))
            db.execute('DELETE FROM sessions WHERE user_id=?', (user['id'],))

    def progress(self, user_id):
        with self.connect() as db:
            row = db.execute('SELECT revision, body, updated FROM progress WHERE user_id=?', (user_id,)).fetchone()
        return {'revision': row['revision'], 'progress': json.loads(row['body']) if row['body'] else None, 'updatedAt': row['updated']}

    def save_progress(self, user_id, revision, progress):
        if type(revision) is not int or revision < 0:
            raise AccountError(400, 'Invalid progress revision.')
        if not isinstance(progress, dict) or progress.get('version') not in (1, 2, 3, 4) or not isinstance(progress.get('attempts'), list) or len(progress['attempts']) > 10000:
            raise AccountError(400, 'Invalid progress snapshot.')
        body = json.dumps(progress, ensure_ascii=True, allow_nan=False, separators=(',', ':'))
        if len(body.encode()) > MAX_PROGRESS:
            raise AccountError(413, 'Progress exceeds the 2 MB account limit. Export a backup before trimming history.')
        now = time.time()
        with self.connect() as db:
            changed = db.execute('UPDATE progress SET revision=revision+1, body=?, updated=? WHERE user_id=? AND revision=?',
                                 (body, now, user_id, revision)).rowcount
            if not changed:
                raise AccountError(409, 'Progress changed on another device. Choose which copy to keep in Account.')
        return {'revision': revision + 1, 'updatedAt': now}

    def claim_job(self, job_id, owner):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM job_owners WHERE expires<?', (time.time(),))
            existing = db.execute('SELECT owner FROM job_owners WHERE job_id=?', (job_id,)).fetchone()
            if existing and existing['owner'] != owner:
                raise AccountError(404, 'Run not found or expired.')
            db.execute('INSERT OR IGNORE INTO job_owners VALUES (?, ?, ?)', (job_id, owner, time.time() + 3600))

    def owns_job(self, job_id, owner):
        with self.connect() as db:
            return db.execute('SELECT 1 FROM job_owners WHERE job_id=? AND owner=? AND expires>?', (job_id, owner, time.time())).fetchone() is not None


def csrf_token(token):
    return hashlib.sha256(('forge-csrf:' + token).encode()).hexdigest()
