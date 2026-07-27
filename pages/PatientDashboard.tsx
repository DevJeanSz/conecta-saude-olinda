import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Building2,
  Calendar,
  CalendarCheck2,
  Clock3,
  FileText,
  HeartPulse,
  Info,
  MapPinned,
  ShieldCheck,
  Stethoscope,
  TestTube2,
} from 'lucide-react';
import { api } from '../services/api';
import { Appointment, AppointmentStatus, HealthUnit, Patient, User } from '../types';

interface PatientDashboardProps {
  user: User;
}

const menuOptions = [
  {
    title: 'Agendamento de Consulta',
    description: 'Escolha especialidade e horário',
    icon: Calendar,
    tone: 'blue',
    path: '/patient-portal/schedule',
  },
  {
    title: 'Minhas Consultas',
    description: 'Veja próximos atendimentos',
    icon: CalendarCheck2,
    tone: 'green',
    path: '/patient-portal/appointments',
  },
  {
    title: 'Atendimentos',
    description: 'Acompanhe seu histórico',
    icon: Stethoscope,
    tone: 'violet',
    path: '/patient-portal/care-history',
  },
  {
    title: 'Unidades de Saúde',
    description: 'Encontre atendimento perto',
    icon: MapPinned,
    tone: 'yellow',
    path: '/patient-portal/units',
  },
  {
    title: 'Agendamento de Exames',
    description: 'Solicite seus exames',
    icon: TestTube2,
    tone: 'red',
    path: '/patient-portal/exams/schedule',
  },
  {
    title: 'Meus Exames',
    description: 'Consulte solicitações e datas',
    icon: FileText,
    tone: 'cyan',
    path: '/patient-portal/exams',
  },
  {
    title: 'Lembretes',
    description: 'Não perca nenhum cuidado',
    icon: Bell,
    tone: 'orange',
    path: '/patient-portal/reminders',
  },
  {
    title: 'Informações',
    description: 'Orientações da rede municipal',
    icon: Info,
    tone: 'navy',
    path: '/patient-portal/information',
  },
];

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [units, setUnits] = useState<HealthUnit[]>([]);

  useEffect(() => {
    const load = async () => {
      const patientData = await api.patients.getByUserId(user.id);
      setPatient(patientData);

      const [unitData, appointmentData] = await Promise.all([
        api.units.getAll(),
        patientData ? api.appointments.getByPatientId(patientData.id) : Promise.resolve([]),
      ]);

      setUnits(unitData);
      const today = new Date().toISOString().split('T')[0];
      const next = appointmentData
        .filter(appointment => appointment.status === AppointmentStatus.SCHEDULED && appointment.date >= today)
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0] || null;
      setNextAppointment(next);
    };

    load();
  }, [user.id]);

  const nextUnit = useMemo(
    () => units.find(unit => unit.id === nextAppointment?.unitId),
    [nextAppointment?.unitId, units],
  );

  const firstName = user.name.split(' ')[0];
  const nextDate = nextAppointment?.date
    ? new Date(`${String(nextAppointment.date).split('T')[0]}T00:00:00`)
    : null;

  return (
    <>
      <section className="patient-welcome">
        <div>
          <span>Olá, {firstName}</span>
          <h1>Como podemos ajudar você hoje?</h1>
          <p>Acesse seus serviços de saúde com poucos toques.</p>
        </div>
        <div className="health-id">
          <span>
            <ShieldCheck size={18} />
          </span>
          <div>
            <small>Cartão SUS verificado</small>
            <strong>{patient?.susNumber || user.susNumber || 'Não informado'}</strong>
          </div>
          <BadgeCheck size={22} />
        </div>
      </section>

      <section className="next-appointment">
        <div className="appointment-date">
          <span>{nextDate ? nextDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : 'SEM'}</span>
          <strong>{nextDate ? String(nextDate.getDate()).padStart(2, '0') : '--'}</strong>
          <small>{nextDate ? nextDate.toLocaleDateString('pt-BR', { weekday: 'long' }) : 'consulta'}</small>
        </div>
        <div className="appointment-info">
          <span className="status-badge scheduled">{nextAppointment ? 'Próxima consulta' : 'Agenda livre'}</span>
          <h2>{nextAppointment ? 'Consulta agendada' : 'Nenhuma consulta futura'}</h2>
          <p>
            <Clock3 size={16} /> {nextAppointment?.time || 'Escolha um horário'} <i /> <Building2 size={16} /> {nextUnit?.name || 'Unidade de referência'}
          </p>
        </div>
        <button
          onClick={() => navigate(nextAppointment ? '/patient-portal/appointments' : '/patient-portal/schedule')}
          type="button"
        >
          {nextAppointment ? 'Ver detalhes' : 'Agendar'} <ArrowRight size={17} />
        </button>
      </section>

      <section className="patient-modules">
        <div className="patient-section-title">
          <div>
            <span>Serviços digitais</span>
            <h2>O que você precisa?</h2>
          </div>
          <span>8 serviços disponíveis</span>
        </div>

        <div className="patient-module-grid">
          {menuOptions.map(({ icon: Icon, title, description, tone, path }) => (
            <button
              className="patient-module-card"
              key={title}
              onClick={() => navigate(path)}
              type="button"
            >
              <span className={`module-icon ${tone}`}>
                <Icon size={23} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
      </section>

      <section className="health-tip">
        <span>
          <HeartPulse size={22} />
        </span>
        <div>
          <strong>Cuide de você todos os dias</strong>
          <p>
            Mantenha seus dados atualizados para receber lembretes e
            orientações da rede municipal.
          </p>
        </div>
        <button onClick={() => navigate('/perfil')} type="button">
          Atualizar perfil
        </button>
      </section>
    </>
  );
};
