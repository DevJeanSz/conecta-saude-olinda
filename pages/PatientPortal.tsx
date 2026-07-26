import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Info,
  Loader2,
  Map as MapIcon,
  MapPin,
  Navigation,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { api } from '../services/api';
import { STATUS_LABELS } from '../constants';
import { Appointment, AppointmentStatus, HealthUnit, Patient, Specialty, User } from '../types';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface PatientPortalProps {
  user: User;
}

const convertToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const convertToString = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const buildTimeSlots = (startTime: string, endTime: string) => {
  const slots: string[] = [];
  let current = convertToMinutes(startTime);
  const end = convertToMinutes(endTime);

  while (current < end) {
    slots.push(convertToString(current));
    current += 30;
  }

  return slots;
};

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
};

const formatLongDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      });
};

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const getScheduleForDate = (doctor: User, date: string) => {
  const day = new Date(`${date}T00:00:00`).getDay();
  return doctor.schedule?.find(schedule => schedule.dayOfWeek % 7 === day) || null;
};

const canDoctorAttendUnit = (doctor: User, unitId: string) => {
  const unitIds = new Set([doctor.unitId, ...(doctor.unitIds || [])].filter(Boolean));
  return unitIds.size === 0 || unitIds.has(unitId);
};

const unitAddress = (unit: HealthUnit) =>
  [unit.address, unit.addressNumber, unit.neighborhood, unit.city || 'Olinda', unit.state || 'PE']
    .filter(Boolean)
    .join(', ');

export const PatientPortal: React.FC<PatientPortalProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [checkingSlots, setCheckingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [allUnits, setAllUnits] = useState<HealthUnit[]>([]);
  const [patientUnits, setPatientUnits] = useState<HealthUnit[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [unitDoctors, setUnitDoctors] = useState<User[]>([]);

  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [availableSpecialties, setAvailableSpecialties] = useState<Specialty[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [selectedSpec, setSelectedSpec] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [isDayFull, setIsDayFull] = useState(false);
  const [noSchedule, setNoSchedule] = useState(false);

  const selectedUnit = useMemo(
    () => allUnits.find(unit => unit.id === selectedUnitId) || null,
    [allUnits, selectedUnitId],
  );

  const doctorNameById = useMemo(
    () => new Map(unitDoctors.map(doctor => [doctor.id, doctor.name])),
    [unitDoctors],
  );

  const unitNameById = useMemo(
    () => new Map(allUnits.map(unit => [unit.id, unit.name])),
    [allUnits],
  );

  const specialtyDoctors = useMemo(
    () => doctors.filter(doctor => doctor.specialtyId === selectedSpec),
    [doctors, selectedSpec],
  );

  const availableDates = useMemo(() => {
    if (!selectedDoc?.schedule?.length) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 45 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return toDateInput(date);
    })
      .filter(date => Boolean(getScheduleForDate(selectedDoc, date)))
      .slice(0, 12);
  }, [selectedDoc]);

  const orderedAppointments = useMemo(
    () => [...myAppointments].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    [myAppointments],
  );

  const unitPosition: [number, number] = useMemo(() => {
    const latitude = Number.parseFloat((selectedUnit?.latitude || '').replace(',', '.'));
    const longitude = Number.parseFloat((selectedUnit?.longitude || '').replace(',', '.'));
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [latitude, longitude]
      : [-7.784, -34.896];
  }, [selectedUnit]);

  const loadAppointments = async (targetPatient: Patient | null) => {
    if (!targetPatient) {
      setMyAppointments([]);
      return;
    }

    setMyAppointments(await api.appointments.getByPatientId(targetPatient.id));
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      const [unitData, specialtyData, patientData, doctorData] = await Promise.all([
        api.units.getAll(),
        api.specialties.getAll(),
        api.patients.getByUserId(user.id),
        api.users.getAll(),
      ]);

      if (!isMounted) return;

      const doctorsOnly = doctorData.filter(doctor => doctor.role === 'DOCTOR');
      const linkedUnits = unitData.filter(unit =>
        unit.isHospital ||
        unit.id === user.unitId ||
        user.unitIds?.includes(unit.id) ||
        patientData?.unitId === unit.id ||
        patientData?.unitIds?.includes(unit.id)
      );

      setAllUnits(unitData);
      setSpecialties(specialtyData);
      setPatient(patientData);
      setUnitDoctors(doctorsOnly);
      setPatientUnits(linkedUnits);
      await loadAppointments(patientData);
      setLoading(false);
    };

    load().catch(() => {
      if (!isMounted) return;
      setFeedback({ type: 'error', message: 'Nao foi possivel carregar os dados do agendamento.' });
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [user.id, user.unitId, user.unitIds]);

  const resetScheduleFields = () => {
    setSelectedSpec('');
    setSelectedDoc(null);
    setSelectedDate('');
    setSelectedTime('');
    setAvailableSlots([]);
    setIsDayFull(false);
    setNoSchedule(false);
  };

  const handleUnitSelect = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const unitId = event.target.value;
    setSelectedUnitId(unitId);
    resetScheduleFields();

    if (!unitId) {
      setAvailableSpecialties([]);
      setDoctors([]);
      return;
    }

    const doctorsFromApi = await api.users.getDoctorsByUnit(unitId);
    const sourceDoctors = doctorsFromApi.length > 0 ? doctorsFromApi : unitDoctors;
    const doctorsInUnit = sourceDoctors
      .filter(doctor => doctor.role === 'DOCTOR')
      .filter(doctor => canDoctorAttendUnit(doctor, unitId));

    const specIds = new Set(doctorsInUnit.map(doctor => doctor.specialtyId).filter(Boolean));
    const specsForUnit = specialties.filter(specialty =>
      specIds.has(specialty.id) &&
      (specialty.isGlobal || specialty.unitIds?.includes(unitId))
    );

    setDoctors(doctorsInUnit);
    setAvailableSpecialties(specsForUnit);
  };

  const handleSpecSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const specId = event.target.value;
    const firstDoctor = doctors.find(doctor => doctor.specialtyId === specId) || null;

    setSelectedSpec(specId);
    setSelectedDoc(firstDoctor);
    setSelectedDate('');
    setSelectedTime('');
    setAvailableSlots([]);
    setIsDayFull(false);
    setNoSchedule(Boolean(firstDoctor && !firstDoctor.schedule?.length));
  };

  const handleDoctorSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const doctor = doctors.find(item => item.id === event.target.value) || null;
    setSelectedDoc(doctor);
    setSelectedDate('');
    setSelectedTime('');
    setAvailableSlots([]);
    setIsDayFull(false);
    setNoSchedule(Boolean(doctor && !doctor.schedule?.length));
  };

  const handleDateSelect = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const date = event.target.value;
    setSelectedDate(date);
    setSelectedTime('');
    setAvailableSlots([]);
    setIsDayFull(false);
    setNoSchedule(false);

    if (!selectedDoc || !selectedUnitId || !date) return;

    const schedule = getScheduleForDate(selectedDoc, date);
    if (!schedule) {
      setNoSchedule(true);
      return;
    }

    setCheckingSlots(true);

    try {
      const appointments = await api.appointments.getByUnit(selectedUnitId);
      const activeAppointments = appointments.filter(appointment =>
        appointment.doctorId === selectedDoc.id &&
        appointment.date === date &&
        appointment.status !== AppointmentStatus.CANCELLED
      );

      if (selectedDoc.maxDailyPatients && activeAppointments.length >= selectedDoc.maxDailyPatients) {
        setIsDayFull(true);
        setAvailableSlots([]);
        return;
      }

      const bookedTimes = new Set(activeAppointments.map(appointment => appointment.time));
      setAvailableSlots(buildTimeSlots(schedule.startTime, schedule.endTime).filter(slot => !bookedTimes.has(slot)));
    } finally {
      setCheckingSlots(false);
    }
  };

  const confirmAppointment = async () => {
    if (!patient) {
      setFeedback({ type: 'error', message: 'Cadastro de paciente nao localizado. Entre novamente pelo portal.' });
      return;
    }

    if (!selectedDoc || !selectedUnitId || !selectedDate || !selectedTime) {
      setFeedback({ type: 'error', message: 'Selecione unidade, especialidade, profissional, data e horario.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const appointment = await api.appointments.add({
        patientId: patient.id,
        doctorId: selectedDoc.id,
        unitId: selectedUnitId,
        date: selectedDate,
        time: selectedTime,
        notes: 'Agendado pelo Portal do Paciente',
      });

      setFeedback({ type: 'success', message: 'Consulta agendada com sucesso. Ela ja aparece em Minhas consultas.' });
      setMyAppointments(prev => [appointment, ...prev]);
      setSelectedUnitId('');
      setAvailableSpecialties([]);
      setDoctors([]);
      resetScheduleFields();
    } catch {
      setFeedback({ type: 'error', message: 'Nao foi possivel confirmar este horario. Atualize a agenda e tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="mb-2 text-3xl font-black text-primary">Agendamento de Consulta</h2>
        <p className="text-lg text-slate-600">
          Olá, <span className="font-bold">{user.name.split(' ')[0]}</span>. Escolha uma unidade, especialidade, data disponível e horário livre.
        </p>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${
          feedback.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-700'
            : feedback.type === 'info'
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {feedback.message}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-3xl border border-slate-100 bg-white p-8 text-slate-600 shadow-sm">
          <Loader2 className="mr-3 h-6 w-6 animate-spin text-primary" />
          <span className="font-bold">Carregando agenda...</span>
        </div>
      ) : !patient ? (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
          <h3 className="text-xl font-black">Cadastro nao localizado</h3>
          <p className="mt-2 text-sm font-semibold">Nao encontramos um cadastro de paciente vinculado a este usuario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-8 flex flex-col items-start gap-4 md:flex-row md:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-green-100 bg-green-50">
                  <Calendar className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-[#0F4C81]">Agende sua consulta</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Datas e horários aparecem conforme agenda do profissional.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0F4C81]">Unidade de Saúde</label>
                  <select
                    value={selectedUnitId}
                    onChange={handleUnitSelect}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Selecione a unidade</option>
                    {patientUnits.map(unit => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                  </select>
                  {patientUnits.length === 0 && (
                    <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-red-600">
                      <Info className="h-4 w-4" />
                      Nenhuma unidade vinculada ao seu cadastro.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0F4C81]">Especialidade</label>
                  <select
                    value={selectedSpec}
                    onChange={handleSpecSelect}
                    disabled={!selectedUnitId || availableSpecialties.length === 0}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary disabled:bg-slate-50 disabled:opacity-50"
                  >
                    <option value="">
                      {!selectedUnitId
                        ? 'Selecione a unidade primeiro'
                        : availableSpecialties.length === 0
                          ? 'Nenhuma especialidade disponivel'
                          : 'Selecione a especialidade'}
                    </option>
                    {availableSpecialties.map(specialty => (
                      <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0F4C81]">Profissional</label>
                  <select
                    value={selectedDoc?.id || ''}
                    onChange={handleDoctorSelect}
                    disabled={!selectedSpec || specialtyDoctors.length === 0}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary disabled:bg-slate-50 disabled:opacity-50"
                  >
                    <option value="">
                      {!selectedSpec
                        ? 'Selecione a especialidade primeiro'
                        : specialtyDoctors.length === 0
                          ? 'Nenhum profissional disponivel'
                          : 'Selecione o profissional'}
                    </option>
                    {specialtyDoctors.map(doctor => (
                      <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0F4C81]">Data disponível</label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-4 top-4 h-6 w-6 text-[#0F4C81]" />
                    <select
                      value={selectedDate}
                      onChange={handleDateSelect}
                      disabled={!selectedDoc || availableDates.length === 0}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 pl-14 font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary disabled:bg-slate-50 disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedDoc
                          ? 'Selecione o profissional primeiro'
                          : availableDates.length === 0
                            ? 'Nenhuma data disponivel'
                            : 'Selecione a data'}
                      </option>
                      {availableDates.map(date => (
                        <option key={date} value={date}>{formatLongDate(date)}</option>
                      ))}
                    </select>
                  </div>
                  {noSchedule && (
                    <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-red-600">
                      <Info className="h-4 w-4" />
                      O profissional nao atende nesta data.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0F4C81]">Horário disponível</label>
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-4 top-4 h-6 w-6 text-[#0F4C81]" />
                    <select
                      value={selectedTime}
                      onChange={event => setSelectedTime(event.target.value)}
                      disabled={!selectedDate || availableSlots.length === 0 || isDayFull || checkingSlots}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 pl-14 font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary disabled:bg-slate-50 disabled:opacity-50"
                    >
                      <option value="">
                        {checkingSlots
                          ? 'Consultando horarios...'
                          : isDayFull
                            ? 'Agenda lotada para este dia'
                            : selectedDate && availableSlots.length === 0
                              ? 'Nenhum horario disponivel'
                              : 'Selecione o horario'}
                      </option>
                      {availableSlots.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  disabled={!selectedTime || isDayFull || submitting}
                  onClick={confirmAppointment}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F4C81] py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                >
                  {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
                  Confirmar agendamento
                </button>
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h3 className="mb-6 border-b border-slate-100 pb-4 text-xl font-bold text-slate-800">Seus agendamentos</h3>

            <div className="space-y-4">
              {orderedAppointments.length > 0 ? orderedAppointments.map(appointment => (
                <div key={appointment.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className={`absolute left-0 top-0 h-full w-1 ${
                    appointment.status === AppointmentStatus.SCHEDULED
                      ? 'bg-primary'
                      : appointment.status === AppointmentStatus.COMPLETED
                        ? 'bg-secondary'
                        : 'bg-ita-red'
                  }`} />

                  <div className="pl-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <span className="text-lg font-bold text-slate-800">{doctorNameById.get(appointment.doctorId) ?? 'Profissional de saude'}</span>
                      <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        appointment.status === AppointmentStatus.SCHEDULED
                          ? 'bg-blue-50 text-primary'
                          : appointment.status === AppointmentStatus.COMPLETED
                            ? 'bg-green-50 text-secondary'
                            : 'bg-red-50 text-ita-red'
                      }`}>
                        {STATUS_LABELS[appointment.status]}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <Calendar className="h-4 w-4 text-primary" />
                        {formatDate(appointment.date)}
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <Clock className="h-4 w-4 text-secondary" />
                        {appointment.time}
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <MapPin className="h-4 w-4 text-ita-red" />
                        {unitNameById.get(appointment.unitId) || 'Unidade vinculada'}
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                    <Calendar className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-500">Nenhuma consulta agendada.</p>
                  <p className="mt-1 text-xs text-slate-400">Utilize o painel ao lado para agendar.</p>
                </div>
              )}
            </div>

            {selectedUnit && (
              <div className="mt-8 border-t border-slate-100 pt-6">
                <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-800">
                  <MapIcon className="h-5 w-5 text-primary" />
                  Sua USF: {selectedUnit.name}
                </h4>
                <div className="relative z-0 mb-4 h-48 w-full overflow-hidden rounded-xl border border-slate-200 shadow-inner">
                  <MapContainer key={selectedUnit.id} center={unitPosition} zoom={15} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={unitPosition}>
                      <Popup>
                        <b>{selectedUnit.name}</b><br />
                        {unitAddress(selectedUnit)}
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(unitAddress(selectedUnit))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-3 font-bold text-primary transition-all hover:bg-primary/20"
                >
                  <Navigation className="h-5 w-5" />
                  Como chegar
                </a>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
