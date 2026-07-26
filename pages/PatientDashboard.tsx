import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRing,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  FlaskConical,
  Info,
  Stethoscope,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../services/api';
import { Appointment, AppointmentStatus, HealthUnit, Patient, User } from '../types';

interface PatientDashboardProps {
  user: User;
}

const menuOptions = [
  {
    title: 'Agendamento de Consulta',
    description: 'Escolha unidade, especialidade, data e horario.',
    icon: CalendarCheck,
    color: 'text-[#048C47]',
    bgColor: 'bg-[#E3F8EC]',
    path: '/patient-portal/schedule',
  },
  {
    title: 'Minhas Consultas',
    description: 'Acompanhe consultas futuras e historico.',
    icon: CalendarDays,
    color: 'text-[#0B60C9]',
    bgColor: 'bg-[#DFF0FF]',
    path: '/patient-portal/appointments',
  },
  {
    title: 'Atendimentos',
    description: 'Veja uma linha do tempo resumida.',
    icon: Stethoscope,
    color: 'text-[#06296F]',
    bgColor: 'bg-[#EAF6FF]',
    path: '/patient-portal/care-history',
  },
  {
    title: 'Unidades de Saude',
    description: 'Encontre unidades e contatos.',
    icon: Building2,
    color: 'text-[#048C47]',
    bgColor: 'bg-[#E3F8EC]',
    path: '/patient-portal/units',
  },
  {
    title: 'Agendamento de Exames',
    description: 'Solicite e confirme exames ficticios.',
    icon: FlaskConical,
    color: 'text-[#0B60C9]',
    bgColor: 'bg-[#DFF0FF]',
    path: '/patient-portal/exams/schedule',
  },
  {
    title: 'Meus Exames',
    description: 'Consulte agenda e resultados.',
    icon: ClipboardList,
    color: 'text-[#D51F2A]',
    bgColor: 'bg-[#FFE6E8]',
    path: '/patient-portal/exams',
  },
  {
    title: 'Lembretes',
    description: 'Configure preferencias de aviso.',
    icon: BellRing,
    color: 'text-[#06296F]',
    bgColor: 'bg-[#FFF5C2]',
    path: '/patient-portal/reminders',
  },
  {
    title: 'Informacoes',
    description: 'Duvidas frequentes e canais.',
    icon: Info,
    color: 'text-[#0B60C9]',
    bgColor: 'bg-[#DFF0FF]',
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

  return (
    <div className="flex-1 space-y-6 pb-24">
      <section className="rounded-3xl border border-[#D9E6F5] bg-white p-5 shadow-[0_8px_20px_rgba(6,41,111,0.08)]">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#DFF0FF] text-[#0B60C9]">
            <UserIcon className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#06296F]">Ola, {firstName}!</h1>
            <p className="text-lg font-semibold leading-snug text-[#5F708A]">Como podemos ajudar voce hoje?</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#D9E6F5] bg-white p-5 shadow-[0_8px_20px_rgba(6,41,111,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-[#8A99AD]">Proxima consulta</p>
            {nextAppointment ? (
              <>
                <h2 className="mt-1 text-xl font-black text-[#10223F]">
                  {new Date(`${nextAppointment.date}T00:00:00`).toLocaleDateString('pt-BR')} as {nextAppointment.time}
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#5F708A]">{nextUnit?.name || 'Unidade de referencia'}</p>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-xl font-black text-[#10223F]">Nenhuma consulta futura</h2>
                <p className="mt-1 text-sm font-semibold text-[#5F708A]">Agende uma consulta para ela aparecer aqui.</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(nextAppointment ? '/patient-portal/appointments' : '/patient-portal/schedule')}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#0B60C9] px-4 text-sm font-black text-white hover:bg-[#0847AA]"
          >
            {nextAppointment ? 'Ver consultas' : 'Agendar'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {menuOptions.map(option => (
          <button
            key={option.title}
            onClick={() => navigate(option.path)}
            className="group flex min-h-40 flex-col rounded-2xl border border-[#D9E6F5] bg-white p-4 text-left shadow-[0_8px_20px_rgba(6,41,111,0.08)] transition-all hover:-translate-y-0.5 hover:border-[#0B60C9]/40 hover:shadow-[0_16px_36px_rgba(6,41,111,0.12)] active:translate-y-0"
          >
            <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${option.bgColor}`}>
              <option.icon className={`h-6 w-6 ${option.color}`} />
            </div>
            <h2 className="text-sm font-black leading-tight text-[#10223F] md:text-base">{option.title}</h2>
            <p className="mt-2 flex-1 text-xs font-semibold leading-snug text-[#5F708A]">{option.description}</p>
            <div className="mt-3 flex justify-end">
              <ChevronRight className="h-4 w-4 text-[#8A99AD] transition-colors group-hover:text-[#0B60C9]" />
            </div>
          </button>
        ))}
      </div>

      <section className="rounded-3xl border border-[#CFE7FF] bg-[#DFF0FF] p-5">
        <div className="flex gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#0B60C9]" />
          <div>
            <h2 className="font-black text-[#06296F]">Dica de saude</h2>
            <p className="mt-1 text-sm font-semibold text-[#10223F]">
              Mantenha seus dados atualizados e chegue com antecedencia na unidade no dia do atendimento.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
