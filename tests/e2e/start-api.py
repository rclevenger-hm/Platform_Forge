"""A real disposable account backend for browser integration tests."""
import os
import sys
import tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'server'))
with tempfile.TemporaryDirectory(prefix='forge-browser-accounts-') as directory:
    os.environ.update(DATA_DIR=directory, API_TOKEN='browser-test-operator', REGISTRATION_OPEN='true',
                      ALLOWED_ORIGINS='http://127.0.0.1:4173', COOKIE_SECURE='false', COOKIE_SAMESITE='Lax',
                      RUNNER_URL='', LLM_BASE_URL='')
    import app
    ThreadingHTTPServer(('127.0.0.1', 8789), app.Handler).serve_forever()
