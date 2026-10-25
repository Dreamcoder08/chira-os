import { ApiError } from './api.ts';

const STALE_SESSION =
  'No se pudo iniciar sesión. Comprueba la conexión. Si este equipo tenía otro usuario, cierra primero su sesión.';

/**
 * The sign-in form used to answer every failure with one sentence, so a rate
 * limit (429) told the technician to check a password that was correct. Each
 * cause now gets the action that actually fixes it.
 */
export function loginMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429)
      return 'Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.';
    if (error.status === 401) return 'Correo o contraseña incorrectos.';
    if (error.status === 403)
      return 'Esta dirección no está autorizada para iniciar sesión. Abre la aplicación en la dirección que te dieron.';
    if (error.status >= 500)
      return 'El servidor no respondió bien. Vuelve a intentar en un momento.';
  }
  return STALE_SESSION;
}
