-- Structured sampling for one visit: how many plants the technician checked and
-- how many showed symptoms. Both stay null for records created before this
-- column existed, and for visits where nobody counted.
ALTER TABLE inspections ADD COLUMN plants_observed integer;
ALTER TABLE inspections ADD COLUMN plants_affected integer;

ALTER TABLE inspections ADD CONSTRAINT inspections_sampling_check CHECK (
  (plants_observed IS NULL AND plants_affected IS NULL)
  OR (
    plants_observed BETWEEN 1 AND 500
    AND plants_affected BETWEEN 0 AND plants_observed
  )
);
