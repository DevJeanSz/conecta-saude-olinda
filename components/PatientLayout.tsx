import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Calendar,
  Check,
  ClipboardList,
  FileText,
  FlaskConical,
  Home,
  Info,
  LogOut,
  MapPin,
  Menu,
  User as UserIcon,
  X,
} from 'lucide-react';
import { BrandLockup } from './BrandLockup';
import { api, apiOrigin } from '../services/api';
import { Notification, User } from '../types';
import { io } from 'socket.io-client';

interface PatientLayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const navItems = [
  { label: 'Inicio', path: '/patient-portal', icon: Home },
  { label: 'Agendar', path: '/patient-portal/schedule', icon: Calendar },
  { label: 'Consultas', path: '/patient-portal/appointments', icon: FileText },
  { label: 'Unidades', path: '/patient-portal/units', icon: MapPin },
  { label: 'Perfil', path: '/perfil', icon: UserIcon },
];

const drawerItems = [
  ...navItems,
  { label: 'Atendimentos', path: '/patient-portal/care-history', icon: ClipboardList },
  { label: 'Agendar exame', path: '/patient-portal/exams/schedule', icon: FlaskConical },
  { label: 'Meus exames', path: '/patient-portal/exams', icon: ClipboardList },
  { label: 'Lembretes', path: '/patient-portal/reminders', icon: Bell },
  { label: 'Informacoes', path: '/patient-portal/information', icon: Info },
];

export const PatientLayout: React.FC<PatientLayoutProps> = ({ children, user, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) return;

    api.notifications.getForUser()
      .then(notifs => setNotifications(Array.isArray(notifs) ? notifs : []))
      .catch(() => setNotifications([]));

    const socket = io(apiOrigin);
    socket.emit('join', user.id);
    socket.on('new_notification', (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user.id]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const markAsRead = async (id: string) => {
    await api.notifications.markAsRead(id);
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7FBFF] font-sans text-[#10223F]">
      <header className="sticky top-0 z-50 border-b border-[#D9E6F5] bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[#5F708A] transition-colors hover:bg-[#F1F7FD] hover:text-[#0B60C9] focus:outline-none focus:ring-4 focus:ring-[#0B60C9]/20"
            type="button"
            aria-label="Abrir menu"
          >
            <Menu className="h-7 w-7" />
          </button>

          <button type="button" onClick={() => navigate('/patient-portal')} className="rounded-xl focus:outline-none focus:ring-4 focus:ring-[#0B60C9]/20">
            <BrandLockup compact />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl text-[#5F708A] transition-colors hover:bg-[#F1F7FD] hover:text-[#0B60C9] focus:outline-none focus:ring-4 focus:ring-[#0B60C9]/20"
              type="button"
              aria-label="Abrir notificacoes"
            >
              <Bell className="h-6 w-6" />
              {notifications.length > 0 && (
                <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D51F2A] px-1 text-[9px] font-black text-white">
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-[#D9E6F5] bg-white shadow-[0_24px_64px_rgba(6,41,111,0.16)]">
                <div className="flex items-center justify-between border-b border-[#D9E6F5] bg-[#F7FBFF] p-3">
                  <h2 className="font-black text-[#10223F]">Notificacoes</h2>
                  <button onClick={() => setShowNotifications(false)} className="text-[#8A99AD] hover:text-[#10223F]" type="button" aria-label="Fechar notificacoes">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-5 text-center text-sm font-semibold text-[#5F708A]">Nenhuma notificacao.</div>
                  ) : (
                    notifications.map(notification => (
                      <div key={notification.id} className="border-b border-[#F1F7FD] p-3">
                        <p className="text-sm font-semibold text-[#5F708A]">{notification.message}</p>
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-black text-[#0B60C9]"
                          type="button"
                        >
                          <Check className="h-3 w-3" />
                          Marcar como lida
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto flex h-1 max-w-3xl">
          <div className="flex-1 bg-[#06296F]" />
          <div className="flex-1 bg-[#048C47]" />
          <div className="flex-1 bg-[#FFCF22]" />
          <div className="flex-1 bg-[#D51F2A]" />
        </div>
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <button className="fixed inset-0 bg-[#06142D]/60" onClick={() => setIsMenuOpen(false)} type="button" aria-label="Fechar menu" />

          <aside className="relative flex h-full w-4/5 max-w-xs flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D9E6F5] p-4">
              <BrandLockup compact />
              <button onClick={() => setIsMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-[#8A99AD] hover:bg-[#F1F7FD]" type="button" aria-label="Fechar menu">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex items-center gap-3 border-b border-[#D9E6F5] bg-[#F7FBFF] p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DFF0FF] text-lg font-black text-[#0B60C9]">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-black text-[#10223F]">{user.name}</p>
                <p className="text-xs font-semibold text-[#5F708A]">Cartao SUS: {user.susNumber || 'Nao informado'}</p>
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              {drawerItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-black transition-colors ${
                    isActive(item.path) ? 'bg-[#0B60C9] text-white' : 'text-[#5F708A] hover:bg-[#F1F7FD] hover:text-[#0B60C9]'
                  }`}
                  type="button"
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="border-t border-[#D9E6F5] p-4">
              <button onClick={onLogout} className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-black text-[#D51F2A] hover:bg-[#FFE6E8]" type="button">
                <LogOut className="h-5 w-5" />
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D9E6F5] bg-white sm:hidden">
        <div className="flex h-16">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-black ${
                isActive(item.path) ? 'text-[#0B60C9]' : 'text-[#8A99AD]'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
};
