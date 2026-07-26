import React, { useEffect, useState } from 'react';
import { Appointment, Patient, User } from '../types';
import { api } from '../services/api';
import { Info, Volume2 } from 'lucide-react';
import prefeituraLogo from '@/src/assets/images/prefeitura-olinda-oficial.svg';
import olindaHero from '@/src/assets/images/olinda-hero-conecta-saude.svg';

interface DisplayTVProps {
  user: User | null;
}

export const DisplayTV: React.FC<DisplayTVProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [lastCalledId, setLastCalledId] = useState<string | null>(null);

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

  const today = new Date().toISOString().split('T')[0];
  const calledAppts = appointments
    .filter((appointment) => appointment.calledAt && appointment.queuePassword && appointment.date === today)
    .sort((a, b) => new Date(b.calledAt!).getTime() - new Date(a.calledAt!).getTime());

  const currentCall = calledAppts[0];
  const recentCalls = calledAppts.slice(0, 4);

  const getPatientName = (id: string) => patients.find((patient) => patient.id === id)?.name || '';
  const getDoctorName = (id: string) => doctors.find((doctor) => doctor.id === id)?.name || '';
  const getCallLabel = (appointment: Appointment) => {
    if (appointment.queuePassword?.startsWith('P-')) return 'Prioridade';
    if (appointment.queuePassword?.startsWith('E-')) return 'Exames';
    return getDoctorName(appointment.doctorId) || 'Atendimento';
  };
  const getCallLocation = (appointment: Appointment, index: number) => {
    if (appointment.queuePassword?.startsWith('P-') || appointment.queuePassword?.startsWith('E-')) {
      return `Sala ${String(index + 2).padStart(2, '0')}`;
    }

    return `Guichê ${String((index % 3) + 1).padStart(2, '0')}`;
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

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-2xl font-bold">
        Acesso Negado ou Não Autenticado
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white flex font-sans selection:bg-primary/30">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${olindaHero})` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-900/90" aria-hidden="true" />

      <main className="relative z-10 flex-1 flex flex-col justify-center items-center p-12">
        <div className="absolute top-8 left-8 flex items-center gap-5">
          <img
            src={prefeituraLogo}
            alt="Prefeitura de Olinda"
            className="h-16 w-auto rounded-xl bg-white p-2 shadow-lg shadow-black/30"
          />
          <div className="bg-primary text-white p-3 rounded-xl shadow-lg shadow-primary/20">
            <Volume2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Conecta Saúde
            </h1>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-100">Olinda</p>
          </div>
        </div>

        {currentCall ? (
          <div className="text-center w-full max-w-4xl animate-in fade-in zoom-in duration-500">
            <p className="text-4xl text-slate-400 font-bold tracking-widest uppercase mb-4">Senha</p>
            <div className="text-[12rem] leading-none font-black text-primary mb-8 tracking-tighter drop-shadow-2xl">
              {currentCall.queuePassword}
            </div>

            <div className="bg-slate-800/70 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl">
              <p className="text-3xl text-slate-300 font-medium mb-2">Paciente</p>
              <p className="text-6xl font-bold text-white truncate mb-8">{getPatientName(currentCall.patientId)}</p>

              <div className="flex items-center justify-center gap-4">
                <span className="bg-primary/20 text-primary text-2xl px-6 py-2 rounded-full font-bold">
                  Consultório
                </span>
                <span className="text-4xl font-bold text-slate-200">Dr(a). {getDoctorName(currentCall.doctorId)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-6xl font-black text-slate-600">Aguardando Chamada</div>
          </div>
        )}
      </main>

      <aside className="tv-next relative z-10 w-[500px] bg-slate-950/95 border-l border-white/10 p-8 flex flex-col shadow-2xl backdrop-blur-md">
        <div className="mb-8">
          <span className="block text-3xl font-black text-white tracking-tight">
            Últimas senhas chamadas
          </span>
          <small className="mt-2 block text-base font-semibold text-slate-400">
            Aguarde sua chamada e confira o local de atendimento
          </small>
        </div>

        <div className="space-y-4 flex-1">
          {recentCalls.length === 0 ? (
            <p className="text-slate-500 text-lg font-medium text-center py-10">Nenhuma senha chamada hoje</p>
          ) : (
            recentCalls.map((appointment, index) => (
              <div
                key={appointment.id}
                className="next-ticket bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-xl font-black text-blue-200">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <strong className="text-4xl font-black text-white tracking-tight">{appointment.queuePassword}</strong>
                    <small className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-300">
                      {new Date(appointment.calledAt!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </small>
                  </div>
                  <small className="mt-1 block truncate text-base font-semibold text-slate-400">
                    {getCallLabel(appointment)}
                  </small>
                </div>
                <strong className="shrink-0 text-lg font-black text-yellow-300">
                  {getCallLocation(appointment, index)}
                </strong>
              </div>
            ))
          )}
        </div>

        <div className="pt-8 mt-auto border-t border-slate-800">
          <div className="tv-orientation bg-slate-900 p-4 rounded-xl flex items-center gap-3 text-slate-300 font-semibold">
            <Info className="w-5 h-5 shrink-0 text-blue-200" />
            Mantenha seu documento e cartão SUS em mãos.
          </div>
        </div>
      </aside>
    </div>
  );
};
