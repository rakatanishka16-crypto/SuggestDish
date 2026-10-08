-- Source observations only. Never writes Restaurant, Dish or owner tables.
CREATE TABLE IF NOT EXISTS public."SourceAcquisitionObservation" (
  "recordType" text NOT NULL CHECK ("recordType" IN ('businesses','outlets','dishes','dish_signals','social_profiles','sources')),
  "sourceId" text NOT NULL,
  "payloadHash" text NOT NULL CHECK (length("payloadHash")=64),
  "payload" jsonb NOT NULL CHECK (jsonb_typeof("payload")='object'),
  "observedOn" date NOT NULL,
  "importedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("recordType","sourceId","payloadHash")
);
CREATE TABLE IF NOT EXISTS public."SourceAcquisitionImport" (
  "snapshotHash" text PRIMARY KEY,
  "counts" jsonb NOT NULL,
  "completedAt" timestamptz NOT NULL DEFAULT now()
);
