import React, { useMemo, useState, useEffect } from 'react';
import { api } from '../services/api';
import { AppointmentStatus, User } from '../types';
import { STATUS_LABELS } from '../constants';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';

export const Reports: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load user
  useEffect(() => {
    const stored = localStorage.getItem('health_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  // Load data by unit
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);

        const [appts, docs] = await Promise.all([
          api.appointments.getByUnit(user.unitId),
          api.users.getDoctorsByUnit(user.unitId)
        ]);

        setAppointments(appts || []);
        setDoctors(docs || []);
      } catch (error) {
        console.error('Erro ao carregar relatórios:', error);
        setAppointments([]);
        setDoctors([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const statusData = useMemo(() => {
    if (appointments.length === 0) return [];

    const counts = appointments.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(counts).map(key => ({
      name: STATUS_LABELS[key as AppointmentStatus] ?? key,
      value: counts[key]
    }));
  }, [appointments]);

  const doctorData = useMemo(() => {
    if (doctors.length === 0) return [];

    return doctors.map(doc => {
      const docAppts = appointments.filter(a => a.doctorId === doc.id);
      return {
        name: doc.name.split(' ')[0],
        total: docAppts.length,
        completed: docAppts.filter(
          a => a.status === AppointmentStatus.COMPLETED
        ).length
      };
    });
  }, [doctors, appointments]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (!user) return null;
  if (loading) return <div className="text-slate-500">Carregando relatórios...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Relatórios Gerenciais</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Distribuição por Status</h3>

          <div className="h-64">
            {statusData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                Sem dados
              </div>
            )}
          </div>
        </div>

        {/* Médicos */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Atendimentos por Médico</h3>

          <div className="h-64">
            {doctorData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={doctorData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#8884d8" />
                  <Bar dataKey="completed" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                Sem dados
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
