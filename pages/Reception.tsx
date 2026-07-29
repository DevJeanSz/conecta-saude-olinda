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
  Settings,
  X
} from 'lucide-react';

interface ReceptionProps {
  user: User;
}

const COUNTER_FALLBACK = ['GUICHÊ 01'];

export const Reception: React.FC<ReceptionProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [unit, setUnit] = useState<HealthUnit | null>(null);
  const [counterOptions, setCounterOptions] = useState<string[]>(COUNTER_FALLBACK);
  const [selectedCounter, setSelectedCounter] = useState(COUNTER_FALLBACK[0]);
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({ toleranceMinutes: 15, autoCancelNoShow: true });

  const today = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    if (!user?.unitId) return;
    try {
      const [appts, pts, docs, unitData, locs] = await Promise.all([
        api.appointments.getByUnit(user.unitId),
        api.patients.getByUnit(user.unitId),
        api.users.getDoctorsByUnit(user.unitId),
        api.units.getById(user.unitId),
        api.locations.getByUnit(user.unitId),
      ]);

      const todaysAppts = appts.filter(appointment => appointment.date === today && appointment.status !== AppointmentStatus.CANCELLED);
      setAppointments(todaysAppts.sort((a, b) => a.time.localeCompare(b.time)));
      setPatients(pts);
      setDoctors(docs);
      setUnit(unitData);

      // Carrega locais ativos; fallback se vazio
      const activeLocations = locs.filter(l => l.active).map(l => l.name);
      const opts = activeLocations.length > 0 ? activeLocations : COUNTER_FALLBACK;
      setCounterOptions(opts);
      // Mantém seleção atual se ainda válida, senão seleciona o primeiro
      setSelectedCounter(prev => opts.includes(prev) ? prev : opts[0]);

      if (unitData) {
        setConfigForm(prev => ({
          toleranceMinutes: unitData.toleranceMinutes ?? 15,
          autoCancelNoShow: unitData.autoCancelNoShow ?? true
        }));
      }
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

  const callToTV = async (apptId: string, callLocation = selectedCounter) => {
    await api.appointments.call(apptId, callLocation);
    loadData();
  };

  const saveConfig = async () => {
    if (!unit) return;
    try {
      await api.units.update(unit.id, configForm);
      setShowConfig(false);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar configuração', error);
    }
  };

  const getPatientName = (id: string) => patients.find(patient => patient.id === id)?.name || 'Desconhecido';
  const getDoctorName = (id: string) => doctors.find(doctor => doctor.id === id)?.name || 'Médico';
  const getInitials = (name: string) => name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();

  const isSenhaMode = unit?.attendanceType === 'SENHA';
  const waitingQueue = appointments.filter(appointment => appointment.checkInTime && !appointment.calledAt && appointment.status === AppointmentStatus.SCHEDULED);
  const expectedToday = appointments.filter(appointment => !appointment.checkInTime && appointment.status === AppointmentStatus.SCHEDULED);
  const currentCall = useMemo(
    () => appointments.filter(appointment => appointment.calledAt).sort((a, b) => new Date(b.calledAt!).getTime() - new Date(a.calledAt!).getTime())[0],
    [appointments],
  );
  const preferentialCount = waitingQueue.filter(appointment => appointment.queuePassword?.startsWith('P-')).length;
  const averageWait = waitingQueue.length ? `${Math.max(1, Math.round(waitingQueue.length * 4))} min` : '0 min';
  const nextWaiting = waitingQueue[0];
  const activeCounter = currentCall?.callLocation || selectedCounter;

  return (
    <div className="reception-content">
      <section className="reception-heading">
        <div>
          <span>Recepção conectada</span>
          <h2>Gerencie o fluxo da unidade</h2>
          <p>Check-in, fila de espera, senhas e chamadas em um só painel.</p>
        </div>
        <div className="flex gap-3">
          <button
            className="button button-secondary flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-semibold transition-colors"
            onClick={() => setShowConfig(true)}
            title="Configurações da Unidade"
            type="button"
          >
            <Settings size={19} /> Configurações
          </button>
          {isSenhaMode && (
            <button
              className="button button-primary"
              onClick={() => window.open('/display-tv', '_blank')}
              type="button"
            >
              <MonitorPlay size={19} /> Abrir Painel de TV
            </button>
          )}
        </div>
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
          <label className="counter-selector">
            Guichê do recepcionista
            <select value={selectedCounter} onChange={(event) => setSelectedCounter(event.target.value)}>
              {counterOptions.map(counter => (
                <option key={counter} value={counter}>{counter}</option>
              ))}
            </select>
          </label>
          <div className="ticket-display">
            <small>SENHA</small>
            <strong>{currentCall?.queuePassword || nextWaiting?.queuePassword || '--'}</strong>
            <span>{activeCounter}</span>
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
            onClick={() => currentCall && callToTV(currentCall.id, currentCall.callLocation || selectedCounter)}
            type="button"
          >
            Repetir chamada
          </button>
          {currentCall && (
            <button
              className="button button-secondary"
              onClick={async () => {
                await api.appointments.update(currentCall.id, { status: AppointmentStatus.COMPLETED });
                loadData();
              }}
              type="button"
            >
              Finalizar atendimento
            </button>
          )}
        </aside>
      </section>

      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Configurações da Unidade</h2>
              <button
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                onClick={() => setShowConfig(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="grid gap-5">
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600">
                <div>
                  <strong className="block text-sm font-semibold text-slate-900 dark:text-white">Cancelamento Automático</strong>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Cancela agendamentos após a tolerância</span>
                </div>
                <input 
                  type="checkbox" 
                  className="h-5 w-5 accent-[#0B60C9]" 
                  checked={configForm.autoCancelNoShow} 
                  onChange={(e) => setConfigForm(prev => ({ ...prev, autoCancelNoShow: e.target.checked }))} 
                />
              </label>
              
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Tempo de Tolerância (minutos)</label>
                <select 
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-[#0B60C9] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={configForm.toleranceMinutes}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, toleranceMinutes: Number(e.target.value) }))}
                  disabled={!configForm.autoCancelNoShow}
                >
                  <option value={0}>0 min (sem tolerância)</option>
                  <option value={5}>5 minutos</option>
                  <option value={10}>10 minutos</option>
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>60 minutos (1 hora)</option>
                </select>
                <p className="mt-2 text-xs text-slate-500">Agendamentos atrasados além deste limite serão marcados como Cancelado caso o paciente não faça o Check-in na recepção.</p>
              </div>
              
              <button 
                className="mt-2 w-full rounded-xl bg-[#0B60C9] py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-blue-500/40"
                onClick={saveConfig}
                type="button"
              >
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
