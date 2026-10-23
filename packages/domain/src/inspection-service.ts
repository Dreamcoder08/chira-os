import {
  DomainError,
  editInspection,
  submitInspection,
  reviewInspection,
  type Inspection,
} from './guardian.ts';
import type { InspectionRepository, Principal } from './ports.ts';

export class InspectionService {
  constructor(
    private readonly repository: InspectionRepository,
    private readonly principal: Principal,
  ) {}
  async edit(input: Inspection, version: number) {
    const next = editInspection(
      await this.repository.find(input.id),
      input,
      this.principal.userId,
      version,
    );
    await this.repository.save(next);
    await this.repository.audit('inspection.saved', input.id);
    return next;
  }
  async submit(id: string, version: number) {
    const previous = await this.repository.find(id);
    if (!previous) throw new DomainError('NOT_FOUND', 404);
    if (previous.authorId !== this.principal.userId)
      throw new DomainError('FORBIDDEN', 403);
    const next = submitInspection(
      previous,
      version,
      await this.repository.confirmedPhotos(id),
    );
    await this.repository.save(next);
    await this.repository.audit('inspection.submitted', id);
    return next;
  }
  async review(id: string, version: number, notes: string, followUp: boolean) {
    const previous = await this.repository.find(id);
    if (!previous) throw new DomainError('NOT_FOUND', 404);
    if (!notes.trim() || notes.length > 5000)
      throw new DomainError('INVALID_REVIEW');
    const next = reviewInspection(previous, this.principal.role, version);
    await this.repository.recordReview(id, notes.trim(), followUp);
    await this.repository.save(next);
    await this.repository.audit('inspection.reviewed', id);
    return next;
  }
}
