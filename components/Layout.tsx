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
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import { BrandLockup } from './BrandLockup';
import { useTheme } from '../contexts/ThemeContext';
import { api, apiOrigin } from '../services/api';
import { Notification, User, UserRole } from '../types';

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
  { label: 'Pacientes', path: '/admin/patients', icon: Users, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.SOCIAL_WORKER] },
  { label: 'Agendamentos', path: '/admin/schedule', icon: Calendar, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.DOCTOR] },
  { label: 'Recepcao e Senhas', path: '/admin/reception', icon: MonitorPlay, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT] },
  { label: 'Relatorios', path: '/admin/reports', icon: FileText, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR] },
];

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
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

    loadUnit();
    checkNotifs();

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

  return (
    <div className="flex h-screen bg-[#F7FBFF] text-[#10223F]">
      <aside className="z-20 flex w-64 shrink-0 flex-col border-r border-[#D9E6F5] bg-white shadow-sm">
        <div className="flex flex-col items-center border-b border-[#D9E6F5] p-6">
          <BrandLockup compact />
        </div>

        <div className="border-b border-[#D9E6F5] bg-[#F7FBFF] px-6 py-4">
          <div className="flex items-center gap-2 text-[#5F708A]">
            <MapPin className="h-4 w-4 text-[#D51F2A]" />
            <span className="truncate text-xs font-black uppercase" title={unitName}>{unitName}</span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          {menuItems.filter(item => item.roles.includes(user.role)).map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-black transition-colors ${
                location.pathname === item.path
                  ? 'bg-[#0B60C9] text-white shadow-[0_8px_20px_rgba(6,41,111,0.12)]'
                  : 'text-[#5F708A] hover:bg-[#F1F7FD] hover:text-[#0B60C9]'
              }`}
              type="button"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="m-4 rounded-2xl bg-[#EAF6FF] p-5">
          <p className="text-sm font-black text-[#10223F]">Precisa de ajuda?</p>
          <p className="mt-1 text-xs font-semibold text-[#5F708A]">Acesse suporte tecnico do Conecta Saude Olinda.</p>
          <a href="mailto:conectasaude@olinda.pe.gov.br" className="mt-3 inline-flex text-xs font-black text-[#0B60C9] hover:underline">
            Abrir suporte
          </a>
        </div>
      </aside>

      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-[#F7FBFF] dark:bg-slate-900">
        <header className="z-10 flex h-16 items-center justify-end gap-4 border-b border-[#D9E6F5] bg-white px-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#5F708A] transition-colors hover:bg-[#F1F7FD] hover:text-[#0B60C9] dark:hover:bg-slate-800"
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            type="button"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#5F708A] transition-colors hover:bg-[#F1F7FD] hover:text-[#0B60C9]"
              type="button"
              aria-label="Abrir notificacoes"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#D51F2A]" />}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[#D9E6F5] bg-white shadow-[0_24px_64px_rgba(6,41,111,0.16)]">
                <div className="border-b border-[#D9E6F5] bg-[#F7FBFF] p-3 text-sm font-black text-[#10223F]">Notificacoes</div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm font-semibold text-[#5F708A]">Nenhuma notificacao nova.</div>
                  ) : (
                    notifications.map(notification => (
                      <button
                        key={notification.id}
                        onClick={() => handleRead(notification.id)}
                        className={`block w-full border-b border-[#F1F7FD] p-3 text-left hover:bg-[#F7FBFF] ${!notification.read ? 'bg-[#DFF0FF]/50' : ''}`}
                        type="button"
                      >
                        <p className={`text-sm ${!notification.read ? 'font-black text-[#10223F]' : 'font-semibold text-[#5F708A]'}`}>{notification.message}</p>
                        <span className="text-[10px] font-bold text-[#8A99AD]">{new Date(notification.createdAt).toLocaleString('pt-BR')}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex cursor-pointer items-center gap-3 border-l border-[#D9E6F5] pl-6" onClick={() => setShowProfileMenu(!showProfileMenu)}>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#06296F] text-sm font-black text-white">
              {getInitials(user.name)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-[#10223F] dark:text-slate-100">{user.name}</span>
              <span className="text-xs font-semibold text-[#5F708A]">{user.role === UserRole.ADMIN ? 'Gestor' : 'Profissional de saude'}</span>
            </div>
            <ChevronDown className="ml-1 h-4 w-4 text-[#8A99AD]" />

            {showProfileMenu && (
              <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-[#D9E6F5] bg-white shadow-[0_16px_36px_rgba(6,41,111,0.12)]">
                <button
                  onClick={() => { setShowProfileMenu(false); navigate('/perfil'); }}
                  className="flex w-full items-center gap-2 border-b border-[#F1F7FD] px-4 py-3 text-left text-sm font-black text-[#10223F] hover:bg-[#F7FBFF]"
                  type="button"
                >
                  <UserPlus className="h-4 w-4" />
                  Meu Perfil
                </button>
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-black text-[#D51F2A] hover:bg-[#FFE6E8]"
                  type="button"
                >
                  <LogOut className="h-4 w-4" />
                  Sair do Sistema
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-[1400px]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
