export enum UserRole {
  ADMIN = 'ADMIN',
  GENERAL_SUPERVISOR = 'GENERAL_SUPERVISOR',
  ATTENDANT = 'ATTENDANT',
  DOCTOR = 'DOCTOR',
  SOCIAL_WORKER = 'SOCIAL_WORKER',
  PATIENT = 'PATIENT'
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

export enum ExamStatus {
  SCHEDULED = 'SCHEDULED',
  AVAILABLE = 'AVAILABLE',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

export type AttendanceType = 'CHEGADA' | 'SENHA';

export interface OperatingHour {
  dayOfWeek: number; // 0 (Sun) to 6 (Sat) or 1-7, let's use 1 (Mon) - 7 (Sun)
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface HealthUnitService {
  id: string;
  unitId: string;
  cnesCode?: string;
  name: string;
  classification?: string;
  atendeSus?: boolean;
}

export interface HealthUnit {
  id: string;
  name: string;
  cep?: string;
  address: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  phone: string;
  attendanceType?: AttendanceType;
  // CNES Specifics
  cnesCode?: string;
  razaoSocial?: string;
  tipoUnidade?: string;
  esferaAdministrativa?: string;
  naturezaJuridica?: string;
  atendeSus?: boolean;
  fluxoAtendimento?: string;
  situacao?: string;
  ultimaAtualizacao?: string;
  ibgeCode?: string;
  latitude?: string;
  longitude?: string;
  localOverride?: boolean;
  overriddenFields?: string[];
  operatingHours?: OperatingHour[];
  secondaryActivities?: string[];
  services?: HealthUnitService[];
  isHospital?: boolean;
  toleranceMinutes?: number;
  autoCancelNoShow?: boolean;
}

export interface HealthUnitService {
  id: string;
  unitId: string;
  cnesCode?: string;
  name: string;
  classification?: string;
  atendeSus?: boolean;
}

export interface HealthUnitEquipment {
  id: string;
  unitId: string;
  cnesCode?: string;
  type: string;
  quantity: number;
  status?: string;
  inUseSus?: boolean;
}

export interface HealthUnitBed {
  id: string;
  unitId: string;
  cnesCode?: string;
  type: string;
  totalQuantity: number;
  susQuantity: number;
}

export interface HealthUnitTeam {
  id: string;
  unitId: string;
  ineCode?: string;
  cnesCode?: string;
  type: string;
  name: string;
}

export interface DoctorSchedule {
  dayOfWeek: number; // 0 = Domingo, 1 = Segunda...
  startTime: string; // "08:00"
  endTime: string; // "17:00"
}

export interface Specialty {
  id: string;
  name: string;
  schedule?: DoctorSchedule[];
  maxDailyAppointments?: number;
  isGlobal?: boolean;
  unitIds?: string[];
  cnesCode?: string; // Código padrão DATASUS
}

export interface ExamType {
  id: string;
  name: string;
  schedule: DoctorSchedule[];
  maxDailyAppointments?: number;
  isGlobal: boolean;
  unitIds?: string[];
  requiresReferral?: boolean;
  preparation?: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
  type?: string;
  reference_id?: string;
}

export type HealthPostIcon =
  | 'shield'
  | 'heart'
  | 'bell'
  | 'newspaper'
  | 'calendar'
  | 'stethoscope'
  | 'syringe'
  | 'megaphone';

export interface HealthPost {
  id: string;
  title: string;
  context: string;
  text: string;
  icon: HealthPostIcon;
  imageUrl: string;
  published: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type HealthPostPayload = Omit<HealthPost, 'id' | 'createdAt' | 'updatedAt'>;

export interface User {
  id: string;
  name: string;
  matricula?: string;
  email: string;
  role: UserRole;
  specialtyId?: string; // Changed from string to ID reference
  crm?: string;
  unitId?: string; // Kept as optional for backwards compatibility and default unit
  unitIds?: string[]; // Array for multiple units
  schedule?: DoctorSchedule[]; // Available hours
  maxDailyPatients?: number; // New field for daily capacity
  susNumber?: string; // Added susNumber since Layout.tsx uses it
  cep?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  // CNES Specifics
  cnesId?: string;
  cpf?: string;
  conselhoTipo?: string;
  registroConselho?: string;
  cboCodigo?: string;
  cboDescricao?: string;
  cargaHoraria?: number;
  vinculoTipo?: string;
  situacaoVinculo?: string;
  localOverride?: boolean;
  overriddenFields?: string[];
}

export interface Patient {
  id: string;
  name: string;
  cpf: string;
  rg?: string;
  susNumber?: string;
  gender?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  phone: string;
  birthDate: string;
  email?: string;
  motherName?: string;
  observations?: string;
  unitId?: string;
  unitIds?: string[];
  userId?: string; // Link to a login user if they have access
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  unitId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: AppointmentStatus;
  notes?: string;
  aiSummary?: string;
  queuePassword?: string;
  checkInTime?: string;
  calledAt?: string;
  callLocation?: string;
}

export interface Exam {
  id: string;
  patientId: string;
  unitId: string;
  type: string;
  requestCode?: string;
  date: string;
  time: string;
  status: ExamStatus;
  preparation?: string;
  resultAvailable?: boolean;
  notes?: string;
  referralAttachment?: string;
  cancelReason?: string;
}

export interface CareHistoryItem {
  id: string;
  patientId: string;
  unitId: string;
  date: string;
  service: string;
  summary: string;
  professionalName: string;
}

export interface ReminderPreference {
  id?: string;
  userId: string;
  channels: {
    sms: boolean;
    email: boolean;
    whatsapp: boolean;
  };
  leadTimeHours: number;
  quietHours: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
