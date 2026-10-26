export type Role = 'technician' | 'coordinator';
// What the technician counted, never what it means: incidence is derived and
// displayed, but the record must not claim a diagnosis.
export type Sampling = { plantsObserved: number; plantsAffected: number };
export type Inspection = {
  id: string;
  parcelId: string;
  authorId: string;
  notes: string;
  biosecurity: boolean;
  photoIds: string[];
  sampling: Sampling | null;
  status: 'draft' | 'submitted' | 'reviewed';
  version: number;
  observedAt: string;
};

export function incidence(sampling: Sampling | null): number | null {
  if (!sampling) return null;
  return sampling.plantsAffected / sampling.plantsObserved;
}

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 422,
  ) {
    super(code);
  }
}
function checkVersion(actual: number, expected: number) {
  if (actual !== expected) throw new DomainError('VERSION_CONFLICT', 409);
}
// The counts must describe one visit to one parcel: whole plants, a bounded
// sample, and never more affected plants than observed ones.
function checkSampling(sampling: Sampling | null): void {
  if (!sampling) return;
  const { plantsObserved, plantsAffected } = sampling;
  if (!Number.isInteger(plantsObserved) || !Number.isInteger(plantsAffected))
    throw new DomainError('INVALID_SAMPLING');
  if (plantsObserved < 1 || plantsObserved > 500)
    throw new DomainError('INVALID_SAMPLING');
  if (plantsAffected < 0 || plantsAffected > plantsObserved)
    throw new DomainError('INVALID_SAMPLING');
}
export function editInspection(
  previous: Inspection | undefined,
  input: Inspection,
  actor: string,
  expectedVersion: number,
): Inspection {
  checkVersion(previous?.version ?? 0, expectedVersion);
  if ((previous?.authorId ?? input.authorId) !== actor)
    throw new DomainError('FORBIDDEN', 403);
  if (previous && previous.status !== 'draft')
    throw new DomainError('IMMUTABLE_EVIDENCE', 409);
  if (
    !input.notes.trim() ||
    input.notes.length > 5000 ||
    !/^\d{4}-\d{2}-\d{2}T/.test(input.observedAt) ||
    !Number.isFinite(Date.parse(input.observedAt)) ||
    input.photoIds.length > 5 ||
    new Set(input.photoIds).size !== input.photoIds.length
  )
    throw new DomainError('INVALID_INSPECTION');
  checkSampling(input.sampling);
  if (
    previous &&
    (input.parcelId !== previous.parcelId || input.id !== previous.id)
  )
    throw new DomainError('IMMUTABLE_IDENTITY', 409);
  return {
    ...input,
    authorId: actor,
    notes: input.notes.trim(),
    sampling: input.sampling ?? null,
    status: 'draft',
    version: expectedVersion + 1,
  };
}
export function submitInspection(
  inspection: Inspection,
  expectedVersion: number,
  confirmedPhotoIds: string[],
): Inspection {
  checkVersion(inspection.version, expectedVersion);
  if (inspection.status !== 'draft')
    throw new DomainError('IMMUTABLE_EVIDENCE', 409);
  if (!inspection.biosecurity) throw new DomainError('BIOSECURITY_REQUIRED');
  if (inspection.photoIds.some((id) => !confirmedPhotoIds.includes(id)))
    throw new DomainError('PHOTOS_PENDING', 409);
  return {
    ...inspection,
    status: 'submitted',
    version: inspection.version + 1,
  };
}
export function reviewInspection(
  inspection: Inspection,
  role: Role,
  expectedVersion: number,
): Inspection {
  if (role !== 'coordinator') throw new DomainError('FORBIDDEN', 403);
  checkVersion(inspection.version, expectedVersion);
  if (inspection.status !== 'submitted')
    throw new DomainError('NOT_SUBMITTED', 409);
  return { ...inspection, status: 'reviewed', version: inspection.version + 1 };
}
export function safeCsvCell(value: string): string {
  const safe =
    /^[\s\u0000-\u001f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value)
      ? `'${value}`
      : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
