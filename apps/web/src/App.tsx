import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
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
import { Icon } from './components/icons.tsx';

type View = 'parcelas' | 'mapa' | 'inspecciones';

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
  const [view, setView] = useState<View>('parcelas');
  const [active, setActive] = useState<Parcel | null>(null);
  const [dockOpen, setDockOpen] = useState(true);
  const queryClient = useQueryClient();
  // A toast that never leaves ends up covering the work it announces.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const isCoordinator =
    profile?.memberships.find((m) => m.associationId === associationId)
      ?.role === 'coordinator';
  // A coordinator opens the review queue; a technician opens their parcels.
  useEffect(() => {
    setView(isCoordinator ? 'inspecciones' : 'parcelas');
  }, [isCoordinator, associationId]);
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
  // Reopening the app with pending work lands on the evidence, not on an empty
  // list: a technician who reloads in the field must see what still has to be
  // sent. Runs once per session, so it never fights manual navigation.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !local.data) return;
    opened.current = true;
    if (local.data.drafts.length > 0) setView('inspecciones');
  }, [local.data]);
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
  const initials = profile.user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  const activeIndex = active
    ? parcels.findIndex((parcel) => parcel.id === active.id)
    : -1;
  return (
    <div className="ds-shell">
      <aside className="ds-rail">
        <a className="ds-rail-brand" href="/" aria-label="CHIRA OS">
          <img src="/icon.svg" alt="" />
        </a>
        <nav className="ds-rail-nav" aria-label="Principal">
          <a
            className="ds-rail-item"
            href="#parcelas"
            title="Mis parcelas"
            aria-label="Mis parcelas"
            aria-current={view === 'parcelas' ? 'page' : undefined}
            onClick={() => setView('parcelas')}
          >
            <Icon name="parcels" />
          </a>
          <a
            className="ds-rail-item"
            href="#inspecciones"
            title="Inspecciones"
            aria-label="Inspecciones"
            aria-current={view === 'inspecciones' ? 'page' : undefined}
            onClick={() => setView('inspecciones')}
          >
            <Icon name="inspections" />
          </a>
          {isCoordinator && (
            <a
              className="ds-rail-item"
              href="#exportar"
              title="Exportar"
              aria-label="Exportar"
            >
              <Icon name="export" />
            </a>
          )}
        </nav>
        <div className="ds-rail-bottom">
          <span className="ds-avatar" aria-hidden="true">
            {initials}
          </span>
        </div>
      </aside>
      <div className="ds-main">
        <header className="ds-topbar">
          <div className="ds-context">
            <img className="ds-context-mark" src="/icon.svg" alt="" />
            <span className="ds-context-name">
              CHIRA <b>OS</b>
            </span>
            <span className="ds-context-sep" aria-hidden="true">
              /
            </span>
            <span className="ds-context-page">Guardian</span>
          </div>
          <div className="ds-status">
            {profile.memberships.length > 1 && (
              <label className="ds-pill ds-pill--select">
                <span className="ds-pill-label">Asociación</span>
                <select
                  value={associationId}
                  disabled={busy}
                  onChange={(event) => {
                    setSelected(null);
                    setActive(null);
                    setAssociationId(event.target.value);
                  }}
                >
                  {profile.memberships.map((membership, index) => (
                    <option
                      key={membership.associationId}
                      value={membership.associationId}
                    >
                      Asociación {index + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span
              className={`ds-chip ${online ? 'ds-chip--online' : 'ds-chip--offline'}`}
            >
              <Icon name={online ? 'online' : 'offline'} size={14} />
              {online ? 'Con conexión' : 'Sin conexión'}
            </span>
            <span className="ds-chip ds-chip--warn">Demostración</span>
            <span className="ds-user">{profile.user.name}</span>
            <button
              className="ds-btn ds-btn--ghost"
              onClick={() => void logout()}
              disabled={busy}
            >
              Salir
            </button>
          </div>
        </header>
        {notice && (
          <div role="status" className="notice ds-notice">
            {notice}
          </div>
        )}
        <main className="ds-stage">
          <div className="ds-map" data-visible={view === 'mapa'}>
            <Suspense
              fallback={<p className="ds-map-loading">Cargando mapa…</p>}
            >
              <ParcelMap parcels={parcels} activeId={active?.id} />
            </Suspense>
            <p className="ds-map-note">
              Referencia geográfica local. No incluye imágenes satelitales ni
              cartografía base.
            </p>
          </div>
          <section className="ds-heading" aria-labelledby="ds-title">
            <span className="ds-eyebrow">
              CAMPO CONECTADO, INCLUSO SIN SEÑAL
            </span>
            <h1 id="ds-title">
              {isCoordinator
                ? 'Una mirada a tu asociación.'
                : 'Cada visita cuenta.'}
            </h1>
            <p>
              {isCoordinator
                ? 'Revisa la evidencia y acompaña las decisiones de tu equipo.'
                : 'Registra lo que ves hoy. Protege lo que crece mañana.'}
            </p>
            <span className="ds-date">
              {new Date().toLocaleDateString('es-PE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span className="ds-demo">
              Demostración · datos sintéticos · sin diagnóstico automático
            </span>
          </section>
          {active && (
            <article className="ds-parcel-card">
              <button
                className="ds-icon-btn"
                aria-label="Cerrar"
                onClick={() => setActive(null)}
              >
                <Icon name="close" size={16} />
              </button>
              <span className="ds-eyebrow">
                CHIRA / {String(activeIndex + 1).padStart(2, '0')}
              </span>
              <strong className="ds-parcel-name">{active.name}</strong>
              <p>{active.producerName}</p>
              <dl className="ds-parcel-facts">
                <div>
                  <dt>Superficie</dt>
                  <dd>{active.hectares} ha</dd>
                </div>
                <div>
                  <dt>Cultivo</dt>
                  <dd>{active.crop}</dd>
                </div>
                <div>
                  <dt>Ubicación</dt>
                  <dd>
                    {active.location.coordinates[1].toFixed(4)},{' '}
                    {active.location.coordinates[0].toFixed(4)}
                  </dd>
                </div>
              </dl>
              <button
                className="ds-btn ds-btn--primary"
                onClick={() => {
                  setSelected(active);
                  setActive(null);
                }}
              >
                Nueva inspección
              </button>
            </article>
          )}
          <section className="ds-dock" data-open={dockOpen}>
            <button
              className="ds-dock-handle"
              onClick={() => setDockOpen((value) => !value)}
              aria-expanded={dockOpen}
              aria-label={dockOpen ? 'Contraer panel' : 'Expandir panel'}
            >
              <Icon name={dockOpen ? 'chevronDown' : 'chevronUp'} size={16} />
            </button>
            <div className="ds-dock-body">
              <div className="ds-sync">
                <div className="ds-sync-copy">
                  <strong>Tu trabajo sigue, con o sin conexión.</strong>
                  <p>
                    Prepara tus parcelas antes de salir. Los envíos pendientes
                    se reintentan al volver la señal.
                  </p>
                </div>
                <div className="ds-sync-actions">
                  <button
                    className="ds-btn ds-btn--secondary"
                    disabled={!online || busy}
                    onClick={() => void download()}
                  >
                    Preparar trabajo offline
                  </button>
                  <button
                    className="ds-btn ds-btn--primary"
                    disabled={!online || busy}
                    onClick={() => void sync()}
                  >
                    {busy ? 'Sincronizando…' : 'Sincronizar ahora'}
                  </button>
                </div>
              </div>
              <div className="ds-stats">
                <div>
                  <span>PARCELAS EN ESTE EQUIPO</span>
                  <strong>{parcels.length.toString().padStart(2, '0')}</strong>
                  <small>Listas para la próxima visita</small>
                </div>
                <div>
                  <span>SUPERFICIE REGISTRADA</span>
                  <strong>
                    {parcels
                      .reduce((sum, parcel) => sum + parcel.hectares, 0)
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
              <div className="ds-dock-tabs" role="tablist" aria-label="Panel">
                <button
                  type="button"
                  role="tab"
                  className="ds-tab"
                  aria-selected={view === 'parcelas'}
                  onClick={() => setView('parcelas')}
                >
                  Parcelas <span className="ds-count">{parcels.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  className="ds-tab"
                  aria-selected={view === 'inspecciones'}
                  onClick={() => setView('inspecciones')}
                >
                  Inspecciones{' '}
                  <span className="ds-count">
                    {drafts.length + inspections.length}
                  </span>
                </button>
              </div>
              <div className="ds-dock-scroll">
                <section id="parcelas" hidden={view !== 'parcelas'}>
                  <div className="ds-section-head">
                    <div>
                      <h2>
                        Mis parcelas{' '}
                        <span className="ds-count">{parcels.length}</span>
                      </h2>
                      <p className="muted">
                        Cada parcela, su historia y sus próximas visitas.
                      </p>
                    </div>
                    <button
                      className="ds-btn ds-btn--secondary"
                      disabled={!online}
                      onClick={() => setCreateParcel(true)}
                    >
                      Registrar parcela
                    </button>
                  </div>
                  <div className="ds-parcel-grid">
                    {parcels.map((parcel, index) => (
                      <article
                        className="ds-parcel-tile"
                        key={parcel.id}
                        data-active={active?.id === parcel.id}
                      >
                        <button
                          type="button"
                          className="ds-parcel-open"
                          onClick={() => setActive(parcel)}
                          aria-label={`Ver ${parcel.name} en el mapa`}
                        >
                          <span className="ds-parcel-code">
                            CHIRA / {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="ds-parcel-crop">{parcel.crop}</span>
                        </button>
                        <div className="ds-parcel-info">
                          <h3>{parcel.name}</h3>
                          <p>{parcel.producerName}</p>
                          <div className="ds-parcel-meta">
                            <span>
                              <strong>{parcel.hectares} ha</strong>Superficie
                            </span>
                            <span>
                              <strong>Querecotillo</strong>Valle del Chira
                            </span>
                          </div>
                          <button
                            className="ds-btn ds-btn--secondary ds-btn--block"
                            onClick={() => setSelected(parcel)}
                          >
                            Nueva inspección
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {parcels.length === 0 && (
                    <div className="ds-empty">
                      Prepara tu trabajo offline para ver las parcelas
                      asignadas, o registra tu primera parcela.
                    </div>
                  )}
                </section>
                <section id="inspecciones" hidden={view !== 'inspecciones'}>
                  <div className="ds-section-head">
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
                  <div className="ds-inspection-grid">
                    {drafts.map((draft) => (
                      <InspectionCard
                        key={draft.id}
                        inspection={
                          {
                            ...draft,
                            photoIds: draft.photos.map((photo) => photo.id),
                            status: 'draft',
                            version: Math.max(1, draft.expectedVersion),
                          } as Inspection
                        }
                        draft={draft}
                        parcelName={name(draft.parcelId)}
                        associationId={associationId}
                        isCoordinator={false}
                        onChanged={changed}
                      />
                    ))}
                    {inspections.map((inspection) => (
                      <InspectionCard
                        key={inspection.id}
                        inspection={inspection}
                        parcelName={name(inspection.parcelId)}
                        associationId={associationId}
                        isCoordinator={!!isCoordinator}
                        onChanged={() => void reload()}
                      />
                    ))}
                  </div>
                  {!drafts.length && !inspections.length && (
                    <div className="ds-empty">
                      Las próximas visitas aparecerán aquí. Empieza desde una
                      parcela.
                    </div>
                  )}
                </section>
                {isCoordinator && (
                  <section className="ds-export" id="exportar">
                    <div>
                      <strong>La información es de tu asociación.</strong>
                      <p>
                        Descarga los datos cuando los necesites. Las fotografías
                        están disponibles en cada inspección.
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
                <footer className="ds-footer">
                  CHIRA OS{' '}
                  <span>Guardian · Hecho para el trabajo de campo.</span>
                  <span>
                    Las observaciones requieren evaluación agronómica.
                  </span>
                </footer>
              </div>
            </div>
          </section>
        </main>
        <nav className="ds-tabbar" aria-label="Navegación">
          <button
            type="button"
            className="ds-tabbar-item"
            aria-current={view === 'parcelas' ? 'page' : undefined}
            onClick={() => setView('parcelas')}
          >
            <Icon name="list" />
            Parcelas
          </button>
          <button
            type="button"
            className="ds-tabbar-item"
            aria-current={view === 'mapa' ? 'page' : undefined}
            onClick={() => setView('mapa')}
          >
            <Icon name="map" />
            Mapa
          </button>
          <button
            type="button"
            className="ds-tabbar-item"
            aria-current={view === 'inspecciones' ? 'page' : undefined}
            onClick={() => setView('inspecciones')}
          >
            <Icon name="inspections" />
            Revisión
          </button>
        </nav>
      </div>
      {selected && (
        <div className="ds-scrim">
          <div
            className="ds-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Nueva inspección"
          >
            <InspectionForm
              parcel={selected}
              userId={profile.user.id}
              associationId={associationId}
              onCancel={() => setSelected(null)}
              onSaved={() => {
                setSelected(null);
                changed();
                setView('inspecciones');
                setNotice('Inspección guardada en este dispositivo.');
              }}
            />
          </div>
        </div>
      )}
      {createParcel && (
        <div className="ds-scrim">
          <div
            className="ds-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Registrar parcela"
          >
            <ParcelForm
              associationId={associationId}
              onCancel={() => setCreateParcel(false)}
              onSaved={() => {
                setCreateParcel(false);
                void reload();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
