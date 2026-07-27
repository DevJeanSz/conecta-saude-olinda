CREATE TABLE IF NOT EXISTS exam_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  schedule jsonb DEFAULT '[]'::jsonb,
  max_daily_appointments integer,
  is_global boolean DEFAULT true,
  unit_ids jsonb DEFAULT '[]'::jsonb,
  preparation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
