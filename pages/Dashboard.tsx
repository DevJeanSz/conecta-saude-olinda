import React, { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  ShieldCheck,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { User, UserRole, AppointmentStatus } from '../types';
import { api } from '../services/api';

interface DashboardProps {
  user: User;
}

type MetricTone = 'blue' | 'green' | 'red' | 'violet' | 'yellow' | 'orange' | 'cyan' | 'navy';

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
  const [lineData, setLineData] = useState<Array<{ name: string; value: number }>>([]);
  const [monthlyStats, setMonthlyStats] = useState({
    total: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  });
  const [unitHighlights, setUnitHighlights] = useState<Array<{ name: string; count: number; progress: number }>>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      const units = await api.units.getAll();
      const users = await api.users.getAll();
      const specs = await api.specialties.getAll();
      const patients = await api.patients.getAll();
      const appointments = await api.appointments.getAll();
      const today = new Date().toISOString().split('T')[0];
      const todayAppts = appointments.filter(appointment => appointment.date === today);

      const pastAppointments = appointments.filter(appointment => new Date(appointment.date) < new Date(today) || (appointment.date === today && appointment.status === AppointmentStatus.NO_SHOW));
      const noShows = pastAppointments.filter(appointment => appointment.status === AppointmentStatus.NO_SHOW).length;
      const absenteeismValue = pastAppointments.length ? `${Math.round((noShows / pastAppointments.length) * 100)}%` : '0%';

      let totalWaitMs = 0;
      let waitCount = 0;
      appointments.forEach(appointment => {
        if (appointment.checkInTime && appointment.calledAt) {
          const checkIn = new Date(`2000-01-01T${appointment.checkInTime}`);
          const called = new Date(`2000-01-01T${appointment.calledAt}`);
          totalWaitMs += called.getTime() - checkIn.getTime();
          waitCount++;
        }
      });
      const avgWaitTimeValue = waitCount > 0 ? `${Math.round((totalWaitMs / waitCount) / 60000)} min` : '0 min';
      const waitingListValue = todayAppts.filter(appointment => appointment.checkInTime && !appointment.calledAt && appointment.status === AppointmentStatus.SCHEDULED).length;

      setStats({
        totalPatients: patients.length,
        totalProfessionals: users.filter(currentUser => currentUser.role === UserRole.DOCTOR).length,
        totalSpecialties: specs.length,
        totalUnits: units.length,
        todayAppointments: todayAppts.length,
        completedAppts: todayAppts.filter(appointment => appointment.status === AppointmentStatus.COMPLETED).length,
        absenteeism: absenteeismValue,
        avgWaitTime: avgWaitTimeValue,
        waitingList: waitingListValue,
      });

      const monthPrefix = today.substring(0, 7);
      const monthAppointments = appointments.filter(appointment => appointment.date.startsWith(monthPrefix));
      const appointmentsByDate = monthAppointments.reduce<Record<string, number>>((acc, appointment) => {
        const day = appointment.date.split('-')[2];
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {});

      const lineDataRaw = Object.keys(appointmentsByDate).sort().map(day => ({
        name: day,
        value: appointmentsByDate[day],
      }));
      setLineData(lineDataRaw.length > 0 ? lineDataRaw : [{ name: '01', value: 0 }]);

      const maxUnitCount = Math.max(1, ...units.map(unit => todayAppts.filter(appointment => appointment.unitId === unit.id).length));
      setUnitHighlights(
        units.slice(0, 4).map(unit => {
          const count = todayAppts.filter(appointment => appointment.unitId === unit.id).length;
          return {
            name: unit.name,
            count,
            progress: Math.max(8, Math.round((count / maxUnitCount) * 100)),
          };
        }),
      );

      setMonthlyStats({
        total: monthAppointments.length,
        completed: monthAppointments.filter(appointment => appointment.status === AppointmentStatus.COMPLETED).length,
        cancelled: monthAppointments.filter(appointment => appointment.status === AppointmentStatus.CANCELLED).length,
        noShow: monthAppointments.filter(appointment => appointment.status === AppointmentStatus.NO_SHOW).length,
      });
    };

    loadDashboardData();
  }, [user]);

  const metrics = useMemo<Array<{ label: string; value: string | number; meta: string; icon: LucideIcon; tone: MetricTone; trend: 'up' | 'down' }>>(() => [
    { label: 'Consultas do Dia', value: stats.todayAppointments, meta: 'Agenda atualizada', icon: Calendar, tone: 'blue', trend: 'up' },
    { label: 'Consultas Realizadas', value: stats.completedAppts, meta: 'Concluídas hoje', icon: CheckCircle2, tone: 'green', trend: 'up' },
    { label: 'Taxa de Absenteísmo', value: stats.absenteeism, meta: 'Acompanhar faltas', icon: AlertCircle, tone: 'red', trend: 'down' },
    { label: 'Pacientes Ativos', value: stats.totalPatients, meta: 'Cadastros da rede', icon: Users, tone: 'violet', trend: 'up' },
    { label: 'Tempo Médio de Espera', value: stats.avgWaitTime, meta: 'Meta: até 20 min', icon: Clock3, tone: 'yellow', trend: 'up' },
    { label: 'Fila de Espera', value: stats.waitingList, meta: 'Em atendimento', icon: ClipboardCheck, tone: 'orange', trend: 'up' },
    { label: 'Profissionais Ativos', value: stats.totalProfessionals, meta: 'Equipe médica', icon: Stethoscope, tone: 'cyan', trend: 'up' },
    { label: 'Unidades de Saúde', value: stats.totalUnits, meta: 'Rede municipal', icon: Building2, tone: 'navy', trend: 'up' },
  ], [stats]);

  const maxChartValue = Math.max(1, ...lineData.map(item => item.value));

  return (
    <div className="dashboard-content">
      <section className="dashboard-intro">
        <div>
          <span>Visão da rede</span>
          <h2>Bom dia, {user.name.split(' ')[0]}!</h2>
          <p>
            Acompanhe atendimentos, filas, unidades, profissionais e
            indicadores da rede municipal de Olinda.
          </p>
        </div>
        <div className="system-status">
          <span />
          <div>
            <strong>Sistema operacional</strong>
            <small>Todas as unidades sincronizadas</small>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        {metrics.map(({ label, value, meta, icon: Icon, tone, trend }) => (
          <article className="metric-card" key={label}>
            <span className={`metric-icon ${tone}`}>
              <Icon size={21} />
            </span>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
              <span className={trend}>
                {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {meta}
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-lower-grid">
        <article className="chart-card">
          <div className="card-header">
            <div>
              <h3>Atendimentos do mês</h3>
              <p>Consultas agendadas e realizadas</p>
            </div>
            <button type="button">
              Mês atual <ChevronDown size={16} />
            </button>
          </div>
          <div className="chart-legend">
            <span className="legend-blue">Agendadas</span>
            <span className="legend-green">Realizadas</span>
          </div>
          <div className="bar-chart" aria-label="Gráfico de atendimentos">
            {lineData.slice(-7).map((item, index) => {
              const height = Math.max(8, Math.round((item.value / maxChartValue) * 100));
              return (
                <div className="bar-group" key={`${item.name}-${index}`}>
                  <div>
                    <i style={{ height: `${height}%` }} />
                    <i style={{ height: `${Math.max(5, height - 13)}%` }} />
                  </div>
                  <span>{item.name}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="units-card">
          <div className="card-header">
            <div>
              <h3>Unidades em destaque</h3>
              <p>Volume de atendimentos hoje</p>
            </div>
          </div>
          {(unitHighlights.length ? unitHighlights : [{ name: 'Rede municipal', count: 0, progress: 8 }]).map(unit => (
            <div className="unit-progress" key={unit.name}>
              <div>
                <strong>{unit.name}</strong>
                <small>{unit.count} atendimentos</small>
              </div>
              <span>
                <i style={{ width: `${unit.progress}%` }} />
              </span>
            </div>
          ))}
        </article>
      </section>

      <section className="admin-data-card dashboard-summary-card">
        <div className="card-header">
          <div>
            <h3>Resumo mensal</h3>
            <p>Produção consolidada do mês atual.</p>
          </div>
          <ShieldCheck size={24} />
        </div>
        <div className="dashboard-summary-grid">
          <strong>{monthlyStats.total}<span>Total</span></strong>
          <strong>{monthlyStats.completed}<span>Realizadas</span></strong>
          <strong>{monthlyStats.cancelled}<span>Canceladas</span></strong>
          <strong>{monthlyStats.noShow}<span>Faltas</span></strong>
        </div>
      </section>
    </div>
  );
};
