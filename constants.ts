import { User, UserRole, Patient, Appointment, AppointmentStatus, HealthUnit, Specialty } from './types';

export const MOCK_UNITS: HealthUnit[] = [
  {
    id: 'olinda-rio-doce',
    name: 'USF Rio Doce',
    address: 'Rio Doce, Olinda - PE',
    neighborhood: 'Rio Doce',
    city: 'Olinda',
    state: 'PE',
    phone: '(81) 0000-0000',
    attendanceType: 'CHEGADA'
  },
  {
    id: 'olinda-peixinhos',
    name: 'USF Peixinhos',
    address: 'Peixinhos, Olinda - PE',
    neighborhood: 'Peixinhos',
    city: 'Olinda',
    state: 'PE',
    phone: '(81) 0000-0000',
    attendanceType: 'CHEGADA'
  },
  {
    id: 'olinda-bairro-novo',
    name: 'USF Bairro Novo',
    address: 'Bairro Novo, Olinda - PE',
    neighborhood: 'Bairro Novo',
    city: 'Olinda',
    state: 'PE',
    phone: '(81) 0000-0000',
    attendanceType: 'CHEGADA'
  },
  {
    id: 'olinda-jardim-brasil',
    name: 'USF Jardim Brasil',
    address: 'Jardim Brasil, Olinda - PE',
    neighborhood: 'Jardim Brasil',
    city: 'Olinda',
    state: 'PE',
    phone: '(81) 0000-0000',
    attendanceType: 'CHEGADA'
  },
  {
    id: 'olinda-aguazinha',
    name: 'USF Aguazinha',
    address: 'Aguazinha, Olinda - PE',
    neighborhood: 'Aguazinha',
    city: 'Olinda',
    state: 'PE',
    phone: '(81) 0000-0000',
    attendanceType: 'CHEGADA'
  },
  {
    id: 'olinda-casa-caiada',
    name: 'USF Casa Caiada',
    address: 'Casa Caiada, Olinda - PE',
    neighborhood: 'Casa Caiada',
    city: 'Olinda',
    state: 'PE',
    phone: '(81) 0000-0000',
    attendanceType: 'CHEGADA'
  }
];

export const MOCK_SPECIALTIES: Specialty[] = [
  { id: '1', name: 'Cardiologia' },
  { id: '2', name: 'Pediatria' },
  { id: '3', name: 'Clínica Geral' },
  { id: '4', name: 'Dermatologia' },
  { id: '5', name: 'Ortopedia' },
  { id: '6', name: 'Dentista' }
];

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Admin Geral', matricula: 'ADMIN001', email: 'admin@health.com', role: UserRole.ADMIN, unitId: '1' },
  { 
    id: '2', 
    name: 'Dr. Roberto Silva', 
    matricula: 'MED001',
    email: 'doctor@health.com', 
    role: UserRole.DOCTOR, 
    specialtyId: '1', 
    unitId: '1',
    maxDailyPatients: 10,
    schedule: [
      { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }, // Seg
      { dayOfWeek: 3, startTime: '08:00', endTime: '12:00' }, // Qua
      { dayOfWeek: 5, startTime: '08:00', endTime: '17:00' }, // Sex
    ]
  },
  { 
    id: '3', 
    name: 'Dra. Ana Costa', 
    matricula: 'MED002',
    email: 'ana@health.com', 
    role: UserRole.DOCTOR, 
    specialtyId: '6', // Dentista 
    unitId: '1',
    maxDailyPatients: 8,
    schedule: [
      { dayOfWeek: 2, startTime: '13:00', endTime: '18:00' }, // Ter
      { dayOfWeek: 4, startTime: '13:00', endTime: '18:00' }, // Qui
    ]
  },
  { id: '4', name: 'João Atendente', email: 'attendant@health.com', role: UserRole.ATTENDANT, unitId: '1' },
  { id: '99', name: 'Carlos Paciente', email: 'paciente@health.com', role: UserRole.PATIENT, unitId: '1' }, // Demo Patient
];

export const MOCK_PATIENTS: Patient[] = [
  { id: '101', name: 'Carlos Paciente', userId: '99', cpf: '123.456.789-00', susNumber: '700000000000000', phone: '(11) 99999-1234', birthDate: '1985-05-15', unitId: '1' },
  { id: '102', name: 'Maria Santos', cpf: '234.567.890-11', phone: '(11) 98888-5678', birthDate: '1990-10-20', unitId: '1' },
  { id: '103', name: 'Pedro Souza', cpf: '345.678.901-22', phone: '(21) 97777-4321', birthDate: '2015-02-01', unitId: '1' },
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  { id: '501', patientId: '101', doctorId: '2', unitId: '1', date: new Date().toISOString().split('T')[0], time: '09:00', status: AppointmentStatus.SCHEDULED, notes: 'Checkup anual' },
];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Agendado',
  [AppointmentStatus.COMPLETED]: 'Concluído',
  [AppointmentStatus.CANCELLED]: 'Cancelado',
  [AppointmentStatus.NO_SHOW]: 'Não Compareceu'
};

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.GENERAL_SUPERVISOR]: 'Supervisor Geral',
  [UserRole.ATTENDANT]: 'Atendente',
  [UserRole.DOCTOR]: 'Médico',
  [UserRole.SOCIAL_WORKER]: 'Assistente Social',
  [UserRole.PATIENT]: 'Paciente'
};
