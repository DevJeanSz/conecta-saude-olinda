CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cep text,
  address text NOT NULL,
  address_number text,
  neighborhood text,
  city text,
  state text,
  phone text NOT NULL,
  attendance_type varchar(20) DEFAULT 'CHEGADA',
  cnes_code text UNIQUE,
  local_override boolean DEFAULT false,
  overridden_fields jsonb DEFAULT '[]'::jsonb,
  operating_hours jsonb,
  secondary_activities text[],
  is_hospital boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  schedule jsonb DEFAULT '[]'::jsonb,
  max_daily_appointments integer,
  is_global boolean DEFAULT true,
  unit_ids jsonb DEFAULT '[]'::jsonb,
  cnes_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  matricula text UNIQUE,
  email text NOT NULL,
  password_hash text,
  role text NOT NULL CHECK (role IN ('ADMIN', 'GENERAL_SUPERVISOR', 'DOCTOR', 'ATTENDANT', 'SOCIAL_WORKER', 'PATIENT')),
  specialty_id uuid REFERENCES specialties(id) ON DELETE SET NULL,
  crm text,
  unit_id uuid REFERENCES units(id) ON DELETE RESTRICT,
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_daily_patients integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_units (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, unit_id)
);

CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text NOT NULL,
  rg text,
  sus_number text,
  gender text,
  cep text,
  address text,
  address_number text,
  neighborhood text,
  city text,
  state text,
  phone text NOT NULL,
  birth_date date NOT NULL,
  email text,
  mother_name text,
  observations text,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  date date NOT NULL,
  time text NOT NULL,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  notes text,
  ai_summary text,
  queue_password varchar(50),
  check_in_time timestamptz,
  called_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_unit_role ON users(unit_id, role);
CREATE INDEX IF NOT EXISTS idx_patients_unit ON patients(unit_id);
CREATE INDEX IF NOT EXISTS idx_appointments_unit_date ON appointments(unit_id, date);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
