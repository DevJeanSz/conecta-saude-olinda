import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BellRing,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  FlaskConical,
  HelpCircle,
  Info,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Appointment,
  AppointmentStatus,
  CareHistoryItem,
  Exam,
  ExamStatus,
  HealthUnit,
  Patient,
  ReminderPreference,
  User,
} from '../types';
import { STATUS_LABELS } from '../constants';

interface PatientPageProps {
  user: User;
}

const cardClass = 'rounded-2xl border border-[#D9E6F5] bg-white shadow-[0_8px_20px_rgba(6,41,111,0.08)]';
const inputClass = 'h-11 w-full rounded-xl border border-[#CBD8E8] bg-white px-3 text-sm font-semibold text-[#10223F] outline-none focus:border-[#0B60C9] focus:ring-4 focus:ring-[#0B60C9]/15';

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
};

const maskIdentifier = (value?: string) => {
  if (!value) return 'Não informado';
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 4) return value;
  return `${clean.slice(0, 3)}****${clean.slice(-4)}`;
};

const PatientPageShell = ({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="space-y-6 pb-24">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-black leading-tight text-[#06296F]">{title}</h1>
        <p className="mt-2 max-w-2xl text-base font-medium text-[#5F708A]">{description}</p>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const DemoNotice = () => (
  <div className="flex gap-3 rounded-2xl border border-[#CFE7FF] bg-[#DFF0FF] p-4 text-sm font-semibold text-[#06296F]">
    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
    <p>Informações protegidas. Esta tela exibe somente dados autorizados para o seu perfil.</p>
  </div>
);

const LoadingState = ({ label = 'Carregando dados...' }: { label?: string }) => (
  <div className={`${cardClass} flex min-h-48 items-center justify-center p-8 text-[#5F708A]`}>
    <Loader2 className="mr-3 h-5 w-5 animate-spin text-[#0B60C9]" />
    <span className="font-bold">{label}</span>
  </div>
);

const EmptyState = ({
  icon: Icon = Info,
  title,
  description,
  action,
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <div className={`${cardClass} flex min-h-56 flex-col items-center justify-center p-8 text-center`}>
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF6FF] text-[#0B60C9]">
      <Icon className="h-7 w-7" />
    </div>
    <h2 className="text-xl font-black text-[#10223F]">{title}</h2>
    <p className="mt-2 max-w-md text-sm font-medium text-[#5F708A]">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

const Feedback = ({ type, message }: { type: 'success' | 'error' | 'info'; message: string }) => {
  const styles = {
    success: 'border-[#BFEBD1] bg-[#E3F8EC] text-[#024F2A]',
    error: 'border-[#FFC7CC] bg-[#FFE6E8] text-[#97111B]',
    info: 'border-[#CFE7FF] bg-[#DFF0FF] text-[#06296F]',
  };
  const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? AlertCircle : Info;
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${styles[type]}`}>
      <Icon className="h-5 w-5" />
      {message}
    </div>
  );
};

const AppointmentBadge = ({ status }: { status: AppointmentStatus }) => {
  const styles = {
    [AppointmentStatus.SCHEDULED]: 'bg-[#DFF0FF] text-[#0B60C9]',
    [AppointmentStatus.COMPLETED]: 'bg-[#E3F8EC] text-[#048C47]',
    [AppointmentStatus.CANCELLED]: 'bg-[#FFE6E8] text-[#D51F2A]',
    [AppointmentStatus.NO_SHOW]: 'bg-[#EEF2F6] text-[#64748B]',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${styles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
};

const ExamBadge = ({ status }: { status: ExamStatus }) => {
  const labels = {
    [ExamStatus.SCHEDULED]: 'Agendado',
    [ExamStatus.AVAILABLE]: 'Resultado disponível',
    [ExamStatus.CANCELLED]: 'Cancelado',
  };
  const styles = {
    [ExamStatus.SCHEDULED]: 'bg-[#DFF0FF] text-[#0B60C9]',
    [ExamStatus.AVAILABLE]: 'bg-[#E3F8EC] text-[#048C47]',
    [ExamStatus.CANCELLED]: 'bg-[#FFE6E8] text-[#D51F2A]',
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${styles[status]}`}>{labels[status]}</span>;
};

const loadPatient = async (user: User) => api.patients.getByUserId(user.id);

export const PatientAppointmentsPage: React.FC<PatientPageProps> = ({ user }) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [tab, setTab] = useState<'future' | 'history'>('future');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  const refresh = async () => {
    setLoading(true);
    const patientData = await loadPatient(user);
    setPatient(patientData);
    const [doctorData, unitData, appointmentData] = await Promise.all([
      api.users.getAll(),
      api.units.getAll(),
      patientData ? api.appointments.getByPatientId(patientData.id) : Promise.resolve([]),
    ]);
    setDoctors(doctorData);
    setUnits(unitData);
    setAppointments(appointmentData);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [user.id]);

  const doctorById = useMemo(() => new Map(doctors.map(doctor => [doctor.id, doctor])), [doctors]);
  const unitById = useMemo(() => new Map(units.map(unit => [unit.id, unit])), [units]);
  const today = new Date().toISOString().split('T')[0];
  const visibleAppointments = appointments
    .filter(appointment => tab === 'future'
      ? appointment.date >= today && appointment.status !== AppointmentStatus.CANCELLED
      : appointment.date < today || appointment.status !== AppointmentStatus.SCHEDULED)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const cancelAppointment = async (appointment: Appointment) => {
    if (!window.confirm('Cancelar esta consulta?')) return;
    await api.appointments.update(appointment.id, { status: AppointmentStatus.CANCELLED });
    setFeedback('Consulta cancelada. O histórico foi preservado.');
    await refresh();
  };

  return (
    <PatientPageShell
      title="Minhas consultas"
      description="Acompanhe consultas futuras, histórico e detalhes dos seus agendamentos."
      action={(
        <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B60C9] px-5 font-black text-white hover:bg-[#0847AA]" to="/patient-portal/schedule">
          <Calendar className="h-5 w-5" />
          Agendar consulta
        </Link>
      )}
    >
      <DemoNotice />
      {feedback && <Feedback type="success" message={feedback} />}
      {loading ? (
        <LoadingState />
      ) : !patient ? (
        <EmptyState title="Cadastro não localizado" description="Entre novamente pelo portal para carregar seu cadastro." />
      ) : (
        <>
          <div className={`${cardClass} flex gap-2 p-2`}>
            {[
              ['future', 'Próximas'],
              ['history', 'Histórico'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key as 'future' | 'history')}
                className={`h-10 flex-1 rounded-xl text-sm font-black ${tab === key ? 'bg-[#0B60C9] text-white' : 'text-[#5F708A] hover:bg-[#F1F7FD]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {visibleAppointments.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={tab === 'future' ? 'Nenhuma consulta futura' : 'Sem histórico de consultas'}
              description="Quando houver movimentação, os registros aparecerão aqui com status e detalhes."
              action={<Link className="font-black text-[#0B60C9]" to="/patient-portal/schedule">Agendar agora</Link>}
            />
          ) : (
            <div className="grid gap-4">
              {visibleAppointments.map(appointment => {
                const doctor = doctorById.get(appointment.doctorId);
                const unit = unitById.get(appointment.unitId);
                return (
                  <article key={appointment.id} className={`${cardClass} p-5`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <AppointmentBadge status={appointment.status} />
                        <h2 className="mt-3 text-xl font-black text-[#10223F]">
                          {doctor?.name || 'Profissional de saúde'}
                        </h2>
                        <p className="mt-1 text-sm font-semibold text-[#5F708A]">{unit?.name || 'Unidade de referência'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm font-bold text-[#10223F] sm:text-right">
                        <span className="inline-flex items-center gap-2 sm:justify-end"><Calendar className="h-4 w-4 text-[#0B60C9]" />{formatDate(appointment.date)}</span>
                        <span className="inline-flex items-center gap-2 sm:justify-end"><Clock className="h-4 w-4 text-[#048C47]" />{appointment.time}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="h-10 rounded-xl border border-[#CFE7FF] px-4 text-sm font-black text-[#0B60C9] hover:bg-[#F7FBFF]" type="button">
                        Ver detalhes
                      </button>
                      {appointment.status === AppointmentStatus.SCHEDULED && (
                        <button
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#FFC7CC] px-4 text-sm font-black text-[#D51F2A] hover:bg-[#FFE6E8]"
                          type="button"
                          onClick={() => cancelAppointment(appointment)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Cancelar
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </PatientPageShell>
  );
};

export const PatientCareHistoryPage: React.FC<PatientPageProps> = ({ user }) => {
  const [items, setItems] = useState<CareHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const patient = await loadPatient(user);
      setItems(patient ? await api.careHistory.getByPatientId(patient.id) : []);
      setLoading(false);
    };
    run();
  }, [user.id]);

  const filteredItems = items.filter(item =>
    `${item.service} ${item.summary} ${item.professionalName}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <PatientPageShell title="Atendimentos" description="Linha do tempo resumida de atendimentos registrados, sem prontuário sensível.">
      <DemoNotice />
      <div className={`${cardClass} flex items-center gap-3 p-3`}>
        <Search className="h-5 w-5 text-[#8A99AD]" />
        <input className="h-10 flex-1 bg-transparent text-sm font-semibold outline-none" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por serviço, profissional ou resumo" />
      </div>
      {loading ? (
        <LoadingState />
      ) : filteredItems.length === 0 ? (
        <EmptyState icon={Stethoscope} title="Nenhum atendimento encontrado" description="A lista ainda não possui eventos para os filtros selecionados." />
      ) : (
        <div className="relative space-y-4 pl-5 before:absolute before:left-1.5 before:top-2 before:h-full before:w-0.5 before:bg-[#D9E6F5]">
          {filteredItems.map(item => (
            <article key={item.id} className={`${cardClass} relative p-5 before:absolute before:-left-[23px] before:top-6 before:h-3 before:w-3 before:rounded-full before:bg-[#0B60C9]`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-black text-[#10223F]">{item.service}</h2>
                <span className="text-sm font-black text-[#0B60C9]">{formatDate(item.date)}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[#5F708A]">{item.summary}</p>
              <p className="mt-3 text-xs font-black uppercase text-[#8A99AD]">Responsável: {item.professionalName}</p>
            </article>
          ))}
        </div>
      )}
    </PatientPageShell>
  );
};

export const PatientUnitsPage: React.FC = () => {
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [selectedType, setSelectedType] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.units.getAll().then(data => {
      setUnits(data);
      setLoading(false);
    });
  }, []);

  const filteredUnits = units.filter(unit => {
    const text = `${unit.name} ${unit.neighborhood} ${unit.address} ${unit.tipoUnidade}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesType = selectedType === 'all'
      || (selectedType === 'hospital' && unit.isHospital)
      || (selectedType === 'usf' && !unit.isHospital);
    return matchesQuery && matchesType;
  });

  return (
    <PatientPageShell title="Unidades de saúde" description="Localize unidades, horários e contatos da rede municipal.">
      <DemoNotice />
      <div className={`${cardClass} grid gap-3 p-4 sm:grid-cols-[1fr_180px]`}>
        <div className="flex items-center gap-3 rounded-xl border border-[#CBD8E8] px-3">
          <Search className="h-5 w-5 text-[#8A99AD]" />
          <input className="h-11 flex-1 bg-transparent text-sm font-semibold outline-none" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome, bairro ou endereço" />
        </div>
        <select className={inputClass} value={selectedType} onChange={event => setSelectedType(event.target.value)}>
          <option value="all">Todos os tipos</option>
          <option value="usf">Unidades básicas</option>
          <option value="hospital">Hospitais</option>
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : filteredUnits.length === 0 ? (
        <EmptyState icon={Building2} title="Nenhuma unidade encontrada" description="Limpe a busca ou altere o filtro para visualizar outras unidades." />
      ) : (
        <div className="grid gap-4">
          {filteredUnits.map(unit => (
            <article key={unit.id} className={`${cardClass} p-5`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-[#10223F]">{unit.name}</h2>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#5F708A]">
                    <MapPin className="h-4 w-4 text-[#D51F2A]" />
                    {[unit.address, unit.addressNumber, unit.neighborhood, unit.city || 'Olinda'].filter(Boolean).join(', ')}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-[#EAF6FF] px-3 py-1 text-xs font-black text-[#0B60C9]">
                  {unit.isHospital ? 'Hospital' : 'Unidade básica'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm font-bold text-[#10223F] sm:grid-cols-3">
                <span className="flex items-center gap-2"><Phone className="h-4 w-4 text-[#048C47]" />{unit.phone || '(81) 0000-0000'}</span>
                <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-[#0B60C9]" />Segunda a sexta</span>
                <span className="flex items-center gap-2"><Info className="h-4 w-4 text-[#FFCF22]" />Atendimento: {unit.attendanceType === 'SENHA' ? 'senha' : 'chegada'}</span>
              </div>
              <p className="mt-4 text-xs font-semibold text-[#8A99AD]">Endereço e telefone podem ser atualizados pela unidade quando necessário.</p>
            </article>
          ))}
        </div>
      )}
    </PatientPageShell>
  );
};

export const PatientExamSchedulePage: React.FC<PatientPageProps> = ({ user }) => {
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [form, setForm] = useState({
    type: 'Hemograma completo',
    requestCode: 'REQ-OLINDA-2026',
    unitId: '',
    date: '',
    time: '08:00',
  });

  useEffect(() => {
    const run = async () => {
      const [patientData, unitData] = await Promise.all([loadPatient(user), api.units.getAll()]);
      setPatient(patientData);
      setUnits(unitData);
      setForm(prev => ({ ...prev, unitId: patientData?.unitId || unitData[0]?.id || '' }));
      setLoading(false);
    };
    run();
  }, [user.id]);

  const preparation = form.type.includes('Sangue') || form.type.includes('Hemograma')
    ? 'Jejum de 8 horas e documento com foto.'
    : 'Levar documento com foto e solicitação do exame.';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!patient) {
      setFeedback({ type: 'error', message: 'Cadastro de paciente não localizado.' });
      return;
    }
    setSubmitting(true);
    try {
      await api.exams.add({
        patientId: patient.id,
        unitId: form.unitId,
        type: form.type,
        requestCode: form.requestCode,
        date: form.date,
        time: form.time,
        preparation,
      });
      setFeedback({ type: 'success', message: 'Exame agendado com sucesso. O resumo já está disponível em Meus exames.' });
    } catch (error) {
      setFeedback({ type: 'error', message: 'Não foi possível agendar o exame. Verifique os dados e tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PatientPageShell title="Agendar exame" description="Solicite, escolha unidade, data e horário para um exame.">
      {loading ? (
        <LoadingState />
      ) : (
        <form onSubmit={submit} className={`${cardClass} grid gap-5 p-5`}>
          {feedback && <Feedback type={feedback.type} message={feedback.message} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-black text-[#06296F]">Tipo de exame</label>
              <select className={inputClass} value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>
                <option>Hemograma completo</option>
                <option>Glicemia de jejum</option>
                <option>Raio-X simples</option>
                <option>Ultrassonografia</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-black text-[#06296F]">Solicitação</label>
              <input className={inputClass} value={form.requestCode} onChange={event => setForm({ ...form, requestCode: event.target.value })} required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-black text-[#06296F]">Unidade</label>
              <select className={inputClass} value={form.unitId} onChange={event => setForm({ ...form, unitId: event.target.value })} required>
                {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-black text-[#06296F]">Data</label>
                <input className={inputClass} min={new Date().toISOString().split('T')[0]} type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} required />
              </div>
              <div>
              <label className="mb-2 block text-sm font-black text-[#06296F]">Horário</label>
                <input className={inputClass} type="time" value={form.time} onChange={event => setForm({ ...form, time: event.target.value })} required />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#CFE7FF] bg-[#F7FBFF] p-4">
            <p className="text-xs font-black uppercase text-[#8A99AD]">Preparo</p>
            <p className="mt-1 text-sm font-bold text-[#10223F]">{preparation}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => navigate('/patient-portal/exams')} className="h-11 rounded-xl border border-[#CFE7FF] px-5 font-black text-[#0B60C9] hover:bg-[#F7FBFF]">
              Ver meus exames
            </button>
            <button disabled={submitting} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B60C9] px-5 font-black text-white hover:bg-[#0847AA] disabled:opacity-60">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FlaskConical className="h-5 w-5" />}
              Confirmar exame
            </button>
          </div>
        </form>
      )}
    </PatientPageShell>
  );
};

export const PatientExamsPage: React.FC<PatientPageProps> = ({ user }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [tab, setTab] = useState<'scheduled' | 'results'>('scheduled');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const patient = await loadPatient(user);
      setExams(patient ? await api.exams.getByPatientId(patient.id) : []);
      setLoading(false);
    };
    run();
  }, [user.id]);

  const visibleExams = exams.filter(exam => tab === 'scheduled' ? exam.status === ExamStatus.SCHEDULED : exam.status === ExamStatus.AVAILABLE);

  const downloadDemoResult = (exam: Exam) => {
    const content = `Resultado - ${exam.type}\nPaciente: ${user.name}\nData: ${formatDate(exam.date)}\n\nArquivo gerado pelo Conecta Saúde Olinda.`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resultado-${exam.type.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFeedback('Arquivo de resultado gerado.');
  };

  return (
    <PatientPageShell
      title="Meus exames"
      description="Consulte exames agendados, resultados e orientações de preparo."
      action={<Link className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B60C9] px-5 font-black text-white hover:bg-[#0847AA]" to="/patient-portal/exams/schedule"><FlaskConical className="h-5 w-5" />Agendar exame</Link>}
    >
      {feedback && <Feedback type="info" message={feedback} />}
      <div className={`${cardClass} flex gap-2 p-2`}>
        <button type="button" onClick={() => setTab('scheduled')} className={`h-10 flex-1 rounded-xl text-sm font-black ${tab === 'scheduled' ? 'bg-[#0B60C9] text-white' : 'text-[#5F708A] hover:bg-[#F1F7FD]'}`}>Agendados</button>
        <button type="button" onClick={() => setTab('results')} className={`h-10 flex-1 rounded-xl text-sm font-black ${tab === 'results' ? 'bg-[#0B60C9] text-white' : 'text-[#5F708A] hover:bg-[#F1F7FD]'}`}>Resultados</button>
      </div>
      {loading ? (
        <LoadingState />
      ) : visibleExams.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Nenhum exame nesta aba" description="Agende um exame ou consulte outra aba." />
      ) : (
        <div className="grid gap-4">
          {visibleExams.map(exam => (
            <article key={exam.id} className={`${cardClass} p-5`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <ExamBadge status={exam.status} />
                  <h2 className="mt-3 text-xl font-black text-[#10223F]">{exam.type}</h2>
                  <p className="mt-1 text-sm font-semibold text-[#5F708A]">Solicitação: {exam.requestCode || 'Sem código'}</p>
                </div>
                <div className="text-sm font-bold text-[#10223F] sm:text-right">
                  <p>{formatDate(exam.date)}</p>
                  <p className="text-[#5F708A]">{exam.time}</p>
                </div>
              </div>
              <p className="mt-4 rounded-xl bg-[#F7FBFF] p-3 text-sm font-semibold text-[#5F708A]">{exam.preparation}</p>
              {exam.status === ExamStatus.AVAILABLE && (
                <button type="button" onClick={() => downloadDemoResult(exam)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-[#CFE7FF] px-4 text-sm font-black text-[#0B60C9] hover:bg-[#F7FBFF]">
                  <Download className="h-4 w-4" />
                  Baixar resultado
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </PatientPageShell>
  );
};

export const PatientRemindersPage: React.FC<PatientPageProps> = ({ user }) => {
  const storageKey = `conecta_saude_reminders_${user.id}`;
  const defaultPreference: ReminderPreference = {
    userId: user.id,
    channels: { sms: true, email: true, whatsapp: false },
    leadTimeHours: 24,
    quietHours: true,
  };
  const [preferences, setPreferences] = useState<ReminderPreference>(defaultPreference);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setPreferences(await api.reminders.getPreferences());
      } catch {
        const saved = localStorage.getItem(storageKey);
        if (saved) setPreferences(JSON.parse(saved));
      }
    };
    load();
  }, [storageKey]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.reminders.savePreferences(preferences);
      setPreferences(saved);
    } catch {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } finally {
      setSaving(false);
      setFeedback('Preferências salvas.');
    }
  };

  const toggleChannel = (key: keyof ReminderPreference['channels']) => {
    setPreferences(prev => ({ ...prev, channels: { ...prev.channels, [key]: !prev.channels[key] } }));
  };

  return (
    <PatientPageShell title="Lembretes" description="Configure como deseja receber lembretes de consultas e exames.">
      {feedback && <Feedback type="success" message={feedback} />}
      <div className={`${cardClass} grid gap-5 p-5`}>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['sms', 'SMS'],
            ['email', 'E-mail'],
            ['whatsapp', 'WhatsApp'],
          ].map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center justify-between rounded-2xl border border-[#D9E6F5] p-4 text-sm font-black text-[#10223F]">
              {label}
              <input type="checkbox" className="h-5 w-5 accent-[#0B60C9]" checked={preferences.channels[key as keyof ReminderPreference['channels']]} onChange={() => toggleChannel(key as keyof ReminderPreference['channels'])} />
            </label>
          ))}
        </div>
        <div>
          <label className="mb-2 block text-sm font-black text-[#06296F]">Antecedência do lembrete</label>
          <select className={inputClass} value={preferences.leadTimeHours} onChange={event => setPreferences({ ...preferences, leadTimeHours: Number(event.target.value) })}>
            <option value={6}>6 horas antes</option>
            <option value={12}>12 horas antes</option>
            <option value={24}>1 dia antes</option>
            <option value={48}>2 dias antes</option>
          </select>
        </div>
        <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-[#F7FBFF] p-4 text-sm font-black text-[#10223F]">
          Evitar mensagens entre 22h e 7h
          <input type="checkbox" className="h-5 w-5 accent-[#0B60C9]" checked={preferences.quietHours} onChange={event => setPreferences({ ...preferences, quietHours: event.target.checked })} />
        </label>
        <button type="button" disabled={saving} onClick={save} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B60C9] px-5 font-black text-white hover:bg-[#0847AA] disabled:opacity-60 sm:w-fit">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <BellRing className="h-5 w-5" />}
          Salvar preferências
        </button>
      </div>
      <div className="grid gap-4">
        {['Consulta de clínica geral em 24 horas', 'Exame de sangue em 2 dias', 'Resultado disponível'].map((message, index) => (
          <div key={message} className={`${cardClass} flex items-center gap-4 p-4`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF6FF] text-[#0B60C9]">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black text-[#10223F]">{message}</p>
              <p className="text-sm font-semibold text-[#5F708A]">{index === 0 ? 'Próximo lembrete' : 'Histórico de lembretes'}</p>
            </div>
          </div>
        ))}
      </div>
    </PatientPageShell>
  );
};

export const PatientInformationPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState('documents');
  const faqs = [
    {
      id: 'documents',
      question: 'Quais documentos devo levar?',
      answer: 'Leve documento com foto, Cartao SUS e comprovante de residencia quando solicitado pela unidade.',
    },
    {
      id: 'cancel',
      question: 'Como cancelo uma consulta?',
      answer: 'Acesse Minhas consultas, abra a consulta agendada e use a acao Cancelar. O historico permanece registrado.',
    },
    {
      id: 'emergency',
      question: 'Posso usar o portal em uma emergência?',
      answer: 'Não. Em urgências, procure imediatamente o serviço de urgência apropriado ou acione os canais oficiais de emergência.',
    },
  ];
  const filteredFaqs = faqs.filter(item => `${item.question} ${item.answer}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <PatientPageShell title="Informações" description="Dúvidas comuns sobre o Conecta Saúde Olinda e canais de atendimento.">
      <div className={`${cardClass} flex items-center gap-3 p-3`}>
        <Search className="h-5 w-5 text-[#8A99AD]" />
        <input className="h-10 flex-1 bg-transparent text-sm font-semibold outline-none" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar pergunta" />
      </div>
      <div className="rounded-2xl border border-[#FFC7CC] bg-[#FFE6E8] p-4 text-sm font-bold text-[#97111B]">
        Esta área não substitui atendimento médico. Em caso de urgência, procure uma unidade de emergência ou acione os canais oficiais.
      </div>
      <div className="space-y-3">
        {filteredFaqs.map(item => (
          <article key={item.id} className={`${cardClass} overflow-hidden`}>
            <button type="button" onClick={() => setOpenId(openId === item.id ? '' : item.id)} className="flex w-full items-center justify-between gap-4 p-5 text-left">
              <span className="font-black text-[#10223F]">{item.question}</span>
              <ChevronRight className={`h-5 w-5 text-[#0B60C9] transition-transform ${openId === item.id ? 'rotate-90' : ''}`} />
            </button>
            {openId === item.id && <p className="border-t border-[#D9E6F5] px-5 py-4 text-sm font-semibold text-[#5F708A]">{item.answer}</p>}
          </article>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${cardClass} p-5`}>
          <Mail className="mb-3 h-6 w-6 text-[#0B60C9]" />
          <h2 className="font-black text-[#10223F]">Atendimento digital</h2>
          <p className="mt-1 text-sm font-semibold text-[#5F708A]">conectasaude@olinda.pe.gov.br</p>
        </div>
        <div className={`${cardClass} p-5`}>
          <Phone className="mb-3 h-6 w-6 text-[#048C47]" />
          <h2 className="font-black text-[#10223F]">Central municipal</h2>
          <p className="mt-1 text-sm font-semibold text-[#5F708A]">(81) 0000-0000</p>
        </div>
      </div>
    </PatientPageShell>
  );
};

export const NotFoundPage: React.FC = () => (
  <div className="min-h-[60vh] rounded-2xl border border-[#D9E6F5] bg-white p-8 text-center shadow-[0_8px_20px_rgba(6,41,111,0.08)]">
    <HelpCircle className="mx-auto h-12 w-12 text-[#0B60C9]" />
    <h1 className="mt-4 text-3xl font-black text-[#06296F]">Página não encontrada</h1>
    <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-[#5F708A]">A rota solicitada não existe no Conecta Saúde Olinda.</p>
    <Link to="/" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B60C9] px-5 font-black text-white hover:bg-[#0847AA]">
      Voltar ao início
      <RotateCcw className="h-5 w-5" />
    </Link>
  </div>
);
