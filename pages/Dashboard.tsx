import React, { useEffect, useState } from 'react';
import { User, UserRole, Appointment, AppointmentStatus } from '../types';
import { api } from '../services/api';
import { STATUS_LABELS } from '../constants';
import { Calendar, Users, Building2, Stethoscope, ShieldCheck, Activity, UserPlus, Clock, BookHeart, CheckCircle, AlertCircle } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalProfessionals: 0,
    totalSpecialties: 0,
    totalUnits: 0,
    todayAppointments: 0,
    absenteeism: '0%',
    avgWaitTime: '0 min',
    waitingList: 0,
    completedAppts: 0,
  });

  const [lineData, setLineData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({
    total: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0
  });

  useEffect(() => {
    const loadDashboardData = async () => {
      const units = await api.units.getAll();
      const users = await api.users.getAll();
      const specs = await api.specialties.getAll();
      const patients = await api.patients.getAll();
      const appointments = await api.appointments.getAll();
      const today = new Date().toISOString().split('T')[0];
      const todayAppts = appointments.filter(a => a.date === today);

      // Absenteeism
      const pastAppointments = appointments.filter(a => new Date(a.date) < new Date(today) || (a.date === today && a.status === AppointmentStatus.NO_SHOW));
      const noShows = pastAppointments.filter(a => a.status === AppointmentStatus.NO_SHOW).length;
      const absenteeismValue = pastAppointments.length ? `${Math.round((noShows / pastAppointments.length) * 100)}%` : '0%';

      // Average Wait Time
      let totalWaitMs = 0;
      let waitCount = 0;
      appointments.forEach(a => {
          if (a.checkInTime && a.calledAt) {
               const checkIn = new Date(`2000-01-01T${a.checkInTime}`);
               const called = new Date(`2000-01-01T${a.calledAt}`);
               totalWaitMs += (called.getTime() - checkIn.getTime());
               waitCount++;
          }
      });
      const avgWaitTimeValue = waitCount > 0 ? `${Math.round((totalWaitMs / waitCount) / 60000)} min` : '0 min';

      // Fila de Espera
      const waitingListValue = todayAppts.filter(a => a.checkInTime && !a.calledAt && a.status === AppointmentStatus.SCHEDULED).length;

      setStats({
        totalPatients: patients.length,
        totalProfessionals: users.filter(u => u.role === UserRole.DOCTOR).length,
        totalSpecialties: specs.length,
        totalUnits: units.length,
        todayAppointments: todayAppts.length,
        completedAppts: todayAppts.filter(a => a.status === AppointmentStatus.COMPLETED).length,
        absenteeism: absenteeismValue,
        avgWaitTime: avgWaitTimeValue,
        waitingList: waitingListValue,
      });

      // Charts Data
      const monthPrefix = today.substring(0, 7); // YYYY-MM
      const monthAppointments = appointments.filter(a => a.date.startsWith(monthPrefix));
      
      const appointmentsByDate = monthAppointments.reduce((acc: any, appt) => {
          const day = appt.date.split('-')[2];
          acc[day] = (acc[day] || 0) + 1;
          return acc;
      }, {});
      
      const lineDataRaw = Object.keys(appointmentsByDate).sort().map(day => ({
          name: day,
          value: appointmentsByDate[day]
      }));
      setLineData(lineDataRaw.length > 0 ? lineDataRaw : [{name: '01', value: 0}]);

      const pieCounts: Record<string, number> = {};
      for (const appt of appointments) {
          const doctor = users.find(u => u.id === appt.doctorId);
          if (doctor && doctor.specialtyId) {
              const spec = specs.find(s => s.id === doctor.specialtyId);
              const specName = spec ? spec.name : 'Outras';
              pieCounts[specName] = (pieCounts[specName] || 0) + 1;
          } else {
              pieCounts['Outras'] = (pieCounts['Outras'] || 0) + 1;
          }
      }

      const colors = ['#1267D5', '#2BB24C', '#FFD21E', '#9333EA', '#06B6D4', '#94A3B8'];
      const pieDataRaw = Object.entries(pieCounts).map(([name, value], idx) => ({
          name,
          value: value as number,
          color: colors[idx % colors.length]
      })).sort((a, b) => b.value - a.value);
      setPieData(pieDataRaw);

      setMonthlyStats({
          total: monthAppointments.length,
          completed: monthAppointments.filter(a => a.status === AppointmentStatus.COMPLETED).length,
          cancelled: monthAppointments.filter(a => a.status === AppointmentStatus.CANCELLED).length,
          noShow: monthAppointments.filter(a => a.status === AppointmentStatus.NO_SHOW).length
      });
    };

    loadDashboardData();
  }, [user]);

  const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900 text-${color}-600 dark:text-${color}-400`}>
          <Icon className={`w-6 h-6 text-primary`} />
        </div>
        <span className="text-xl font-black text-slate-800 dark:text-slate-100">{value}</span>
      </div>
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{title}</p>
        {trend && (
          <p className="text-xs font-semibold text-secondary dark:text-emerald-400 mt-1 flex items-center gap-1">
              <span className="text-lg leading-none">↑</span> {trend}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Banner de Boas Vindas */}
      <div className="bg-primary-dark rounded-2xl p-8 text-white relative overflow-hidden shadow-lg">
          <div className="relative z-10 w-2/3">
              <div className="flex items-center gap-3 mb-2">
                 <ShieldCheck className="w-8 h-8 text-secondary" />
                 <h2 className="text-2xl font-bold">Bem-vindo, {user.name.split(' ')[0]}!</h2>
              </div>
              <p className="text-blue-100 mt-2 font-medium">Você tem controle total sobre as unidades de saúde, equipe e especialidades da rede municipal. Utilize os indicadores abaixo para acompanhar e tomar decisões estratégicas.</p>
          </div>
          {/* Decoração de fundo */}
          <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none">
              <Building2 className="w-64 h-64 -mb-10 -mr-10 text-white" />
          </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Consultas do Dia" value={stats.todayAppointments} icon={Calendar} color="primary" />
        <StatCard title="Consultas Realizadas" value={stats.completedAppts} icon={CheckCircle} color="secondary" />
        <StatCard title="Taxa de Absenteísmo" value={stats.absenteeism} icon={AlertCircle} color="red" />
        <StatCard title="Pacientes Ativos" value={stats.totalPatients} icon={Users} color="primary" />
        
        <StatCard title="Tempo Méd. Espera" value={stats.avgWaitTime} icon={Clock} color="orange" />
        <StatCard title="Fila de Espera" value={stats.waitingList} icon={Users} color="blue" />
        <StatCard title="Profissionais Ativos" value={stats.totalProfessionals} icon={Stethoscope} color="primary" />
        <StatCard title="Unidades de Saúde" value={stats.totalUnits} icon={Building2} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico de Linha */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Agendamentos do mês <span className="text-slate-400 dark:text-slate-500 font-normal text-sm">ⓘ</span></h3>
            <div className="flex gap-2">
                <select className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm p-1 rounded font-medium text-slate-600 dark:text-slate-300"><option>Maio/2025</option></select>
                <select className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm p-1 rounded font-medium text-slate-600 dark:text-slate-300"><option>Mensal</option></select>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                <Line type="monotone" dataKey="value" stroke="#1267D5" strokeWidth={3} dot={{r: 4, fill: '#1267D5', strokeWidth: 2, stroke: 'white'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50 dark:border-slate-800">
              <div className="flex flex-col"><span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total no mês</span><span className="text-xl font-black text-slate-800 dark:text-slate-100">{monthlyStats.total}</span></div>
              <div className="flex flex-col items-center"><span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1"><CheckCircle className="w-3 h-3 text-secondary"/> Realizados</span><span className="text-xl font-black text-slate-800 dark:text-slate-100">{monthlyStats.completed}</span></div>
              <div className="flex flex-col items-center"><span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1"><AlertCircle className="w-3 h-3 text-ita-red"/> Cancelados</span><span className="text-xl font-black text-slate-800 dark:text-slate-100">{monthlyStats.cancelled}</span></div>
              <div className="flex flex-col items-end"><span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1"><UserPlus className="w-3 h-3 text-ita-yellow"/> Faltas</span><span className="text-xl font-black text-slate-800 dark:text-slate-100">{monthlyStats.noShow}</span></div>
          </div>
        </div>

        {/* Gráfico de Pizza */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col transition-colors">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Distribuição por especialidade <span className="text-slate-400 dark:text-slate-500 font-normal text-sm">ⓘ</span></h3>
          <div className="h-48 relative flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Total</span>
                <span className="text-lg font-black text-slate-800 dark:text-slate-100">{stats.totalSpecialties > 0 ? Object.values(pieData).reduce((sum, item) => sum + item.value, 0) : 0}</span>
            </div>
          </div>
          <div className="mt-auto space-y-2">
              {pieData.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: item.color}}></div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{item.name}</span>
                      </div>
                      <div className="flex gap-4 w-24 justify-end">
                          <span className="font-bold text-slate-800 dark:text-slate-100">{item.value}</span>
                          <span className="text-slate-400 dark:text-slate-500 w-8 text-right">{Object.values(pieData).reduce((sum, i) => sum + i.value, 0) > 0 ? Math.round((item.value/Object.values(pieData).reduce((sum, i) => sum + i.value, 0))*100) : 0}%</span>
                      </div>
                  </div>
              ))}
          </div>
          <button className="text-primary font-bold text-sm text-center mt-4 w-full hover:underline">Ver todas as especialidades →</button>
        </div>

      </div>

      {/* Atividades Recentes removidas conforme solicitado para uso de dados reais em breve */}
      
      {/* Rodapé da imagem */}
      <div className="pt-8 text-center flex items-center justify-center gap-2 text-slate-400 text-xs font-medium border-t border-slate-200 mt-8">
          Conecta Saúde Olinda - Sistema de Gestão em Saúde <span className="text-primary px-2">|</span> <BookHeart className="w-4 h-4 text-primary" /> Tecnologia conectando pessoas e cuidando de vidas!
      </div>
    </div>
  );
};
