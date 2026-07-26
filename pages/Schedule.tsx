import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  UserRole,
  Appointment,
  Patient,
  AppointmentStatus,
  Specialty,
  HealthUnit,
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

const TIME_SLOTS = Array.from({ length: 20 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const APPOINTMENT_TYPES = ['Consulta', 'Retorno', 'Encaixe', 'Avaliação', 'Exame'];

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
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

export const Schedule: React.FC<ScheduleProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [unit, setUnit] = useState<HealthUnit | null>(null);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()));
  const [query, setQuery] = useState('');
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewApptModal, setShowNewApptModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<Appointment | null>(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [newApptData, setNewApptData] = useState({
    patientId: '',
    doctorId: '',
    date: selectedDate,
    time: '09:00',
    endTime: '09:30',
    type: 'Consulta',
    notes: '',
    returnVisit: false,
  });

  const loadData = async () => {
    if (!user.unitId) {
      setAppointments([]);
      setPatients([]);
      setDoctors([]);
      setSpecialties([]);
      setUnit(null);
      setLoadingSchedule(false);
      return;
    }

    setLoadingSchedule(true);
    try {
      const [unitAppts, unitPatients, unitDoctors, allSpecialties, unitData] = await Promise.all([
        api.appointments.getByUnit(user.unitId),
        api.patients.getByUnit(user.unitId),
        api.users.getDoctorsByUnit(user.unitId),
        api.specialties.getAll(),
        api.units.getById(user.unitId),
      ]);

      const scopedAppointments = user.role === UserRole.DOCTOR
        ? unitAppts.filter((appointment) => appointment.doctorId === user.id)
        : unitAppts;

      setAppointments(scopedAppointments);
      setPatients(unitPatients);
      setDoctors(unitDoctors);
      setSpecialties(allSpecialties);
      setUnit(unitData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setAppointments([]);
      setPatients([]);
      setDoctors([]);
      setSpecialties([]);
      setUnit(null);
    } finally {
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id, user.unitId]);

  const selectedDateObj = useMemo(() => parseDateInput(selectedDate), [selectedDate]);
  const weekStart = useMemo(() => getWorkWeekStart(selectedDateObj), [selectedDateObj]);
  const visibleDays = useMemo(() => Array.from({ length: 5 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  const validSpecialtyIds = specialties
    .filter((specialty) => specialty.isGlobal || (specialty.unitIds && specialty.unitIds.includes(user.unitId || '')))
    .map((specialty) => specialty.id);

  const validDoctors = doctors.filter(
    (doctor) => doctor.specialtyId && validSpecialtyIds.includes(doctor.specialtyId),
  );

  const patientNameById = useMemo(() => new Map(patients.map((patient) => [patient.id, patient.name])), [patients]);
  const doctorNameById = useMemo(() => new Map(doctors.map((doctor) => [doctor.id, doctor.name])), [doctors]);

  const filteredAppointments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return appointments.filter((appointment) => {
      const patientName = patientNameById.get(appointment.patientId) || '';
      const doctorName = doctorNameById.get(appointment.doctorId) || '';
      return !normalizedQuery
        || patientName.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
        || doctorName.toLocaleLowerCase('pt-BR').includes(normalizedQuery);
    });
  }, [appointments, doctorNameById, patientNameById, query]);

  const appointmentsBySlot = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    filteredAppointments.forEach((appointment) => {
      const key = `${appointment.date}-${appointment.time}`;
      const current = map.get(key) || [];
      current.push(appointment);
      map.set(key, current);
    });
    return map;
  }, [filteredAppointments]);

  const selectedDayAppointments = useMemo(() => filteredAppointments
    .filter((appointment) => appointment.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time)), [filteredAppointments, selectedDate]);

  const weekAppointmentsCount = useMemo(() => {
    const dayValues = new Set(visibleDays.map(toDateInputValue));
    return filteredAppointments.filter((appointment) => dayValues.has(appointment.date)).length;
  }, [filteredAppointments, visibleDays]);

  const getSpecialtyName = (id?: string) => specialties.find((specialty) => specialty.id === id)?.name || '';

  const openAppointmentModal = (date = selectedDate, time = '09:00', type = 'Consulta') => {
    setSelectedDate(date);
    setNewApptData({
      patientId: '',
      doctorId: validDoctors[0]?.id || '',
      date,
      time,
      endTime: TIME_SLOTS[Math.min(TIME_SLOTS.indexOf(time) + 1, TIME_SLOTS.length - 1)] || time,
      type,
      notes: '',
      returnVisit: type === 'Retorno',
    });
    setShowNewApptModal(true);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApptData.patientId || !newApptData.doctorId || !user.unitId) return;

    const selectedDoctor = doctors.find((doctor) => doctor.id === newApptData.doctorId);
    const selectedSpecialty = selectedDoctor?.specialtyId
      ? specialties.find(specialty => specialty.id === selectedDoctor.specialtyId)
      : null;
    const allAppts = await api.appointments.getByUnit(user.unitId);

    if (selectedSpecialty) {
      if (!selectedSpecialty.isGlobal && (!selectedSpecialty.unitIds || !selectedSpecialty.unitIds.includes(user.unitId))) {
        alert('A especialidade deste profissional não está habilitada para esta unidade.');
        return;
      }

      if (selectedSpecialty.schedule && selectedSpecialty.schedule.length > 0) {
        const dateObj = parseDateInput(newApptData.date);
        const dayOfWeek = dateObj.getDay();
        const isAttendedDay = selectedSpecialty.schedule.some(schedule => schedule.dayOfWeek === dayOfWeek);

        if (!isAttendedDay) {
          alert(`A especialidade ${selectedSpecialty.name} não atende neste dia da semana.`);
          return;
        }
      }

      if (selectedSpecialty.maxDailyAppointments) {
        const specialtyDoctorIds = doctors.filter(doctor => doctor.specialtyId === selectedSpecialty.id).map(doctor => doctor.id);
        const specialtyDailyCount = allAppts.filter(
          (appointment) =>
            specialtyDoctorIds.includes(appointment.doctorId) &&
            appointment.date === newApptData.date &&
            appointment.status !== AppointmentStatus.CANCELLED,
        ).length;

        if (specialtyDailyCount >= selectedSpecialty.maxDailyAppointments) {
          alert(`Limite da especialidade atingido: a cota diária de ${selectedSpecialty.maxDailyAppointments} atendimentos para ${selectedSpecialty.name} foi atingida.`);
          return;
        }
      }
    }

    if (selectedDoctor && selectedDoctor.maxDailyPatients) {
      const dailyCount = allAppts.filter(
        (appointment) =>
          appointment.doctorId === newApptData.doctorId &&
          appointment.date === newApptData.date &&
          appointment.status !== AppointmentStatus.CANCELLED,
      ).length;

      if (dailyCount >= selectedDoctor.maxDailyPatients) {
        alert(`Limite diário atingido: Dr(a). ${selectedDoctor.name} já atingiu ${selectedDoctor.maxDailyPatients} atendimentos para esta data.`);
        return;
      }
    }

    const conflict = allAppts.find(
      (appointment) =>
        appointment.doctorId === newApptData.doctorId &&
        appointment.date === newApptData.date &&
        appointment.time === newApptData.time &&
        appointment.status !== AppointmentStatus.CANCELLED,
    );

    if (conflict) {
      alert('Este profissional já possui um agendamento nesse horário.');
      return;
    }

    const notes = [
      `Tipo: ${newApptData.type}`,
      newApptData.returnVisit ? 'Retorno: sim' : '',
      newApptData.endTime ? `Horário final previsto: ${newApptData.endTime}` : '',
      newApptData.notes.trim(),
    ].filter(Boolean).join('\n');

    setSaving(true);
    try {
      await api.appointments.add({
        patientId: newApptData.patientId,
        doctorId: newApptData.doctorId,
        date: newApptData.date,
        time: newApptData.time,
        unitId: user.unitId,
        notes,
      });

      if (user.id !== newApptData.doctorId) {
        const patientName = patientNameById.get(newApptData.patientId) ?? 'Paciente';
        const dateFormatted = parseDateInput(newApptData.date).toLocaleDateString('pt-BR');
        await api.notifications.add(
          newApptData.doctorId,
          `Nova consulta agendada: ${patientName} em ${dateFormatted} às ${newApptData.time}`,
        );
      }

      setShowNewApptModal(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    const updated = await api.appointments.update(id, { status });
    await loadData();
    if (showDetailModal && showDetailModal.id === id) {
      setShowDetailModal({ ...showDetailModal, status: updated?.status || status });
    }
  };

  const handleSaveNotes = async () => {
    if (!showDetailModal) return;
    await api.appointments.update(showDetailModal.id, { notes: doctorNotes });
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
            <button className="button button-secondary" onClick={() => openAppointmentModal(toDateInputValue(new Date()), getCurrentSlot(), 'Encaixe')} type="button">
              <Sparkles size={18} /> Agendar agora
            </button>
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

        <label className="schedule-search">
          <Search size={18} />
          <input
            aria-label="Buscar agendamento"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por paciente ou profissional"
            value={query}
          />
        </label>

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
                    const slotAppointments = appointmentsBySlot.get(`${date}-${time}`) || [];
                    return (
                      <div className="schedule-slot" key={`${date}-${time}`}>
                        {slotAppointments.length > 0 ? (
                          slotAppointments.map((appointment) => {
                            const patientName = patientNameById.get(appointment.patientId) || 'Paciente';
                            return (
                              <button
                                className={`schedule-event ${statusClass[appointment.status]}`}
                                key={appointment.id}
                                onClick={() => {
                                  setDoctorNotes(appointment.notes || '');
                                  setShowDetailModal(appointment);
                                }}
                                type="button"
                              >
                                <strong>{patientName}</strong>
                                <span>{doctorNameById.get(appointment.doctorId) || 'Profissional'}</span>
                                <small>{STATUS_LABELS[appointment.status]}</small>
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
            <span>{weekAppointmentsCount} na semana</span>
            <h3>{selectedDateLabel}</h3>
            <p>{selectedDayAppointments.length} atendimento(s) selecionado(s)</p>
          </div>

          {selectedDayAppointments.length === 0 ? (
            <div className="schedule-empty-day">
              <Clock size={26} />
              <strong>Nenhum atendimento neste dia</strong>
              <p>Escolha um horário livre no calendário para criar um agendamento.</p>
            </div>
          ) : (
            <div className="schedule-day-list">
              {selectedDayAppointments.map((appointment) => {
                const patientName = patientNameById.get(appointment.patientId) || 'Paciente';
                return (
                  <button
                    key={appointment.id}
                    onClick={() => {
                      setDoctorNotes(appointment.notes || '');
                      setShowDetailModal(appointment);
                    }}
                    type="button"
                  >
                    <span>{appointment.time}</span>
                    <div>
                      <strong>{patientName}</strong>
                      <small>{doctorNameById.get(appointment.doctorId) || 'Profissional'}</small>
                    </div>
                    <i className={statusClass[appointment.status]}>{STATUS_LABELS[appointment.status]}</i>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {showNewApptModal && (
        <div className="schedule-modal-backdrop">
          <div className="schedule-modal-card">
            <div className="schedule-modal-header">
              <div>
                <Calendar size={24} />
                <h3>Agendamento</h3>
              </div>
              <button aria-label="Fechar agendamento" onClick={() => setShowNewApptModal(false)} type="button">
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSchedule} className="schedule-form">
              <label>
                Paciente
                <select
                  required
                  value={newApptData.patientId}
                  onChange={(event) => setNewApptData({ ...newApptData, patientId: event.target.value })}
                >
                  <option value="">Selecione um paciente</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Profissional
                <select
                  required
                  value={newApptData.doctorId}
                  onChange={(event) => setNewApptData({ ...newApptData, doctorId: event.target.value })}
                >
                  <option value="">Selecione um profissional</option>
                  {validDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}{getSpecialtyName(doctor.specialtyId) ? ` - ${getSpecialtyName(doctor.specialtyId)}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Tipo de agendamento
                <select
                  value={newApptData.type}
                  onChange={(event) => setNewApptData({ ...newApptData, type: event.target.value, returnVisit: event.target.value === 'Retorno' })}
                >
                  {APPOINTMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>

              <div className="schedule-form-grid">
                <label>
                  Horário inicial
                  <select
                    required
                    value={newApptData.time}
                    onChange={(event) => setNewApptData({ ...newApptData, time: event.target.value })}
                  >
                    {TIME_SLOTS.map((time) => <option key={time}>{time}</option>)}
                  </select>
                </label>
                <label>
                  Horário final
                  <select
                    value={newApptData.endTime}
                    onChange={(event) => setNewApptData({ ...newApptData, endTime: event.target.value })}
                  >
                    {TIME_SLOTS.map((time) => <option key={time}>{time}</option>)}
                  </select>
                </label>
              </div>

              <label>
                Data
                <input
                  required
                  type="date"
                  value={newApptData.date}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setNewApptData({ ...newApptData, date: event.target.value });
                  }}
                />
              </label>

              <label>
                Observações
                <textarea
                  onChange={(event) => setNewApptData({ ...newApptData, notes: event.target.value })}
                  placeholder="Orientações, motivo do encaixe ou observações da recepção."
                  value={newApptData.notes}
                />
              </label>

              <label className="schedule-checkbox">
                <input
                  checked={newApptData.returnVisit}
                  onChange={(event) => setNewApptData({ ...newApptData, returnVisit: event.target.checked })}
                  type="checkbox"
                />
                Retorno
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
                <h3>Detalhes da consulta</h3>
              </div>
              <button aria-label="Fechar detalhes" onClick={() => setShowDetailModal(null)} type="button">
                <X size={22} />
              </button>
            </div>

            <div className="schedule-detail-body">
              <div className="schedule-detail-summary">
                <span>{showDetailModal.time}</span>
                <div>
                  <strong>{patientNameById.get(showDetailModal.patientId) || 'Paciente'}</strong>
                  <small>{doctorNameById.get(showDetailModal.doctorId) || 'Profissional'}</small>
                </div>
              </div>

              <div className="schedule-status-actions">
                {Object.values(AppointmentStatus).map((status) => (
                  <button
                    className={showDetailModal.status === status ? 'active' : ''}
                    key={status}
                    onClick={() => handleStatusChange(showDetailModal.id, status)}
                    type="button"
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>

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
