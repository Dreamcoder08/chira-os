import { Type, type Static } from '@sinclair/typebox';

export const Id = Type.String({ format: 'uuid' });
export const ParcelSchema = Type.Object(
  {
    id: Id,
    name: Type.String({ minLength: 1, maxLength: 100 }),
    producerName: Type.String({ minLength: 1, maxLength: 100 }),
    crop: Type.String({ minLength: 1, maxLength: 100 }),
    hectares: Type.Number({ exclusiveMinimum: 0, maximum: 10000 }),
    location: Type.Object({
      type: Type.Literal('Point'),
      coordinates: Type.Tuple([
        Type.Number({ minimum: -180, maximum: 180 }),
        Type.Number({ minimum: -90, maximum: 90 }),
      ]),
    }),
    assignedTo: Type.String(),
  },
  { additionalProperties: false },
);
export const CreateParcelSchema = Type.Omit(ParcelSchema, ['id', 'assignedTo']);
export const SamplingSchema = Type.Object(
  {
    plantsObserved: Type.Integer({ minimum: 1, maximum: 500 }),
    plantsAffected: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export const InspectionSchema = Type.Object(
  {
    id: Id,
    parcelId: Id,
    authorId: Type.String(),
    notes: Type.String({ minLength: 1, maxLength: 5000 }),
    biosecurity: Type.Boolean(),
    photoIds: Type.Array(Id, { maxItems: 5, uniqueItems: true }),
    sampling: Type.Optional(Type.Union([SamplingSchema, Type.Null()])),
    status: Type.Union([
      Type.Literal('draft'),
      Type.Literal('submitted'),
      Type.Literal('reviewed'),
    ]),
    version: Type.Integer({ minimum: 1 }),
    observedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export const OperationSchema = Type.Object(
  { operationId: Id, expectedVersion: Type.Integer({ minimum: 0 }) },
  { additionalProperties: false },
);
export const EditInspectionSchema = Type.Composite(
  [
    Type.Omit(InspectionSchema, ['id', 'status', 'version']),
    Type.Pick(OperationSchema, ['operationId', 'expectedVersion']),
  ],
  { additionalProperties: false },
);
export const ReviewSchema = Type.Object(
  {
    operationId: Id,
    expectedVersion: Type.Integer({ minimum: 1 }),
    notes: Type.String({ minLength: 1, maxLength: 5000 }),
    followUp: Type.Boolean(),
  },
  { additionalProperties: false },
);
export const IdParams = Type.Object({ id: Id });
export const PhotoParams = Type.Object({ id: Id, photoId: Id });
export type Parcel = Static<typeof ParcelSchema>;
export type Inspection = Static<typeof InspectionSchema>;
export type EditInspectionInput = Static<typeof EditInspectionSchema>;
export type ReviewInput = Static<typeof ReviewSchema>;
export type OperationInput = Static<typeof OperationSchema>;
export type CreateParcelInput = Static<typeof CreateParcelSchema>;
