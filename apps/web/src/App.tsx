import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Inspection,
  Parcel,
} from '../../../packages/contracts/src/schemas.ts';
import {
  db,
  storeProfile,
  prepareOffline,
  synchronize,
  clearLocalData,
  type Profile,
} from './lib/offline.ts';
import { ApiError, request } from './lib/api.ts';
import { Login } from './components/Login.tsx';
import { InspectionForm } from './components/InspectionForm.tsx';
import { InspectionCard } from './components/InspectionCard.tsx';
import { ParcelForm } from './components/ParcelForm.tsx';
import {
  finishLogout,
  logoutPending,
  markLogoutPending,
} from './lib/logout.ts';

const ParcelMap = lazy(() => import('./components/ParcelMap.tsx'));
export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [associationId, setAssociationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Parcel | null>(null);
  const [createParcel, setCreateParcel] = useState(false);
  const [map, setMap] = useState(false);
  const queryClient = useQueryClient();
  const isCoordinator =
    profile?.memberships.find((m) => m.associationId === associationId)
      ?.role === 'coordinator';
  const changed = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['workspace'] });
  }, [queryClient]);
  const login = useCallback((value: Profile) => {
    setProfile(value);
    setAssociationId(value.memberships[0]?.associationId ?? '');
    setNotice('');
  }, []);
  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        if (logoutPending()) {
          if (navigator.onLine) await finishLogout();
          return;
        }
        if (navigator.onLine) {
          let value: Profile | undefined;
          try {
            value = await request<Profile>('/api/v1/session');
          } catch (error) {
            if (error instanceof ApiError) return;
          }
          if (value) {
            try {
              await storeProfile(value);
              if (active) login(value);
            } catch {
              if (active)
                setNotice(
                  'Hay datos de otro usuario en este dispositivo. Cierra la sesión y elimina sus datos antes de cambiar de cuenta.',
                );
            }
            return;
          }
        }
        const cached = await db.meta.get('profile');
        if (cached && active) login(cached.value);
      } finally {
        if (active) setLoading(false);
      }
    }
    void boot().catch(() => {
      if (active) setNotice('No se pudo abrir el almacenamiento local.');
    });
    return () => {
      active = false;
    };
  }, [login]);
  const local = useQuery({
    queryKey: ['workspace', profile?.user.id, associationId],
    networkMode: 'always',
    enabled: !!profile && !!associationId,
    queryFn: async () => ({
      parcels: await db.parcels
        .where('associationId')
        .equals(associationId)
        .toArray(),
      inspections: await db.inspections
        .where('associationId')
        .equals(associationId)
        .toArray(),
      drafts: await db.drafts
        .where('associationId')
        .equals(associationId)
        .toArray(),
    }),
  });
  const sync = useCallback(async () => {
    if (!associationId || !navigator.onLine) return;
    setBusy(true);
    try {
      await synchronize(associationId);
      setNotice('Trabajo sincronizado.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setProfile(null);
        setNotice(
          'La sesión caducó. Vuelve a entrar con el mismo usuario; conservamos los borradores.',
        );
      } else
        setNotice(
          'No se completó la sincronización. Los borradores siguen en este dispositivo; revisa su estado y reintenta.',
        );
    } finally {
      setBusy(false);
      changed();
    }
  }, [associationId, changed]);
  useEffect(() => {
    const connected = () => {
      setOnline(true);
      if (logoutPending())
        void finishLogout().catch(() =>
          setNotice(
            'El cierre de sesión del servidor sigue pendiente; reintenta al recuperar conexión.',
          ),
        );
      else void sync();
    };
    const disconnected = () => setOnline(false);
    const otherTabLogout = (event: StorageEvent) => {
      if (event.key === 'chira.logoutPending' && event.newValue === '1') {
        setProfile(null);
        setAssociationId('');
        queryClient.clear();
      }
    };
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    window.addEventListener('storage', otherTabLogout);
    return () => {
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('storage', otherTabLogout);
    };
  }, [sync, queryClient]);
  useEffect(() => {
    if (associationId && navigator.onLine) void sync();
  }, [associationId, sync]);
  async function download() {
    setBusy(true);
    try {
      await prepareOffline(associationId);
      await navigator.storage?.persist();
      setNotice('Parcelas disponibles sin conexión');
      changed();
    } catch {
      setNotice(
        'No se pudo preparar el trabajo. Comprueba tu conexión y vuelve a entrar si la sesión caducó.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (busy) return;
    const pending = await db.drafts.count();
    if (
      pending &&
      !window.confirm(
        'Hay borradores pendientes. Salir los eliminará de este dispositivo. Cancela para sincronizarlos primero. ¿Descartar y salir?',
      )
    )
      return;
    markLogoutPending();
    try {
      await finishLogout();
    } catch {
      setNotice(
        'Datos locales eliminados. Al recuperar conexión se cerrará la sesión del servidor.',
      );
    }
    setProfile(null);
    setAssociationId('');
    setSelected(null);
    setCreateParcel(false);
    queryClient.clear();
    await clearLocalData();
  }
  async function reload() {
    try {
      await prepareOffline(associationId);
      changed();
    } catch {
      setNotice('No se pudo actualizar la información.');
    }
  }
  if (loading) return <main className="loading">Abriendo Guardian…</main>;
  if (!profile)
    return (
      <>
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        <Login onLogin={login} />
      </>
    );
  const parcels = local.data?.parcels ?? [];
  const drafts = local.data?.drafts ?? [];
  const inspections = (local.data?.inspections ?? []).filter(
    (i) => !drafts.some((d) => d.id === i.id),
  );
  const name = (id: string) =>
    parcels.find((p) => p.id === id)?.name ?? 'Parcela de la asociación';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <img src="/icon.svg" alt="" />
          <span>
            CHIRA <b>OS</b>
          </span>
        </a>
        <div className="sidebar-product">
          GUARDIAN<span>Inteligencia para cuidar.</span>
        </div>
        <nav aria-label="Principal">
          <a href="#parcelas" className="nav-active">
            ▦ &nbsp; Mis parcelas
          </a>
          <a href="#inspecciones">◉ &nbsp; Inspecciones</a>
          <button className="nav-button" onClick={() => setMap((v) => !v)}>
            ⌖ &nbsp; {map ? 'Ocultar mapa' : 'Ver ubicaciones'}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <span className="eyebrow">VALLE DEL CHIRA</span>
          <p>
            La tecnología al servicio
            <br />
            de nuestra tierra.
          </p>
          <span>Querecotillo · Perú</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Asociación <span className="muted">/</span> Guardian
          </span>
          <div>
            <span className={`connection ${online ? '' : 'offline'}`}>
              {online ? 'Con conexión' : 'Sin conexión'}
            </span>
            <span className="user-name">{profile.user.name}</span>
            <button
              className="text-button"
              onClick={() => void logout()}
              disabled={busy}
            >
              Salir
            </button>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                CAMPO CONECTADO, INCLUSO SIN SEÑAL
              </span>
              <h1>
                {isCoordinator
                  ? 'Una mirada a tu asociación.'
                  : 'Cada visita cuenta.'}
              </h1>
              <p>
                {isCoordinator
                  ? 'Revisa la evidencia y acompaña las decisiones de tu equipo.'
                  : 'Registra lo que ves hoy. Protege lo que crece mañana.'}
              </p>
            </div>
            <span className="date">
              {new Date().toLocaleDateString('es-PE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="demo-note">
            DEMOSTRACIÓN · DATOS SINTÉTICOS · SIN DIAGNÓSTICO AUTOMÁTICO
          </div>
          {profile.memberships.length > 1 && (
            <label>
              Asociación
              <select
                value={associationId}
                disabled={busy}
                onChange={(e) => {
                  setSelected(null);
                  setAssociationId(e.target.value);
                }}
              >
                {profile.memberships.map((m, i) => (
                  <option key={m.associationId} value={m.associationId}>
                    Asociación {i + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          <div className="stats">
            <div>
              <span>PARCELAS EN ESTE EQUIPO</span>
              <strong>{parcels.length.toString().padStart(2, '0')}</strong>
              <small>Listas para la próxima visita</small>
            </div>
            <div>
              <span>SUPERFICIE REGISTRADA</span>
              <strong>
                {parcels
                  .reduce((s, p) => s + p.hectares, 0)
                  .toLocaleString('es-PE')}{' '}
                <em>ha</em>
              </strong>
              <small>Trabajo a escala de cada productor</small>
            </div>
            <div>
              <span>ENVÍOS PENDIENTES</span>
              <strong>
                {drafts.length.toString().padStart(2, '0')}{' '}
                <i className={drafts.length ? 'dot amber' : 'dot'} />
              </strong>
              <small>
                {drafts.length
                  ? 'Conservados en este dispositivo'
                  : 'Todo en orden por aquí'}
              </small>
            </div>
          </div>
          <section className="sync-banner">
            <div className="sync-symbol" aria-hidden="true">
              ↻
            </div>
            <div>
              <strong>Tu trabajo sigue, con o sin conexión.</strong>
              <p>
                Prepara tus parcelas antes de salir. Los envíos pendientes se
                reintentan al volver la señal.
              </p>
            </div>
            <div className="actions">
              <button
                className="secondary"
                disabled={!online || busy}
                onClick={() => void download()}
              >
                Preparar trabajo offline
              </button>
              <button disabled={!online || busy} onClick={() => void sync()}>
                {busy ? 'Sincronizando…' : 'Sincronizar ahora'}
              </button>
            </div>
          </section>
          {selected && (
            <InspectionForm
              parcel={selected}
              userId={profile.user.id}
              associationId={associationId}
              onCancel={() => setSelected(null)}
              onSaved={() => {
                setSelected(null);
                changed();
                setNotice('Inspección guardada en este dispositivo.');
              }}
            />
          )}
          {createParcel && (
            <ParcelForm
              associationId={associationId}
              onCancel={() => setCreateParcel(false)}
              onSaved={() => {
                setCreateParcel(false);
                void reload();
              }}
            />
          )}
          {map && (
            <Suspense fallback={<p>Cargando mapa…</p>}>
              <ParcelMap parcels={parcels} />
            </Suspense>
          )}
          <section id="parcelas">
            <div className="section-heading">
              <div>
                <h2>
                  Mis parcelas <span className="count">{parcels.length}</span>
                </h2>
                <p className="muted">
                  Cada parcela, su historia y sus próximas visitas.
                </p>
              </div>
              <button
                className="secondary"
                disabled={!online}
                onClick={() => setCreateParcel(true)}
              >
                Registrar parcela
              </button>
            </div>
            <div className="parcel-grid">
              {parcels.map((p, index) => (
                <article className="panel parcel-card" key={p.id}>
                  <div className="parcel-illustration" aria-hidden="true">
                    <span className="parcel-code">
                      CHIRA / {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="plot">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <span className="crop-tag">{p.crop}</span>
                  </div>
                  <div className="parcel-info">
                    <h3>{p.name}</h3>
                    <p>{p.producerName}</p>
                    <div className="parcel-meta">
                      <span>
                        <strong>{p.hectares} ha</strong>Superficie
                      </span>
                      <span>
                        <strong>Querecotillo</strong>Valle del Chira
                      </span>
                    </div>
                    <button
                      className="secondary full-width"
                      onClick={() => setSelected(p)}
                    >
                      Nueva inspección
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {parcels.length === 0 && (
              <div className="empty">
                Prepara tu trabajo offline para ver las parcelas asignadas, o
                registra tu primera parcela.
              </div>
            )}
          </section>
          <section id="inspecciones">
            <div className="section-heading">
              <div>
                <h2>Registro de campo</h2>
                <p className="muted">
                  Observaciones con evidencia y revisión humana.
                </p>
              </div>
              <span className="small">
                {drafts.length + inspections.length} registros
              </span>
            </div>
            <div className="inspection-grid">
              {drafts.map((d) => (
                <InspectionCard
                  key={d.id}
                  inspection={
                    {
                      ...d,
                      photoIds: d.photos.map((p) => p.id),
                      status: 'draft',
                      version: Math.max(1, d.expectedVersion),
                    } as Inspection
                  }
                  draft={d}
                  parcelName={name(d.parcelId)}
                  associationId={associationId}
                  isCoordinator={false}
                  onChanged={changed}
                />
              ))}
              {inspections.map((i) => (
                <InspectionCard
                  key={i.id}
                  inspection={i}
                  parcelName={name(i.parcelId)}
                  associationId={associationId}
                  isCoordinator={!!isCoordinator}
                  onChanged={() => void reload()}
                />
              ))}
            </div>
            {!drafts.length && !inspections.length && (
              <div className="empty">
                Las próximas visitas aparecerán aquí. Empieza desde una parcela.
              </div>
            )}
          </section>
          {isCoordinator && (
            <section className="export-bar">
              <div>
                <strong>La información es de tu asociación.</strong>
                <p>
                  Descarga los datos cuando los necesites. Las fotografías están
                  disponibles en cada inspección.
                </p>
              </div>
              <a
                href={`/api/v1/exports/parcels.geojson?associationId=${associationId}`}
                download
              >
                Exportar parcelas
              </a>
              <a
                href={`/api/v1/exports/inspections.csv?associationId=${associationId}`}
                download
              >
                Exportar inspecciones
              </a>
            </section>
          )}
          <footer>
            CHIRA OS <span>Guardian · Hecho para el trabajo de campo.</span>
            <span>Las observaciones requieren evaluación agronómica.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
