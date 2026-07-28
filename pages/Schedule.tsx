import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  UserRole,
  Appointment,
  Patient,
  AppointmentStatus,
  Specialty,
  HealthUnit,
  Exam,
  ExamStatus,
} from '../types';
import { api } from '../services/api';
import { STATUS_LABELS } from '../constants';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  Plus,
  Search,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';

interface ScheduleProps {
  user: User;
}

type PatientLookupFeedback = {
  type: 'found' | 'not-found';
  message: string;
} | null;



const normalizeDigits = (value = '') => value.replace(/\D/g, '');

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string) => {
  if (!value) return new Date(NaN);
  const dateStr = value.includes('T') ? value.split('T')[0] : value;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getWorkWeekStart = (date: Date) => {
  const next = new Date(date);
  const day = next.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + mondayOffset);
  return next;
};

const getCurrentSlot = () => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(minutes / 30) * 30;
  const clamped = Math.min(Math.max(rounded, 8 * 60), 17 * 60 + 30);
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const statusClass = {
  [AppointmentStatus.SCHEDULED]: 'scheduled',
  [AppointmentStatus.COMPLETED]: 'completed',
  [AppointmentStatus.CANCELLED]: 'cancelled',
  [AppointmentStatus.NO_SHOW]: 'no-show',
};

const canManageAllUnits = (user: User) =>
  user.role === UserRole.ADMIN || user.role === UserRole.GENERAL_SUPERVISOR;

const getUserUnitIds = (user: User) =>
  Array.from(new Set([user.unitId, ...(user.unitIds || [])].filter(Boolean) as string[]));

const isSpecialtyEnabledForUnit = (specialty: Specialty, unitId: string) =>
  Boolean(unitId && (specialty.isGlobal || specialty.unitIds?.includes(unitId)));

const formatDateOption = (value: string) =>
  parseDateInput(value).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

const formatPatientAddress = (patient: Patient) => {
  const street = [patient.address, patient.addressNumber].filter(Boolean).join(', ');
  const cityState = [patient.city, patient.state].filter(Boolean).join(' - ');

  return [
    street,
    patient.neighborhood,
    cityState,
    patient.cep ? `CEP ${patient.cep}` : '',
  ].filter(Boolean).join(' | ');
};

const getPatientVisibleUnitId = (
  patient: Patient,
  visibleUnits: HealthUnit[],
  fallbackUnitId: string,
) => {
  const visibleUnitIds = new Set(visibleUnits.map((availableUnit) => availableUnit.id));
  const patientUnitIds = [patient.unitId, ...(patient.unitIds || [])].filter(Boolean) as string[];
  return patientUnitIds.find((unitId) => visibleUnitIds.has(unitId)) || fallbackUnitId;
};

export const Schedule: React.FC<ScheduleProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientLookupPool, setPatientLookupPool] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [unit, setUnit] = useState<HealthUnit | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState(user.unitId || user.unitIds?.[0] || '');
  const [unitSearch, setUnitSearch] = useState('');
  const [isUnitSelectOpen, setIsUnitSelectOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'PLANTÃO' | 'COMERCIAL' | '24H'>('COMERCIAL');
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()));
  const [query, setQuery] = useState('');
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewApptModal, setShowNewApptModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<{ type: 'appointment' | 'exam', data: any } | null>(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [identifiedPatientId, setIdentifiedPatientId] = useState<string | null>(null);
  const [patientLookupFeedback, setPatientLookupFeedback] = useState<PatientLookupFeedback>(null);
  const [newApptData, setNewApptData] = useState({
    patientName: '',
    susNumber: '',
    cpf: '',
    rg: '',
    address: '',
    unitId: user.unitId || user.unitIds?.[0] || '',
    specialtyId: '',
    date: selectedDate,
    time: '',
    notes: '',
    returnVisit: false,
  });

  const loadData = async () => {
    setLoadingSchedule(true);
    try {
      const [allUnits, allSpecialties] = await Promise.all([
        api.units.getAll(),
        api.specialties.getAll(),
      ]);
      const userUnitIds = getUserUnitIds(user);
      const visibleUnits = canManageAllUnits(user)
        ? allUnits
        : allUnits.filter((availableUnit) => userUnitIds.includes(availableUnit.id));
      const activeUnitId = selectedUnitId || user.unitId || visibleUnits[0]?.id || '';

      setUnits(visibleUnits);

      if (!activeUnitId) {
        setAppointments([]);
        setExams([]);
        setPatients([]);
        setPatientLookupPool([]);
        setDoctors([]);
        setSpecialties(allSpecialties);
        setUnit(null);
        return;
      }

      if (selectedUnitId !== activeUnitId) {
        setSelectedUnitId(activeUnitId);
      }

      const unitPatientsPromise = api.patients.getByUnit(activeUnitId);
      const patientLookupPromise = canManageAllUnits(user)
        ? api.patients.getAll()
        : unitPatientsPromise;

      const [unitAppts, unitExams, unitPatients, searchablePatients, unitDoctors, unitData] = await Promise.all([
        api.appointments.getByUnit(activeUnitId),
        api.exams.getByUnit(activeUnitId),
        unitPatientsPromise,
        patientLookupPromise,
        api.users.getDoctorsByUnit(activeUnitId),
        api.units.getById(activeUnitId),
      ]);

      const scopedAppointments = user.role === UserRole.DOCTOR
        ? unitAppts.filter((appointment) => appointment.doctorId === user.id)
        : unitAppts;

      setAppointments(scopedAppointments);
      setExams(unitExams);
      setPatients(unitPatients);
      setPatientLookupPool(searchablePatients);
      setDoctors(unitDoctors);
      setSpecialties(allSpecialties);
      setUnit(unitData);
      setNewApptData((current) => ({
        ...current,
        unitId: current.unitId || activeUnitId,
      }));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setAppointments([]);
      setExams([]);
      setPatients([]);
      setPatientLookupPool([]);
      setDoctors([]);
      setSpecialties([]);
      setUnits([]);
      setUnit(null);
    } finally {
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id, user.unitId, selectedUnitId]);

  const selectedDateObj = useMemo(() => parseDateInput(selectedDate), [selectedDate]);
  const weekStart = useMemo(() => getWorkWeekStart(selectedDateObj), [selectedDateObj]);
  const visibleDays = useMemo(() => Array.from({ length: 5 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  const activeUnitId = selectedUnitId || user.unitId || '';

  const getSpecialtiesForUnit = (unitId: string) => specialties.filter((specialty) =>
    isSpecialtyEnabledForUnit(specialty, unitId),
  );

  const validSpecialties = useMemo(
    () => getSpecialtiesForUnit(activeUnitId),
    [activeUnitId, specialties],
  );

  const appointmentUnitSpecialties = useMemo(
    () => getSpecialtiesForUnit(newApptData.unitId),
    [newApptData.unitId, specialties],
  );

  const TIME_SLOTS = useMemo(() => {
    if (viewMode === 'PLANTÃO') {
      return Array.from({ length: 25 }, (_, index) => {
        const totalMinutes = 7 * 60 + index * 30;
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      });
    }
    if (viewMode === '24H') {
      return Array.from({ length: 48 }, (_, index) => {
        const totalMinutes = index * 30;
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      });
    }
    return Array.from({ length: 20 }, (_, index) => {
      const totalMinutes = 8 * 60 + index * 30;
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    });
  }, [viewMode]);

  const validSpecialtyIds = useMemo(
    () => validSpecialties.map((specialty) => specialty.id),
    [validSpecialties],
  );

  const validDoctors = useMemo(() => doctors.filter(
    (doctor) => doctor.specialtyId && validSpecialtyIds.includes(doctor.specialtyId),
  ), [doctors, validSpecialtyIds]);

  const searchablePatients = useMemo(() => {
    const map = new Map<string, Patient>();
    patients.forEach((patient) => map.set(patient.id, patient));
    patientLookupPool.forEach((patient) => map.set(patient.id, patient));
    return Array.from(map.values());
  }, [patientLookupPool, patients]);

  const patientBySusNumber = useMemo(() => {
    const map = new Map<string, Patient>();
    searchablePatients.forEach((patient) => {
      const susDigits = normalizeDigits(patient.susNumber);
      if (susDigits) {
        map.set(susDigits, patient);
      }
    });
    return map;
  }, [searchablePatients]);

  const patientNameById = useMemo(() => new Map(searchablePatients.map((patient) => [patient.id, patient.name])), [searchablePatients]);
  const doctorNameById = useMemo(() => new Map(doctors.map((doctor) => [doctor.id, doctor.name])), [doctors]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    
    const combined = [
      ...appointments.map(a => ({ type: 'appointment' as const, data: a })),
      ...exams.map(e => ({ type: 'exam' as const, data: e }))
    ];

    return combined.filter((event) => {
      const patientName = patientNameById.get(event.data.patientId) || '';
      const docOrType = event.type === 'appointment'
        ? (doctorNameById.get(event.data.doctorId) || '')
        : 'Exame';
      
      return !normalizedQuery
        || patientName.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
        || docOrType.toLocaleLowerCase('pt-BR').includes(normalizedQuery);
    });
  }, [appointments, exams, doctorNameById, patientNameById, query]);

  const eventsBySlot = useMemo(() => {
    const map = new Map<string, Array<{ type: 'appointment' | 'exam', data: any }>>();
    filteredEvents.forEach((event) => {
      const key = `${event.data.date}-${event.data.time}`;
      const current = map.get(key) || [];
      current.push(event);
      map.set(key, current);
    });
    return map;
  }, [filteredEvents]);

  const selectedDayEvents = useMemo(() => filteredEvents
    .filter((event) => event.data.date === selectedDate)
    .sort((a, b) => a.data.time.localeCompare(b.data.time)), [filteredEvents, selectedDate]);

  const weekEventsCount = useMemo(() => {
    const start = toDateInputValue(weekStart);
    const end = toDateInputValue(addDays(weekStart, 7));
    return filteredEvents.filter((event) => event.data.date >= start && event.data.date < end).length;
  }, [filteredEvents, weekStart]);

  const isScheduleOpen = (schedule: { dayOfWeek: number; startTime: string; endTime: string }[] | undefined, date: string, time?: string) => {
    if (!schedule || schedule.length === 0) return true;
    const dayOfWeek = parseDateInput(date).getDay();
    return schedule.some((item) =>
      item.dayOfWeek === dayOfWeek &&
      (!time || (time >= item.startTime && time < item.endTime)),
    );
  };

  const hasSpecialtyDailyCapacity = (specialtyId: string, date: string, sourceAppointments = appointments) => {
    const selectedSpecialty = specialties.find((specialty) => specialty.id === specialtyId);
    if (!selectedSpecialty?.maxDailyAppointments) return true;
    const specialtyDoctorIds = doctors
      .filter((doctor) => doctor.specialtyId === specialtyId)
      .map((doctor) => doctor.id);
    const specialtyDailyCount = sourceAppointments.filter(
      (appointment) =>
        specialtyDoctorIds.includes(appointment.doctorId) &&
        appointment.date === date &&
        appointment.status !== AppointmentStatus.CANCELLED,
    ).length;
    return specialtyDailyCount < selectedSpecialty.maxDailyAppointments;
  };

  const getAvailableDoctorsForSlot = (
    unitId: string,
    specialtyId: string,
    date: string,
    time: string,
    sourceAppointments = appointments,
  ) => {
    if (!unitId || !specialtyId || !date || !time) return [];
    const selectedSpecialty = specialties.find((specialty) => specialty.id === specialtyId);
    if (!selectedSpecialty || !isSpecialtyEnabledForUnit(selectedSpecialty, unitId)) return [];
    if (!isScheduleOpen(selectedSpecialty.schedule, date, time)) return [];
    if (!hasSpecialtyDailyCapacity(specialtyId, date, sourceAppointments)) return [];

    return validDoctors.filter((doctor) => {
      if (doctor.specialtyId !== specialtyId) return false;
      if (!isScheduleOpen(doctor.schedule, date, time)) return false;

      const dailyAppointments = sourceAppointments.filter(
        (appointment) =>
          appointment.doctorId === doctor.id &&
          appointment.date === date &&
          appointment.status !== AppointmentStatus.CANCELLED,
      );

      if (doctor.maxDailyPatients && dailyAppointments.length >= doctor.maxDailyPatients) return false;

      return !dailyAppointments.some((appointment) => appointment.time === time);
    });
  };

  const getAvailableDateOptions = (unitId: string, specialtyId: string) => {
    if (!unitId || !specialtyId) return [];

    return Array.from({ length: 60 }, (_, index) => toDateInputValue(addDays(new Date(), index)))
      .filter((date) => {
        const selectedSpecialty = specialties.find((specialty) => specialty.id === specialtyId);
        if (!selectedSpecialty) return false;
        if (!isScheduleOpen(selectedSpecialty.schedule, date)) return false;
        if (!hasSpecialtyDailyCapacity(specialtyId, date)) return false;
        return TIME_SLOTS.some((time) => getAvailableDoctorsForSlot(unitId, specialtyId, date, time).length > 0);
      })
      .map((date) => ({
        value: date,
        label: formatDateOption(date),
      }));
  };

  const getAvailableTimeOptions = (unitId: string, specialtyId: string, date: string) => {
    if (!unitId || !specialtyId || !date) return [];
    return TIME_SLOTS.filter((time) => getAvailableDoctorsForSlot(unitId, specialtyId, date, time).length > 0);
  };

  const availableDateOptions = useMemo(
    () => getAvailableDateOptions(newApptData.unitId, newApptData.specialtyId),
    [appointments, doctors, newApptData.specialtyId, newApptData.unitId, specialties, validDoctors],
  );

  const availableTimeOptions = useMemo(
    () => getAvailableTimeOptions(newApptData.unitId, newApptData.specialtyId, newApptData.date),
    [appointments, doctors, newApptData.date, newApptData.specialtyId, newApptData.unitId, specialties, validDoctors],
  );

  const openAppointmentModal = (date = selectedDate, time = '') => {
    const defaultUnitId = selectedUnitId || units[0]?.id || user.unitId || '';
    setSelectedDate(date);
    setIdentifiedPatientId(null);
    setPatientLookupFeedback(null);
    setNewApptData({
      patientName: '',
      susNumber: '',
      cpf: '',
      rg: '',
      address: '',
      unitId: defaultUnitId,
      specialtyId: '',
      date,
      time,
      notes: '',
      returnVisit: false,
    });
    setShowNewApptModal(true);
  };

  const handleSusNumberChange = (susNumber: string) => {
    const susDigits = normalizeDigits(susNumber);
    const matchedPatient = susDigits ? patientBySusNumber.get(susDigits) : undefined;

    if (!matchedPatient) {
      setIdentifiedPatientId(null);
      setPatientLookupFeedback(
        susDigits.length >= 15
          ? {
            type: 'not-found',
            message: 'Paciente não encontrado. Continue preenchendo os dados manualmente.',
          }
          : null,
      );
      setNewApptData((current) => ({ ...current, susNumber }));
      return;
    }

    const patientUnitId = getPatientVisibleUnitId(
      matchedPatient,
      units,
      newApptData.unitId || selectedUnitId || user.unitId || '',
    );
    const patientAddress = formatPatientAddress(matchedPatient);

    if (patientUnitId && patientUnitId !== selectedUnitId) {
      setSelectedUnitId(patientUnitId);
    }

    setIdentifiedPatientId(matchedPatient.id);
    setPatientLookupFeedback({
      type: 'found',
      message: 'Paciente encontrado. Dados preenchidos automaticamente.',
    });
    setNewApptData((current) => {
      const unitChanged = Boolean(patientUnitId && patientUnitId !== current.unitId);

      return {
        ...current,
        patientName: matchedPatient.name || current.patientName,
        susNumber: matchedPatient.susNumber || susNumber,
        cpf: matchedPatient.cpf || current.cpf,
        rg: matchedPatient.rg || current.rg,
        address: patientAddress || current.address,
        unitId: patientUnitId || current.unitId,
        specialtyId: unitChanged ? '' : current.specialtyId,
        date: unitChanged ? '' : current.date,
        time: unitChanged ? '' : current.time,
      };
    });
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !newApptData.patientName.trim() ||
      !newApptData.susNumber.trim() ||
      !newApptData.cpf.trim() ||
      !newApptData.rg.trim() ||
      !newApptData.address.trim() ||
      !newApptData.unitId ||
      !newApptData.specialtyId ||
      !newApptData.date ||
      !newApptData.time
    ) {
      alert('Preencha todos os campos obrigatórios do agendamento.');
      return;
    }

    const selectedSpecialty = specialties.find((specialty) => specialty.id === newApptData.specialtyId);
    if (!selectedSpecialty || !isSpecialtyEnabledForUnit(selectedSpecialty, newApptData.unitId)) {
      alert('A especialidade selecionada não está habilitada para esta unidade.');
      return;
    }

    const allAppts = await api.appointments.getByUnit(newApptData.unitId);
    if (!isScheduleOpen(selectedSpecialty.schedule, newApptData.date, newApptData.time)) {
      alert(`A especialidade ${selectedSpecialty.name} não atende nesta data ou horário.`);
      return;
    }

    if (!hasSpecialtyDailyCapacity(selectedSpecialty.id, newApptData.date, allAppts)) {
      alert(`Limite da especialidade atingido: a cota diária de ${selectedSpecialty.maxDailyAppointments} atendimentos para ${selectedSpecialty.name} foi atingida.`);
      return;
    }

    const availableDoctorsForSlot = getAvailableDoctorsForSlot(
      newApptData.unitId,
      selectedSpecialty.id,
      newApptData.date,
      newApptData.time,
      allAppts,
    );
    const selectedDoctor = availableDoctorsForSlot[0];

    if (!selectedDoctor) {
      alert('Não há profissional disponível para a especialidade, data e horário selecionados.');
      return;
    }

    const cpfDigits = normalizeDigits(newApptData.cpf);
    const susDigits = normalizeDigits(newApptData.susNumber);
    const linkedPatient = identifiedPatientId
      ? searchablePatients.find((patient) => patient.id === identifiedPatientId)
      : undefined;
    const existingPatient = linkedPatient || searchablePatients.find((patient) =>
      normalizeDigits(patient.cpf) === cpfDigits ||
      Boolean(patient.susNumber && normalizeDigits(patient.susNumber) === susDigits),
    );
    const patientUnitIds = Array.from(new Set([
      ...(existingPatient?.unitIds || []),
      existingPatient?.unitId,
      newApptData.unitId,
    ].filter(Boolean) as string[]));

    const notes = [
      `Tipo: ${newApptData.returnVisit ? 'Retorno' : 'Consulta'}`,
      `Especialidade: ${selectedSpecialty.name}`,
      newApptData.returnVisit ? 'Retorno: sim' : '',
      newApptData.notes.trim(),
    ].filter(Boolean).join('\n');

    setSaving(true);
    try {
      const patientPayload: Omit<Patient, 'id'> = {
        name: newApptData.patientName.trim(),
        susNumber: newApptData.susNumber.trim(),
        cpf: newApptData.cpf.trim(),
        rg: newApptData.rg.trim(),
        address: newApptData.address.trim(),
        phone: existingPatient?.phone || '(00) 00000-0000',
        birthDate: existingPatient?.birthDate || '1900-01-01',
        unitId: newApptData.unitId,
        unitIds: patientUnitIds,
      };

      const patient = existingPatient
        ? await api.patients.update(existingPatient.id, patientPayload)
        : await api.patients.add(patientPayload);

      await api.appointments.add({
        patientId: patient.id,
        doctorId: selectedDoctor.id,
        date: newApptData.date,
        time: newApptData.time,
        unitId: newApptData.unitId,
        notes,
      });

      if (user.id !== selectedDoctor.id) {
        const dateFormatted = parseDateInput(newApptData.date).toLocaleDateString('pt-BR');
        await api.notifications.add(
          selectedDoctor.id,
          `Nova consulta agendada: ${patient.name} em ${dateFormatted} às ${newApptData.time}`,
        );
      }

      setShowNewApptModal(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: AppointmentStatus | string, type: 'appointment' | 'exam') => {
    if (status === AppointmentStatus.CANCELLED || status === 'CANCELLED') {
      const reason = window.prompt('Motivo do cancelamento (obrigatório):');
      if (reason === null) return;
      if (!reason.trim()) {
        alert('O motivo do cancelamento é obrigatório.');
        return;
      }
      try {
        let updated;
        if (type === 'appointment') {
          updated = await api.appointments.cancel(id, reason.trim());
        } else {
          updated = await api.exams.cancel(id, reason.trim()); 
        }
        await loadData();
        if (showDetailModal && showDetailModal.data.id === id) {
          setShowDetailModal({ ...showDetailModal, data: { ...showDetailModal.data, status: updated?.status || status } });
        }
      } catch (err) {
        alert('Erro ao cancelar o agendamento.');
      }
      return;
    }

    try {
      let updated;
      if (type === 'appointment') {
        updated = await api.appointments.update(id, { status: status as AppointmentStatus });
      } else {
        updated = await api.exams.update(id, { status: status as ExamStatus });
      }
      await loadData();
      if (showDetailModal && showDetailModal.data.id === id) {
        setShowDetailModal({ ...showDetailModal, data: { ...showDetailModal.data, status: updated?.status || status } });
      }
    } catch (err) {
      alert('Erro ao atualizar status.');
    }
  };

  const handleSaveNotes = async () => {
    if (!showDetailModal) return;
    if (showDetailModal.type === 'appointment') {
      await api.appointments.update(showDetailModal.data.id, { notes: doctorNotes });
    } else {
      await api.exams.update(showDetailModal.data.id, { notes: doctorNotes });
    }
    setShowDetailModal(null);
    setDoctorNotes('');
    await loadData();
  };

  const goToday = () => setSelectedDate(toDateInputValue(new Date()));
  const goPreviousWeek = () => setSelectedDate(toDateInputValue(addDays(weekStart, -7)));
  const goNextWeek = () => setSelectedDate(toDateInputValue(addDays(weekStart, 7)));

  const selectedDateLabel = selectedDateObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <div className="schedule-page">
      <section className="schedule-hero">
        <div>
          <span>Agenda municipal</span>
          <h2>Calendário de atendimentos</h2>
          <p>
            Crie encaixes, retornos e consultas diretamente nos horários livres da unidade.
          </p>
        </div>
        {user.role !== UserRole.DOCTOR && (
          <div className="schedule-hero-actions">
            <button className="button button-primary" onClick={() => openAppointmentModal(selectedDate, '09:00')} type="button">
              <Plus size={18} /> Novo agendamento
            </button>
          </div>
        )}
      </section>

      <section className="schedule-controls">
        <div className="schedule-date-controls">
          <button onClick={goToday} type="button">
            <Calendar size={17} /> Hoje
          </button>
          <button aria-label="Semana anterior" onClick={goPreviousWeek} type="button">
            <ChevronLeft size={18} />
          </button>
          <button aria-label="Próxima semana" onClick={goNextWeek} type="button">
            <ChevronRight size={18} />
          </button>
          <strong>
            {weekStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </strong>
        </div>

        {units.length > 1 && (
          <div className="schedule-search" style={{ minWidth: '220px', position: 'relative' }}>
            <div
              onClick={() => setIsUnitSelectOpen(!isUnitSelectOpen)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', width: '100%', height: '100%' }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b' }}>
                {units.find(u => u.id === selectedUnitId)?.name || 'Selecionar unidade...'}
              </span>
            </div>
            {isUnitSelectOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', zIndex: 10, maxHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                <input
                  autoFocus
                  onChange={e => setUnitSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  placeholder="Buscar unidade..."
                  style={{ padding: '0.5rem', border: 'none', borderBottom: '1px solid #e2e8f0', outline: 'none' }}
                  value={unitSearch}
                />
                <div style={{ overflowY: 'auto' }}>
                  {units.filter(u => u.name.toLowerCase().includes(unitSearch.toLowerCase())).map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUnitId(u.id);
                        setIsUnitSelectOpen(false);
                        setUnitSearch('');
                      }}
                      style={{ padding: '0.5rem', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      type="button"
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <label className="schedule-search">
          <Search size={18} />
          <input
            aria-label="Buscar agendamento"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por paciente..."
            value={query}
          />
        </label>
        
        <div className="schedule-view-toggle" style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem' }}>
          {(['PLANTÃO', 'COMERCIAL', '24H'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.875rem',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: 'pointer',
                background: viewMode === mode ? '#fff' : 'transparent',
                boxShadow: viewMode === mode ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                fontWeight: viewMode === mode ? 600 : 400,
                color: viewMode === mode ? '#0f172a' : '#64748b'
              }}
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="schedule-legend">
          <span><i className="scheduled" /> Agendado</span>
          <span><i className="completed" /> Realizado</span>
          <span><i className="cancelled" /> Cancelado</span>
        </div>
      </section>

      <section className="schedule-alert">
        <Info size={18} />
        <div>
          <strong>{unit?.attendanceType === 'SENHA' ? 'Atendimento por senha' : 'Ordem de chegada'}</strong>
          <p>
            O horário organiza a previsão da agenda. A recepção ainda controla chegada, senhas e chamadas conforme o fluxo da unidade.
          </p>
        </div>
      </section>

      <div className="schedule-layout">
        <section className="schedule-calendar-card">
          <div className="schedule-calendar-header">
            <div />
            {visibleDays.map((day) => {
              const dayValue = toDateInputValue(day);
              return (
                <button
                  className={dayValue === selectedDate ? 'active' : ''}
                  key={dayValue}
                  onClick={() => setSelectedDate(dayValue)}
                  type="button"
                >
                  <strong>{day.toLocaleDateString('pt-BR', { day: '2-digit' })}</strong>
                  <span>{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                </button>
              );
            })}
          </div>

          <div className="schedule-calendar-grid">
            {loadingSchedule ? (
              <div className="schedule-loading">
                <Loader2 className="loading-spin" size={26} />
                Carregando agenda...
              </div>
            ) : (
              TIME_SLOTS.map((time) => (
                <React.Fragment key={time}>
                  <div className="schedule-time-cell">{time}</div>
                  {visibleDays.map((day) => {
                    const date = toDateInputValue(day);
                    const slotEvents = eventsBySlot.get(`${date}-${time}`) || [];
                    return (
                      <div className="schedule-slot" key={`${date}-${time}`}>
                        {slotEvents.length > 0 ? (
                          slotEvents.map((event) => {
                            const patientName = patientNameById.get(event.data.patientId) || 'Paciente';
                            const docOrType = event.type === 'appointment'
                              ? (doctorNameById.get(event.data.doctorId) || 'Profissional')
                              : 'Exame';
                            // Different class for exam vs appointment
                            const eventClass = event.type === 'exam' ? 'schedule-event-exam' : '';

                            return (
                              <button
                                className={`schedule-event ${statusClass[event.data.status]} ${eventClass}`}
                                key={`${event.type}-${event.data.id}`}
                                onClick={() => {
                                  setDoctorNotes(event.data.notes || '');
                                  setShowDetailModal(event);
                                }}
                                type="button"
                                style={event.type === 'exam' ? { borderLeftColor: '#10b981', backgroundColor: '#ecfdf5' } : undefined}
                              >
                                <strong>{patientName}</strong>
                                <span>{docOrType}</span>
                                <small>{STATUS_LABELS[event.data.status]}</small>
                              </button>
                            );
                          })
                        ) : (
                          user.role !== UserRole.DOCTOR && (
                            <button
                              aria-label={`Agendar em ${date} às ${time}`}
                              className="schedule-empty-slot"
                              onClick={() => openAppointmentModal(date, time)}
                              type="button"
                            >
                              <Plus size={14} />
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </div>
        </section>

        <aside className="schedule-day-panel">
          <div>
            <span>{weekEventsCount} na semana</span>
            <h3>{selectedDateLabel}</h3>
            <p>{selectedDayEvents.length} atendimento(s) selecionado(s)</p>
          </div>

          {selectedDayEvents.length === 0 ? (
            <div className="schedule-empty-day">
              <Clock size={26} />
              <strong>Nenhum atendimento neste dia</strong>
              <p>Escolha um horário livre no calendário para criar um agendamento.</p>
            </div>
          ) : (
            <div className="schedule-day-list">
              {selectedDayEvents.map((event) => {
                const patientName = patientNameById.get(event.data.patientId) || 'Paciente';
                const docOrType = event.type === 'appointment'
                  ? (doctorNameById.get(event.data.doctorId) || 'Profissional')
                  : 'Exame';
                
                return (
                  <button
                    key={`${event.type}-${event.data.id}`}
                    onClick={() => {
                      setDoctorNotes(event.data.notes || '');
                      setShowDetailModal(event);
                    }}
                    type="button"
                  >
                    <span>{event.data.time}</span>
                    <div>
                      <strong>{patientName}</strong>
                      <small>{docOrType}</small>
                    </div>
                    <i className={statusClass[event.data.status]}>{STATUS_LABELS[event.data.status]}</i>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {showNewApptModal && (
        <div className="schedule-modal-backdrop">
          <div className="schedule-modal-card schedule-create-card">
            <div className="schedule-modal-header">
              <div>
                <Calendar size={24} />
                <h3>Agendamento</h3>
              </div>
              <button aria-label="Fechar agendamento" onClick={() => setShowNewApptModal(false)} type="button">
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="schedule-form schedule-create-form">
              <div className="schedule-form-section">
                <span>Dados do paciente</span>
                <div className="schedule-form-grid">
                  <label className="field-wide">
                    Nome do paciente
                    <input
                      autoFocus
                      onChange={(event) => setNewApptData({ ...newApptData, patientName: event.target.value })}
                      placeholder="Nome completo"
                      required
                      value={newApptData.patientName}
                    />
                  </label>

                  <label>
                    Cartão do SUS
                    <input
                      inputMode="numeric"
                      onChange={(event) => handleSusNumberChange(event.target.value)}
                      placeholder="000 0000 0000 0000"
                      required
                      value={newApptData.susNumber}
                    />
                  </label>

                  <label>
                    CPF
                    <input
                      inputMode="numeric"
                      onChange={(event) => setNewApptData({ ...newApptData, cpf: event.target.value })}
                      placeholder="000.000.000-00"
                      required
                      value={newApptData.cpf}
                    />
                  </label>

                  {patientLookupFeedback && (
                    <div className={`schedule-lookup-note ${patientLookupFeedback.type}`}>
                      {patientLookupFeedback.type === 'found' ? <Sparkles size={18} /> : <Info size={18} />}
                      <span>{patientLookupFeedback.message}</span>
                    </div>
                  )}

                  <label>
                    RG
                    <input
                      onChange={(event) => setNewApptData({ ...newApptData, rg: event.target.value })}
                      placeholder="Documento de identidade"
                      required
                      value={newApptData.rg}
                    />
                  </label>

                  <label className="field-wide">
                    Endereço
                    <input
                      onChange={(event) => setNewApptData({ ...newApptData, address: event.target.value })}
                      placeholder="Rua, número, bairro e complemento"
                      required
                      value={newApptData.address}
                    />
                  </label>
                </div>
              </div>

              <div className="schedule-form-section">
                <span>Agenda</span>
                <div className="schedule-form-grid">
                  <label>
                    Unidade
                    <select
                      onChange={(event) => {
                        const unitId = event.target.value;
                        setSelectedUnitId(unitId);
                        setNewApptData({
                          ...newApptData,
                          unitId,
                          specialtyId: '',
                          date: '',
                          time: '',
                        });
                      }}
                      required
                      value={newApptData.unitId}
                    >
                      <option value="">Selecione uma unidade</option>
                      {units.map((availableUnit) => (
                        <option key={availableUnit.id} value={availableUnit.id}>{availableUnit.name}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Especialidade
                    <select
                      disabled={!newApptData.unitId}
                      onChange={(event) => {
                        const specialtyId = event.target.value;
                        const dates = getAvailableDateOptions(newApptData.unitId, specialtyId);
                        const date = dates.some((option) => option.value === newApptData.date)
                          ? newApptData.date
                          : dates[0]?.value || '';
                        const times = date ? getAvailableTimeOptions(newApptData.unitId, specialtyId, date) : [];
                        const time = times.includes(newApptData.time) ? newApptData.time : times[0] || '';

                        if (date) {
                          setSelectedDate(date);
                        }

                        setNewApptData({
                          ...newApptData,
                          specialtyId,
                          date,
                          time,
                        });
                      }}
                      required
                      value={newApptData.specialtyId}
                    >
                      <option value="">Selecione uma especialidade</option>
                      {appointmentUnitSpecialties.map((specialty) => (
                        <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Data
                    <select
                      disabled={!newApptData.specialtyId || availableDateOptions.length === 0}
                      onChange={(event) => {
                        const date = event.target.value;
                        const times = getAvailableTimeOptions(newApptData.unitId, newApptData.specialtyId, date);
                        setSelectedDate(date);
                        setNewApptData({
                          ...newApptData,
                          date,
                          time: times.includes(newApptData.time) ? newApptData.time : times[0] || '',
                        });
                      }}
                      required
                      value={availableDateOptions.some((option) => option.value === newApptData.date) ? newApptData.date : ''}
                    >
                      <option value="">
                        {newApptData.specialtyId ? 'Selecione uma data disponível' : 'Escolha a especialidade primeiro'}
                      </option>
                      {availableDateOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Horário
                    <select
                      disabled={!newApptData.date || availableTimeOptions.length === 0}
                      onChange={(event) => setNewApptData({ ...newApptData, time: event.target.value })}
                      required
                      value={availableTimeOptions.includes(newApptData.time) ? newApptData.time : ''}
                    >
                      <option value="">
                        {newApptData.date ? 'Selecione um horário disponível' : 'Escolha a data primeiro'}
                      </option>
                      {availableTimeOptions.map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field-wide">
                    Observação (opcional)
                    <textarea
                      onChange={(event) => setNewApptData({ ...newApptData, notes: event.target.value })}
                      placeholder="Orientações, motivo do atendimento ou observações da recepção."
                      value={newApptData.notes}
                    />
                  </label>
                </div>
              </div>

              <label className="schedule-checkbox">
                <input
                  checked={newApptData.returnVisit}
                  onChange={(event) => setNewApptData({ ...newApptData, returnVisit: event.target.checked })}
                  type="checkbox"
                />
                É retorno
              </label>

              <div className="schedule-modal-actions">
                <button className="button button-secondary" onClick={() => setShowNewApptModal(false)} type="button">
                  Cancelar
                </button>
                <button className="button button-primary" disabled={saving} type="submit">
                  {saving ? <Loader2 className="loading-spin" size={18} /> : <Check size={18} />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && (
        <div className="schedule-modal-backdrop">
          <div className="schedule-modal-card schedule-detail-card">
            <div className="schedule-modal-header">
              <div>
                <UserIcon size={24} />
                <h3>{showDetailModal.type === 'appointment' ? 'Detalhes da consulta' : 'Detalhes do exame'}</h3>
              </div>
              <button aria-label="Fechar detalhes" onClick={() => setShowDetailModal(null)} type="button">
                <X size={22} />
              </button>
            </div>

            <div className="schedule-detail-body">
              <div className="schedule-detail-summary">
                <span>{showDetailModal.data.time}</span>
                <div>
                  <strong>{patientNameById.get(showDetailModal.data.patientId) || 'Paciente'}</strong>
                  <small>
                    {showDetailModal.type === 'appointment'
                      ? (doctorNameById.get(showDetailModal.data.doctorId) || 'Profissional')
                      : 'Exame'}
                  </small>
                </div>
              </div>

              <div className="schedule-status-actions">
                {(showDetailModal.type === 'appointment' ? Object.values(AppointmentStatus) : Object.values(ExamStatus)).map((status) => (
                  <button
                    className={showDetailModal.data.status === status ? 'active' : ''}
                    key={status}
                    onClick={() => handleStatusChange(showDetailModal.data.id, status, showDetailModal.type)}
                    type="button"
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>

              {showDetailModal.type === 'exam' && showDetailModal.data.referralAttachment && (
                <div className="mt-4 p-3 bg-[#F7FBFF] border border-[#CFE7FF] rounded-lg">
                  <span className="block text-sm font-bold text-[#06296F] mb-2">Encaminhamento anexado</span>
                  <button 
                    onClick={() => {
                      const img = new Image();
                      img.src = showDetailModal.data.referralAttachment;
                      const w = window.open("");
                      w?.document.write(img.outerHTML);
                    }}
                    className="text-sm bg-white border border-[#0B60C9] text-[#0B60C9] px-3 py-1.5 rounded font-medium hover:bg-[#F0F7FF] transition-colors"
                  >
                    Visualizar Anexo
                  </button>
                </div>
              )}

              <label>
                Notas clínicas
                <textarea
                  disabled={user.role !== UserRole.DOCTOR}
                  onChange={(event) => setDoctorNotes(event.target.value)}
                  placeholder="Descreva sintomas, diagnóstico, prescrições ou observações."
                  value={doctorNotes}
                />
              </label>
            </div>

            <div className="schedule-modal-actions">
              <button className="button button-secondary" onClick={() => setShowDetailModal(null)} type="button">
                Fechar
              </button>
              <button className="button button-primary" onClick={handleSaveNotes} type="button">
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
