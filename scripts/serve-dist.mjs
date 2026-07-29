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
import rateLimit from 'express-rate-limit';
import xss from 'xss';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { hasAppointmentConflict, nextQueuePassword } from '../server/domain/schedulingRules.mjs';

const { Pool } = pg;

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDir, '..');
const distDir = join(projectRoot, 'dist');
const indexFile = join(distDir, 'index.html');
const configuredOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:4173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowOrigin = (origin, callback) => {
  if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origem nao permitida pelo CORS.'));
};
const app = express();
app.set('trust proxy', 1); // Confia no primeiro proxy (Railway/Render) para evitar erro de X-Forwarded-For no rate-limit

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: configuredOrigins,
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

app.use(cors({ origin: allowOrigin }));
app.disable('x-powered-by');
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...(configuredOrigins.length ? configuredOrigins : [])]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '5mb' }));

// Global rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: 'Muitas requisições deste IP, tente novamente mais tarde.'
});
app.use('/api/', apiLimiter);

// Specific stricter limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests
  message: 'Muitas tentativas de login. Tente novamente mais tarde.'
});
app.use('/api/auth/', authLimiter);

const sanitizeText = value => String(xss(value ?? '')).trim().replace(/\s+/g, ' ');
const SYSTEM_ROLES = ['ADMIN', 'GENERAL_SUPERVISOR', 'DOCTOR', 'ATTENDANT', 'SOCIAL_WORKER', 'PATIENT'];
const MANAGEMENT_ROLES = ['ADMIN', 'GENERAL_SUPERVISOR'];
const HEALTH_POST_ICONS = ['shield', 'heart', 'bell', 'newspaper', 'calendar', 'stethoscope', 'syringe', 'megaphone'];
const DEFAULT_HEALTH_POSTS = [
  {
    title: 'Diagnóstico do HIV abre caminho para tratamento e vida digna',
    context: 'Testagem e cuidado',
    body: 'Testar cedo ajuda a iniciar acompanhamento e tratamento, proteger a saúde e reduzir riscos para o paciente.',
    icon: 'shield',
    image_url: '/news/noticia-hiv-testagem.png',
    display_order: 1,
  },
  {
    title: 'Tabagismo tem tratamento e apoio na rede de saúde',
    context: 'Parar de fumar',
    body: 'Com orientação profissional, plano de cuidado e acompanhamento, largar o cigarro se torna uma decisão possível.',
    icon: 'heart',
    image_url: '/news/noticia-tabagismo-tratamento.png',
    display_order: 2,
  },
  {
    title: 'Queimaduras e saúde cardiovascular',
    context: 'Julho Vermelho e Amarelo',
    body: 'Julho reforça prevenção de queimaduras, cuidados em casa e atenção à pressão, ao coração e aos hábitos de vida.',
    icon: 'bell',
    image_url: '/news/noticia-campanha-mensal.png',
    display_order: 3,
  },
  {
    title: 'Prevenção também é cuidado diário',
    context: 'Saúde em geral',
    body: 'Vacinação, consultas, exames e orientação de rotina mantêm a família acompanhada antes que o problema cresça.',
    icon: 'newspaper',
    image_url: '/news/noticia-saude-geral.png',
    display_order: 4,
  },
];
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
  isHospital: row.is_hospital ?? false,
  toleranceMinutes: row.tolerance_minutes !== null ? row.tolerance_minutes : 15,
  autoCancelNoShow: row.auto_cancel_no_show !== null ? row.auto_cancel_no_show : true
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
  createdAt: row.created_at,
  type: row.type ?? 'GENERAL',
  reference_id: row.reference_id ?? undefined
});

const mapHealthPost = row => ({
  id: row.id,
  title: row.title,
  context: row.context,
  text: row.body,
  icon: row.icon,
  imageUrl: row.image_url,
  published: row.published,
  displayOrder: row.display_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const requireImageUrl = (value) => {
  const imageUrl = String(value ?? '').trim();
  const isBundledAsset = imageUrl.startsWith('/news/');
  const isUploadedImage = /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(imageUrl);

  if (!imageUrl || imageUrl.length > 2500000 || (!isBundledAsset && !isUploadedImage)) {
    const error = new Error('imagem invalida.');
    error.status = 400;
    throw error;
  }

  return imageUrl;
};

const normalizeHealthPostPayload = (body, current = {}) => {
  const title = requireText(body.title ?? current.title, 'titulo', 96);
  const context = requireText(body.context ?? current.context, 'contexto', 48);
  const text = requireText(body.text ?? current.body, 'texto', 400);
  const icon = sanitizeText(body.icon ?? current.icon ?? 'newspaper');
  if (!HEALTH_POST_ICONS.includes(icon)) {
    const error = new Error('icone invalido.');
    error.status = 400;
    throw error;
  }

  const rawOrder = body.displayOrder ?? body.display_order ?? current.display_order ?? 0;
  const displayOrder = Math.min(Math.max(Number.parseInt(String(rawOrder), 10) || 0, 0), 999);

  return {
    title,
    context,
    body: text,
    icon,
    imageUrl: requireImageUrl(body.imageUrl ?? body.image_url ?? current.image_url),
    published: body.published !== undefined ? Boolean(body.published) : (current.published ?? true),
    displayOrder,
  };
};
const mapAppointment = row => ({
  id: row.id,
  patientId: row.patient_id,
  doctorId: row.doctor_id,
  unitId: row.unit_id,
  date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : (typeof row.date === 'string' ? row.date.split('T')[0] : row.date),
  time: row.time,
  status: row.status,
  notes: row.notes ?? undefined,
  aiSummary: row.ai_summary ?? undefined,
  queuePassword: row.queue_password ?? undefined,
  checkInTime: row.check_in_time ?? undefined,
  calledAt: row.called_at ?? undefined,
  callLocation: row.call_location ?? undefined
});

const mapExam = row => ({
  id: row.id,
  patientId: row.patient_id,
  unitId: row.unit_id,
  type: row.type,
  requestCode: row.request_code ?? undefined,
  date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : (typeof row.date === 'string' ? row.date.split('T')[0] : row.date),
  time: row.time,
  status: row.status,
  preparation: row.preparation ?? undefined,
  resultAvailable: row.result_available ?? false,
  notes: row.notes ?? undefined,
  referralAttachment: row.referral_attachment ?? undefined,
  cancelReason: row.cancel_reason ?? undefined
});

const mapCareEvent = row => ({
  id: row.id,
  patientId: row.patient_id,
  unitId: row.unit_id,
  date: row.date,
  service: row.service,
  summary: row.summary,
  professionalName: row.professional_name
});

const mapReminderPreference = row => ({
  id: row.user_id,
  userId: row.user_id,
  channels: typeof row.channels === 'string' ? JSON.parse(row.channels) : row.channels,
  leadTimeHours: row.lead_time_hours,
  quietHours: row.quiet_hours
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

const hasEnabledReminderChannel = channels => Boolean(channels?.sms || channels?.email || channels?.whatsapp);

const isQuietHour = (date = new Date()) => {
  const hour = date.getHours();
  return hour >= 22 || hour < 7;
};

const toDateOnly = (date) => {
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  const rawDate = String(date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) return rawDate.slice(0, 10);

  const parsedDate = new Date(rawDate);
  if (!Number.isNaN(parsedDate.getTime())) return parsedDate.toISOString().slice(0, 10);

  return rawDate.split('T')[0];
};

const toTimeOnly = time => String(time || '00:00').slice(0, 5);

const toEventDate = (date, time) => new Date(`${toDateOnly(date)}T${toTimeOnly(time)}:00`);

const formatReminderDistance = (eventDate, now = new Date()) => {
  const diffMs = eventDate.getTime() - now.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} minuto(s)`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hora(s)`;

  return `${Math.round(diffHours / 24)} dia(s)`;
};

const createNotification = async ({ userId, message, type = 'GENERAL', referenceId = null, emit = true }) => {
  const cleanMessage = sanitizeText(String(message)).slice(0, 500);
  const cleanType = sanitizeText(String(type)).slice(0, 80);
  const cleanReferenceId = referenceId ? sanitizeText(String(referenceId)).slice(0, 160) : null;
  const conflictClause = cleanReferenceId
    ? 'ON CONFLICT (user_id, type, reference_id) WHERE reference_id IS NOT NULL DO NOTHING'
    : '';

  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, message, type, reference_id)
     VALUES ($1, $2, $3, $4)
     ${conflictClause}
     RETURNING *`,
    [userId, cleanMessage, cleanType, cleanReferenceId]
  );

  if (!rows[0]) return null;

  const notification = mapNotification(rows[0]);
  if (emit) io.to(userId).emit('new_notification', notification);
  return notification;
};

const getReminderPreferenceForUser = async (userId) => {
  const { rows } = await pool.query('SELECT * FROM reminder_preferences WHERE user_id = $1', [userId]);
  if (rows[0]) return mapReminderPreference(rows[0]);

  const created = await pool.query(
    `INSERT INTO reminder_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = reminder_preferences.updated_at
     RETURNING *`,
    [userId]
  );
  return mapReminderPreference(created.rows[0]);
};

const enqueuePatientReminders = async (user, { emit = true } = {}) => {
  if (!user || user.role !== 'PATIENT') return [];

  const preference = await getReminderPreferenceForUser(user.id);
  if (!hasEnabledReminderChannel(preference.channels)) return [];
  if (preference.quietHours && isQuietHour()) return [];

  const patientRes = await pool.query(
    'SELECT id FROM patients WHERE user_id = $1 OR email = $2 ORDER BY created_at DESC LIMIT 1',
    [user.id, user.email]
  );
  const patientId = patientRes.rows[0]?.id;
  if (!patientId) return [];

  const created = [];
  const leadTimeHours = Math.min(Math.max(Number(preference.leadTimeHours) || 24, 1), 168);
  const now = new Date();

  const { rows: appointments } = await pool.query(
    `SELECT a.*, doctor.name as doctor_name, sp.name as specialty_name, unit.name as unit_name
     FROM appointments a
     JOIN users doctor ON a.doctor_id = doctor.id
     LEFT JOIN specialties sp ON doctor.specialty_id = sp.id
     JOIN units unit ON a.unit_id = unit.id
     WHERE a.patient_id = $1
       AND a.status = 'SCHEDULED'
       AND (a.date::timestamp + a.time::time) BETWEEN now() AND now() + ($2::int * interval '1 hour')
     ORDER BY a.date ASC, a.time ASC`,
    [patientId, leadTimeHours]
  );

  for (const appointment of appointments) {
    const eventDate = toEventDate(appointment.date, appointment.time);
    const eventDateKey = toDateOnly(appointment.date);
    const eventTimeKey = toTimeOnly(appointment.time);
    const timeDistance = formatReminderDistance(eventDate, now);
    const dateLabel = eventDate.toLocaleDateString('pt-BR');
    const message = `Lembrete de consulta: ${appointment.specialty_name || 'Atendimento'} com ${appointment.doctor_name} na ${appointment.unit_name} em ${timeDistance}, no dia ${dateLabel} às ${eventTimeKey}.`;
    const notification = await createNotification({
      userId: user.id,
      message,
      type: 'APPOINTMENT_REMINDER',
      referenceId: `appointment:${appointment.id}:${eventDateKey}:${eventTimeKey}`,
      emit,
    });
    if (notification) created.push(notification);
  }

  const { rows: exams } = await pool.query(
    `SELECT e.*, unit.name as unit_name
     FROM exams e
     JOIN units unit ON e.unit_id = unit.id
     WHERE e.patient_id = $1
       AND e.status = 'SCHEDULED'
       AND (e.date::timestamp + e.time::time) BETWEEN now() AND now() + ($2::int * interval '1 hour')
     ORDER BY e.date ASC, e.time ASC`,
    [patientId, leadTimeHours]
  );

  for (const exam of exams) {
    const eventDate = toEventDate(exam.date, exam.time);
    const eventDateKey = toDateOnly(exam.date);
    const eventTimeKey = toTimeOnly(exam.time);
    const timeDistance = formatReminderDistance(eventDate, now);
    const dateLabel = eventDate.toLocaleDateString('pt-BR');
    const message = `Lembrete de exame: ${exam.type} na ${exam.unit_name} em ${timeDistance}, no dia ${dateLabel} às ${eventTimeKey}. ${exam.preparation ? `Preparo: ${exam.preparation}` : 'Leve documento com foto e Cartão SUS.'}`;
    const notification = await createNotification({
      userId: user.id,
      message,
      type: 'EXAM_REMINDER',
      referenceId: `exam:${exam.id}:${eventDateKey}:${eventTimeKey}`,
      emit,
    });
    if (notification) created.push(notification);
  }

  const { rows: availableResults } = await pool.query(
    `SELECT e.*
     FROM exams e
     WHERE e.patient_id = $1
       AND e.status = 'AVAILABLE'
       AND e.result_available = true
       AND e.date >= current_date - interval '90 days'
     ORDER BY e.date DESC, e.time DESC`,
    [patientId]
  );

  for (const exam of availableResults) {
    const notification = await createNotification({
      userId: user.id,
      message: `Resultado disponível: ${exam.type}. Acesse Meus exames para consultar e baixar o resultado.`,
      type: 'EXAM_RESULT',
      referenceId: `exam-result:${exam.id}`,
      emit,
    });
    if (notification) created.push(notification);
  }

  return created;
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
      queue_password varchar(50),
      check_in_time timestamptz,
      called_at timestamptz,
      call_location varchar(50),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS exams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
      type text NOT NULL,
      request_code text,
      date date NOT NULL,
      time text NOT NULL,
      status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'AVAILABLE', 'CANCELLED', 'NO_SHOW')),
      preparation text,
      result_available boolean NOT NULL DEFAULT false,
      notes text,
      referral_attachment text,
      cancel_reason text,
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

    CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message text NOT NULL,
      type text NOT NULL DEFAULT 'GENERAL',
      reference_id text,
      read boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS health_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL CHECK (char_length(title) <= 96),
      context text NOT NULL CHECK (char_length(context) <= 48),
      body text NOT NULL CHECK (char_length(body) <= 400),
      icon text NOT NULL DEFAULT 'newspaper',
      image_url text NOT NULL,
      published boolean NOT NULL DEFAULT true,
      display_order integer NOT NULL DEFAULT 0,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
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
    CREATE INDEX IF NOT EXISTS idx_exams_patient ON exams(patient_id, date);
    CREATE INDEX IF NOT EXISTS idx_care_events_patient ON care_events(patient_id, date);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
    CREATE INDEX IF NOT EXISTS idx_health_posts_public ON health_posts(published, display_order, updated_at DESC);

    CREATE TABLE IF NOT EXISTS exam_types (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      schedule jsonb DEFAULT '[]'::jsonb,
      max_daily_appointments integer,
      is_global boolean DEFAULT true,
      unit_ids jsonb DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
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
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS call_location varchar(50);',
    'ALTER TABLE exams ADD COLUMN IF NOT EXISTS notes text;',
    'ALTER TABLE exams ADD COLUMN IF NOT EXISTS referral_attachment text;',
    'ALTER TABLE exams ADD COLUMN IF NOT EXISTS cancel_reason text;',
    'ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_status_check;',
    'ALTER TABLE exams ADD CONSTRAINT exams_status_check CHECK (status IN (\'SCHEDULED\', \'AVAILABLE\', \'CANCELLED\', \'NO_SHOW\'));',
    'ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type text DEFAULT \'GENERAL\';',
    'ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id text;',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(user_id, type, reference_id) WHERE reference_id IS NOT NULL;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS cnes_code text UNIQUE;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS razao_social text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS tipo_unidade text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS esfera_administrativa text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS natureza_juridica text;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS atende_sus boolean DEFAULT true;',
    'ALTER TABLE units ADD COLUMN IF NOT EXISTS tolerance_minutes integer DEFAULT 15;',
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
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS overridden_fields jsonb DEFAULT \'[]\'::jsonb;',
    `CREATE TABLE IF NOT EXISTS locations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      type text NOT NULL CHECK (type IN ('GUICHE', 'SALA', 'MESA')),
      number integer NOT NULL,
      name text NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(unit_id, type, number)
    )`
  ];

  for (const query of newColumnsQueries) {
    try {
      await pool.query(query);
    } catch (e) {
    }
  }

  try {
    const { rows: postRows } = await pool.query('SELECT COUNT(*)::int AS total FROM health_posts');
    if (postRows[0].total === 0) {
      for (const post of DEFAULT_HEALTH_POSTS) {
        await pool.query(
          `INSERT INTO health_posts (title, context, body, icon, image_url, published, display_order)
           VALUES ($1, $2, $3, $4, $5, true, $6)`,
          [post.title, post.context, post.body, post.icon, post.image_url, post.display_order]
        );
      }
    }
  } catch (err) {
    console.error('[HealthPosts] Falha ao criar publicacoes iniciais:', err.message);
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

    const patient = await pool.query(
      `INSERT INTO patients (name, cpf, sus_number, phone, birth_date, unit_id, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['Carlos Paciente', '000.000.000-00', '700000000000000', '(81) 99999-0000', '1985-05-15', unitId, patientUser.rows[0].id]
    );

    const specialties = ['Clinica Geral', 'Pediatria', 'Cardiologia', 'Odontologia'];
    for (const name of specialties) {
      await pool.query('INSERT INTO specialties (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    }

    const spec = await pool.query("SELECT id FROM specialties WHERE name = 'Clinica Geral' LIMIT 1");
    const professionalPasswordHash = await bcrypt.hash('Demo@123456', 12);
    const doctor = await pool.query(
      `INSERT INTO users (name, matricula, email, password_hash, role, specialty_id, unit_id, schedule, max_daily_patients)
       VALUES ($1, $2, $3, $4, 'DOCTOR', $5, $6, $7, $8)
       RETURNING id`,
      ['Dra. Ana Bezerra', 'MED001', 'ana.bezerra@demo.local', professionalPasswordHash, spec.rows[0]?.id ?? null, unitId, JSON.stringify([{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }, { dayOfWeek: 3, startTime: '08:00', endTime: '12:00' }, { dayOfWeek: 5, startTime: '08:00', endTime: '12:00' }]), 12]
    );

    const attendant = await pool.query(
      `INSERT INTO users (name, matricula, email, password_hash, role, unit_id)
       VALUES ($1, $2, $3, $4, 'ATTENDANT', $5)
       RETURNING id`,
      ['Joao Recepcao', 'REC001', 'recepcao@demo.local', professionalPasswordHash, unitId]
    );

    await pool.query('INSERT INTO user_units (user_id, unit_id) VALUES ($1, $2), ($3, $2), ($4, $2) ON CONFLICT DO NOTHING', [patientUser.rows[0].id, unitId, doctor.rows[0].id, attendant.rows[0].id]);

    const appointmentDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, unit_id, date, time, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [patient.rows[0].id, doctor.rows[0].id, unitId, appointmentDate, '09:00', 'Consulta ficticia de acompanhamento']
    );

    await pool.query(
      `INSERT INTO exams (patient_id, unit_id, type, request_code, date, time, status, preparation, result_available)
       VALUES ($1, $2, $3, $4, $5, $6, 'AVAILABLE', $7, true)`,
      [patient.rows[0].id, unitId, 'Hemograma completo', 'REQ-DEMO-2026', appointmentDate, '07:30', 'Jejum de 8 horas e documento com foto.']
    );

    await pool.query(
      `INSERT INTO care_events (patient_id, unit_id, date, service, summary, professional_name)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [patient.rows[0].id, unitId, new Date(Date.now() - 604800000).toISOString().slice(0, 10), 'Acolhimento', 'Atendimento administrativo ficticio para orientacao de agendamento.', 'Equipe de recepcao']
    );

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
    const { rows } = await pool.query("SELECT * FROM units WHERE esfera_administrativa != 'Privada' OR esfera_administrativa IS NULL ORDER BY name");
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
    
    const toleranceMinutes = req.body.toleranceMinutes !== undefined ? req.body.toleranceMinutes : (current.rows[0].tolerance_minutes ?? 15);
    const autoCancelNoShow = req.body.autoCancelNoShow !== undefined ? req.body.autoCancelNoShow : (current.rows[0].auto_cancel_no_show ?? true);
    const row = current.rows[0];
    const localOverride = row.cnes_code ? true : row.local_override;

    const { rows } = await pool.query(
      'UPDATE units SET name = $1, address = $2, phone = $3, cep = $4, address_number = $5, neighborhood = $6, city = $7, state = $8, attendance_type = $9, local_override = $10, is_hospital = $11, tolerance_minutes = $13, auto_cancel_no_show = $14 WHERE id = $12 RETURNING *',
      [name, address, phone, cep, addressNumber, neighborhood, city, state, attendanceType, localOverride, isHospital, req.params.id, toleranceMinutes, autoCancelNoShow]
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

const mapExamType = row => ({
  id: row.id,
  name: row.name,
  schedule: row.schedule ?? [],
  maxDailyAppointments: row.max_daily_appointments ?? undefined,
  isGlobal: row.is_global ?? true,
  unitIds: row.unit_ids ? (typeof row.unit_ids === 'string' ? JSON.parse(row.unit_ids) : row.unit_ids) : [],
  preparation: row.preparation ?? undefined,
  requiresReferral: row.requires_referral ?? true
});

app.get('/api/exam-types', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM exam_types ORDER BY name ASC');
    return res.json(rows.map(mapExamType));
  } catch (error) {
    return next(error);
  }
});

app.post('/api/exam-types', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const name = req.body.name;
    const schedule = req.body.schedule ? JSON.stringify(req.body.schedule) : '[]';
    const maxDailyAppointments = req.body.maxDailyAppointments || null;
    const isGlobal = req.body.isGlobal ?? true;
    const unitIds = req.body.unitIds ? JSON.stringify(req.body.unitIds) : '[]';
    const preparation = req.body.preparation || null;
    const requiresReferral = req.body.requiresReferral ?? true;
    
    const { rows } = await pool.query(
      'INSERT INTO exam_types (name, schedule, max_daily_appointments, is_global, unit_ids, preparation, requires_referral) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, schedule, maxDailyAppointments, isGlobal, unitIds, preparation, requiresReferral]
    );
    await audit(req, 'CREATE', 'exam_type', rows[0].id);
    return res.status(201).json(mapExamType(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/exam-types/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const name = req.body.name;
    const schedule = req.body.schedule ? JSON.stringify(req.body.schedule) : '[]';
    const maxDailyAppointments = req.body.maxDailyAppointments || null;
    const isGlobal = req.body.isGlobal ?? true;
    const unitIds = req.body.unitIds ? JSON.stringify(req.body.unitIds) : '[]';
    const preparation = req.body.preparation || null;
    const requiresReferral = req.body.requiresReferral ?? true;
    
    const { rows } = await pool.query(
      'UPDATE exam_types SET name = $1, schedule = $2, max_daily_appointments = $3, is_global = $4, unit_ids = $5, preparation = $6, requires_referral = $7 WHERE id = $8 RETURNING *',
      [name, schedule, maxDailyAppointments, isGlobal, unitIds, preparation, requiresReferral, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tipo de exame nao encontrado.' });
    await audit(req, 'UPDATE', 'exam_type', req.params.id);
    return res.json(mapExamType(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/exam-types/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM exam_types WHERE id = $1', [req.params.id]);
    await audit(req, 'DELETE', 'exam_type', req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// ─── ROTAS: LOCAIS (SALAS, MESAS, GUICHÊS) ────────────────────────────────

app.get('/api/locations', authenticate, async (req, res, next) => {
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

    const { rows } = await pool.query(
      `SELECT * FROM locations ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY type, number ASC`,
      params
    );
    res.json(rows.map(r => ({
      id: r.id,
      unitId: r.unit_id,
      type: r.type,
      number: r.number,
      name: r.name,
      active: r.active,
      createdAt: r.created_at
    })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/locations', authenticate, async (req, res, next) => {
  try {
    const allowed = ['ADMIN', 'GENERAL_SUPERVISOR', 'ATTENDANT'];
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado.' });

    const { type, number, unitId } = req.body;
    if (!type || !['GUICHE', 'SALA', 'MESA'].includes(type)) {
      return res.status(400).json({ error: 'Tipo inválido. Use GUICHE, SALA ou MESA.' });
    }
    const num = parseInt(number);
    if (!num || num < 1 || num > 999) return res.status(400).json({ error: 'Número inválido.' });

    const targetUnitId = canManageAllUnits(req) ? (unitId || req.user.unitId) : req.user.unitId;
    if (!targetUnitId) return res.status(400).json({ error: 'Unidade obrigatória.' });

    // Gera o nome padronizado: GUICHÊ 01, SALA 03, MESA 10
    const typeLabel = type === 'GUICHE' ? 'GUICHÊ' : type;
    const name = `${typeLabel} ${String(num).padStart(2, '0')}`;

    const { rows } = await pool.query(
      `INSERT INTO locations (unit_id, type, number, name) VALUES ($1, $2, $3, $4) RETURNING *`,
      [targetUnitId, type, num, name]
    );
    await audit(req, 'INSERT', 'location', rows[0].id);
    res.status(201).json({ id: rows[0].id, unitId: rows[0].unit_id, type: rows[0].type, number: rows[0].number, name: rows[0].name, active: rows[0].active });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Já existe um local com este tipo e número nesta unidade.' });
    next(error);
  }
});

app.patch('/api/locations/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['ADMIN', 'GENERAL_SUPERVISOR', 'ATTENDANT'];
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado.' });

    const current = await pool.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Local não encontrado.' });
    if (!canAccessUnit(req, current.rows[0].unit_id)) return res.status(403).json({ error: 'Acesso negado.' });

    const updates = {};
    if (typeof req.body.active === 'boolean') updates.active = req.body.active;
    if (req.body.number) {
      const num = parseInt(req.body.number);
      if (!num || num < 1 || num > 999) return res.status(400).json({ error: 'Número inválido.' });
      const typeLabel = current.rows[0].type === 'GUICHE' ? 'GUICHÊ' : current.rows[0].type;
      updates.number = num;
      updates.name = `${typeLabel} ${String(num).padStart(2, '0')}`;
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nenhum campo válido para atualizar.' });

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = [req.params.id, ...Object.values(updates)];
    const { rows } = await pool.query(`UPDATE locations SET ${setClauses} WHERE id = $1 RETURNING *`, values);

    await audit(req, 'UPDATE', 'location', req.params.id);
    res.json({ id: rows[0].id, unitId: rows[0].unit_id, type: rows[0].type, number: rows[0].number, name: rows[0].name, active: rows[0].active });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Já existe um local com este tipo e número nesta unidade.' });
    next(error);
  }
});

app.delete('/api/locations/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['ADMIN', 'GENERAL_SUPERVISOR'];
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado.' });

    const current = await pool.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Local não encontrado.' });
    if (!canAccessUnit(req, current.rows[0].unit_id)) return res.status(403).json({ error: 'Acesso negado.' });

    await pool.query('DELETE FROM locations WHERE id = $1', [req.params.id]);
    await audit(req, 'DELETE', 'location', req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────────────────

app.get('/api/health-posts', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM health_posts
       WHERE published = true
       ORDER BY display_order ASC, updated_at DESC
       LIMIT 12`
    );
    return res.json(rows.map(mapHealthPost));
  } catch (error) {
    return next(error);
  }
});

app.get('/api/admin/health-posts', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM health_posts
       ORDER BY display_order ASC, updated_at DESC`
    );
    return res.json(rows.map(mapHealthPost));
  } catch (error) {
    return next(error);
  }
});

app.post('/api/admin/health-posts', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const payload = normalizeHealthPostPayload(req.body);
    const { rows } = await pool.query(
      `INSERT INTO health_posts (title, context, body, icon, image_url, published, display_order, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING *`,
      [payload.title, payload.context, payload.body, payload.icon, payload.imageUrl, payload.published, payload.displayOrder, req.user.id]
    );
    await audit(req, 'CREATE', 'health_post', rows[0].id);
    return res.status(201).json(mapHealthPost(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/admin/health-posts/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM health_posts WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Publicacao nao encontrada.' });

    const payload = normalizeHealthPostPayload(req.body, current.rows[0]);
    const { rows } = await pool.query(
      `UPDATE health_posts
       SET title = $1, context = $2, body = $3, icon = $4, image_url = $5, published = $6,
           display_order = $7, updated_by = $8, updated_at = now()
       WHERE id = $9
       RETURNING *`,
      [payload.title, payload.context, payload.body, payload.icon, payload.imageUrl, payload.published, payload.displayOrder, req.user.id, req.params.id]
    );
    await audit(req, 'UPDATE', 'health_post', req.params.id);
    return res.json(mapHealthPost(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/admin/health-posts/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR'), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM health_posts WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Publicacao nao encontrada.' });
    await audit(req, 'DELETE', 'health_post', req.params.id);
    return res.status(204).end();
  } catch (error) {
    return next(error);
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
      if (req.user.role === 'PATIENT') {
        params.push(req.user.id);
        where.push(`user_id = $${params.length}`);
      } else {
        params.push(req.user.unitId);
        where.push(`unit_id = $${params.length}`);
      }
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
      if (req.user.role === 'PATIENT') {
        if (req.query.unitId) {
          params.push(String(req.query.unitId));
          where.push(`unit_id = $${params.length}`);
        }
      } else {
        params.push(req.user.unitId);
        where.push(`unit_id = $${params.length}`);
      }
    } else if (req.query.unitId) {
      params.push(String(req.query.unitId));
      where.push(`unit_id = $${params.length}`);
    }

    if (req.user.role === 'PATIENT') {
      const pRes = await pool.query('SELECT id FROM patients WHERE user_id = $1', [req.user.id]);
      const pIds = pRes.rows.map(r => r.id);
      if (pIds.length === 0) return res.json([]);
      
      if (req.query.patientId && !pIds.includes(req.query.patientId)) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }
      
      if (req.query.patientId) {
        params.push(String(req.query.patientId));
        where.push(`patient_id = $${params.length}`);
      } else {
        params.push(pIds);
        where.push(`patient_id = ANY($${params.length})`);
      }
    } else if (req.query.patientId) {
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
    const patientId = requireText(req.body.patientId, 'paciente', 80);
    const doctorId = requireText(req.body.doctorId, 'profissional', 80);
    const unitId = requireText(req.body.unitId, 'unidade', 80);
    const date = requireText(req.body.date, 'data', 20);
    const time = requireText(req.body.time, 'horario', 10);

    if (!canAccessUnit(req, unitId)) return res.status(403).json({ error: 'Acesso negado para esta unidade.' });

    const [patient, doctor, existing] = await Promise.all([
      pool.query('SELECT * FROM patients WHERE id = $1', [patientId]),
      pool.query("SELECT * FROM users WHERE id = $1 AND role = 'DOCTOR' AND active = true", [doctorId]),
      pool.query('SELECT * FROM appointments WHERE doctor_id = $1 AND date = $2', [doctorId, date])
    ]);

    if (!patient.rows[0]) return res.status(400).json({ error: 'Paciente invalido.' });
    if (req.user.role === 'PATIENT' && patient.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado. Voce so pode agendar para si mesmo.' });
    }
    if (!doctor.rows[0]) return res.status(400).json({ error: 'Profissional invalido.' });
    if (!canAccessUnit(req, patient.rows[0].unit_id) || !canAccessUnit(req, doctor.rows[0].unit_id)) {
      return res.status(403).json({ error: 'Acesso negado para os dados enviados.' });
    }

    if (hasAppointmentConflict(existing.rows, { doctorId, date, time })) {
      return res.status(409).json({ error: 'Ja existe agendamento ativo para este profissional neste horario.' });
    }

    if (doctor.rows[0].max_daily_patients) {
      const activeCount = existing.rows.filter(row => row.status !== 'CANCELLED').length;
      if (activeCount >= doctor.rows[0].max_daily_patients) {
        return res.status(409).json({ error: 'Limite diario do profissional atingido.' });
      }
    }

    if (doctor.rows[0].specialty_id) {
      const specialty = await pool.query('SELECT * FROM specialties WHERE id = $1', [doctor.rows[0].specialty_id]);
      if (specialty.rows[0]) {
        const spec = specialty.rows[0];
        const specUnitIds = spec.unit_ids ? (typeof spec.unit_ids === 'string' ? JSON.parse(spec.unit_ids) : spec.unit_ids) : [];
        if (!spec.is_global && !specUnitIds.includes(unitId)) {
          return res.status(403).json({ error: 'A especialidade do profissional nao esta disponivel nesta unidade.' });
        }
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, unit_id, date, time, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [patientId, doctorId, unitId, date, time, req.body.notes ? sanitizeText(req.body.notes).slice(0, 500) : null]
    );
    await audit(req, 'CREATE', 'appointment', rows[0].id);
    if (patient.rows[0].user_id) {
      const eventDate = toEventDate(rows[0].date, rows[0].time);
      const eventTime = toTimeOnly(rows[0].time);
      await createNotification({
        userId: patient.rows[0].user_id,
        message: `Consulta agendada: ${eventDate.toLocaleDateString('pt-BR')} às ${eventTime}. Você receberá um lembrete quando a data estiver próxima.`,
        type: 'APPOINTMENT_CREATED',
        referenceId: `appointment-created:${rows[0].id}`,
      });
    }
    res.status(201).json(mapAppointment(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/appointments/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const current = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    const appointment = current.rows[0];
    if (!appointment) return res.status(404).json({ error: 'Agendamento nao encontrado.' });
    if (appointment.status === 'CANCELLED') return res.status(400).json({ error: 'Agendamento ja esta cancelado.' });

    if (req.user.role === 'PATIENT') {
      const patientRes = await pool.query('SELECT user_id FROM patients WHERE id = $1', [appointment.patient_id]);
      if (!patientRes.rows[0] || patientRes.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      const apptDateStr = appointment.date instanceof Date ? appointment.date.toISOString().split('T')[0] : String(appointment.date).split('T')[0];
      const apptDateTime = new Date(`${apptDateStr}T${appointment.time}:00`);
      const now = new Date();
      const diffMs = apptDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 8) {
        return res.status(400).json({ error: 'Cancelamento pelo paciente permitido apenas com no minimo 8 horas de antecedencia.' });
      }
    } else {
      if (!canAccessUnit(req, appointment.unit_id)) return res.status(403).json({ error: 'Acesso negado.' });
      if (!reason || String(reason).trim() === '') {
        return res.status(400).json({ error: 'Motivo do cancelamento e obrigatorio para profissionais/recepcao.' });
      }
    }

    let notes = appointment.notes || '';
    if (reason && String(reason).trim() !== '') {
      const cancelReason = `[CANCELADO: ${String(reason).trim()}]`;
      notes = notes ? `${notes}\n\n${cancelReason}` : cancelReason;
    }

    const { rows } = await pool.query(
      `UPDATE appointments
       SET status = 'CANCELLED', notes = $1
       WHERE id = $2
       RETURNING *`,
      [notes ? sanitizeText(notes).slice(0, 500) : null, req.params.id]
    );

    await audit(req, 'UPDATE', 'appointment', req.params.id, { action: 'CANCELLED', reason });
    res.json(mapAppointment(rows[0]));
  } catch (error) {
    next(error);
  }
});


app.post('/api/appointments/:id/check-in', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR', 'ATTENDANT'), async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    const appointment = current.rows[0];
    if (!appointment) return res.status(404).json({ error: 'Agendamento nao encontrado.' });
    if (!canAccessUnit(req, appointment.unit_id)) return res.status(403).json({ error: 'Acesso negado.' });
    if (appointment.status === 'CANCELLED') return res.status(400).json({ error: 'Agendamento cancelado nao pode receber check-in.' });

    const unit = await pool.query('SELECT attendance_type FROM units WHERE id = $1', [appointment.unit_id]);
    const todayRows = await pool.query('SELECT * FROM appointments WHERE unit_id = $1 AND date = $2', [appointment.unit_id, appointment.date]);
    const queuePassword = unit.rows[0]?.attendance_type === 'SENHA'
      ? nextQueuePassword(todayRows.rows, Boolean(req.body.priority), appointment.date)
      : appointment.queue_password;

    const { rows } = await pool.query(
      `UPDATE appointments
       SET queue_password = $1, check_in_time = COALESCE(check_in_time, now())
       WHERE id = $2
       RETURNING *`,
      [queuePassword, req.params.id]
    );
    await audit(req, 'CHECK_IN', 'appointment', req.params.id);
    return res.json(mapAppointment(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.post('/api/appointments/:id/call', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR', 'ATTENDANT'), async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    const appointment = current.rows[0];
    if (!appointment) return res.status(404).json({ error: 'Agendamento nao encontrado.' });
    if (!canAccessUnit(req, appointment.unit_id)) return res.status(403).json({ error: 'Acesso negado.' });
    if (!appointment.check_in_time) return res.status(400).json({ error: 'Realize o check-in antes da chamada.' });

    const requestedLocation = req.body?.callLocation
      ? sanitizeText(String(req.body.callLocation)).slice(0, 50)
      : null;
    const callLocation = requestedLocation || appointment.call_location || 'GUICHÊ 01';

    const { rows } = await pool.query(
      'UPDATE appointments SET called_at = now(), call_location = $1 WHERE id = $2 RETURNING *',
      [callLocation, req.params.id]
    );
    await audit(req, 'CALL', 'appointment', req.params.id, { callLocation });
    io.emit('queue_call', mapAppointment(rows[0]));
    return res.json(mapAppointment(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/appointments/:id', authenticate, async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Agendamento nao encontrado.' });
    if (!canAccessUnit(req, current.rows[0].unit_id)) return res.status(403).json({ error: 'Acesso negado.' });

    const row = current.rows[0];
    const { rows } = await pool.query(
      `UPDATE appointments SET date=$1, time=$2, status=$3, notes=$4, ai_summary=$5, queue_password=$6, check_in_time=$7, called_at=$8, call_location=$9 WHERE id=$10 RETURNING *`,
      [
        req.body.date ?? row.date, 
        req.body.time ?? row.time, 
        req.body.status ?? row.status, 
        req.body.notes ?? row.notes, 
        req.body.aiSummary ?? row.ai_summary, 
        req.body.queuePassword !== undefined ? req.body.queuePassword : row.queue_password,
        req.body.checkInTime !== undefined ? req.body.checkInTime : row.check_in_time,
        req.body.calledAt !== undefined ? req.body.calledAt : row.called_at,
        req.body.callLocation !== undefined ? sanitizeText(String(req.body.callLocation)).slice(0, 50) : row.call_location,
        req.params.id
      ]
    );
    await audit(req, 'UPDATE', 'appointment', req.params.id);
    return res.json(mapAppointment(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.get('/api/exams', authenticate, async (req, res, next) => {
  try {
    const params = [];
    const where = [];

    if (req.user.role === 'PATIENT') {
      const pRes = await pool.query('SELECT id FROM patients WHERE user_id = $1', [req.user.id]);
      const pIds = pRes.rows.map(r => r.id);
      if (pIds.length === 0) return res.json([]);
      
      if (req.query.patientId && !pIds.includes(req.query.patientId)) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }
      
      if (req.query.patientId) {
        params.push(String(req.query.patientId));
        where.push(`patient_id = $${params.length}`);
      } else {
        params.push(pIds);
        where.push(`patient_id = ANY($${params.length})`);
      }
    } else if (req.query.patientId) {
      params.push(String(req.query.patientId));
      where.push(`patient_id = $${params.length}`);
    }

    if (!canManageAllUnits(req)) {
      if (req.user.role === 'PATIENT') {
        if (req.query.unitId) {
          params.push(String(req.query.unitId));
          where.push(`unit_id = $${params.length}`);
        }
      } else {
        params.push(req.user.unitId);
        where.push(`unit_id = $${params.length}`);
      }
    } else if (req.query.unitId) {
      params.push(String(req.query.unitId));
      where.push(`unit_id = $${params.length}`);
    }

    const { rows } = await pool.query(`SELECT * FROM exams ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY date DESC, time`, params);
    res.json(rows.map(mapExam));
  } catch (error) {
    next(error);
  }
});

app.post('/api/exams', authenticate, async (req, res, next) => {
  try {
    const patientId = requireText(req.body.patientId, 'paciente', 80);
    const unitId = requireText(req.body.unitId, 'unidade', 80);
    const type = requireText(req.body.type, 'tipo de exame', 120);
    const date = requireText(req.body.date, 'data', 20);
    const time = requireText(req.body.time, 'horario', 10);

    if (!canAccessUnit(req, unitId)) return res.status(403).json({ error: 'Acesso negado para esta unidade.' });

    const patient = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
    if (!patient.rows[0]) return res.status(400).json({ error: 'Paciente invalido.' });
    if (req.user.role === 'PATIENT' && patient.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado. Voce so pode agendar para si mesmo.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO exams (patient_id, unit_id, type, request_code, date, time, preparation, referral_attachment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        patientId,
        unitId,
        type,
        req.body.requestCode ? sanitizeText(req.body.requestCode).slice(0, 80) : null,
        date,
        time,
        req.body.preparation ? sanitizeText(req.body.preparation).slice(0, 500) : null,
        req.body.referralAttachment || null
      ]
    );
    await audit(req, 'CREATE', 'exam', rows[0].id);
    if (patient.rows[0].user_id) {
      const eventDate = toEventDate(rows[0].date, rows[0].time);
      const eventTime = toTimeOnly(rows[0].time);
      await createNotification({
        userId: patient.rows[0].user_id,
        message: `Exame agendado: ${type} em ${eventDate.toLocaleDateString('pt-BR')} às ${eventTime}. Confira o preparo em Meus exames.`,
        type: 'EXAM_CREATED',
        referenceId: `exam-created:${rows[0].id}`,
      });
    }
    res.status(201).json(mapExam(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/exams/:id', authenticate, authorize('ADMIN', 'GENERAL_SUPERVISOR', 'ATTENDANT', 'DOCTOR'), async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM exams WHERE id = $1', [req.params.id]);
    const row = current.rows[0];
    if (!row) return res.status(404).json({ error: 'Exame nao encontrado.' });
    if (!canAccessUnit(req, row.unit_id)) return res.status(403).json({ error: 'Acesso negado.' });

    const allowedStatuses = ['SCHEDULED', 'AVAILABLE', 'CANCELLED', 'NO_SHOW'];
    const nextStatus = req.body.status ? sanitizeText(String(req.body.status)) : row.status;
    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ error: 'Status de exame invalido.' });
    }

    const nextResultAvailable = req.body.resultAvailable !== undefined
      ? Boolean(req.body.resultAvailable)
      : (nextStatus === 'AVAILABLE' ? true : row.result_available);

    const { rows } = await pool.query(
      `UPDATE exams
       SET date = $1, time = $2, status = $3, preparation = $4, result_available = $5, notes = $6, cancel_reason = $7
       WHERE id = $8
       RETURNING *`,
      [
        req.body.date ?? row.date,
        req.body.time ?? row.time,
        nextStatus,
        req.body.preparation !== undefined ? sanitizeText(String(req.body.preparation)).slice(0, 500) : row.preparation,
        nextResultAvailable,
        req.body.notes !== undefined ? sanitizeText(String(req.body.notes)).slice(0, 500) : row.notes,
        req.body.cancelReason !== undefined ? sanitizeText(String(req.body.cancelReason)).slice(0, 500) : row.cancel_reason,
        req.params.id
      ]
    );

    await audit(req, 'UPDATE', 'exam', req.params.id, { status: nextStatus });
    if (nextStatus === 'AVAILABLE' && rows[0].result_available) {
      const patient = await pool.query('SELECT user_id FROM patients WHERE id = $1', [rows[0].patient_id]);
      if (patient.rows[0]?.user_id) {
        await createNotification({
          userId: patient.rows[0].user_id,
          message: `Resultado disponível: ${rows[0].type}. Acesse Meus exames para consultar e baixar o resultado.`,
          type: 'EXAM_RESULT',
          referenceId: `exam-result:${rows[0].id}`,
        });
      }
    }
    return res.json(mapExam(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/exams/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const reason = requireText(req.body.reason, 'motivo do cancelamento');
    const current = await pool.query('SELECT * FROM exams WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Exame nao encontrado.' });
    if (!canAccessUnit(req, current.rows[0].unit_id)) return res.status(403).json({ error: 'Acesso negado.' });
    if (req.user.role === 'PATIENT') {
      const patientRes = await pool.query('SELECT user_id FROM patients WHERE id = $1', [current.rows[0].patient_id]);
      if (!patientRes.rows[0] || patientRes.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }
    }
    const { rows } = await pool.query('UPDATE exams SET status = $1, cancel_reason = $2 WHERE id = $3 RETURNING *', ['CANCELLED', reason, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Exame não encontrado.' });
    await audit(req, 'UPDATE', 'exam', req.params.id);
    return res.json(mapExam(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.get('/api/care-history', authenticate, async (req, res, next) => {
  try {
    const params = [];
    const where = [];

    if (req.user.role === 'PATIENT') {
      const pRes = await pool.query('SELECT id FROM patients WHERE user_id = $1', [req.user.id]);
      const pIds = pRes.rows.map(r => r.id);
      if (pIds.length === 0) return res.json([]);
      
      if (req.query.patientId && !pIds.includes(req.query.patientId)) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }
      
      if (req.query.patientId) {
        params.push(String(req.query.patientId));
        where.push(`patient_id = $${params.length}`);
      } else {
        params.push(pIds);
        where.push(`patient_id = ANY($${params.length})`);
      }
    } else if (req.query.patientId) {
      params.push(String(req.query.patientId));
      where.push(`patient_id = $${params.length}`);
    }

    if (!canManageAllUnits(req)) {
      if (req.user.role !== 'PATIENT') {
        params.push(req.user.unitId);
        where.push(`unit_id = $${params.length}`);
      }
    }

    const { rows } = await pool.query(`SELECT * FROM care_events ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY date DESC`, params);
    res.json(rows.map(mapCareEvent));
  } catch (error) {
    next(error);
  }
});

app.get('/api/reminders/preferences', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM reminder_preferences WHERE user_id = $1', [req.user.id]);
    if (rows[0]) return res.json(mapReminderPreference(rows[0]));

    const created = await pool.query(
      `INSERT INTO reminder_preferences (user_id)
       VALUES ($1)
       RETURNING *`,
      [req.user.id]
    );
    return res.json(mapReminderPreference(created.rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.put('/api/reminders/preferences', authenticate, async (req, res, next) => {
  try {
    const channels = {
      sms: Boolean(req.body.channels?.sms),
      email: Boolean(req.body.channels?.email),
      whatsapp: Boolean(req.body.channels?.whatsapp)
    };
    const leadTimeHours = Math.min(Math.max(Number(req.body.leadTimeHours) || 24, 1), 168);

    const { rows } = await pool.query(
      `INSERT INTO reminder_preferences (user_id, channels, lead_time_hours, quiet_hours, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE
       SET channels = EXCLUDED.channels,
           lead_time_hours = EXCLUDED.lead_time_hours,
           quiet_hours = EXCLUDED.quiet_hours,
           updated_at = now()
       RETURNING *`,
      [req.user.id, JSON.stringify(channels), leadTimeHours, Boolean(req.body.quietHours)]
    );
    await audit(req, 'UPDATE', 'reminder_preferences', req.user.id);
    return res.json(mapReminderPreference(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.post('/api/notifications', authenticate, async (req, res, next) => {
  try {
    const targetUserId = requireText(req.body.userId, 'usuario', 80);
    const newNotif = await createNotification({
      userId: targetUserId,
      message: requireText(req.body.message, 'mensagem', 500),
      type: req.body.type || 'GENERAL',
      referenceId: req.body.referenceId || req.body.reference_id || null,
    });
    if (!newNotif) {
      return res.status(200).json({ duplicated: true });
    }
    res.status(201).json(newNotif);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/notifications/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query('UPDATE notifications SET read = $1 WHERE id = $2 AND user_id = $3 RETURNING *', [Boolean(req.body.read), req.params.id, req.user.id]);
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
     // Limpar sujeira de sincronizações anteriores incorretas (ex: SP/RJ) e clínicas privadas
     await pool.query("DELETE FROM appointments WHERE unit_id IN (SELECT id FROM units WHERE cnes_code IS NOT NULL AND (city IS NULL OR city NOT ILIKE '%Olinda%') AND local_override = false)");
     await pool.query("DELETE FROM user_units WHERE unit_id IN (SELECT id FROM units WHERE cnes_code IS NOT NULL AND (city IS NULL OR city NOT ILIKE '%Olinda%') AND local_override = false)");
     await pool.query("DELETE FROM units WHERE cnes_code IS NOT NULL AND (city IS NULL OR city NOT ILIKE '%Olinda%') AND local_override = false");

     await pool.query("DELETE FROM appointments WHERE unit_id IN (SELECT id FROM units WHERE (esfera_administrativa = 'PRIVADA' OR natureza_juridica LIKE '2%' OR natureza_juridica LIKE '4%') AND local_override = false)");
     await pool.query("DELETE FROM user_units WHERE unit_id IN (SELECT id FROM units WHERE (esfera_administrativa = 'PRIVADA' OR natureza_juridica LIKE '2%' OR natureza_juridica LIKE '4%') AND local_override = false)");
     await pool.query("DELETE FROM users WHERE unit_id IN (SELECT id FROM units WHERE (esfera_administrativa = 'PRIVADA' OR natureza_juridica LIKE '2%' OR natureza_juridica LIKE '4%') AND local_override = false)");
     await pool.query("DELETE FROM units WHERE esfera_administrativa = 'PRIVADA' AND local_override = false");
     await pool.query("DELETE FROM units WHERE (natureza_juridica LIKE '2%' OR natureza_juridica LIKE '4%') AND local_override = false");
     await pool.query("DELETE FROM units WHERE tipo_unidade ILIKE '%CONSULTORIO ISOLADO%' AND local_override = false");
     setSyncProgress({ progress: 15, message: 'Limpando dados inconsistentes...' });

      const ibgeCode = '260960'; // Olinda (6 digits - IMPORTANTE: a API só aceita 6 dígitos)
      let offset = 0;
      const limit = 20;
      const allRawEstabelecimentos = [];
      let hasMore = true;
      let isSuccess = false;

      setSyncProgress({ progress: 20, message: 'Baixando dados do CNES (isso pode demorar uns instantes)...' });

      while (hasMore) {
        const response = await fetch(`https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=${ibgeCode}&limit=${limit}&offset=${offset}`);
        if (response.ok) {
          isSuccess = true;
          const data = await response.json();
          const pageEstabs = data.estabelecimentos || [];
          if (pageEstabs.length === 0) {
            hasMore = false;
          } else {
            allRawEstabelecimentos.push(...pageEstabs);
            offset += limit;
          }
        } else {
          hasMore = false;
          console.error('[CNES Sync Error] Falha na request na paginação offset', offset, 'status:', response.status);
        }
      }

      if (isSuccess) {
        // Filtra estabelecimentos estritamente públicos (Remove PRIVADA mesmo que diga atender SUS)
        const estabelecimentos = allRawEstabelecimentos.filter(est => {
            const esfera = (est.descricao_esfera_administrativa || '').toUpperCase();
            const natureza = String(est.descricao_natureza_juridica_estabelecimento || '');
            
            // O CNES às vezes cadastra empresas privadas (2xxx) ou pessoas físicas (4xxx)
            // Devemos bloquear qualquer entidade empresarial ou pessoa física
            if (natureza.startsWith('2') || natureza.startsWith('4')) return false;
            
            // Bloquear consultórios particulares classificados como CONSULTORIO ISOLADO
            const tipo = String(est.descricao_tipo_unidade || '').toUpperCase();
            if (tipo.includes('CONSULTORIO ISOLADO')) return false;

            return esfera === 'MUNICIPAL' || esfera === 'ESTADUAL' || esfera === 'FEDERAL';
        });

        setSyncProgress({ progress: 30, message: `Encontrados ${estabelecimentos.length} estabelecimentos SUS. Atualizando banco...` });
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

// Cron Job para cancelar agendamentos atrasados
cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    
    // Calcula o limite considerando a tolerancia de cada unidade
    const { rows: appointments } = await pool.query(`
      SELECT a.id, a.date, a.time, u.tolerance_minutes, u.auto_cancel_no_show
      FROM appointments a
      JOIN units u ON a.unit_id = u.id
      WHERE a.status = 'SCHEDULED' 
      AND a.date <= $1
      AND u.auto_cancel_no_show = true
    `, [currentDate]);

    let cancelledCount = 0;
    
    for (const appt of appointments) {
      if (appt.date < currentDate) {
        // Dias anteriores
        await pool.query('UPDATE appointments SET status = $1 WHERE id = $2', ['NO_SHOW', appt.id]);
        cancelledCount++;
      } else if (appt.date === currentDate) {
        // Hoje, validar horario + tolerancia
        const [hour, minute] = appt.time.split(':').map(Number);
        const tolerance = appt.tolerance_minutes || 15;
        
        const apptTime = new Date();
        apptTime.setHours(hour, minute, 0, 0);
        apptTime.setMinutes(apptTime.getMinutes() + tolerance);

        if (now > apptTime) {
          await pool.query('UPDATE appointments SET status = $1 WHERE id = $2', ['NO_SHOW', appt.id]);
          cancelledCount++;
        }
      }
    }
    
    if (cancelledCount > 0) {
      console.log(`[Auto-Cancel] ${cancelledCount} consultas foram canceladas por falta/atraso.`);
    }

    // E faz a mesma logica para EXAMES
    const { rows: exams } = await pool.query(`
      SELECT e.id, e.date, e.time, u.tolerance_minutes, u.auto_cancel_no_show
      FROM exams e
      JOIN units u ON e.unit_id = u.id
      WHERE e.status = 'SCHEDULED' 
      AND e.date <= $1
      AND u.auto_cancel_no_show = true
    `, [currentDate]);

    let cancelledExamsCount = 0;
    
    for (const exam of exams) {
      if (exam.date < currentDate) {
        // Dias anteriores
        await pool.query('UPDATE exams SET status = $1 WHERE id = $2', ['NO_SHOW', exam.id]);
        cancelledExamsCount++;
      } else if (exam.date === currentDate) {
        // Hoje, validar horario + tolerancia
        const [hour, minute] = exam.time.split(':').map(Number);
        const tolerance = exam.tolerance_minutes || 15;
        
        const examTime = new Date();
        examTime.setHours(hour, minute, 0, 0);
        examTime.setMinutes(examTime.getMinutes() + tolerance);

        if (now > examTime) {
          await pool.query('UPDATE exams SET status = $1 WHERE id = $2', ['NO_SHOW', exam.id]);
          cancelledExamsCount++;
        }
      }
    }

    if (cancelledExamsCount > 0) {
      console.log(`[Auto-Cancel] ${cancelledExamsCount} exames foram cancelados por falta/atraso.`);
    }
  } catch (err) {
    console.error('[Auto-Cancel] Falha ao executar rotina de cancelamento:', err);
  }
});

cron.schedule('*/15 * * * *', async () => {
  try {
    const { rows } = await pool.query(`
      SELECT u.*,
        (SELECT string_agg(unit_id::text, ',') FROM user_units WHERE user_id = u.id) as unit_ids
      FROM users u
      WHERE u.role = 'PATIENT' AND u.active = true
    `);

    for (const row of rows) {
      await enqueuePatientReminders(mapUser(row), { emit: true });
    }
  } catch (error) {
    console.error('[Reminders] Erro ao gerar lembretes:', error.message);
  }
});

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
    await enqueuePatientReminders(req.user, { emit: false });

    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 AND read = false ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows.map(mapNotification));
  } catch (err) {
    next(err);
  }
});

app.post('/api/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
     const notifId = req.params.id;
     const userId = req.user.id;
     
     await pool.query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2', [notifId, userId]);
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
