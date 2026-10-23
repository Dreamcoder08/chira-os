import type { Inspection, Role } from './guardian.ts';

export type Point = { type: 'Point'; coordinates: [number, number] };
export type Parcel = {
  id: string;
  name: string;
  producerName: string;
  crop: string;
  hectares: number;
  location: Point;
  assignedTo: string;
};
export type Principal = { userId: string; associationId: string; role: Role };
export interface InspectionRepository {
  find(id: string): Promise<Inspection | undefined>;
  save(inspection: Inspection): Promise<void>;
  confirmedPhotos(inspectionId: string): Promise<string[]>;
  recordReview(
    inspectionId: string,
    notes: string,
    followUp: boolean,
  ): Promise<void>;
  audit(action: string, entityId: string): Promise<void>;
}
export interface PhotoStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
}
