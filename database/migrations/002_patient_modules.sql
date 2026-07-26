CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  type text NOT NULL,
  request_code text,
  date date NOT NULL,
  time text NOT NULL,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'AVAILABLE', 'CANCELLED')),
  preparation text,
  result_available boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  date date NOT NULL,
  service text NOT NULL,
  summary text NOT NULL,
  professional_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminder_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  channels jsonb NOT NULL DEFAULT '{"sms":true,"email":true,"whatsapp":false}'::jsonb,
  lead_time_hours integer NOT NULL DEFAULT 24,
  quiet_hours boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exams_patient ON exams(patient_id, date);
CREATE INDEX IF NOT EXISTS idx_care_events_patient ON care_events(patient_id, date);
