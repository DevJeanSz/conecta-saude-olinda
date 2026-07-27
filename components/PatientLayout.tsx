import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  ArrowLeft,
  Bell,
  Calendar,
  Check,
  ChevronDown,
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
import { PernambucoStripe } from './VisualPrimitives';
import { api, apiOrigin } from '../services/api';
import { Notification, User } from '../types';

interface PatientLayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const navItems = [
  { label: 'Início', path: '/patient-portal', icon: Home },
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
  { label: 'Informações', path: '/patient-portal/information', icon: Info },
];

export const PatientLayout: React.FC<PatientLayoutProps> = ({ children, user, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
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
  const initials = user.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const showBackButton = location.pathname !== '/patient-portal';

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/patient-portal');
  };

  return (
    <main className="patient-page">
      <PernambucoStripe />
      <header className="patient-header">
        <button onClick={() => setIsMenuOpen(true)} type="button" aria-label="Abrir menu">
          <Menu size={22} />
        </button>
        <button type="button" onClick={() => navigate('/patient-portal')}>
          <BrandLockup compact />
        </button>
        <div className="patient-actions">
          <div className="admin-popover-anchor">
            <button aria-label="Notificações" className="icon-button" onClick={() => setShowNotifications(!showNotifications)} type="button">
              <Bell size={20} />
              {notifications.length > 0 && <span />}
            </button>

            {showNotifications && (
              <div className="admin-dropdown notification-dropdown patient-notification-dropdown">
                <div className="dropdown-title">Notificações</div>
                <div className="dropdown-scroll">
                  {notifications.length === 0 ? (
                    <div className="dropdown-empty">Nenhuma notificação.</div>
                  ) : (
                    notifications.map(notification => (
                      <button key={notification.id} onClick={() => markAsRead(notification.id)} type="button">
                        <strong>{notification.message}</strong>
                        <small>Marcar como lida</small>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="admin-popover-anchor">
            <button className="profile-chip" type="button" onClick={() => setShowProfileDropdown(!showProfileDropdown)}>
              <span>{initials || user.name.charAt(0)}</span>
              <span>
                <strong>{user.name}</strong>
                <small>Paciente</small>
              </span>
              <ChevronDown size={16} />
            </button>
            {showProfileDropdown && (
              <div className="admin-dropdown profile-dropdown">
                <button
                  onClick={() => {
                    setShowProfileDropdown(false);
                    navigate('/perfil');
                  }}
                  type="button"
                >
                  Meu perfil
                </button>
                <button className="danger" onClick={onLogout} type="button">
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <div className="mobile-menu-panel">
          <button onClick={() => handleNavigation('/patient-portal')} type="button">
            Início
          </button>
          {drawerItems.map(item => (
            <button key={item.path} onClick={() => handleNavigation(item.path)} type="button">
              {item.label}
            </button>
          ))}
          <button onClick={onLogout} type="button">
            Sair
          </button>
          <button onClick={() => setIsMenuOpen(false)} type="button" aria-label="Fechar menu">
            <X size={18} /> Fechar
          </button>
        </div>
      )}

      <div className="patient-shell">
        {showBackButton && (
          <button className="patient-back-button" onClick={handleBack} type="button">
            <ArrowLeft size={18} />
            Voltar
          </button>
        )}
        {children}
      </div>

      <nav className="patient-bottom-nav" aria-label="Navegação do paciente">
        {navItems.map(item => (
          <Link className={isActive(item.path) ? 'active' : ''} key={item.path} to={item.path}>
            <item.icon size={20} /> <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
};
