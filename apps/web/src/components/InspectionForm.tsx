import { useState, type FormEvent } from 'react';
import type { Parcel } from '../../../../packages/contracts/src/schemas.ts';
import { db, type Draft } from '../lib/offline.ts';
import { PhotoError, acceptsPhoto, preparePhoto } from '../lib/photo.ts';

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
  const [photos, setPhotos] = useState<{ id: string; blob: Blob }[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function choose(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length > 5 || files.some((file) => !acceptsPhoto(file))) {
      setError('Selecciona hasta 5 imágenes JPEG, PNG o WebP.');
      setPhotos([]);
      return;
    }
    setError('');
    setPreparing(true);
    try {
      const prepared: { id: string; blob: Blob }[] = [];
      for (const file of files)
        prepared.push({
          id: crypto.randomUUID(),
          blob: await preparePhoto(file),
        });
      setPhotos(prepared);
    } catch (cause) {
      setPhotos([]);
      setError(
        cause instanceof PhotoError
          ? cause.message
          : 'No pudimos preparar las imágenes. Intenta de nuevo.',
      );
    } finally {
      setPreparing(false);
    }
  }

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
      photos,
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
            disabled={preparing}
            onChange={(event) => void choose(event.currentTarget)}
          />
        </label>
        <span className="small">
          Hasta 5 imágenes. Se reducen a 2048 px en este dispositivo y se
          guardan hasta el envío.
        </span>
        {preparing && <p className="small">Preparando las imágenes…</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button disabled={busy || preparing}>
          {busy ? 'Guardando…' : 'Guardar en este dispositivo'}
        </button>
      </form>
    </section>
  );
}
