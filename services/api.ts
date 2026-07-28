import { User, Patient, Appointment, HealthUnit, Specialty, Notification, Exam, ExamType, CareHistoryItem, ReminderPreference, HealthPost, HealthPostPayload } from '../types';

const SESSION_USER_KEY = 'health_user';
const ACCESS_TOKEN_KEY = 'auth_token';
const REQUEST_TIMEOUT_MS = 15000;

const normalizeApiUrl = (url?: string) => {
  let cleaned = (url || '').trim().replace(/\/+$/, '');
  if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned;
};
export const apiOrigin = normalizeApiUrl(import.meta.env.VITE_API_URL) || window.location.origin;
const API_URL = apiOrigin.endsWith('/api') ? apiOrigin : `${apiOrigin}/api`;

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;
type AuthUser = User & { password?: string };
type UserWritePayload = Omit<User, 'id'> & { password?: string };
type UserUpdatePayload = Partial<User> & { password?: string };

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const clearSession = () => {
  localStorage.removeItem(SESSION_USER_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
};

const sanitizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

const sanitizeUser = (user: AuthUser): User => {
  const { password, ...safeUser } = user;
  return safeUser;
};

const getHeaders = () => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const buildUrl = (endpoint: string, params?: QueryParams) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = new URL(cleanEndpoint, `${API_URL}/`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
};

const parseResponse = async (response: Response) => {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (response.ok) {
      throw new ApiError('Resposta invalida da API.', response.status);
    }

    return null;
  }

  return response.json();
};

const request = async <T>(endpoint: string, options: RequestInit = {}, params?: QueryParams): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(endpoint, params), {
      ...options,
      headers: { ...getHeaders(), ...options.headers },
      credentials: 'omit',
      signal: controller.signal
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearSession();
      }

      const message = typeof data?.error === 'string'
        ? data.error
        : 'Nao foi possivel concluir a requisicao.';

      throw new ApiError(message, response.status);
    }

    return data as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const pathId = (id: string) => encodeURIComponent(id);

const saveAuthSession = (data: { token?: string; user?: User }) => {
  if (data.token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.token);
  }

  if (data.user) {
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(sanitizeUser(data.user)));
  }
};

export const api = {
  auth: {
    loginProfessional: async (matricula: string, password: string) => {
      try {
        const data = await request<{ token?: string; user: AuthUser; unit?: HealthUnit }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            matricula: sanitizeText(matricula),
            password
          })
        });

        saveAuthSession(data);
        return data;
      } catch {
        return null;
      }
    },
    login: async (matricula: string, password?: string) => {
      if (!password) return null;
      return api.auth.loginProfessional(matricula, password);
    },
    loginPatient: async (name: string, susNumber: string) => {
      try {
        const data = await request<{ token?: string; user: AuthUser; unit: HealthUnit }>('/auth/login-patient', {
          method: 'POST',
          body: JSON.stringify({
            name: sanitizeText(name),
            susNumber: sanitizeText(susNumber)
          })
        });

        saveAuthSession(data);
        return data;
      } catch {
        return null;
      }
    },
    registerPatient: async (payload: { name: string, rg?: string, cpf: string, birthDate: string, address: string, cep: string, phone: string, susNumber: string, email: string, unitId: string }) => {
      try {
        const data = await request<{ token?: string; user: AuthUser; unit: HealthUnit }>('/auth/register-patient', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        saveAuthSession(data);
        return data;
      } catch {
        return null;
      }
    },
    logout: clearSession
  },
  units: {
    getAll: async () => request<HealthUnit[]>('/units').catch(() => []),
    getById: async (id: string) => request<HealthUnit | null>(`/units/${pathId(id)}`)
      .catch(() => null),
    add: (unit: Omit<HealthUnit, 'id'>) => request<HealthUnit>('/units', { method: 'POST', body: JSON.stringify(unit) }),
    update: (id: string, updates: Partial<HealthUnit>) => request<HealthUnit>(`/units/${pathId(id)}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    delete: (id: string) => request<void>(`/units/${pathId(id)}`, { method: 'DELETE' }),
    restoreCnes: (id: string) => request<void>(`/units/${pathId(id)}/restore-cnes`, { method: 'POST' })
  },
  specialties: {
    getAll: async () => request<Specialty[]>('/specialties').catch(() => []),
    add: (specialty: Omit<Specialty, 'id'>) => request<Specialty>('/specialties', { method: 'POST', body: JSON.stringify(specialty) }),
    update: (id: string, updates: Partial<Specialty>) => request<Specialty>(`/specialties/${pathId(id)}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    delete: (id: string) => request<void>(`/specialties/${pathId(id)}`, { method: 'DELETE' })
  },
  examTypes: {
    getAll: async () => request<ExamType[]>('/exam-types').catch(() => []),
    add: (examType: Omit<ExamType, 'id'>) => request<ExamType>('/exam-types', { method: 'POST', body: JSON.stringify(examType) }),
    update: (id: string, updates: Partial<ExamType>) => request<ExamType>(`/exam-types/${pathId(id)}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    delete: (id: string) => request<void>(`/exam-types/${pathId(id)}`, { method: 'DELETE' })
  },
  healthPosts: {
    getPublished: async () => request<HealthPost[]>('/health-posts').catch(() => []),
    getAll: async () => request<HealthPost[]>('/admin/health-posts').catch(() => []),
    add: (post: HealthPostPayload) => request<HealthPost>('/admin/health-posts', { method: 'POST', body: JSON.stringify(post) }),
    update: (id: string, updates: Partial<HealthPostPayload>) => request<HealthPost>(`/admin/health-posts/${pathId(id)}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    delete: (id: string) => request<void>(`/admin/health-posts/${pathId(id)}`, { method: 'DELETE' })
  },
  users: {
    getAll: async () => request<User[]>('/users').catch(() => []),
    getByUnit: async (unitId: string) => request<User[]>('/users', {}, { unitId })
      .catch(() => []),
    getDoctorsByUnit: async (unitId: string) => request<User[]>('/users', {}, { unitId, role: 'DOCTOR' })
      .catch(() => []),
    add: (user: UserWritePayload) => request<User>('/users', { method: 'POST', body: JSON.stringify(user) }),
    update: (id: string, user: UserUpdatePayload) => request<User>(`/users/${pathId(id)}`, { method: 'PATCH', body: JSON.stringify(user) }),
    updateProfile: (data: { name?: string; email?: string; password?: string; unitId?: string }) => request<User>('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/users/${pathId(id)}`, { method: 'DELETE' }),
    restoreCnes: (id: string) => request<void>(`/users/${pathId(id)}/restore-cnes`, { method: 'POST' })
  },
  notifications: {
    getForUser: () => request<Notification[]>('/notifications'),
    add: (userId: string, message: string) => request<Notification>('/notifications', { method: 'POST', body: JSON.stringify({ userId, message: sanitizeText(message) }) }),
    markAsRead: (id: string) => request<Notification>(`/notifications/${pathId(id)}/read`, { method: 'POST' })
  },
  patients: {
    getAll: async () => request<Patient[]>('/patients').catch(() => []),
    getByUnit: async (unitId: string) => request<Patient[]>('/patients', {}, { unitId })
      .catch(() => []),
    getByUserId: async (userId: string) => {
      const patients = await request<Patient[]>('/patients', {}, { userId }).catch(() => []);
      return patients[0] ?? null;
    },
    add: (patient: Omit<Patient, 'id'>) => request<Patient>('/patients', { method: 'POST', body: JSON.stringify(patient) }),
    update: (id: string, updates: Partial<Patient>) => request<Patient>(`/patients/${pathId(id)}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    delete: (id: string) => request<void>(`/patients/${pathId(id)}`, { method: 'DELETE' })
  },
  appointments: {
    getAll: () => request<Appointment[]>('/appointments').catch(() => []),
    getByUnit: (unitId: string) => request<Appointment[]>('/appointments', {}, { unitId }).catch(() => []),
    getByPatientId: (patientId: string) => request<Appointment[]>('/appointments', {}, { patientId }).catch(() => []),
    add: (appt: Omit<Appointment, 'id' | 'status'>) => request<Appointment>('/appointments', { method: 'POST', body: JSON.stringify(appt) }),
    checkIn: (id: string, priority = false) => request<Appointment>(`/appointments/${pathId(id)}/check-in`, { method: 'POST', body: JSON.stringify({ priority }) }),
    call: (id: string, callLocation?: string) => request<Appointment>(`/appointments/${pathId(id)}/call`, {
      method: 'POST',
      body: JSON.stringify(callLocation ? { callLocation: sanitizeText(callLocation) } : {})
    }),
    update: (id: string, updates: Partial<Appointment>) => request<Appointment>(`/appointments/${pathId(id)}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    cancel: (id: string, reason?: string) => request<Appointment>(`/appointments/${pathId(id)}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) })
  },
  exams: {
    getAll: () => request<Exam[]>('/exams').catch(() => []),
    getByPatientId: (patientId: string) => request<Exam[]>('/exams', {}, { patientId })
      .catch(() => []),
    getByUnit: (unitId: string) => request<Exam[]>('/exams', {}, { unitId }).catch(() => []),
    add: (exam: Omit<Exam, 'id' | 'status' | 'resultAvailable'>) => request<Exam>('/exams', { method: 'POST', body: JSON.stringify(exam) }),
    update: (id: string, updates: Partial<Exam>) => request<Exam>(`/exams/${pathId(id)}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    cancel: (id: string, reason: string) => request<Exam>(`/exams/${pathId(id)}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) })
  },
  careHistory: {
    getByPatientId: (patientId: string) => request<CareHistoryItem[]>('/care-history', {}, { patientId })
      .catch(() => [])
  },
  reminders: {
    getPreferences: () => request<ReminderPreference>('/reminders/preferences'),
    savePreferences: (preferences: ReminderPreference) => request<ReminderPreference>('/reminders/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences)
    })
  },
  system: {
    syncCnes: () => request<void>('/sync/cnes', { method: 'POST' }),
    syncCnesProfessionals: () => request<void>('/sync/cnes/professionals', { method: 'POST' })
  }
};
