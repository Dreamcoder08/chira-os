import type {
  Inspection,
  Parcel,
} from '../../../../packages/contracts/src/schemas.ts';
import { formatPercent } from '../lib/incidence.ts';
import { formatShortDate } from '../lib/format.ts';
import { parcelReport, type ReportTrend } from '../lib/report.ts';

/**
 * One page a coordinator can print and hand over. It exists so the person who
 * answers to an association has something to show that is not a phone screen:
 * the parcel, its last visits and whether the incidence is moving.
 *
 * Nothing here is a diagnosis. The counts are what a technician observed, and
 * the page says so, because a printed page outlives the conversation that
 * produced it.
 */

const TREND_LABEL: Record<ReportTrend, string> = {
  up: 'Sube respecto de la visita anterior',
  down: 'Baja respecto de la visita anterior',
  stable: 'Estable respecto de la visita anterior',
  unknown: 'Sin visita anterior comparable',
};

type ParcelReportProps = {
  parcel: Parcel;
  inspections: Inspection[];
  onClose: () => void;
};

export function ParcelReport({
  parcel,
  inspections,
  onClose,
}: ParcelReportProps) {
  const report = parcelReport(parcel.id, inspections);
  const latest = report.latest;

  return (
    <article className="ds-report" aria-label="Reporte de la parcela">
      <header className="ds-report-head">
        <p className="ds-report-brand">
          CHIRA <b>OS</b>
        </p>
        <h2>Reporte de parcela</h2>
        <p className="ds-report-meta">
          {parcel.name} · {parcel.producerName} · {parcel.crop} ·{' '}
          {parcel.hectares} ha
        </p>
        <p className="ds-report-meta">
          Coordenadas {parcel.location.coordinates[1].toFixed(4)},{' '}
          {parcel.location.coordinates[0].toFixed(4)}
        </p>
      </header>

      <section className="ds-report-summary" aria-label="Resumen">
        <div>
          <span className="ds-report-label">Visitas registradas</span>
          <strong>{report.totalVisits}</strong>
        </div>
        <div>
          <span className="ds-report-label">Última visita</span>
          <strong>
            {report.lastVisit ? formatShortDate(report.lastVisit) : '—'}
          </strong>
        </div>
        <div>
          <span className="ds-report-label">Incidencia actual</span>
          <strong>
            {latest?.ratio === null || latest === null
              ? 'Sin muestreo'
              : formatPercent(latest.ratio)}
          </strong>
        </div>
        <div>
          <span className="ds-report-label">Tendencia</span>
          <strong>{TREND_LABEL[report.trend]}</strong>
        </div>
      </section>

      {report.visits.length === 0 ? (
        <p className="ds-report-empty">
          Esta parcela no tiene visitas registradas.
        </p>
      ) : (
        <table className="ds-report-table">
          <caption>
            Últimas visitas, de la más reciente a la más antigua
          </caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Estado</th>
              <th scope="col">Evaluadas</th>
              <th scope="col">Con síntomas</th>
              <th scope="col">Incidencia</th>
            </tr>
          </thead>
          <tbody>
            {report.visits.map((visit) => (
              <tr key={visit.id}>
                <td>{formatShortDate(visit.observedAt)}</td>
                <td>{visit.status === 'reviewed' ? 'Revisada' : 'Enviada'}</td>
                <td>{visit.plantsObserved ?? '—'}</td>
                <td>{visit.plantsAffected ?? '—'}</td>
                <td>
                  {visit.ratio === null
                    ? 'Sin muestreo'
                    : formatPercent(visit.ratio)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {latest && latest.notes !== '' && (
        <section className="ds-report-notes" aria-label="Última observación">
          <h3>Última observación</h3>
          <p>{latest.notes}</p>
        </section>
      )}

      <footer className="ds-report-foot">
        <p>
          Registro de observaciones de campo. Una fotografía o un conteo no
          confirman una enfermedad: el diagnóstico corresponde al técnico
          responsable.
        </p>
        <p>
          Documento generado el {formatShortDate(new Date().toISOString())}{' '}
          desde los registros de la asociación.
        </p>
      </footer>

      <div className="ds-report-actions">
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          onClick={() => window.print()}
        >
          Imprimir o guardar PDF
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--secondary"
          onClick={onClose}
        >
          Volver al mapa
        </button>
      </div>
    </article>
  );
}
