import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, UserRole, Notification } from '../types';
import { api, apiOrigin } from '../services/api';
import { io } from 'socket.io-client';
import { LayoutDashboard, Calendar, Users, FileText, LogOut, Bell, UserPlus, MapPin, Building2, BookHeart, ListPlus, ChevronDown, Sun, Moon } from 'lucide-react';
import logo from '@/src/assets/images/conectasaudeolinda.png';
import { useTheme } from '../contexts/ThemeContext';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unitName, setUnitName] = useState('Carregando...');
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Get Unit Info
    const loadUnit = async () => {
      const unit = await api.units.getById(user.unitId);
      if (unit) {
        setUnitName(unit.name);
      } else {
        setUnitName('Unidade Desconhecida');
      }
    };
    loadUnit();

    // Get initial notifications and setup WebSocket
    const checkNotifs = async () => {
      try {
        const notifs = await api.notifications.getForUser();
        setNotifications(Array.isArray(notifs) ? notifs : []);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };
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
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const menuItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.DOCTOR, UserRole.SOCIAL_WORKER] },
    { label: 'Início', path: '/', icon: BookHeart, roles: [UserRole.PATIENT] },
    { label: 'Agendamento de Consulta', path: '/patient-schedule', icon: Calendar, roles: [UserRole.PATIENT] },
    { label: 'Unidades', path: '/admin/units', icon: Building2, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR] },
    { label: 'Equipe', path: '/admin/users', icon: UserPlus, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR] },
    { label: 'Especialidades', path: '/admin/specialties', icon: ListPlus, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR] },
    { label: 'Pacientes', path: '/admin/patients', icon: Users, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.SOCIAL_WORKER] },
    { label: 'Agendamentos', path: '/admin/schedule', icon: Calendar, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.DOCTOR] },
    { label: 'Assistência Social', path: '/admin/social-assistance', icon: Users, roles: [UserRole.ADMIN, UserRole.SOCIAL_WORKER] }, // Added for Social Worker
    { label: 'Recepção e Senhas', path: '/admin/reception', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT] },
    { label: 'Relatórios', path: '/admin/reports', icon: FileText, roles: [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR] },
  ];

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen bg-ita-background text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm">
        <div className="p-6 border-b border-slate-100 flex flex-col items-center">
          <img src={logo} alt="Conecta Saúde Olinda" className="w-40 h-auto" />
        </div>

        {/* User Info (For Patient or Admin depending on role) */}
        {user.role === UserRole.PATIENT ? null : (
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-700">
              <MapPin className="w-4 h-4 text-ita-red" />
              <span className="text-xs font-bold uppercase tracking-wide truncate" title={unitName}>{unitName}</span>
            </div>
          </div>
        )}

        <div className="p-4 flex flex-col gap-1 flex-1 overflow-y-auto">
          {menuItems.filter(item => item.roles.includes(user.role)).map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-primary'
              }`}
            >
              <item.icon className={`w-5 h-5 ${location.pathname === item.path ? 'text-white' : 'text-slate-400'}`} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Ajuda / Suporte na Sidebar (Mockup) */}
        <div className="p-6 m-4 bg-ita-background rounded-xl flex flex-col gap-2">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">🎧</div>
                Precisa de ajuda?
            </span>
            <span className="text-xs text-slate-500">Acesse o suporte técnico ou consulte o manual do sistema.</span>
            <button className="text-primary text-xs font-bold text-left mt-1 hover:underline">Abrir suporte →</button>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden dark:bg-slate-900 bg-background">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end px-8 gap-4 shadow-sm z-10">
           
           {/* Theme Toggle */}
           <button
             onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
             className="p-2 text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-all"
             title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
           >
             {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
           </button>

           {/* Notifications */}
           <div className="relative">
              <button 
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-full transition-all relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-ita-red rounded-full border-2 border-white"></span>
                )}
              </button>

              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden">
                   <div className="p-3 bg-slate-50 border-b border-slate-100 font-semibold text-slate-700 text-sm">Notificações</div>
                   <div className="max-h-64 overflow-y-auto">
                     {notifications.length === 0 ? (
                       <div className="p-4 text-center text-slate-400 text-sm">Nenhuma notificação nova.</div>
                     ) : (
                       notifications.map(n => (
                         <div 
                           key={n.id} 
                           onClick={() => handleRead(n.id)}
                           className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer ${!n.read ? 'bg-blue-50/50' : ''}`}
                         >
                            <p className={`text-sm ${!n.read ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{n.message}</p>
                            <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleTimeString()} - {new Date(n.createdAt).toLocaleDateString()}</span>
                         </div>
                       ))
                     )}
                   </div>
                </div>
              )}
           </div>

           {/* User Profile */}
           <div className="relative border-l border-slate-200 pl-6 flex items-center gap-3 cursor-pointer" onClick={() => setShowProfileMenu(!showProfileMenu)}>
              <div className="w-10 h-10 rounded-full bg-primary-dark flex items-center justify-center text-white font-bold text-sm">
                 {getInitials(user.name)}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800">{user.name}</span>
                <span className="text-xs text-slate-500">
                    {user.role === UserRole.PATIENT ? `Cartão SUS: ${user.susNumber || 'Não informado'}` : (user.role === UserRole.ADMIN ? 'Administrador' : 'Profissional de Saúde')}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 ml-2" />

              {showProfileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 overflow-hidden z-50">
                      <button 
                        onClick={() => { setShowProfileMenu(false); navigate('/perfil'); }}
                        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                      >
                          <UserPlus className="w-4 h-4" />
                          Meu Perfil
                      </button>
                      <button 
                        onClick={onLogout}
                        className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium flex items-center gap-2"
                      >
                          <LogOut className="w-4 h-4" />
                          Sair do Sistema
                      </button>
                  </div>
              )}
           </div>
        </header>

        <div className="flex-1 overflow-auto bg-ita-background p-8">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
