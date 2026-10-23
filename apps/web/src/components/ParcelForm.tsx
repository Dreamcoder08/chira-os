import { useState, type FormEvent } from 'react';
import { request } from '../lib/api.ts';

export function ParcelForm({
  associationId,
  onSaved,
  onCancel,
}: {
  associationId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await request('/api/v1/parcels', associationId, {
        method: 'POST',
        body: JSON.stringify({
          name: data.get('name'),
          producerName: data.get('producer'),
          crop: data.get('crop'),
          hectares: Number(data.get('hectares')),
          location: {
            type: 'Point',
            coordinates: [
              Number(data.get('longitude')),
              Number(data.get('latitude')),
            ],
          },
        }),
      });
      onSaved();
    } catch {
      setError(
        'No se pudo registrar la parcela. Comprueba la conexión y los campos.',
      );
    }
  }
  return (
    <section className="panel editor">
      <div className="section-heading">
        <h2>Registrar parcela</h2>
        <button className="secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <form onSubmit={save}>
        <div className="form-grid">
          <label>
            Nombre de parcela
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Productor
            <input name="producer" required maxLength={100} />
          </label>
          <label>
            Cultivo
            <input
              name="crop"
              defaultValue="Banano orgánico"
              required
              maxLength={100}
            />
          </label>
          <label>
            Superficie (ha)
            <input
              name="hectares"
              type="number"
              step="0.001"
              min="0.001"
              max="10000"
              required
            />
          </label>
          <label>
            Longitud
            <input
              name="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              defaultValue="-80.65"
              required
            />
          </label>
          <label>
            Latitud
            <input
              name="latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              defaultValue="-4.84"
              required
            />
          </label>
        </div>
        <p className="small">
          Confirma la ubicación real antes del piloto. La parcela se asignará a
          tu usuario.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button>Guardar parcela</button>
      </form>
    </section>
  );
}
