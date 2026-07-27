import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Bell,
  Building2,
  Calendar,
  ChevronDown,
  FileText,
  LayoutDashboard,
  ListPlus,
  LogOut,
  MapPin,
  MonitorPlay,
  Moon,
  Search,
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import { BrandLockup } from './BrandLockup';
import { useTheme } from '../contexts/ThemeContext';
import { api, apiOrigin } from '../services/api';
import { AppointmentStatus, Notification, User, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const menuItems = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.DOCTOR, UserRole.SOCIAL_WORKER] },
  { label: 'Unidades', path: '/admin/units', icon: Building2, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR] },
  { label: 'Equipe', path: '/admin/users', icon: UserPlus, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR] },
  { label: 'Especialidades', path: '/admin/specialties', icon: ListPlus, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR] },
  { label: 'Exames', path: '/admin/exam-types', icon: Search, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR] },
  { label: 'Pacientes', path: '/admin/patients', icon: Users, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.SOCIAL_WORKER] },
  { label: 'Agendamentos', path: '/admin/schedule', icon: Calendar, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.DOCTOR] },
  { label: 'Recepção e Senhas', path: '/admin/reception', icon: MonitorPlay, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT] },
  { label: 'Relatórios', path: '/admin/reports', icon: FileText, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR] },
];

const pageTitles: Record<string, string> = {
  '/admin': 'Painel gestor',
  '/admin/units': 'Unidades de Saúde',
  '/admin/users': 'Equipe e Profissionais',
  '/admin/specialties': 'Especialidades',
  '/admin/exam-types': 'Tipos de Exame',
  '/admin/patients': 'Pacientes',
  '/admin/schedule': 'Agendamentos',
  '/admin/reception': 'Painel da Recepção',
  '/admin/reports': 'Relatórios',
  '/perfil': 'Meu perfil',
};

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [todayAppointmentCount, setTodayAppointmentCount] = useState(0);
  const [unitName, setUnitName] = useState('Carregando...');
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const loadUnit = async () => {
      if (!user.unitId) {
        setUnitName('Rede municipal');
        return;
      }
      const unit = await api.units.getById(user.unitId);
      setUnitName(unit?.name || 'Rede municipal');
    };

    const checkNotifs = async () => {
      try {
        const notifs = await api.notifications.getForUser();
        setNotifications(Array.isArray(notifs) ? notifs : []);
      } catch {
        setNotifications([]);
      }
    };

    const checkTodayAppointments = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const appts = user.unitId
          ? await api.appointments.getByUnit(user.unitId)
          : await api.appointments.getAll();
        const activeToday = appts.filter((appointment) => {
          const isActive = appointment.status !== AppointmentStatus.CANCELLED;
          const belongsToDoctor = user.role !== UserRole.DOCTOR || appointment.doctorId === user.id;
          return appointment.date === today && isActive && belongsToDoctor;
        });
        setTodayAppointmentCount(activeToday.length);
      } catch {
        setTodayAppointmentCount(0);
      }
    };

    loadUnit();
    checkNotifs();
    checkTodayAppointments();

    const socket = io(apiOrigin);
    socket.emit('join', user.id);
    socket.on('new_notification', (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user.id, user.unitId]);

  const handleRead = (id: string) => {
    api.notifications.markAsRead(id);
    setNotifications(prev => prev.map(notification => notification.id === id ? { ...notification, read: true } : notification));
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const unreadCount = notifications.filter(notification => !notification.read).length;
  const title = pageTitles[location.pathname] || 'Gestão municipal';
  const roleLabel = user.role === UserRole.ADMIN ? 'Gestor municipal' : 'Profissional de saúde';

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <BrandLockup />
        </div>

        <div className="admin-unit-chip">
          <MapPin size={16} />
          <span title={unitName}>{unitName}</span>
        </div>

        <nav aria-label="Administração">
          <span>Visão geral</span>
          {menuItems.filter(item => item.roles.includes(user.role)).map((item, index) => (
            <button
              className={location.pathname === item.path ? 'active' : ''}
              key={item.path}
              onClick={() => navigate(item.path)}
              type="button"
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.path === '/admin/schedule' && todayAppointmentCount > 0 && (
                <small>{todayAppointmentCount}</small>
              )}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div>
            <span>{getInitials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{roleLabel}</small>
            </div>
          </div>
          <button aria-label="Sair" onClick={onLogout} type="button">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <span>{unitName}</span>
            <h1>{title}</h1>
          </div>
          <div className="admin-top-actions">
            <label className="admin-search">
              <Search size={18} />
              <input aria-label="Buscar" placeholder="Buscar no sistema..." />
            </label>

            <button
              aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              className="icon-button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              type="button"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="admin-popover-anchor">
              <button
                aria-label="Notificações"
                className="icon-button"
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                type="button"
              >
                <Bell size={20} />
                {unreadCount > 0 && <span />}
              </button>

              {showNotifMenu && (
                <div className="admin-dropdown notification-dropdown">
                  <div className="dropdown-title">Notificações</div>
                  <div className="dropdown-scroll">
                    {notifications.length === 0 ? (
                      <div className="dropdown-empty">Nenhuma notificação nova.</div>
                    ) : (
                      notifications.map(notification => (
                        <button
                          className={!notification.read ? 'unread' : ''}
                          key={notification.id}
                          onClick={() => handleRead(notification.id)}
                          type="button"
                        >
                          <strong>{notification.message}</strong>
                          <small>{new Date(notification.createdAt).toLocaleString('pt-BR')}</small>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="admin-popover-anchor">
              <button className="admin-profile-button" onClick={() => setShowProfileMenu(!showProfileMenu)} type="button">
                <span className="admin-avatar">{getInitials(user.name)}</span>
                <ChevronDown size={16} />
              </button>

              {showProfileMenu && (
                <div className="admin-dropdown profile-dropdown">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/perfil');
                    }}
                    type="button"
                  >
                    Meu perfil
                  </button>
                  <button className="danger" onClick={onLogout} type="button">
                    Sair do sistema
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="admin-content-shell">
          {children}
        </div>
      </div>
    </main>
  );
};
