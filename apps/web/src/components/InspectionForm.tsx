import { useState, type FormEvent } from 'react';
import type { Parcel } from '../../../../packages/contracts/src/schemas.ts';
import { db, type Draft } from '../lib/offline.ts';

export function InspectionForm({
  parcel,
  userId,
  associationId,
  onSaved,
  onCancel,
}: {
  parcel: Parcel;
  userId: string;
  associationId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const draft: Draft = {
      id: crypto.randomUUID(),
      associationId,
      parcelId: parcel.id,
      authorId: userId,
      notes: String(form.get('notes')).trim(),
      biosecurity: form.get('biosecurity') === 'on',
      observedAt: new Date().toISOString(),
      photos: photos.map((blob) => ({ id: crypto.randomUUID(), blob })),
      expectedVersion: 0,
      saveOperationId: crypto.randomUUID(),
      submitOperationId: crypto.randomUUID(),
      state: 'pending',
    };
    try {
      await db.drafts.add(draft);
      onSaved();
    } catch {
      setError(
        'No se pudo guardar. El almacenamiento puede estar lleno o no disponible. Conserva esta pantalla y libera espacio antes de reintentar.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel editor">
      <div className="section-heading">
        <div>
          <span className="eyebrow">NUEVA VISITA</span>
          <h2>{parcel.name}</h2>
        </div>
        <button className="secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <p>
        Registra lo que observaste. Una fotografía no confirma una enfermedad;
        la evaluación corresponde al especialista.
      </p>
      <form onSubmit={save}>
        <label>
          Observaciones
          <textarea
            name="notes"
            required
            minLength={1}
            maxLength={5000}
            rows={5}
            placeholder="Estado de las plantas, cambios observados y contexto de la visita…"
          />
        </label>
        <label className="check">
          <input name="biosecurity" type="checkbox" required />
          Completé el protocolo de bioseguridad
        </label>
        <p className="small">
          Confirma el cumplimiento del protocolo aprobado por tu asociación
          antes de abandonar la parcela.
        </p>
        <label>
          Fotografías
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (
                files.length > 5 ||
                files.some(
                  (f) =>
                    f.size > 8 * 1024 * 1024 ||
                    !['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
                )
              ) {
                setError(
                  'Selecciona hasta 5 imágenes JPEG, PNG o WebP de máximo 8 MB cada una.',
                );
                setPhotos([]);
                event.target.value = '';
                return;
              }
              setError('');
              setPhotos(files);
            }}
          />
        </label>
        <span className="small">
          Hasta 5 imágenes · 8 MB por imagen. Se guardan en este dispositivo
          hasta el envío.
        </span>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar en este dispositivo'}
        </button>
      </form>
    </section>
  );
}
