import { describe, expect, test } from 'vitest';
import { LOGIN_ERRORS, loginErrorCode, loginErrorMessage, loginErrorUrl } from './login-error';

describe('loginErrorMessage', () => {
  test('shows our copy for known codes', () => {
    for (const [code, copy] of Object.entries(LOGIN_ERRORS)) expect(loginErrorMessage(code)).toBe(copy);
  });

  test('never echoes an unknown value', () => {
    for (const value of ['Your account is locked — call +91 98xxxxxx', 'toString', '__proto__', 'constructor', 'NOT_DTU']) {
      expect(loginErrorMessage(value)).toBe(LOGIN_ERRORS.signin_failed);
    }
  });

  test('shows nothing without an error', () => {
    expect(loginErrorMessage(null)).toBeNull();
    expect(loginErrorMessage('')).toBeNull();
  });
});

describe('loginErrorCode', () => {
  test('recognises the DTU-only hook rejection', () => {
    expect(
      loginErrorCode({ error: 'access_denied', message: 'DTour is only for DTU students — sign in with your @dtu.ac.in email.' }),
    ).toBe('not_dtu');
  });

  test('recognises expired or invalid links', () => {
    expect(loginErrorCode({ code: 'otp_expired', message: 'Email link is invalid or has expired' })).toBe('link_expired');
    expect(loginErrorCode({ code: 'flow_state_not_found' })).toBe('link_expired');
    expect(loginErrorCode({ message: 'Token has expired or is invalid' })).toBe('link_expired');
  });

  test('recognises a cancelled Google sign-in', () => {
    expect(loginErrorCode({ error: 'access_denied', message: 'The user denied the request' })).toBe('cancelled');
  });

  test('falls back to the generic code', () => {
    expect(loginErrorCode({ error: 'server_error', message: 'Database error saving new user' })).toBe('signin_failed');
    expect(loginErrorCode({})).toBe('signin_failed');
  });
});

test('loginErrorUrl stays on the given origin and carries only the code', () => {
  expect(loginErrorUrl('https://dtour.example', 'not_dtu').href).toBe('https://dtour.example/login?error=not_dtu');
});
