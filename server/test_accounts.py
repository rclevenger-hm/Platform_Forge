import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path
from unittest.mock import patch
import app
from accounts import AccountStore, AccountError, RateLimiter

PASSWORD = 'a long unique test passphrase'


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.store = AccountStore(Path(self.directory.name) / 'accounts.sqlite3')
        self.patch = patch.object(app, 'account_store', return_value=self.store); self.patch.start()
        self.env = patch.dict(os.environ, {'REGISTRATION_OPEN': 'true', 'COOKIE_SECURE': 'false', 'COOKIE_SAMESITE': 'Lax', 'API_TOKEN': 'operator', 'ALLOWED_ORIGINS': 'https://forge.example'}); self.env.start()
        app.AUTH_LIMIT = RateLimiter()
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        self.url = 'http://127.0.0.1:' + str(self.server.server_port)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close()
        self.patch.stop(); self.env.stop(); self.directory.cleanup()

    def request(self, path, body=None, session=None, headers=None):
        values = {'Content-Type': 'application/json', 'X-Forge-Client': '1'}
        if session:
            values.update(Cookie=session['cookie'], **{'X-CSRF-Token': session['csrf']})
        values.update(headers or {})
        req = urllib.request.Request(self.url + path, data=json.dumps(body).encode() if body is not None else None, headers=values)
        try:
            response = urllib.request.urlopen(req)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.loads(response.read()), response.headers

    def register(self, username='roger'):
        status, body, headers = self.request('/api/auth/register', {'username': username, 'password': PASSWORD})
        self.assertEqual(status, 200, body)
        return {**body, 'cookie': headers['Set-Cookie'].split(';')[0]}

    def test_accounts_are_isolated_conflicts_preserve_saved_work_and_logout_revokes(self):
        one = self.register(); two = self.register('learner_two')
        snapshot = {'version': 3, 'attempts': [], 'notes': {'M01': 'Private notes'}}
        self.assertEqual(self.request('/api/account/progress', {'revision': 0, 'progress': snapshot, 'userId': two['user']['id']}, one)[0], 200)
        self.assertEqual(self.request('/api/account/progress', session=two)[1]['progress'], None)
        self.assertEqual(self.request('/api/account/progress', session=one)[1]['progress'], snapshot)
        self.assertEqual(self.request('/api/account/progress', {'revision': 0, 'progress': {'version': 3, 'attempts': []}}, one)[0], 409)
        self.assertEqual(self.request('/api/account/progress', session=one)[1]['progress'], snapshot)
        self.assertEqual(self.request('/api/auth/logout', {}, one)[0], 200)
        self.assertEqual(self.request('/api/account/progress', session=one)[0], 401)
        status, body, headers = self.request('/api/auth/login', {'username': 'ROGER', 'password': PASSWORD})
        self.assertEqual(status, 200)
        restored = {**body, 'cookie': headers['Set-Cookie'].split(';')[0]}
        self.assertEqual(self.request('/api/account/progress', session=restored)[1]['progress'], snapshot)

    def test_csrf_origin_cookies_and_account_auth(self):
        user = self.register()
        status, _, headers = self.request('/api/auth/status', session=user, headers={'Origin': 'https://forge.example'})
        self.assertEqual(status, 200)
        self.assertEqual(headers['Access-Control-Allow-Credentials'], 'true')
        self.assertEqual(self.request('/api/account/progress', {'revision': 0, 'progress': {}}, user, {'X-CSRF-Token': 'wrong'})[0], 403)
        self.assertEqual(self.request('/api/auth/logout', {}, user, {'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.request('/api/auth/login', {'username': 'roger', 'password': PASSWORD}, headers={'X-Forge-Client': ''})[0], 403)
        self.assertEqual(self.request('/api/account/progress', headers={'Authorization': 'Bearer operator'})[0], 401)
        with patch.dict(os.environ, {'COOKIE_SECURE': 'true', 'COOKIE_SAMESITE': 'None'}):
            cookie = app.session_cookie('token')
            for part in ['__Host-forge_session=', 'Secure', 'HttpOnly', 'SameSite=None', 'Path=/']:
                self.assertIn(part, cookie)
        with patch.dict(os.environ, {'COOKIE_SECURE': 'false', 'COOKIE_SAMESITE': 'None'}):
            with self.assertRaises(ValueError): app.session_cookie('token')

    def test_persistent_hashed_credentials_reset_and_session_expiry(self):
        user = self.register()
        reopened = AccountStore(self.store.path)
        self.assertEqual(reopened.login('roger', PASSWORD), user['user'])
        with reopened.connect() as db:
            row = dict(db.execute('SELECT * FROM users').fetchone())
            session = dict(db.execute('SELECT * FROM sessions').fetchone())
        self.assertNotIn(PASSWORD, json.dumps(row))
        self.assertNotIn(user['cookie'].split('=')[1], json.dumps(session))
        reopened.reset_password('roger', 'another sufficiently long password')
        self.assertEqual(self.request('/api/account/progress', session=user)[0], 401)
        with self.assertRaises(AccountError): reopened.login('roger', PASSWORD)
        token = reopened.new_session(user['user'])
        with reopened.connect() as db: db.execute('UPDATE sessions SET expires=0')
        self.assertIsNone(reopened.session(token))

    def test_closed_registration_rate_limits_and_payload_bounds(self):
        with patch.dict(os.environ, {'REGISTRATION_OPEN': 'false'}):
            self.assertEqual(self.request('/api/auth/register', {'username': 'learner', 'password': PASSWORD})[0], 403)
        user = self.register()
        with self.assertRaises(AccountError):
            self.store.save_progress(user['user']['id'], 0, {'version': 3, 'attempts': [], 'oversized': 'x' * 2_000_001})
        for _ in range(10):
            self.assertEqual(self.request('/api/auth/login', {'username': 'unknown', 'password': PASSWORD})[0], 401)
        self.assertEqual(self.request('/api/auth/login', {'username': 'unknown', 'password': PASSWORD})[0], 429)

    def test_jobs_are_bound_to_signed_in_owner(self):
        one = self.register(); two = self.register('second')
        job_id = 'd' * 32
        with patch.object(app, 'runner_request', return_value={'id': job_id, 'state': 'starting'}) as proxy:
            self.assertEqual(self.request('/api/jobs', {'missionId': 'M07', 'jobId': job_id, 'code': 'print(1)'}, one)[0], 202)
            self.assertEqual(self.request('/api/jobs/' + job_id, session=one)[0], 200)
            before = proxy.call_count
            self.assertEqual(self.request('/api/jobs/' + job_id, session=two)[0], 404)
            self.assertEqual(self.request('/api/jobs/' + job_id + '/cancel', {}, two)[0], 404)
            self.assertEqual(self.request('/api/jobs', {'missionId': 'M07', 'jobId': job_id, 'code': 'print(1)'}, two)[0], 404)
            self.assertEqual(proxy.call_count, before)
