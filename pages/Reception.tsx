import React, { useState, useEffect } from 'react';
import { Appointment, Patient, User, HealthUnit, AppointmentStatus } from '../types';
import { api } from '../services/api';
import { Users, MonitorPlay, Clock, CheckCircle2, Ticket } from 'lucide-react';

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
        api.units.getById(user.unitId)
      ]);

      const todaysAppts = appts.filter(a => a.date === today && a.status !== 'CANCELLED');
      setAppointments(todaysAppts.sort((a, b) => a.time.localeCompare(b.time)));
      setPatients(pts);
      setDoctors(docs);
      setUnit(unitData);
    } catch (error) {
      console.error("Erro ao carregar dados da recepção", error);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh queue every 10 seconds
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

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.name || 'Desconhecido';
  const getDoctorName = (id: string) => doctors.find(d => d.id === id)?.name || 'Médico';

  const isSenhaMode = unit?.attendanceType === 'SENHA';

  const waitingQueue = appointments.filter(a => a.checkInTime && a.status !== 'COMPLETED');
  const expectedToday = appointments.filter(a => !a.checkInTime);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Painel da Recepção</h2>
           <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie a fila de espera e o check-in dos pacientes hoje</p>
        </div>
        {isSenhaMode && (
          <button 
            onClick={() => window.open('/display-tv', '_blank')}
            className="flex items-center gap-2 bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors"
          >
            <MonitorPlay className="w-5 h-5" />
            Abrir Painel de TV
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expected Patients */}
        <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
             <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                 <Clock className="w-5 h-5 text-slate-400" />
                 Aguardando Check-in ({expectedToday.length})
             </h3>
          </div>
          <div className="p-5 flex-1 overflow-y-auto max-h-[600px] space-y-3">
             {expectedToday.length === 0 ? (
                 <p className="text-slate-500 text-center py-8">Nenhum paciente aguardando check-in.</p>
             ) : (
                 expectedToday.map(appt => (
                     <div key={appt.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-primary transition-colors">
                         <div className="flex justify-between items-start mb-3">
                             <div>
                                 <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{getPatientName(appt.patientId)}</h4>
                                 <p className="text-sm text-slate-500">Horário agendado: <span className="font-semibold text-slate-700 dark:text-slate-300">{appt.time}</span></p>
                                 <p className="text-sm text-slate-500">Dr(a). {getDoctorName(appt.doctorId)}</p>
                             </div>
                         </div>
                         <div className="flex gap-2">
                             {isSenhaMode ? (
                                 <>
                                    <button 
                                        onClick={() => generatePassword(appt.id, false)}
                                        className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
                                    >
                                        Gerar Senha (Geral)
                                    </button>
                                    <button 
                                        onClick={() => generatePassword(appt.id, true)}
                                        className="flex-1 bg-amber-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                                    >
                                        Gerar Senha (Pref)
                                    </button>
                                 </>
                             ) : (
                                 <button 
                                     onClick={() => generatePassword(appt.id, false)}
                                     className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                 >
                                     <CheckCircle2 className="w-4 h-4" /> Confirmar Chegada
                                 </button>
                             )}
                         </div>
                     </div>
                 ))
             )}
          </div>
        </div>

        {/* Checked-in / Queue */}
        <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
             <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                 <Users className="w-5 h-5 text-primary" />
                 Fila de Espera ({waitingQueue.length})
             </h3>
          </div>
          <div className="p-5 flex-1 overflow-y-auto max-h-[600px] space-y-3">
             {waitingQueue.length === 0 ? (
                 <p className="text-slate-500 text-center py-8">Fila vazia.</p>
             ) : (
                 waitingQueue.sort((a, b) => new Date(a.checkInTime!).getTime() - new Date(b.checkInTime!).getTime()).map(appt => (
                     <div key={appt.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex justify-between items-center">
                         <div>
                             <div className="flex items-center gap-3 mb-1">
                                 {isSenhaMode && appt.queuePassword && (
                                    <span className="bg-primary/10 text-primary font-bold px-3 py-1 rounded-lg flex items-center gap-1">
                                        <Ticket className="w-4 h-4" /> {appt.queuePassword}
                                    </span>
                                 )}
                                 <h4 className="font-bold text-slate-800 dark:text-slate-100">{getPatientName(appt.patientId)}</h4>
                             </div>
                             <p className="text-sm text-slate-500">Aguardando Dr(a). {getDoctorName(appt.doctorId)}</p>
                             <p className="text-xs text-slate-400 mt-1">Check-in: {new Date(appt.checkInTime!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                         </div>
                         <div className="flex flex-col gap-2">
                            {isSenhaMode && (
                                <button 
                                    onClick={() => callToTV(appt.id)}
                                    className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors flex items-center gap-2"
                                >
                                    <MonitorPlay className="w-4 h-4" /> Chamar TV
                                </button>
                            )}
                            <button 
                                onClick={async () => {
                                    await api.appointments.update(appt.id, { status: AppointmentStatus.COMPLETED });
                                    loadData();
                                }}
                                className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                            >
                                Finalizar
                            </button>
                         </div>
                     </div>
                 ))
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
