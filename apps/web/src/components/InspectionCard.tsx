import { useState, type FormEvent } from 'react';
import type { Inspection } from '../../../../packages/contracts/src/schemas.ts';
import { db, type Draft } from '../lib/offline.ts';
import { request } from '../lib/api.ts';

export function InspectionCard({
  inspection,
  parcelName,
  associationId,
  isCoordinator,
  draft,
  onChanged,
}: {
  inspection: Inspection;
  parcelName: string;
  associationId: string;
  isCoordinator: boolean;
  draft?: Draft;
  onChanged: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const label = draft
    ? draft.state === 'conflict'
      ? 'Conflicto: revisar'
      : draft.state === 'blocked'
        ? 'Envío bloqueado'
        : 'Pendiente de sincronizar'
    : inspection.status === 'reviewed'
      ? 'Revisada'
      : inspection.status === 'submitted'
        ? 'Enviada'
        : 'Borrador en servidor';
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const values = new FormData(event.currentTarget);
    try {
      await request(
        `/api/v1/inspections/${inspection.id}/reviews`,
        associationId,
        {
          method: 'POST',
          body: JSON.stringify({
            operationId: crypto.randomUUID(),
            expectedVersion: inspection.version,
            notes: values.get('review'),
            followUp: values.get('followUp') === 'on',
          }),
        },
      );
      onChanged();
    } catch {
      setError(
        'No se pudo registrar la revisión. Comprueba la conexión y actualiza para revisar posibles cambios.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    if (!draft) return;
    // Keep original evidence locally; the user explicitly creates a distinct inspection.
    const id = crypto.randomUUID();
    await db.transaction('rw', db.drafts, async () => {
      await db.drafts.add({
        ...draft,
        id,
        expectedVersion: 0,
        state: 'pending',
        error: undefined,
        saveOperationId: crypto.randomUUID(),
        submitOperationId: crypto.randomUUID(),
        photos: draft.photos.map((p) => ({ ...p, id: crypto.randomUUID() })),
      });
      await db.drafts.delete(draft.id);
    });
    onChanged();
  }
  return (
    <article className="panel inspection-card">
      <div className="section-heading">
        <span className="eyebrow">{parcelName}</span>
        <span className={`status ${draft ? 'pending' : inspection.status}`}>
          {label}
        </span>
      </div>
      <p className="observation">{inspection.notes}</p>
      <div className="small">
        {new Date(inspection.observedAt).toLocaleString('es-PE')} ·{' '}
        {inspection.biosecurity
          ? 'Bioseguridad registrada'
          : 'Checklist pendiente'}
      </div>
      {!draft && inspection.photoIds.length > 0 && (
        <div className="photos">
          {inspection.photoIds.map((id) => (
            <a
              key={id}
              href={`/api/v1/photos/${id}?associationId=${associationId}`}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={`/api/v1/photos/${id}?associationId=${associationId}`}
                alt="Evidencia de inspección"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
      {draft?.state === 'conflict' && (
        <div className="conflict">
          <p>
            El servidor tiene otra versión. Tu registro sigue en este
            dispositivo. Puedes conservarlo como una inspección nueva; no se
            sobrescribirá la evidencia anterior.
          </p>
          <button className="secondary" onClick={() => void recover()}>
            Conservar como nueva inspección
          </button>
        </div>
      )}
      {draft?.state === 'blocked' && (
        <p className="error">
          El servidor rechazó este envío ({draft.error}). Conservamos el
          borrador; solicita revisión del coordinador antes de reintentar.
        </p>
      )}
      {isCoordinator && !draft && inspection.status === 'submitted' && (
        <form className="review-form" onSubmit={review}>
          <label>
            Revisión del coordinador
            <textarea name="review" required maxLength={5000} rows={2} />
          </label>
          <label className="check">
            <input type="checkbox" name="followUp" />
            Requiere seguimiento
          </label>
          <button disabled={busy}>
            {busy ? 'Registrando…' : 'Registrar revisión'}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </article>
  );
}
