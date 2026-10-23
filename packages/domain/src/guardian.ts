export type Role = 'technician' | 'coordinator';
export type Inspection = {
  id: string;
  parcelId: string;
  authorId: string;
  notes: string;
  biosecurity: boolean;
  photoIds: string[];
  status: 'draft' | 'submitted' | 'reviewed';
  version: number;
  observedAt: string;
};

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
  if (
    previous &&
    (input.parcelId !== previous.parcelId || input.id !== previous.id)
  )
    throw new DomainError('IMMUTABLE_IDENTITY', 409);
  return {
    ...input,
    authorId: actor,
    notes: input.notes.trim(),
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
