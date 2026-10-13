"""Operator password reset. Passwords are prompted, never passed as command arguments."""
import getpass
import os
import sys
from pathlib import Path
from accounts import AccountStore, AccountError

if __name__ == '__main__':
    if len(sys.argv) != 3 or sys.argv[1] != 'reset-password':
        raise SystemExit('Usage: python server/manage_accounts.py reset-password USERNAME')
    password = getpass.getpass('New password (12–128 characters): ')
    if password != getpass.getpass('Confirm password: '):
        raise SystemExit('Passwords did not match.')
    try:
        AccountStore(Path(os.environ.get('DATA_DIR', 'data')) / 'accounts.sqlite3').reset_password(sys.argv[2], password)
    except AccountError as error:
        raise SystemExit(str(error)) from None
    print('Password updated; all existing sessions for this account were revoked.')
