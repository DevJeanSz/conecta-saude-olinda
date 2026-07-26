import React, { useState, useEffect } from 'react';
import { Appointment, Patient, User } from '../types';
import { api } from '../services/api';
import { Volume2 } from 'lucide-react';

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
        api.users.getDoctorsByUnit(user.unitId)
      ]);
      setAppointments(appts);
      setPatients(pts);
      setDoctors(docs);
    } catch (error) {
      console.error("Erro ao carregar dados da TV", error);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000); // Poll every 3 seconds for fast TV update
    return () => clearInterval(interval);
  }, [user?.unitId]);

  const calledAppts = appointments
    .filter(a => a.calledAt && a.queuePassword && a.date === new Date().toISOString().split('T')[0])
    .sort((a, b) => new Date(b.calledAt!).getTime() - new Date(a.calledAt!).getTime());

  const currentCall = calledAppts[0];
  const historyCalls = calledAppts.slice(1, 5);

  useEffect(() => {
    // Play sound if a new password is called
    if (currentCall && currentCall.id !== lastCalledId) {
      setLastCalledId(currentCall.id);
      
      try {
        // Synthesis voice
        const msg = new SpeechSynthesisUtterance();
        msg.text = `Senha. ${currentCall.queuePassword}. Paciente. ${getPatientName(currentCall.patientId)}. Consultório do doutor. ${getDoctorName(currentCall.doctorId)}`;
        msg.lang = 'pt-BR';
        window.speechSynthesis.speak(msg);
      } catch (e) {
          console.log("Audio play failed", e);
      }
    }
  }, [currentCall, lastCalledId]);

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.name || '';
  const getDoctorName = (id: string) => doctors.find(d => d.id === id)?.name || '';

  if (!user) {
      return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-2xl font-bold">Acesso Negado ou Não Autenticado</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex overflow-hidden font-sans selection:bg-primary/30">
      {/* Current Call Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-12 relative">
          <div className="absolute top-8 left-8 flex items-center gap-3">
              <div className="bg-primary text-white p-3 rounded-xl shadow-lg shadow-primary/20">
                  <Volume2 className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Conecta Saúde</h1>
          </div>

          {currentCall ? (
              <div className="text-center w-full max-w-4xl animate-in fade-in zoom-in duration-500">
                  <p className="text-4xl text-slate-400 font-bold tracking-widest uppercase mb-4">Senha</p>
                  <div className="text-[12rem] leading-none font-black text-primary mb-8 tracking-tighter drop-shadow-2xl">
                      {currentCall.queuePassword}
                  </div>
                  
                  <div className="bg-slate-800/50 backdrop-blur-md rounded-3xl p-8 border border-slate-700 shadow-2xl">
                      <p className="text-3xl text-slate-300 font-medium mb-2">Paciente</p>
                      <p className="text-6xl font-bold text-white truncate mb-8">{getPatientName(currentCall.patientId)}</p>
                      
                      <div className="flex items-center justify-center gap-4">
                          <span className="bg-primary/20 text-primary text-2xl px-6 py-2 rounded-full font-bold">Consultório</span>
                          <span className="text-4xl font-bold text-slate-200">Dr(a). {getDoctorName(currentCall.doctorId)}</span>
                      </div>
                  </div>
              </div>
          ) : (
              <div className="text-center">
                  <div className="text-6xl font-black text-slate-700">Aguardando Chamada</div>
              </div>
          )}
      </div>

      {/* History Panel */}
      <div className="w-[480px] bg-slate-950 border-l border-slate-800 p-8 flex flex-col shadow-2xl z-10">
          <h2 className="text-3xl font-black text-white mb-8 tracking-tight flex items-center gap-3">
              Últimas Chamadas
          </h2>
          
          <div className="space-y-4 flex-1">
              {historyCalls.length === 0 ? (
                  <p className="text-slate-600 text-lg font-medium text-center py-10">Nenhum histórico</p>
              ) : (
                  historyCalls.map((appt, idx) => (
                      <div key={appt.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-transform hover:scale-105">
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-3xl font-black text-slate-300">{appt.queuePassword}</span>
                              <span className="text-sm font-medium text-slate-500">{new Date(appt.calledAt!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xl font-bold text-white truncate mb-1">{getPatientName(appt.patientId)}</p>
                          <p className="text-slate-400 font-medium truncate">Dr(a). {getDoctorName(appt.doctorId)}</p>
                      </div>
                  ))
              )}
          </div>
          
          <div className="pt-8 mt-auto border-t border-slate-800">
              <div className="bg-slate-900 p-4 rounded-xl flex items-center justify-center">
                  <p className="text-slate-400 font-medium">Prefeitura Municipal de Olinda</p>
              </div>
          </div>
      </div>
    </div>
  );
};
