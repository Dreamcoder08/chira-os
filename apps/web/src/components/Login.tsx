import { useState, type FormEvent } from 'react';
import { request } from '../lib/api.ts';
import {
  db,
  storeProfile,
  clearLocalData,
  type Profile,
} from '../lib/offline.ts';
import { finishLogout, markLogoutPending } from '../lib/logout.ts';

export function Login({ onLogin }: { onLogin: (profile: Profile) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function reset() {
    if (
      !window.confirm(
        'Esto eliminará los borradores y datos locales, incluidos los pendientes de envío. ¿Descartar y cerrar sesión?',
      )
    )
      return;
    markLogoutPending();
    await finishLogout().catch(() => {});
    await clearLocalData();
    setError('Datos locales eliminados. Puedes volver a entrar con conexión.');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await finishLogout();
      await request('/api/auth/sign-in/email', undefined, {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const profile = await request<Profile>('/api/v1/session');
      await db.open();
      await storeProfile(profile);
      onLogin(profile);
    } catch {
      setError(
        'No se pudo iniciar sesión. Comprueba tus datos y la conexión. Si este equipo tenía otro usuario, cierra primero su sesión.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="welcome">
        <span className="eyebrow">NACIDO EN EL VALLE DEL CHIRA</span>
        <h1>
          Información que
          <br />
          cuida el campo.
        </h1>
        <p>
          Una herramienta para acompañar a quienes protegen nuestras cosechas,
          visita a visita.
        </p>
        <div className="field-art" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="welcome-foot">
          QUERECOTILLO · PIURA, PERÚ <span>05° S / 80° O</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="brand">
          <img src="/icon.svg" alt="" />
          <span>
            CHIRA <b>OS</b>
          </span>
        </div>
        <span className="pill">GUARDIAN · ACCESO DE LA ASOCIACIÓN</span>
        <h2>Volvamos al campo.</h2>
        <p>Accede a tus parcelas, visitas y observaciones.</p>
        <form onSubmit={submit}>
          <label>
            Correo
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <button disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </form>
        <button className="text-button" onClick={() => void reset()}>
          Eliminar datos locales y cerrar sesión
        </button>
        <p className="small">
          El primer acceso necesita conexión. Usa únicamente tu dispositivo
          asignado y mantenlo bloqueado cuando no lo uses.
        </p>
        <div className="demo-note">
          ENTORNO DE DEMOSTRACIÓN · DATOS SINTÉTICOS
        </div>
      </section>
    </main>
  );
}
