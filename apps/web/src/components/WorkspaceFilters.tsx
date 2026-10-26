interface WorkspaceFiltersProps {
  subject: string;
  search: string;
  onSearch: (value: string) => void;
  status?: string;
  onStatus?: (value: string) => void;
}

export function WorkspaceFilters({
  subject,
  search,
  onSearch,
  status,
  onStatus,
}: WorkspaceFiltersProps) {
  return (
    <div className="ds-filters">
      <label>
        Buscar {subject}
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Parcela, productor, cultivo u observación"
        />
      </label>
      {onStatus && (
        <label>
          Estado de inspección
          <select
            value={status}
            onChange={(event) => onStatus(event.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="pending">En este dispositivo</option>
            <option value="submitted">Por revisar</option>
            <option value="reviewed">Revisadas</option>
            <option value="draft">Borradores en servidor</option>
          </select>
        </label>
      )}
      <button
        className="ds-btn ds-btn--secondary"
        disabled={!search && (!status || status === 'all')}
        onClick={() => {
          onSearch('');
          onStatus?.('all');
        }}
      >
        Limpiar filtros
      </button>
    </div>
  );
}
