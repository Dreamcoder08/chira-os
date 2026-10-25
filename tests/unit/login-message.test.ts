import { describe, expect, it } from 'vitest';
import { ApiError } from '../../apps/web/src/lib/api.ts';
import { loginMessage } from '../../apps/web/src/lib/login-message.ts';

describe('login failure message', () => {
  it('tells the user to wait when the rate limit rejected the attempt', () => {
    // A correct password that hits 429 must not read as a wrong password.
    expect(loginMessage(new ApiError(429, 'RATE_LIMITED'))).toMatch(
      /demasiados intentos/i,
    );
  });

  it('names the credentials when the server rejected them', () => {
    expect(loginMessage(new ApiError(401, 'INVALID_EMAIL_OR_PASSWORD'))).toBe(
      'Correo o contraseña incorrectos.',
    );
  });

  it('blames the server when the server failed', () => {
    expect(loginMessage(new ApiError(500, 'INTERNAL'))).toMatch(/servidor/i);
  });

  it('blames the connection when the request never reached the server', () => {
    expect(loginMessage(new TypeError('Failed to fetch'))).toMatch(/conexión/i);
  });

  it('says which address to open when the origin was not trusted', () => {
    // Typing 127.0.0.1 instead of localhost reached the server and got a 403;
    // "comprueba la conexión" sent the technician to the wrong place.
    expect(loginMessage(new ApiError(403, 'FORBIDDEN'))).toMatch(/dirección/i);
  });

  it('keeps the stale-session hint for anything it cannot classify', () => {
    expect(loginMessage(new ApiError(418, 'TEAPOT'))).toMatch(/otro usuario/i);
  });
});
