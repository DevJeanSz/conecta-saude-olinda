import bcrypt from 'bcryptjs';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL nao configurada.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

const passwordHash = await bcrypt.hash('Demo@123456', 12);

try {
  await pool.query('BEGIN');

  const unit = await pool.query(
    `INSERT INTO units (name, address, phone, city, state, attendance_type)
     VALUES ($1, $2, $3, 'Olinda', 'PE', 'SENHA')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    ['USF Demo Olinda', 'Rua de Demonstracao, 100', '(81) 0000-0000']
  );

  const unitId = unit.rows[0]?.id || (await pool.query("SELECT id FROM units WHERE name = 'USF Demo Olinda' LIMIT 1")).rows[0].id;

  await pool.query("INSERT INTO specialties (name) VALUES ('Clinica Geral') ON CONFLICT (name) DO NOTHING");
  const specialtyId = (await pool.query("SELECT id FROM specialties WHERE name = 'Clinica Geral' LIMIT 1")).rows[0].id;

  await pool.query(
    `INSERT INTO users (name, matricula, email, password_hash, role, unit_id)
     VALUES ($1, 'ADMIN001', $2, $3, 'ADMIN', $4)
     ON CONFLICT (matricula) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    ['Gestor Demo', 'gestor.demo@olinda.local', passwordHash, unitId]
  );

  const doctor = await pool.query(
    `INSERT INTO users (name, matricula, email, password_hash, role, specialty_id, unit_id, schedule, max_daily_patients)
     VALUES ($1, 'MED001', $2, $3, 'DOCTOR', $4, $5, $6, 12)
     ON CONFLICT (matricula) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    ['Dra. Ana Bezerra', 'ana.bezerra@olinda.local', passwordHash, specialtyId, unitId, JSON.stringify([{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }])]
  );
  const doctorId = doctor.rows[0]?.id || (await pool.query("SELECT id FROM users WHERE matricula = 'MED001'")).rows[0].id;

  const patientUser = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, unit_id)
     VALUES ($1, $2, $3, 'PATIENT', $4)
     RETURNING id`,
    ['Carlos Paciente', 'carlos.paciente@olinda.local', passwordHash, unitId]
  );

  const patient = await pool.query(
    `INSERT INTO patients (name, cpf, sus_number, phone, birth_date, unit_id, user_id)
     VALUES ($1, '000.000.000-00', '700000000000000', '(81) 99999-0000', '1985-05-15', $2, $3)
     RETURNING id`,
    ['Carlos Paciente', unitId, patientUser.rows[0].id]
  );

  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await pool.query(
    `INSERT INTO appointments (patient_id, doctor_id, unit_id, date, time, notes)
     VALUES ($1, $2, $3, $4, '09:00', 'Consulta ficticia de demonstracao')`,
    [patient.rows[0].id, doctorId, unitId, date]
  );

  await pool.query('COMMIT');
  console.log('Seed ficticio aplicado.');
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
} finally {
  await pool.end();
}
