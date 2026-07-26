import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import fs, { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import cron from 'node-cron';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as ftp from 'basic-ftp';
import unzipper from 'unzipper';
import csv from 'csv-parser';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const { Pool } = pg;

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDir, '..');
const distDir = join(projectRoot, 'dist');
const indexFile = join(distDir, 'index.html');
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let currentSyncState = null;

const setSyncProgress = (data) => {
  currentSyncState = data;
  io.emit('sync_progress', data);
  if (data.progress >= 100 || data.error) {
    setTimeout(() => {
      currentSyncState = null;
    }, 5000);
  }
};

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    if (userId) socket.join(userId);
  });
  
  socket.on('get_sync_status', () => {
    if (currentSyncState) {
      socket.emit('sync_progress', currentSyncState);
    }
  });
});
const port = Number.parseInt(process.env.PORT || '4173', 10);
const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT precisa ser um numero entre 1 e 65535.');
  process.exit(1);
}

if (!existsSync(indexFile)) {
  console.error('A pasta dist nao foi encontrada. Execute npm run build antes de npm start.');
  process.exit(1);
}

if (!databaseUrl) {
  console.error('DATABASE_URL nao configurada.');
  process.exit(1);
}

if (!jwtSecret || jwtSecret.length < 32) {
  console.error('JWT_SECRET precisa ter no minimo 32 caracteres.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

app.use(cors({ origin: '*' }));
app.disable('x-powered-by');
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '256kb' }));

const sanitizeText = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const SYSTEM_ROLES = ['ADMIN', 'GENERAL_SUPERVISOR', 'DOCTOR', 'ATTENDANT', 'SOCIAL_WORKER', 'PATIENT'];
const MANAGEMENT_ROLES = ['ADMIN', 'GENERAL_SUPERVISOR'];
const normalizeRole = role => SYSTEM_ROLES.includes(role) ? role : null;
const requireText = (value, field, max = 255) => {
  const text = sanitizeText(value);
  if (!text || text.length > max) {
    const error = new Error(`${field} invalido.`);
    error.status = 400;
    throw error;
  }
  return text;
};

const mapUnit = row => ({
  id: row.id,
  name: row.name,
  cep: row.cep ?? undefined,
  address: row.address,
  addressNumber: row.address_number ?? undefined,
  neighborhood: row.neighborhood ?? undefined,
  city: row.city ?? undefined,
  state: row.state ?? undefined,
  phone: row.phone,
  attendanceType: row.attendance_type ?? 'CHEGADA',
  cnesCode: row.cnes_code ?? undefined,
  localOverride: row.local_override ?? false,
  overriddenFields: row.overridden_fields ?? [],
  operatingHours: row.operating_hours ?? undefined,
  secondaryActivities: row.secondary_activities ?? undefined,
  services: row.services ?? undefined,
  isHospital: row.is_hospital ?? false
});

const mapUser = row => ({
  id: row.id,
  name: row.name,
  matricula: row.matricula ?? undefined,
  email: row.email,
  role: row.role,
  specialtyId: row.specialty_id ?? undefined,
  crm: row.crm ?? undefined,
  unitId: row.unit_id,
  unitIds: row.unit_ids ? (typeof row.unit_ids === 'string' ? row.unit_ids.split(',') : row.unit_ids) : (row.unit_id ? [row.unit_id] : []),
  schedule: row.schedule ?? [],
  maxDailyPatients: row.max_daily_patients ?? undefined,
  cep: row.cep ?? undefined,
  address: row.address ?? undefined,
  addressNumber: row.address_number ?? undefined,
  neighborhood: row.neighborhood ?? undefined,
  city: row.city ?? undefined,
  state: row.state ?? undefined,
  cnesId: row.cnes_id ?? undefined,
  localOverride: row.local_override ?? false,
  overriddenFields: row.overridden_fields ?? []
});

const mapPatient = row => ({
  id: row.id,
  name: row.name,
  cpf: row.cpf,
  rg: row.rg ?? undefined,
  gender: row.gender ?? undefined,
  motherName: row.mother_name ?? undefined,
  observations: row.observations ?? undefined,
  susNumber: row.sus_number ?? undefined,
  cep: row.cep ?? undefined,
  address: row.address ?? undefined,
  addressNumber: row.address_number ?? undefined,
  neighborhood: row.neighborhood ?? undefined,
  city: row.city ?? undefined,
  state: row.state ?? undefined,
  phone: row.phone,
  birthDate: row.birth_date,
  email: row.email ?? undefined,
  unitId: row.unit_id,
  unitIds: row.unit_ids ? (typeof row.unit_ids === 'string' ? row.unit_ids.split(',') : row.unit_ids) : (row.unit_id ? [row.unit_id] : []),
  userId: row.user_id ?? undefined
});

const mapSpecialty = row => ({
  id: row.id,
  name: row.name,
  schedule: row.schedule ?? [],
  maxDailyAppointments: row.max_daily_appointments ?? undefined,
  isGlobal: row.is_global ?? true,
  unitIds: row.unit_ids ? (typeof row.unit_ids === 'string' ? JSON.parse(row.unit_ids) : row.unit_ids) : []
});
const mapNotification = row => ({
  id: row.id,
  userId: row.user_id,
  message: row.message,
  read: row.read,
  createdAt: row.created_at
});
const mapAppointment = row => ({
  id: row.id,
  patientId: row.patient_id,
  doctorId: row.doctor_id,
  unitId: row.unit_id,
  date: row.date,
  time: row.time,
  status: row.status,
  notes: row.notes ?? undefined,
  aiSummary: row.ai_summary ?? undefined,
  queuePassword: row.queue_password ?? undefined,
  checkInTime: row.check_in_time ?? undefined,
  calledAt: row.called_at ?? undefined
});

const signToken = user => jwt.sign(
  { sub: user.id, role: user.role, unitId: user.unitId, unitIds: user.unitIds },
  jwtSecret,
  { expiresIn: '8h' }
);

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) return res.status(401).json({ error: 'Autenticacao obrigatoria.' });

  try {
    const payload = jwt.verify(token, jwtSecret);
    const { rows } = await pool.query(`
      SELECT u.*, 
        (SELECT string_agg(unit_id::text, ',') FROM user_units WHERE user_id = u.id) as unit_ids
      FROM users u WHERE u.id = $1 AND u.active = true
    `, [payload.sub]);
    if (!rows[0]) return res.status(401).json({ error: 'Sessao invalida.' });
    req.user = mapUser(rows[0]);
    return next();
  } catch {
    return res.status(401).json({ error: 'Sessao expirada ou invalida.' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Acesso negado.' });
  }
  return next();
};

const canManageAllUnits = req => MANAGEMENT_ROLES.includes(req.user.role);
const canAccessUnit = (req, unitId) => canManageAllUnits(req) || req.user.unitId === unitId || (req.user.unitIds && req.user.unitIds.includes(unitId));

const audit = async (req, action, entityType, entityId, details = {}) => {
  if (!req.user) return;
  await pool.query(
    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
    [req.user.id, action, entityType, entityId, JSON.stringify(details)]
  );
};

const ensureSchemaAndSeed = async () => {
  await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS units (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      address text NOT NULL,
      phone text NOT NULL,
      is_hospital boolean DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS specialties (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE,
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

    CREATE TABLE IF NOT EXISTS patients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      cpf text NOT NULL,
      sus_number text,
      address text,
      neighborhood text,
      phone text NOT NULL,
      birth_date date NOT NULL,
      email text,
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

    CREATE TABLE IF NOT EXISTS user_units (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, unit_id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_unit_role ON users(unit_id, role);
    CREATE INDEX IF NOT EXISTS idx_patients_unit ON patients(unit_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_unit_date ON appointments(unit_id, date);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

    CREATE TABLE IF NOT EXISTS health_unit_services (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      cnes_code text,
      name text NOT NULL,
      classification text,
      atende_sus boolean DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS health_unit_equipments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      cnes_code text,
      type text NOT NULL,
      quantity integer NOT NULL DEFAULT 0,
      status text,
      in_use_sus boolean DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS health_unit_beds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      cnes_code text,
      type text NOT NULL,
      total_quantity integer NOT NULL DEFAULT 0,
      sus_quantity integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS health_unit_teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      ine_code text,
      cnes_code text,
      type text NOT NULL,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  
  try {
    await pool.query('ALTER TABLE users ALTER COLUMN unit_id DROP NOT NULL');
  } catch (e) {
  }

  try {
    await pool.query(`
      INSERT INTO user_units (user_id, unit_id)
      SELECT id, unit_id FROM users WHERE unit_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
  } catch (e) {
  }

  const newColumnsQueries = [
    'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;',
    "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'GENERAL_SUPERVISOR', 'DOCTOR', 'ATTENDANT', 'SOCIAL_WORKER', 'PATIENT'));",
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS is_hospital boolean DEFAULT false;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS cep text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS address_number text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS neighborhood text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS city text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS state text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS cep text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS address text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS address_number text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS neighborhood text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS state text;',
    'ALTER TABLE patients ADD COLUMN IF NOT EXISTS cep text;',
    'ALTER TABLE patients ADD COLUMN IF NOT EXISTS address_number text;',
    'ALTER TABLE patients ADD COLUMN IF NOT EXISTS city text;',
    'ALTER TABLE patients ADD COLUMN IF NOT EXISTS state text;',
    'ALTER TABLE patients ADD COLUMN IF NOT EXISTS rg text;',
    'ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender text;',
    'ALTER TABLE patients ADD COLUMN IF NOT EXISTS mother_name text;',
    'ALTER TABLE patients ADD COLUMN IF NOT EXISTS observations text;',
    'ALTER TABLE specialties ADD COLUMN IF NOT EXISTS schedule jsonb DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE specialties ADD COLUMN IF NOT EXISTS max_daily_appointments integer;',
    'ALTER TABLE specialties ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT true;',
    'ALTER TABLE specialties ADD COLUMN IF NOT EXISTS unit_ids jsonb DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS attendance_type varchar(20) DEFAULT \'CHEGADA\';',
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS queue_password varchar(50);',
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_time timestamptz;',
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS called_at timestamptz;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS cnes_code text UNIQUE;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS razao_social text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS tipo_unidade text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS esfera_administrativa text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS natureza_juridica text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS atende_sus boolean DEFAULT true;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS fluxo_atendimento text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS situacao text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS ultima_atualizacao text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS ibge_code text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS latitude text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS longitude text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS cnes_id text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS conselho_tipo text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS registro_conselho text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS cbo_codigo text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS cbo_descricao text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS carga_horaria integer;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS vinculo_tipo text;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS situacao_vinculo text;',
    'ALTER TABLE specialties ADD COLUMN IF NOT EXISTS cnes_code text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS local_override boolean DEFAULT false;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS overridden_fields jsonb DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS operating_hours jsonb;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS secondary_activities text[];',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS local_override boolean DEFAULT false;',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS overridden_fields jsonb DEFAULT \'[]\'::jsonb;'
  ];

  for (const query of newColumnsQueries) {
    try {
      await pool.query(query);
    } catch (e) {
    }
  }

  if (process.env.INITIAL_ADMIN_PASSWORD) {
    try {
      const adminMatricula = process.env.INITIAL_ADMIN_MATRICULA || 'ADMIN001';
      const passwordHash = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 12);
      
      let defaultUnitId = null;
      const { rows: unitRows } = await pool.query('SELECT id FROM units ORDER BY created_at ASC LIMIT 1');
      if (unitRows.length > 0) {
        defaultUnitId = unitRows[0].id;
      } else {
        const unit = await pool.query(
          'INSERT INTO units (name, address, phone) VALUES ($1, $2, $3) RETURNING id',
          ['Secretaria de Saúde', 'Não informado', '0000000000']
        );
        defaultUnitId = unit.rows[0].id;
      }

      await pool.query(`
        INSERT INTO users (name, matricula, email, password_hash, role, unit_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (matricula) DO UPDATE 
        SET password_hash = EXCLUDED.password_hash, role = 'ADMIN'
      `, ['Administrador Geral', adminMatricula, 'admin@olinda.pe.gov.br', passwordHash, 'ADMIN', defaultUnitId]);

    } catch (err) {
      console.error('[Erro] Falha ao criar admin via env:', err.message);
    }
  }

  const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM users');
  if (rows[0].total > 0) return;

  const patientPasswordHash = await bcrypt.hash('Paciente@12345', 12);

  await pool.query('BEGIN');
  try {
    const unit = await pool.query(
      'INSERT INTO units (name, address, phone) VALUES ($1, $2, $3) RETURNING id',
      ['Secretaria Municipal de Saude', 'Olinda - PE', '(81) 0000-0000']
    );
    const unitId = unit.rows[0].id;

    const patientUser = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, unit_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      ['Carlos Paciente', 'paciente@exemplo.local', patientPasswordHash, 'PATIENT', unitId]
    );

    await pool.query(
      `INSERT INTO patients (name, cpf, sus_number, phone, birth_date, unit_id, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['Carlos Paciente', '000.000.000-00', '700000000000000', '(81) 99999-0000', '1985-05-15', unitId, patientUser.rows[0].id]
    );

    const specialties = ['Clinica Geral', 'Pediatria', 'Cardiologia', 'Odontologia'];
    for (const name of specialties) {
      await pool.query('INSERT INTO specialties (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    }

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const matricula = requireText(req.body.matricula, 'matricula', 80).toUpperCase();
    const password = requireText(req.body.password, 'senha', 200);

    const { rows } = await pool.query(
      `SELECT u.*, 
        (SELECT string_agg(unit_id::text, ',') FROM user_units WHERE user_id = u.id) as unit_ids
       FROM users u
       WHERE upper(u.matricula) = $1 AND u.role <> 'PATIENT' AND u.active = true`,
      [matricula]
    );

    const row = rows[0];
    if (!row || !row.password_hash || !(await bcrypt.compare(password, row.password_hash))) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }

    const user = mapUser(row);
    
    let defaultUnit = { id: '', name: '', address: '', phone: '' };
    if (user.unitIds && user.unitIds.length > 0) {
      const unitResult = await pool.query('SELECT * FROM units WHERE id = $1', [user.unitIds[0]]);
      if (unitResult.rows[0]) {
        defaultUnit = mapUnit(unitResult.rows[0]);
      }
    }

    return res.json({
      token: signToken(user),
      user,
      unit: defaultUnit
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/login-patient', async (req, res, next) => {
  try {
    const name = requireText(req.body.name, 'nome', 180).toLowerCase();
    const susNumber = requireText(req.body.susNumber, 'cartao SUS', 30);

    const patientResult = await pool.query(
      `SELECT p.*, un.name AS unit_name, un.address AS unit_address, un.phone AS unit_phone
       FROM patients p
       JOIN units un ON un.id = p.unit_id
       WHERE lower(p.name) = $1 AND p.sus_number = $2`,
      [name, susNumber]
    );

    const patient = patientResult.rows[0];
    if (!patient) return res.status(401).json({ error: 'Paciente nao encontrado.' });

    let userId = patient.user_id;
    if (!userId) {
      const createdUser = await pool.query(
        'INSERT INTO users (name, email, role, unit_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [patient.name, patient.email || `paciente-${patient.id}@local`, 'PATIENT', patient.unit_id]
      );
      userId = createdUser.rows[0].id;
      await pool.query('UPDATE patients SET user_id = $1 WHERE id = $2', [userId, patient.id]);
    }

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1 AND active = true', [userId]);
    const userRow = userResult.rows[0];
    if (!userRow) return res.status(401).json({ error: 'Paciente inativo.' });

    const user = mapUser(userRow);
    return res.json({
      token: signToken(user),
      user,
      unit: mapUnit({ id: patient.unit_id, name: patient.unit_name, address: patient.unit_address, phone: patient.unit_phone })
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/register-patient', async (req, res, next) => {
  try {
    const name = requireText(req.body.name, 'nome', 180);
    const cpf = requireText(req.body.cpf, 'cpf', 20);
    const susNumber = requireText(req.body.susNumber, 'cartao SUS', 30);
    const phone = requireText(req.body.phone, 'telefone', 40);
    const birthDate = requireText(req.body.birthDate, 'data de nascimento', 20);
    const unitId = requireText(req.body.unitId, 'unidade', 50);
    
    const email = req.body.email ? sanitizeText(req.body.email) : null;
    let address = req.body.address ? sanitizeText(req.body.address) : '';
    if (req.body.cep) address += ` - CEP: ${sanitizeText(req.body.cep)}`;
    if (req.body.rg) address += ` - RG: ${sanitizeText(req.body.rg)}`;
    
    address = address ? address.substring(0, 255) : null;

    const existing = await pool.query('SELECT id FROM patients WHERE cpf = $1 OR sus_number = $2', [cpf, susNumber]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Paciente com este CPF ou cartao SUS ja cadastrado.' });
    }

    const unitResult = await pool.query('SELECT * FROM units WHERE id = $1', [unitId]);
    if (!unitResult.rows[0]) {
      return res.status(404).json({ error: 'Unidade nao encontrada.' });
    }
    const unit = mapUnit(unitResult.rows[0]);

    await pool.query('BEGIN');
    
    const createdUser = await pool.query(
      'INSERT INTO users (name, email, role, unit_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email || `paciente-${Date.now()}@local`, 'PATIENT', unitId]
    );
    const userId = createdUser.rows[0].id;

    await pool.query(
      `INSERT INTO patients (name, cpf, sus_number, phone, birth_date, email, address, unit_id, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [name, cpf, susNumber, phone, birthDate, email, address, unitId, userId]
    );

    await pool.query('COMMIT');

    const userRow = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = mapUser(userRow.rows[0]);

    return res.json({
      token: signToken(user),
      user,
      unit
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    return next(error);
  }
});

app.get('/api/units', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM units ORDER BY name');
    res.json(rows.map(mapUnit));
  } catch (error) {
    next(error);
  }
});

app.get('/api/units/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM units WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Unidade nao encontrada.' });
    if (!canAccessUnit(req, rows[0].id)) return res.status(403).json({ error: 'Acesso negado.' });
    
    const servicesRes = await pool.query('SELECT * FROM health_unit_services WHERE unit_id = $1 ORDER BY name', [req.params.id]);
    const unitData = rows[0];
    unitData.services = servicesRes.rows.map(s => ({
       id: s.id,
       unitId: s.unit_id,
       cnesCode: s.cnes_code,
       name: s.name,
       classification: s.classification,
       atendeSus: s.atende_sus
    }));
    
    return res.json(mapUnit(unitData));
  } catch (error) {
    return next(error);
  }
});

app.post('/api/units', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const name = requireText(req.body.name, 'nome');
    const address = requireText(req.body.address, 'endereco');
    const phone = requireText(req.body.phone, 'telefone', 40);
    const cep = req.body.cep || null;
    const addressNumber = req.body.addressNumber || null;
    const neighborhood = req.body.neighborhood || null;
    const city = req.body.city || null;
    const state = req.body.state || null;
    const attendanceType = req.body.attendanceType || 'CHEGADA';
    const isHospital = req.body.isHospital || false;
    const { rows } = await pool.query(
      'INSERT INTO units (name, address, phone, cep, address_number, neighborhood, city, state, attendance_type, is_hospital) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [name, address, phone, cep, addressNumber, neighborhood, city, state, attendanceType, isHospital]
    );
    await audit(req, 'CREATE', 'unit', rows[0].id);
    res.status(201).json(mapUnit(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/units/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const name = requireText(req.body.name, 'nome');
    const address = requireText(req.body.address, 'endereco');
    const phone = requireText(req.body.phone, 'telefone', 40);
    const cep = req.body.cep || null;
    const addressNumber = req.body.addressNumber || null;
    const neighborhood = req.body.neighborhood || null;
    const city = req.body.city || null;
    const state = req.body.state || null;
    const attendanceType = req.body.attendanceType || 'CHEGADA';
    const isHospital = req.body.isHospital !== undefined ? req.body.isHospital : false;
    const current = await pool.query('SELECT * FROM units WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Unidade nao encontrada.' });
    
    const row = current.rows[0];
    const localOverride = row.cnes_code ? true : row.local_override;

    const { rows } = await pool.query(
      'UPDATE units SET name = $1, address = $2, phone = $3, cep = $4, address_number = $5, neighborhood = $6, city = $7, state = $8, attendance_type = $9, local_override = $10, is_hospital = $11 WHERE id = $12 RETURNING *',
      [name, address, phone, cep, addressNumber, neighborhood, city, state, attendanceType, localOverride, isHospital, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Unidade nao encontrada.' });
    await audit(req, 'UPDATE', 'unit', req.params.id);
    return res.json(mapUnit(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/units/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM units WHERE id = $1', [req.params.id]);
    await audit(req, 'DELETE', 'unit', req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/units/:id/restore-cnes', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('UPDATE units SET local_override = false, overridden_fields = \'[]\'::jsonb WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Unidade nao encontrada.' });
    await audit(req, 'UPDATE', 'unit', req.params.id, { action: 'RESTORE_CNES' });
    return res.json(mapUnit(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.get('/api/specialties', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM specialties ORDER BY name');
    res.json(rows.map(mapSpecialty));
  } catch (error) {
    next(error);
  }
});

app.post('/api/specialties', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const name = requireText(req.body.name, 'especialidade');
    const schedule = req.body.schedule ? JSON.stringify(req.body.schedule) : '[]';
    const maxDailyAppointments = req.body.maxDailyAppointments || null;
    const isGlobal = req.body.isGlobal ?? true;
    const unitIds = req.body.unitIds ? JSON.stringify(req.body.unitIds) : '[]';
    
    const { rows } = await pool.query(
      'INSERT INTO specialties (name, schedule, max_daily_appointments, is_global, unit_ids) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, schedule, maxDailyAppointments, isGlobal, unitIds]
    );
    await audit(req, 'CREATE', 'specialty', rows[0].id);
    res.status(201).json(mapSpecialty(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/specialties/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const name = requireText(req.body.name, 'especialidade');
    const schedule = req.body.schedule ? JSON.stringify(req.body.schedule) : '[]';
    const maxDailyAppointments = req.body.maxDailyAppointments || null;
    const isGlobal = req.body.isGlobal ?? true;
    const unitIds = req.body.unitIds ? JSON.stringify(req.body.unitIds) : '[]';
    
    const { rows } = await pool.query(
      'UPDATE specialties SET name = $1, schedule = $2, max_daily_appointments = $3, is_global = $4, unit_ids = $5 WHERE id = $6 RETURNING *',
      [name, schedule, maxDailyAppointments, isGlobal, unitIds, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Especialidade nao encontrada.' });
    await audit(req, 'UPDATE', 'specialty', req.params.id);
    return res.json(mapSpecialty(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/specialties/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM specialties WHERE id = $1', [req.params.id]);
    await audit(req, 'DELETE', 'specialty', req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/users', authenticate, async (req, res, next) => {
  try {
    const unitId = req.query.unitId ? String(req.query.unitId) : null;
    const role = req.query.role ? String(req.query.role) : null;
    const params = [];
    const where = ['active = true'];

    if (req.user.role === 'PATIENT') {
      // Patients can only see doctors
      if (role && role !== 'DOCTOR') {
        return res.status(403).json({ error: 'Acesso negado.' });
      }
      params.push('DOCTOR');
      where.push(`role = $${params.length}`);
    } else if (!canManageAllUnits(req)) {
      params.push(req.user.unitId);
      where.push(`unit_id = $${params.length}`);
    } else if (unitId) {
      params.push(unitId);
      where.push(`unit_id = $${params.length}`);
    }

    if (role) {
      params.push(role);
      where.push(`role = $${params.length}`);
    }

    const { rows } = await pool.query(`
      SELECT u.*, 
        (SELECT string_agg(unit_id::text, ',') FROM user_units WHERE user_id = u.id) as unit_ids
      FROM users u 
      WHERE ${where.join(' AND ')} 
      ORDER BY name
    `, params);
    res.json(rows.map(mapUser));
  } catch (error) {
    next(error);
  }
});

app.post('/api/users', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const role = normalizeRole(req.body.role);
    if (!role || role === 'PATIENT') return res.status(400).json({ error: 'Tipo de usuario invalido.' });

    const name = requireText(req.body.name, 'nome');
    const matricula = requireText(req.body.matricula, 'matricula', 80).toUpperCase();
    const email = requireText(req.body.email, 'email');
    const password = requireText(req.body.password, 'senha', 200);
    const unitId = req.body.unitIds && req.body.unitIds.length > 0 ? req.body.unitIds[0] : (req.body.unitId || null);
    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (name, matricula, email, password_hash, role, specialty_id, crm, unit_id, schedule, max_daily_patients, cep, address, address_number, neighborhood, city, state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        name,
        matricula,
        email,
        passwordHash,
        role,
        req.body.specialtyId || null,
        req.body.crm || null,
        unitId,
        JSON.stringify(req.body.schedule || []),
        req.body.maxDailyPatients || null,
        req.body.cep || null,
        req.body.address || null,
        req.body.addressNumber || null,
        req.body.neighborhood || null,
        req.body.city || null,
        req.body.state || null
      ]
    );
    
    const newUserId = rows[0].id;
    if (req.body.unitIds && Array.isArray(req.body.unitIds)) {
      for (const uid of req.body.unitIds) {
        await pool.query('INSERT INTO user_units (user_id, unit_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newUserId, uid]);
      }
    } else if (unitId) {
      await pool.query('INSERT INTO user_units (user_id, unit_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newUserId, unitId]);
    }
    
    const newUserResult = await pool.query(`
      SELECT u.*, (SELECT string_agg(unit_id::text, ',') FROM user_units WHERE user_id = u.id) as unit_ids
      FROM users u WHERE u.id = $1
    `, [newUserId]);

    await audit(req, 'CREATE', 'user', newUserId, { role });
    res.status(201).json(mapUser(newUserResult.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.put('/api/users/profile', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const current = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Usuario nao encontrado.' });
    
    const row = current.rows[0];
    const passwordHash = req.body.password ? await bcrypt.hash(requireText(req.body.password, 'senha', 200), 12) : row.password_hash;
    const name = req.body.name ? requireText(req.body.name, 'nome') : row.name;
    const email = req.body.email ? requireText(req.body.email, 'email') : row.email;
    const unitId = req.body.unitId || row.unit_id; // For patients to update their unit
    
    const { rows } = await pool.query(
      `UPDATE users
       SET name=$1, email=$2, password_hash=$3, unit_id=$4
       WHERE id=$5 RETURNING *`,
      [name, email, passwordHash, unitId, userId]
    );
    
    // Also update patient record if this user is a patient
    if (row.role === 'PATIENT') {
       await pool.query(
         `UPDATE patients SET name=$1, email=$2, unit_id=$3 WHERE user_id=$4`,
         [name, email, unitId, userId]
       );
    }
    
    const updatedResult = await pool.query(`
      SELECT u.*, (SELECT string_agg(unit_id::text, ',') FROM user_units WHERE user_id = u.id) as unit_ids
      FROM users u WHERE u.id = $1
    `, [userId]);
    
    await audit(req, 'UPDATE', 'user_profile', userId, {});
    res.json(mapUser(updatedResult.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/users/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Usuario nao encontrado.' });

    const row = current.rows[0];
    const passwordHash = req.body.password ? await bcrypt.hash(requireText(req.body.password, 'senha', 200), 12) : row.password_hash;
    const role = normalizeRole(req.body.role || row.role);

    const unitId = req.body.unitIds && req.body.unitIds.length > 0 ? req.body.unitIds[0] : (req.body.unitId ?? row.unit_id);

    const localOverride = row.cnes_id ? true : row.local_override;

    const { rows } = await pool.query(
      `UPDATE users
       SET name=$1, matricula=$2, email=$3, password_hash=$4, role=$5, specialty_id=$6, crm=$7, unit_id=$8, schedule=$9, max_daily_patients=$10, cep=$11, address=$12, address_number=$13, neighborhood=$14, city=$15, state=$16, local_override=$17
       WHERE id=$18 RETURNING *`,
      [
        requireText(req.body.name ?? row.name, 'nome'),
        req.body.matricula ? sanitizeText(req.body.matricula).toUpperCase() : row.matricula,
        requireText(req.body.email ?? row.email, 'email'),
        passwordHash,
        role,
        req.body.specialtyId ?? row.specialty_id,
        req.body.crm ?? row.crm,
        unitId,
        JSON.stringify(req.body.schedule ?? row.schedule ?? []),
        req.body.maxDailyPatients ?? row.max_daily_patients,
        req.body.cep ?? row.cep,
        req.body.address ?? row.address,
        req.body.addressNumber ?? row.address_number,
        req.body.neighborhood ?? row.neighborhood,
        req.body.city ?? row.city,
        req.body.state ?? row.state,
        localOverride,
        req.params.id
      ]
    );

    if (req.body.unitIds && Array.isArray(req.body.unitIds)) {
      await pool.query('DELETE FROM user_units WHERE user_id = $1', [req.params.id]);
      for (const uid of req.body.unitIds) {
        await pool.query('INSERT INTO user_units (user_id, unit_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, uid]);
      }
    }

    const updatedUserResult = await pool.query(`
      SELECT u.*, (SELECT string_agg(unit_id::text, ',') FROM user_units WHERE user_id = u.id) as unit_ids
      FROM users u WHERE u.id = $1
    `, [req.params.id]);

    await audit(req, req.body.password ? 'RESET_PASSWORD' : 'UPDATE', 'user', req.params.id);
    return res.json(mapUser(updatedUserResult.rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/users/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Nao e permitido excluir o proprio usuario.' });
    await pool.query('UPDATE users SET active = false WHERE id = $1', [req.params.id]);
    await audit(req, 'DELETE', 'user', req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/users/:id/restore-cnes', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('UPDATE users SET local_override = false, overridden_fields = \'[]\'::jsonb WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuario nao encontrado.' });
    await audit(req, 'UPDATE', 'user', req.params.id, { action: 'RESTORE_CNES' });
    return res.json(mapUser(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.get('/api/patients', authenticate, async (req, res, next) => {
  try {
    const params = [];
    const where = [];

    if (req.query.userId) {
      params.push(String(req.query.userId));
      where.push(`user_id = $${params.length}`);
    }

    if (req.query.patientId) {
      params.push(String(req.query.patientId));
      where.push(`id = $${params.length}`);
    }

    if (!canManageAllUnits(req)) {
      params.push(req.user.unitId);
      where.push(`unit_id = $${params.length}`);
    } else if (req.query.unitId) {
      params.push(String(req.query.unitId));
      where.push(`unit_id = $${params.length}`);
    }

    const query = `
      SELECT p.*,
        (SELECT array_agg(uu.unit_id) FROM user_units uu WHERE uu.user_id = p.user_id) as unit_ids
      FROM patients p
      ${where.length ? `WHERE ${where.map(w => w.replace(/(\w+)\s=/, 'p.$1 =')).join(' AND ')}` : ''}
      ORDER BY p.name
    `;
    const { rows } = await pool.query(query, params);
    res.json(rows.map(mapPatient));
  } catch (error) {
    next(error);
  }
});

app.post('/api/patients', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR', 'ATTENDANT', 'SOCIAL_WORKER'), async (req, res, next) => {
  try {
    let unitIds = req.body.unitIds || [];
    let unitId = req.body.unitId;
    if (unitIds.length > 0 && !unitId) unitId = unitIds[0];
    if (unitId && unitIds.length === 0) unitIds = [unitId];
    
    requireText(unitId, 'unidade');
    if (!canAccessUnit(req, unitId)) return res.status(403).json({ error: 'Acesso negado.' });

    const createdUser = await pool.query(
      'INSERT INTO users (name, email, role, unit_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [
        requireText(req.body.name, 'nome'),
        req.body.email || `paciente-${Date.now()}@local`,
        'PATIENT',
        unitId
      ]
    );
    const userId = req.body.userId || createdUser.rows[0].id;

    for (const id of unitIds) {
      await pool.query('INSERT INTO user_units (user_id, unit_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, id]);
    }

    const { rows } = await pool.query(
      `INSERT INTO patients (name, cpf, sus_number, address, neighborhood, phone, birth_date, email, unit_id, user_id, cep, address_number, city, state, rg, gender, mother_name, observations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [
        requireText(req.body.name, 'nome'),
        requireText(req.body.cpf, 'cpf', 20),
        req.body.susNumber || null,
        req.body.address || null,
        req.body.neighborhood || null,
        requireText(req.body.phone, 'telefone', 40),
        requireText(req.body.birthDate, 'data de nascimento', 20),
        req.body.email || null,
        unitId,
        userId,
        req.body.cep || null,
        req.body.addressNumber || null,
        req.body.city || null,
        req.body.state || null,
        req.body.rg || null,
        req.body.gender || null,
        req.body.motherName || null,
        req.body.observations || null
      ]
    );
    rows[0].unit_ids = unitIds.join(',');
    await audit(req, 'CREATE', 'patient', rows[0].id);
    res.status(201).json(mapPatient(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/patients/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR', 'ATTENDANT', 'SOCIAL_WORKER'), async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Paciente nao encontrado.' });
    if (!canAccessUnit(req, current.rows[0].unit_id)) return res.status(403).json({ error: 'Acesso negado.' });

    let unitIds = req.body.unitIds;
    let unitId = req.body.unitId;
    
    if (unitIds && unitIds.length > 0 && !unitId) unitId = unitIds[0];
    if (unitId && (!unitIds || unitIds.length === 0)) unitIds = [unitId];

    const row = current.rows[0];
    const { rows } = await pool.query(
      `UPDATE patients SET name=$1, cpf=$2, sus_number=$3, address=$4, neighborhood=$5, phone=$6, birth_date=$7, email=$8, unit_id=$9, cep=$10, address_number=$11, city=$12, state=$13, rg=$14, gender=$15, mother_name=$16, observations=$17
       WHERE id=$18 RETURNING *`,
      [
        req.body.name ?? row.name,
        req.body.cpf ?? row.cpf,
        req.body.susNumber ?? row.sus_number,
        req.body.address ?? row.address,
        req.body.neighborhood ?? row.neighborhood,
        req.body.phone ?? row.phone,
        req.body.birthDate ?? row.birth_date,
        req.body.email ?? row.email,
        unitId ?? row.unit_id,
        req.body.cep ?? row.cep,
        req.body.addressNumber ?? row.address_number,
        req.body.city ?? row.city,
        req.body.state ?? row.state,
        req.body.rg ?? row.rg,
        req.body.gender ?? row.gender,
        req.body.motherName ?? row.mother_name,
        req.body.observations ?? row.observations,
        req.params.id
      ]
    );

    if (unitIds) {
       await pool.query('DELETE FROM user_units WHERE user_id = $1', [row.user_id]);
       for (const id of unitIds) {
         await pool.query('INSERT INTO user_units (user_id, unit_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [row.user_id, id]);
       }
       rows[0].unit_ids = unitIds.join(',');
    } else {
       // Just fetch what it had
       const existingUnits = await pool.query('SELECT array_agg(unit_id) as unit_ids FROM user_units WHERE user_id = $1', [row.user_id]);
       rows[0].unit_ids = existingUnits.rows[0].unit_ids ? existingUnits.rows[0].unit_ids.join(',') : row.unit_id;
    }

    await audit(req, 'UPDATE', 'patient', req.params.id);
    return res.json(mapPatient(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/patients/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR', 'ATTENDANT', 'SOCIAL_WORKER'), async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Paciente nao encontrado.' });
    if (!canAccessUnit(req, current.rows[0].unit_id)) return res.status(403).json({ error: 'Acesso negado.' });

    await pool.query('DELETE FROM patients WHERE id = $1', [req.params.id]);
    if (current.rows[0].user_id) {
        await pool.query('DELETE FROM users WHERE id = $1', [current.rows[0].user_id]);
    }
    await audit(req, 'DELETE', 'patient', req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/appointments', authenticate, async (req, res, next) => {
  try {
    const params = [];
    const where = [];

    if (!canManageAllUnits(req)) {
      params.push(req.user.unitId);
      where.push(`unit_id = $${params.length}`);
    } else if (req.query.unitId) {
      params.push(String(req.query.unitId));
      where.push(`unit_id = $${params.length}`);
    }

    if (req.query.patientId) {
      params.push(String(req.query.patientId));
      where.push(`patient_id = $${params.length}`);
    }

    const { rows } = await pool.query(`SELECT * FROM appointments ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY date DESC, time`, params);
    res.json(rows.map(mapAppointment));
  } catch (error) {
    next(error);
  }
});

app.post('/api/appointments', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, unit_id, date, time, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.body.patientId, req.body.doctorId, req.body.unitId, req.body.date, req.body.time, req.body.notes || null]
    );
    await audit(req, 'CREATE', 'appointment', rows[0].id);
    res.status(201).json(mapAppointment(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/appointments/:id', authenticate, async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Agendamento nao encontrado.' });
    if (!canAccessUnit(req, current.rows[0].unit_id)) return res.status(403).json({ error: 'Acesso negado.' });

    const row = current.rows[0];
    const { rows } = await pool.query(
      `UPDATE appointments SET date=$1, time=$2, status=$3, notes=$4, ai_summary=$5, queue_password=$6, check_in_time=$7, called_at=$8 WHERE id=$9 RETURNING *`,
      [
        req.body.date ?? row.date, 
        req.body.time ?? row.time, 
        req.body.status ?? row.status, 
        req.body.notes ?? row.notes, 
        req.body.aiSummary ?? row.ai_summary, 
        req.body.queuePassword !== undefined ? req.body.queuePassword : row.queue_password,
        req.body.checkInTime !== undefined ? req.body.checkInTime : row.check_in_time,
        req.body.calledAt !== undefined ? req.body.calledAt : row.called_at,
        req.params.id
      ]
    );
    await audit(req, 'UPDATE', 'appointment', req.params.id);
    return res.json(mapAppointment(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.post('/api/notifications', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'INSERT INTO notifications (user_id, message) VALUES ($1, $2) RETURNING *',
      [req.body.userId, requireText(req.body.message, 'mensagem', 500)]
    );
    const newNotif = mapNotification(rows[0]);
    io.to(req.body.userId).emit('new_notification', newNotif);
    res.status(201).json(newNotif);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/notifications/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query('UPDATE notifications SET read = $1 WHERE id = $2 RETURNING *', [Boolean(req.body.read), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Notificacao nao encontrada.' });
    return res.json(mapNotification(rows[0]));
  } catch (error) {
    return next(error);
  }
});

await ensureSchemaAndSeed();

// CNES Sync Worker
const syncCnes = async () => {
  console.log('[CNES Sync] Iniciando sincronizacao com API de Dados Abertos (Olinda)...');
  setSyncProgress({ progress: 10, message: 'Iniciando busca no CNES...' });
  try {
     // Limpar sujeira de sincronizações anteriores incorretas (ex: SP/RJ)
     await pool.query("DELETE FROM units WHERE cnes_code IS NOT NULL AND city NOT ILIKE '%Olinda%' AND local_override = false");
     setSyncProgress({ progress: 15, message: 'Limpando dados inconsistentes...' });

      const ibgeCode = '260775'; // Olinda (6 digits)
      const response = await fetch(`https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=${ibgeCode}&limit=100`);
     if (response.ok) {
        const data = await response.json();
        const rawEstabelecimentos = data.estabelecimentos || [];
        // Filtra apenas estabelecimentos públicos (Municipais, Estaduais ou Federais)
        // Rejeitando os de esfera 'PRIVADA' ou similar.
        const estabelecimentos = rawEstabelecimentos.filter(est => {
            const esfera = (est.descricao_esfera_administrativa || '').toUpperCase();
            return esfera === 'MUNICIPAL' || esfera === 'ESTADUAL' || esfera === 'FEDERAL';
        });

        setSyncProgress({ progress: 30, message: `Encontrados ${estabelecimentos.length} estabelecimentos públicos. Atualizando...` });
        let processed = 0;
        for (const est of estabelecimentos) {
            await pool.query(`
               INSERT INTO units (
                 name, razao_social, cnes_code, tipo_unidade, esfera_administrativa, natureza_juridica, 
                 address, cep, neighborhood, city, state, address_number, latitude, longitude, phone,
                 atende_sus, fluxo_atendimento, is_hospital
               ) VALUES (
                 $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
               ) ON CONFLICT (cnes_code) DO UPDATE SET
                 name = EXCLUDED.name, razao_social = EXCLUDED.razao_social, tipo_unidade = EXCLUDED.tipo_unidade,
                 esfera_administrativa = EXCLUDED.esfera_administrativa, natureza_juridica = EXCLUDED.natureza_juridica,
                 address = EXCLUDED.address, cep = EXCLUDED.cep, neighborhood = EXCLUDED.neighborhood,
                 city = EXCLUDED.city, state = EXCLUDED.state, address_number = EXCLUDED.address_number,
                 latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, phone = EXCLUDED.phone,
                 atende_sus = EXCLUDED.atende_sus, fluxo_atendimento = EXCLUDED.fluxo_atendimento, is_hospital = EXCLUDED.is_hospital
            `, [
               est.nome_fantasia || est.nome_razao_social || 'Sem Nome', 
               est.nome_razao_social, 
               String(est.codigo_cnes), 
               est.descricao_tipo_unidade || 'Não informado', 
               est.descricao_esfera_administrativa, 
               est.descricao_natureza_juridica_estabelecimento || null,
               est.endereco_estabelecimento || 'Endereço não informado', 
               est.codigo_cep_estabelecimento, 
               est.bairro_estabelecimento, 
               est.descricao_municipio || 'Olinda', // Fallback, a api as vezes não traz 'descricao_municipio' mas sim 'codigo_municipio'
               'PE', 
               est.numero_estabelecimento,
               String(est.latitude_estabelecimento_decimo_grau || ''), 
               String(est.longitude_estabelecimento_decimo_grau || ''), 
               est.numero_telefone_estabelecimento || 'Não informado',
               est.estabelecimento_faz_atendimento_ambulatorial_sus === 'SIM', 
               est.descricao_turno_atendimento || 'Não informado',
               (est.descricao_tipo_unidade || '').toUpperCase().includes('HOSPITAL')
            ]);
            
            processed++;      processed++;
            if (processed % 5 === 0) {
                const perc = Math.floor(30 + (processed / estabelecimentos.length) * 70);
                setSyncProgress({ progress: perc, message: `Atualizando unidades (${processed}/${estabelecimentos.length})...` });
            }
        }
        setSyncProgress({ progress: 100, message: `Concluída sincronização básica de ${estabelecimentos.length} estabelecimentos.` });
        console.log(`[CNES Sync] Concluída sincronização básica de ${estabelecimentos.length} estabelecimentos.`);
     } else {
        setSyncProgress({ progress: 100, error: 'Falha na request para a API do CNES.' });
        console.error('[CNES Sync Error] Falha na request', response.status);
     }
  } catch(err) {
     setSyncProgress({ progress: 100, error: err.message });
     console.error('[CNES Sync Error]', err.message);
  }
};

cron.schedule('0 2 * * *', syncCnes);

app.post('/api/sync/cnes', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    syncCnes(); 
    res.status(200).json({ message: 'Sincronização iniciada' });
  } catch (err) {
    next(err);
  }
});

// CNES Professionals Sync Worker
const syncCnesProfessionals = async () => {
  console.log('[CNES Sync] Iniciando sincronizacao de PROFISSIONAIS via FTP...');
  setSyncProgress({ progress: 5, message: 'Conectando ao FTP do DATASUS...' });
  
    const client = new ftp.Client();
    client.ftp.keepAliveInterval = 10000;
    let tempDir = '';
    try {
      const unitsRes = await pool.query("SELECT id, cnes_code FROM units WHERE cnes_code IS NOT NULL");
      if (unitsRes.rows.length === 0) {
         setSyncProgress({ progress: 100, message: 'Nenhuma unidade com CNES para sincronizar.' });
         return;
      }
      
      const validCnesCodes = new Set(unitsRes.rows.map(u => u.cnes_code));
      const cnesToUnitId = new Map(unitsRes.rows.map(u => [u.cnes_code, u.id]));
  
      await client.access({ host: 'ftp.datasus.gov.br' });
      const list = await client.list('/cnes');
      const zips = list.filter(f => f.name.startsWith('BASE_DE_DADOS_CNES_') && f.name.endsWith('.ZIP'));
      zips.sort((a,b) => b.name.localeCompare(a.name));
      
      if(zips.length === 0) throw new Error("Nenhum arquivo CNES encontrado no FTP.");
      const latestZip = zips[0].name;
      
      const remotePath = `/cnes/${latestZip}`;
      const fileSize = await client.size(remotePath).catch(() => 700000000);
      
      setSyncProgress({ progress: 15, message: `Baixando ${latestZip}... (isso pode demorar uns minutos)` });
      
      tempDir = await mkdtemp(join(tmpdir(), 'cnes-'));
      const zipPath = join(tempDir, 'base.zip');
      
      client.trackProgress(info => {
         const mb = (info.bytes / 1048576).toFixed(1);
         const currProgress = Math.min(35, 15 + Math.floor((info.bytes / fileSize) * 20));
         setSyncProgress({ progress: currProgress, message: `Baixando arquivo... (${mb} MB recebidos)` });
      });
  
      await client.downloadTo(zipPath, remotePath);
      client.trackProgress(); // clear tracker
      
      setSyncProgress({ progress: 40, message: 'Download concluído. Extraindo arquivos CSV...' });
      
      const estabPath = join(tempDir, 'estab.csv');
      const ativPath = join(tempDir, 'ativ.csv');
      const comisPath = join(tempDir, 'comis.csv');
      const profPath = join(tempDir, 'prof.csv');
      const servicoPath = join(tempDir, 'servico.csv');
      const tbServicoPath = join(tempDir, 'tbservico.csv');
      const cboPath = join(tempDir, 'cbo.csv');
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(zipPath)
          .pipe(unzipper.Parse())
          .on('entry', (entry) => {
            const p = entry.path.toUpperCase();
            if (p.endsWith('.CSV') && (p.includes('RLESTABEQUIPEPROF') || p.includes('RLESTABELECIMENTOPROFISSIONAL') || p.includes('TBESTABELECIMENTOPROFISSIONAL'))) {
              entry.pipe(fs.createWriteStream(estabPath));
            } else if (p.endsWith('.CSV') && p.includes('TBATIVIDADEPROFISSIONAL')) {
              entry.pipe(fs.createWriteStream(ativPath));
            } else if (p.endsWith('.CSV') && p.includes('RLESTABPROFCOMISSAO')) {
              entry.pipe(fs.createWriteStream(comisPath));
            } else if (p.endsWith('.CSV') && (p.includes('TBDADOSPROFISSIONALSUS') || p.includes('TBPROFISSIONAL') || p.includes('TB_PROFISSIONAL'))) {
              entry.pipe(fs.createWriteStream(profPath));
            } else if (p.endsWith('.CSV') && p.includes('RLESTABSERVICOCLASSIFICACAO')) {
              entry.pipe(fs.createWriteStream(servicoPath));
            } else if (p.endsWith('.CSV') && p.includes('TBSERVICO')) {
              entry.pipe(fs.createWriteStream(tbServicoPath));
            } else if (p.endsWith('.CSV') && (p.includes('TBCBO') || p.includes('TBOCUPACAO'))) {
              entry.pipe(fs.createWriteStream(cboPath));
            } else {
              entry.autodrain();
            }
          })
          .on('close', resolve)
          .on('error', reject);
      });
      
      if (!fs.existsSync(profPath)) {
         throw new Error("Arquivo de profissionais (tbProfissional / tbDadosProfissionalSus) não encontrado dentro do ZIP.");
      }
      
      const profToCnes = new Map();
      const profToCbo = new Map();
      
      setSyncProgress({ progress: 45, message: 'Processando especialidades e CBOs...' });
      const cboNames = new Map();
      if (fs.existsSync(cboPath)) {
        await new Promise((resolve, reject) => {
           fs.createReadStream(cboPath)
             .pipe(csv({ separator: ';' }))
             .on('data', (row) => {
                 const code = row.CO_CBO;
                 const name = row.NO_CBO || row.DS_CBO || row.NOME;
                 if (code && name) cboNames.set(code, name);
             })
             .on('end', resolve)
             .on('error', reject);
        });
      }
      
      setSyncProgress({ progress: 50, message: 'Processando vínculos de profissionais...' });
      
      const parseRelation = async (filePath) => {
        if (!fs.existsSync(filePath)) return;
        await new Promise((resolve, reject) => {
           fs.createReadStream(filePath)
             .pipe(csv({ separator: ';' }))
             .on('data', (row) => {
                 let cnes = row.CO_CNES;
                 if (!cnes && row.CO_UNIDADE) {
                     cnes = row.CO_UNIDADE.length > 7 ? row.CO_UNIDADE.slice(-7) : row.CO_UNIDADE;
                 }
                 if (cnes && validCnesCodes.has(cnes)) {
                     const profId = row.CO_PROFISSIONAL || row.ID_PROFISSIONAL;
                     if (profId) {
                         profToCnes.set(profId, cnes);
                         const cbo = row.CO_CBO || row.CO_CBO_OCUPACAO || '';
                         if (cbo) {
                             profToCbo.set(profId, cbo);
                         }
                     }
                 }
             })
             .on('end', resolve)
             .on('error', reject);
        });
      };

      await parseRelation(estabPath);
      await parseRelation(ativPath);
      await parseRelation(comisPath);
      
      if (profToCnes.size === 0) {
         throw new Error("Nenhum vínculo de profissional encontrado para as unidades cadastradas.");
      }
      
      setSyncProgress({ progress: 70, message: `Lendo dados de ${profToCnes.size} profissionais...` });
      
      const professionalsToInsert = [];
      await new Promise((resolve, reject) => {
         fs.createReadStream(profPath)
           .pipe(csv({ separator: ';' }))
           .on('data', (row) => {
               const profId = row.CO_PROFISSIONAL || row.ID_PROFISSIONAL;
               if (profId && profToCnes.has(profId)) {
                   professionalsToInsert.push({
                       ...row,
                       CO_PROFISSIONAL: profId,
                       CO_CNES: profToCnes.get(profId),
                       CO_CBO: profToCbo.get(profId) || row.CO_CBO || ''
                   });
               }
           })
           .on('end', resolve)
           .on('error', reject);
      });
    
    setSyncProgress({ progress: 85, message: 'Salvando especialidades e profissionais no banco de dados...' });
    
    const uniqueCbos = [...new Set(professionalsToInsert.map(p => p.CO_CBO).filter(Boolean))];
    for (const cboCode of uniqueCbos) {
        let cboName = cboNames.get(cboCode) || `Especialidade CBO ${cboCode}`;
        cboName = cboName.substring(0, 100); // Segurança tamanho max
        
        await pool.query(`
           INSERT INTO specialties (name, cnes_code) VALUES ($1, $2)
           ON CONFLICT (name) DO UPDATE SET cnes_code = EXCLUDED.cnes_code
        `, [cboName, cboCode]);
    }
    
    const specialtiesRes = await pool.query('SELECT id, cnes_code FROM specialties WHERE cnes_code = ANY($1)', [uniqueCbos]);
    const specialtyCboToId = new Map(specialtiesRes.rows.map(s => [s.cnes_code, s.id]));
    
    let inserted = 0;
    for (const prof of professionalsToInsert) {
        const cpf = prof.CO_CPF || prof.NU_CPF || prof.CPF || '';
        const name = prof.NO_PROFISSIONAL || prof.NO_PROF || prof.NOME || 'Sem Nome';
        const cnes = prof.CO_CNES;
        const cbo = prof.CO_CBO || '';
        const cns = prof.CO_CNS || prof.NU_CNS || prof.CNS || '';
        const profId = prof.CO_PROFISSIONAL;
        
        // Define papel baseado no CBO (ex: Medicos começam com 225)
        let role = 'ATTENDANT';
        if (cbo.startsWith('225')) {
           role = 'DOCTOR';
        }
        
        const unitId = cnesToUnitId.get(cnes);
        const specialtyId = cbo ? specialtyCboToId.get(cbo) || null : null;
        
        let userRes;
        if (cpf) {
           userRes = await pool.query('SELECT id FROM users WHERE email = $1', [cpf + '@cnes.datasus']);
        } else if (cns) {
           userRes = await pool.query('SELECT id FROM users WHERE email = $1', [cns + '@cnes.datasus']);
        }
        
        const passwordHash = await bcrypt.hash(cpf && cpf.length >= 6 ? cpf.substring(0, 6) : '123456', 10);
        
        if (userRes && userRes.rows.length > 0) {
            await pool.query(`
               UPDATE users SET name = $1, role = $2, cnes_id = $3, specialty_id = $4
               WHERE id = $5
            `, [name, role, profId, specialtyId, userRes.rows[0].id]);
        } else {
            await pool.query(`
               INSERT INTO users (name, email, password_hash, role, unit_id, cnes_id, specialty_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [name, cpf ? cpf + '@cnes.datasus' : cns + '@cnes.datasus', passwordHash, role, unitId, profId, specialtyId]);
        }
        inserted++;
    }
    
    setSyncProgress({ progress: 100, message: `Sincronização concluída! ${inserted} profissionais processados.` });
    
    // Extração e Salvamento de Serviços
    setSyncProgress({ progress: 95, message: 'Processando serviços das unidades...' });
    const servicoToName = new Map();
    if (fs.existsSync(tbServicoPath)) {
      await new Promise((resolve, reject) => {
         fs.createReadStream(tbServicoPath)
           .pipe(csv({ separator: ';' }))
           .on('data', (row) => {
               const code = row.CO_SERVICO;
               const name = row.NO_SERVICO || row.DS_SERVICO || row.NOME;
               if (code && name) servicoToName.set(code, name);
           })
           .on('end', resolve)
           .on('error', reject);
      });
    }

    const servicesToInsert = [];
    if (fs.existsSync(servicoPath)) {
      await new Promise((resolve, reject) => {
         fs.createReadStream(servicoPath)
           .pipe(csv({ separator: ';' }))
           .on('data', (row) => {
               let cnes = row.CO_CNES;
               if (!cnes && row.CO_UNIDADE) {
                   cnes = row.CO_UNIDADE.length > 7 ? row.CO_UNIDADE.slice(-7) : row.CO_UNIDADE;
               }
               if (cnes && validCnesCodes.has(cnes)) {
                   const servicoCode = row.CO_SERVICO || row.CO_SERVICO_ESPECIALIZADO;
                   const classCode = row.CO_CLASSIFICACAO || row.CO_CLASSIFICACAO_SERVICO || '';
                   if (servicoCode) {
                       servicesToInsert.push({
                           cnes,
                           servicoCode,
                           classCode,
                           name: servicoToName.get(servicoCode) || `Serviço ${servicoCode}`
                       });
                   }
               }
           })
           .on('end', resolve)
           .on('error', reject);
      });
    }

    if (servicesToInsert.length > 0) {
        setSyncProgress({ progress: 98, message: 'Salvando serviços no banco de dados...' });
        const unitIdsWithServices = [...new Set(servicesToInsert.map(s => cnesToUnitId.get(s.cnes)).filter(Boolean))];
        if (unitIdsWithServices.length > 0) {
            await pool.query('DELETE FROM health_unit_services WHERE unit_id = ANY($1)', [unitIdsWithServices]);
            for (const s of servicesToInsert) {
                const unitId = cnesToUnitId.get(s.cnes);
                if(unitId) {
                   await pool.query(`
                      INSERT INTO health_unit_services (unit_id, cnes_code, name, classification)
                      VALUES ($1, $2, $3, $4)
                   `, [unitId, s.cnes, s.name, s.classCode]);
                }
            }
        }
    }
    
    setSyncProgress({ progress: 100, message: `Sincronização concluída com serviços!` });
    console.log(`[CNES Sync] ${inserted} profissionais atualizados.`);
    
  } catch(err) {
    console.error('[CNES Sync Error]', err);
    setSyncProgress({ progress: 100, error: err.message });
  } finally {
    client.close();
    if (tempDir) {
       await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
};

cron.schedule('30 2 * * *', syncCnesProfessionals);

app.get('/api/notifications', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const userRes = await pool.query('SELECT role, email FROM users WHERE id = $1', [userId]);
    const userRole = userRes.rows[0]?.role;
    
    let notifications = [];
    
    const staticNotifsRes = await pool.query('SELECT * FROM notifications WHERE user_id = $1 AND read = false ORDER BY created_at DESC', [userId]);
    notifications.push(...staticNotifsRes.rows.map(mapNotification));
    
    if (userRole === 'PATIENT') {
       const patientRes = await pool.query('SELECT id FROM patients WHERE user_id = $1 OR email = $2', [userId, userRes.rows[0].email]);
       if (patientRes.rows.length > 0) {
          const patientId = patientRes.rows[0].id;
          const apptsRes = await pool.query(`
             SELECT a.*, u.name as doctor_name, sp.name as specialty_name, hu.name as unit_name
             FROM appointments a
             JOIN users u ON a.doctor_id = u.id
             LEFT JOIN specialties sp ON u.specialty_id = sp.id
             JOIN units hu ON a.unit_id = hu.id
             WHERE a.patient_id = $1 AND a.status = 'SCHEDULED'
          `, [patientId]);
          
          for (const appt of apptsRes.rows) {
             const apptDate = new Date(`${appt.date}T${appt.time}:00`);
             const now = new Date();
             
             if (apptDate > now) {
                const dismissedCheck = await pool.query('SELECT id FROM notifications WHERE user_id = $1 AND message = $2', [userId, `dismissed_appt_${appt.id}`]);
                if (dismissedCheck.rows.length === 0) {
                   const diffMs = apptDate.getTime() - now.getTime();
                   const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                   const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                   
                   let timeStr = '';
                   if (diffDays > 0) timeStr = `${diffDays} dia(s)`;
                   else timeStr = `${diffHours} hora(s)`;
                   
                   notifications.push({
                      id: `dynamic_${appt.id}`,
                      userId,
                      message: `Lembrete: Sua consulta de ${appt.specialty_name || 'Clínica Médica'} com ${appt.doctor_name} na ${appt.unit_name} será em ${timeStr} (Data: ${appt.date} às ${appt.time}).`,
                      read: false,
                      createdAt: new Date().toISOString(),
                      type: 'APPOINTMENT_REMINDER',
                      reference_id: appt.id
                   });
                }
             }
          }
       }
    }
    
    notifications.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

app.post('/api/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
     const notifId = req.params.id;
     const userId = req.user.id;
     
     if (notifId.startsWith('dynamic_')) {
        const apptId = notifId.replace('dynamic_', '');
        await pool.query('INSERT INTO notifications (user_id, message, read) VALUES ($1, $2, true)', [userId, `dismissed_appt_${apptId}`]);
     } else {
        await pool.query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2', [notifId, userId]);
     }
     res.json({ success: true });
  } catch(err) {
     next(err);
  }
});

app.post('/api/sync/cnes/professionals', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    syncCnesProfessionals(); 
    res.status(200).json({ message: 'Sincronização de profissionais iniciada' });
  } catch (err) {
    next(err);
  }
});

app.use('/assets', express.static(join(distDir, 'assets'), {
  immutable: true,
  maxAge: '1y'
}));

app.use(express.static(distDir, {
  etag: true,
  lastModified: true,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(indexFile);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === '23503') {
    return res.status(400).json({ error: 'Não é possível excluir este registro pois existem outras informações (como usuários ou pacientes) vinculadas a ele.' });
  }
  const status = Number.isInteger(error.status) ? error.status : 500;
  res.status(status).json({ error: status === 500 ? 'Erro interno do servidor.' : error.message });
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Servidor iniciado: http://localhost:${port}`);
});
