import React, { useEffect, useMemo, useState } from 'react';
import { Appointment, Patient, User } from '../types';
import { api } from '../services/api';
import { HeartPulse, Info, UserRoundCheck } from 'lucide-react';
import { BrandLockup } from '../components/BrandLockup';
import { PernambucoStripe } from '../components/VisualPrimitives';

interface DisplayTVProps {
  user: User | null;
}

const demoCalls = [
  { ticket: 'A-023', location: 'GUICHÊ 02', service: 'CLÍNICA GERAL', patient: 'Lucas Moura', time: '09:42' },
  { ticket: 'A-022', location: 'SALA 03', service: 'PRIORIDADE', patient: 'Marina Silva', time: '09:35' },
  { ticket: 'E-014', location: 'SALA 05', service: 'EXAMES', patient: 'José Carlos', time: '09:20' },
  { ticket: 'A-021', location: 'GUICHÊ 01', service: 'PEDIATRIA', patient: 'Lúcia Ferreira', time: '09:12' },
];

export const DisplayTV: React.FC<DisplayTVProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [lastCalledId, setLastCalledId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const loadData = async () => {
    if (!user?.unitId) return;

    try {
      const [appts, pts, docs] = await Promise.all([
        api.appointments.getByUnit(user.unitId),
        api.patients.getByUnit(user.unitId),
        api.users.getDoctorsByUnit(user.unitId),
      ]);
      setAppointments(appts);
      setPatients(pts);
      setDoctors(docs);
    } catch (error) {
      console.error('Erro ao carregar dados da TV', error);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [user?.unitId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const calledAppts = appointments
    .filter((appointment) => appointment.calledAt && appointment.queuePassword && appointment.date === today)
    .sort((a, b) => new Date(b.calledAt!).getTime() - new Date(a.calledAt!).getTime());

  const currentCall = calledAppts[0];
  const recentCalls = calledAppts.slice(0, 4);

  const getPatientName = (id: string) => patients.find((patient) => patient.id === id)?.name || '';
  const getDoctorName = (id: string) => doctors.find((doctor) => doctor.id === id)?.name || '';
  const getCallLabel = (appointment: Appointment) => {
    if (appointment.queuePassword?.startsWith('P-')) return 'PRIORIDADE';
    if (appointment.queuePassword?.startsWith('E-')) return 'EXAMES';
    return getDoctorName(appointment.doctorId).toUpperCase() || 'ATENDIMENTO';
  };
  const getCallLocation = (appointment: Appointment, index: number) => {
    if (appointment.queuePassword?.startsWith('P-') || appointment.queuePassword?.startsWith('E-')) {
      return `SALA ${String(index + 2).padStart(2, '0')}`;
    }

    return `GUICHÊ ${String((index % 3) + 1).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (currentCall && currentCall.id !== lastCalledId) {
      setLastCalledId(currentCall.id);

      try {
        const msg = new SpeechSynthesisUtterance();
        msg.text = `Senha. ${currentCall.queuePassword}. Paciente. ${getPatientName(currentCall.patientId)}. Consultório do doutor. ${getDoctorName(currentCall.doctorId)}`;
        msg.lang = 'pt-BR';
        window.speechSynthesis.speak(msg);
      } catch (error) {
        console.log('Audio play failed', error);
      }
    }
  }, [currentCall, lastCalledId]);

  const time = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const date = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  const currentDisplay = useMemo(() => {
    if (currentCall) {
      return {
        ticket: currentCall.queuePassword || '--',
        location: getCallLocation(currentCall, 0),
        service: getCallLabel(currentCall),
        patient: getPatientName(currentCall.patientId),
      };
    }

    if (!user) return demoCalls[0];
    return null;
  }, [currentCall, user, patients, doctors]);

  const recentDisplay = recentCalls.length
    ? recentCalls.map((appointment, index) => ({
      ticket: appointment.queuePassword || '--',
      location: getCallLocation(appointment, index),
      service: getCallLabel(appointment),
      patient: getPatientName(appointment.patientId),
      time: new Date(appointment.calledAt!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }))
    : (!user ? demoCalls : []);

  return (
    <main className="tv-page">
      <PernambucoStripe />
      <header className="tv-header">
        <BrandLockup light />
        <div>
          <span>{user?.unitId ? 'Unidade conectada' : 'USF Bairro Novo'}</span>
          <strong>{time}</strong>
          <small>{date}</small>
        </div>
      </header>

      <section className="tv-content">
        <div className="tv-current-call">
          <div className="tv-live">
            <span /> Chamada atual
          </div>
          <p>Por favor, dirija-se ao local indicado</p>
          <strong>{currentDisplay?.ticket || '--'}</strong>
          <div className="tv-destination">
            <span>
              <small>LOCAL</small>
              <strong>{currentDisplay?.location || 'AGUARDE'}</strong>
            </span>
            <i />
            <span>
              <small>ATENDIMENTO</small>
              <strong>{currentDisplay?.service || 'SEM CHAMADA'}</strong>
            </span>
          </div>
          <div className="tv-person">
            <UserRoundCheck size={24} />
            <span>
              <small>Paciente</small>
              <strong>{currentDisplay?.patient || 'Aguardando chamada'}</strong>
            </span>
          </div>
        </div>

        <aside className="tv-next">
          <div>
            <span>Últimas senhas chamadas</span>
            <small>Aguarde sua chamada</small>
          </div>
          {recentDisplay.length === 0 ? (
            <div className="tv-empty-calls">Nenhuma senha chamada hoje</div>
          ) : (
            recentDisplay.map((call, index) => (
              <div className="next-ticket" key={`${call.ticket}-${index}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{call.ticket}</strong>
                  <small>{call.service}</small>
                </div>
                <strong>{call.location}</strong>
              </div>
            ))
          )}
          <div className="tv-orientation">
            <Info size={20} />
            Mantenha seu documento e cartão SUS em mãos.
          </div>
        </aside>
      </section>

      <footer className="tv-footer">
        <span>
          <HeartPulse size={21} /> Cuidar de Olinda é conectar pessoas à saúde
        </span>
        <strong>Prefeitura Municipal de Olinda</strong>
      </footer>
    </main>
  );
};
