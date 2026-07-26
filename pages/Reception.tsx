import React, { useEffect, useMemo, useState } from 'react';
import { Appointment, Patient, User, HealthUnit, AppointmentStatus } from '../types';
import { api } from '../services/api';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  MonitorPlay,
  MoreHorizontal,
  PhoneCall,
  Search,
  Users,
} from 'lucide-react';

interface ReceptionProps {
  user: User;
}

export const Reception: React.FC<ReceptionProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [unit, setUnit] = useState<HealthUnit | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    if (!user?.unitId) return;
    try {
      const [appts, pts, docs, unitData] = await Promise.all([
        api.appointments.getByUnit(user.unitId),
        api.patients.getByUnit(user.unitId),
        api.users.getDoctorsByUnit(user.unitId),
        api.units.getById(user.unitId),
      ]);

      const todaysAppts = appts.filter(appointment => appointment.date === today && appointment.status !== AppointmentStatus.CANCELLED);
      setAppointments(todaysAppts.sort((a, b) => a.time.localeCompare(b.time)));
      setPatients(pts);
      setDoctors(docs);
      setUnit(unitData);
    } catch (error) {
      console.error('Erro ao carregar dados da recepção', error);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [user?.unitId]);

  const generatePassword = async (apptId: string, isPreferential: boolean) => {
    await api.appointments.checkIn(apptId, isPreferential);
    loadData();
  };

  const callToTV = async (apptId: string) => {
    await api.appointments.call(apptId);
    loadData();
  };

  const getPatientName = (id: string) => patients.find(patient => patient.id === id)?.name || 'Desconhecido';
  const getDoctorName = (id: string) => doctors.find(doctor => doctor.id === id)?.name || 'Médico';
  const getInitials = (name: string) => name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();

  const isSenhaMode = unit?.attendanceType === 'SENHA';
  const waitingQueue = appointments.filter(appointment => appointment.checkInTime && appointment.status !== AppointmentStatus.COMPLETED);
  const expectedToday = appointments.filter(appointment => !appointment.checkInTime);
  const currentCall = useMemo(
    () => appointments.filter(appointment => appointment.calledAt).sort((a, b) => new Date(b.calledAt!).getTime() - new Date(a.calledAt!).getTime())[0],
    [appointments],
  );
  const preferentialCount = waitingQueue.filter(appointment => appointment.queuePassword?.startsWith('P-')).length;
  const averageWait = waitingQueue.length ? `${Math.max(1, Math.round(waitingQueue.length * 4))} min` : '0 min';
  const nextWaiting = waitingQueue[0];

  return (
    <div className="reception-content">
      <section className="reception-heading">
        <div>
          <span>Recepção conectada</span>
          <h2>Gerencie o fluxo da unidade</h2>
          <p>Check-in, fila de espera, senhas e chamadas em um só painel.</p>
        </div>
        {isSenhaMode && (
          <button
            className="button button-primary"
            onClick={() => window.open('/display-tv', '_blank')}
            type="button"
          >
            <MonitorPlay size={19} /> Abrir Painel de TV
          </button>
        )}
      </section>

      <section className="reception-metrics">
        {[
          ['Atendidos hoje', String(appointments.filter(appointment => appointment.status === AppointmentStatus.COMPLETED).length), CheckCircle2, 'green'],
          ['Na fila', String(waitingQueue.length), Users, 'blue'],
          ['Tempo médio', averageWait, Clock3, 'yellow'],
          ['Prioridades', String(preferentialCount).padStart(2, '0'), AlertCircle, 'red'],
        ].map(([label, value, Icon, tone]) => {
          const MetricIcon = Icon as typeof CheckCircle2;
          return (
            <article key={String(label)}>
              <span className={`metric-icon ${tone}`}>
                <MetricIcon size={21} />
              </span>
              <div>
                <small>{label as string}</small>
                <strong>{value as string}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className="reception-grid">
        <article className="checkin-card">
          <div className="card-header">
            <div>
              <h3>Agenda de hoje</h3>
              <p>Próximos pacientes da unidade</p>
            </div>
            <label className="small-search">
              <Search size={17} />
              <input aria-label="Buscar paciente" placeholder="Buscar paciente" />
            </label>
          </div>

          <div className="queue-table">
            <div className="queue-table-head">
              <span>Paciente</span>
              <span>Serviço</span>
              <span>Horário</span>
              <span>Status</span>
              <span />
            </div>

            {[...waitingQueue, ...expectedToday].slice(0, 8).map((appointment) => {
              const patientName = getPatientName(appointment.patientId);
              const checkedIn = Boolean(appointment.checkInTime);
              return (
                <div className="queue-table-row" key={appointment.id}>
                  <span className="patient-cell">
                    <i>{getInitials(patientName)}</i>
                    <strong>{patientName}</strong>
                  </span>
                  <span>{getDoctorName(appointment.doctorId)}</span>
                  <span>{appointment.time}</span>
                  <span className={`status-badge ${checkedIn ? 'completed' : 'scheduled'}`}>
                    {checkedIn ? 'Check-in feito' : 'Aguardando'}
                  </span>
                  {checkedIn ? (
                    <button aria-label={`Opções para ${patientName}`} onClick={() => callToTV(appointment.id)} type="button">
                      <MonitorPlay size={19} />
                    </button>
                  ) : (
                    <button aria-label={`Gerar senha para ${patientName}`} onClick={() => generatePassword(appointment.id, false)} type="button">
                      <MoreHorizontal size={19} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </article>

        <aside className="call-card">
          <span className="call-kicker">
            <span /> Chamada atual
          </span>
          <div className="ticket-display">
            <small>SENHA</small>
            <strong>{currentCall?.queuePassword || nextWaiting?.queuePassword || '--'}</strong>
            <span>GUICHÊ 02</span>
          </div>
          <div className="called-person">
            <span>{getInitials(currentCall ? getPatientName(currentCall.patientId) : nextWaiting ? getPatientName(nextWaiting.patientId) : 'CS')}</span>
            <div>
              <strong>{currentCall ? getPatientName(currentCall.patientId) : nextWaiting ? getPatientName(nextWaiting.patientId) : 'Aguardando chamada'}</strong>
              <small>{currentCall ? getDoctorName(currentCall.doctorId) : nextWaiting ? getDoctorName(nextWaiting.doctorId) : unit?.name || 'Rede municipal'}</small>
            </div>
          </div>
          <button
            className="button button-success"
            disabled={!nextWaiting}
            onClick={() => nextWaiting && callToTV(nextWaiting.id)}
            type="button"
          >
            <PhoneCall size={18} /> Chamar próxima senha
          </button>
          <button
            className="button button-secondary"
            disabled={!currentCall}
            onClick={() => currentCall && callToTV(currentCall.id)}
            type="button"
          >
            Repetir chamada
          </button>
          {nextWaiting && (
            <button
              className="button button-secondary"
              onClick={async () => {
                await api.appointments.update(nextWaiting.id, { status: AppointmentStatus.COMPLETED });
                loadData();
              }}
              type="button"
            >
              Finalizar atendimento
            </button>
          )}
        </aside>
      </section>
    </div>
  );
};
