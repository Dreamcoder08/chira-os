import Dexie, { type EntityTable } from 'dexie';
import type {
  Inspection,
  Parcel,
} from '../../../../packages/contracts/src/schemas.ts';
import { ApiError, getParcels, request } from './api.ts';
import { logoutPending } from './logout.ts';

export type Profile = {
  user: { id: string; name: string };
  memberships: { associationId: string; role: 'technician' | 'coordinator' }[];
};
export type Draft = {
  id: string;
  associationId: string;
  parcelId: string;
  authorId: string;
  notes: string;
  biosecurity: boolean;
  observedAt: string;
  photos: { id: string; blob: Blob }[];
  expectedVersion: number;
  saveOperationId: string;
  submitOperationId: string;
  state: 'pending' | 'conflict' | 'blocked';
  error?: string;
};
type LocalParcel = Parcel & { associationId: string };
type LocalInspection = Inspection & { associationId: string };
export const db = new Dexie('chira-guardian') as Dexie & {
  meta: EntityTable<{ key: string; value: Profile }, 'key'>;
  parcels: EntityTable<LocalParcel, 'id'>;
  inspections: EntityTable<LocalInspection, 'id'>;
  drafts: EntityTable<Draft, 'id'>;
};
db.version(1).stores({
  meta: 'key',
  parcels: 'id,associationId',
  inspections: 'id,associationId',
  drafts: 'id,associationId',
});

export async function storeProfile(profile: Profile) {
  const previous = await db.meta.get('profile');
  if (previous && previous.value.user.id !== profile.user.id)
    throw new Error(
      'Cierra la sesión anterior y elimina sus datos antes de cambiar de usuario.',
    );
  await db.meta.put({ key: 'profile', value: profile });
}
export async function prepareOffline(associationId: string) {
  const [parcels, inspections] = await Promise.all([
    getParcels(associationId),
    request<Inspection[]>('/api/v1/inspections', associationId),
  ]);
  await db.transaction('rw', db.parcels, db.inspections, async () => {
    await db.parcels.where('associationId').equals(associationId).delete();
    await db.inspections.where('associationId').equals(associationId).delete();
    await db.parcels.bulkPut(parcels.map((p) => ({ ...p, associationId })));
    await db.inspections.bulkPut(
      inspections.map((i) => ({ ...i, associationId })),
    );
  });
}
let inFlight: Promise<void> | undefined;
export function synchronize(associationId: string): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = sync(associationId).finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}
async function sync(associationId: string) {
  if (logoutPending()) throw new ApiError(401, 'LOGOUT_PENDING');
  const live = await request<Profile>('/api/v1/session');
  const cached = await db.meta.get('profile');
  if (!cached || live.user.id !== cached.value.user.id)
    throw new ApiError(401, 'ACCOUNT_CHANGED');
  for (const draft of await db.drafts
    .where('associationId')
    .equals(associationId)
    .toArray()) {
    if (draft.state !== 'pending') continue;
    if (draft.authorId !== live.user.id)
      throw new ApiError(401, 'ACCOUNT_CHANGED');
    try {
      const saved = await request<Inspection>(
        `/api/v1/inspections/${draft.id}`,
        associationId,
        {
          method: 'PUT',
          body: JSON.stringify({
            operationId: draft.saveOperationId,
            expectedVersion: draft.expectedVersion,
            authorId: draft.authorId,
            parcelId: draft.parcelId,
            notes: draft.notes,
            biosecurity: draft.biosecurity,
            observedAt: draft.observedAt,
            photoIds: draft.photos.map((p) => p.id),
          }),
        },
      );
      for (const photo of draft.photos)
        await request(
          `/api/v1/inspections/${draft.id}/photos/${photo.id}`,
          associationId,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/octet-stream' },
            body: photo.blob,
          },
        );
      const submitted = await request<Inspection>(
        `/api/v1/inspections/${draft.id}/submit`,
        associationId,
        {
          method: 'POST',
          body: JSON.stringify({
            operationId: draft.submitOperationId,
            expectedVersion: saved.version,
          }),
        },
      );
      await db.transaction('rw', db.drafts, db.inspections, async () => {
        await db.inspections.put({ ...submitted, associationId });
        await db.drafts.delete(draft.id);
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        await db.drafts.update(draft.id, {
          state: 'conflict',
          error: error.code,
        });
      else if (
        error instanceof ApiError &&
        [400, 403, 404, 413, 415, 422].includes(error.status)
      )
        await db.drafts.update(draft.id, {
          state: 'blocked',
          error: error.code,
        });
      throw error;
    }
  }
  await prepareOffline(associationId);
}
export async function clearLocalData() {
  if (inFlight) await inFlight.catch(() => {});
  db.close();
  await Dexie.delete('chira-guardian');
}
