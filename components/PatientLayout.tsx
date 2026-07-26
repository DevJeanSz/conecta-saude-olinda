import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User } from '../types';
import { Menu, Bell, X, LogOut, Home, Calendar, FileText, MapPin, User as UserIcon, Check } from 'lucide-react';
import logo from '@/src/assets/images/conectasaudeolinda.png';
import { api, apiOrigin } from '../services/api';
import { Notification } from '../types';
import { io } from 'socket.io-client';
interface PatientLayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

export const PatientLayout: React.FC<PatientLayoutProps> = ({ children, user, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user?.id) {
      api.notifications.getForUser()
        .then(notifs => setNotifications(Array.isArray(notifs) ? notifs : []))
        .catch(err => console.error('Failed to fetch notifications:', err));
      
      const socket = io(apiOrigin);
      socket.emit('join', user.id);
      
      socket.on('new_notification', (notif: Notification) => {
        setNotifications(prev => [notif, ...prev]);
      });
      
      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const markAsRead = async (id: string) => {
    await api.notifications.markAsRead(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] text-slate-800 font-sans">
      {/* Mobile-Style Header */}
      <header className="bg-white sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3 max-w-3xl mx-auto">
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:text-primary transition-colors focus:outline-none"
          >
            <Menu className="w-7 h-7" />
          </button>
          
          <img src={logo} alt="Conecta Saúde" className="h-10 object-contain cursor-pointer" onClick={() => navigate('/patient-portal')} />
          
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 -mr-2 text-slate-600 hover:text-primary transition-colors relative focus:outline-none"
            >
              <Bell className="w-6 h-6" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 rounded-full border border-white text-[9px] font-bold text-white flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h4 className="font-bold text-slate-700">Notificações</h4>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">Nenhuma notificação.</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                        <p className="text-sm text-slate-600">{n.message}</p>
                        <div className="mt-2 flex justify-end">
                          <button 
                            onClick={() => markAsRead(n.id)}
                            className="text-xs flex items-center gap-1 text-primary hover:text-blue-700 font-medium"
                          >
                            <Check className="w-3 h-3" /> Marcar como lido
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Colored Bottom Bar */}
        <div className="w-full max-w-3xl mx-auto flex h-[3px]">
          <div className="flex-1 bg-[#0F4C81]"></div>
          <div className="flex-1 bg-[#4CAF50]"></div>
          <div className="flex-1 bg-[#FFC107]"></div>
          <div className="flex-1 bg-[#E53935]"></div>
        </div>
      </header>

      {/* Side Drawer Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[60] flex">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMenuOpen(false)}
          ></div>
          
          {/* Drawer */}
          <div className="relative w-4/5 max-w-xs bg-white h-full flex flex-col shadow-2xl animate-fade-in-right">
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
               <img src={logo} alt="Conecta Saúde" className="h-8" />
               <button onClick={() => setIsMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                 <X className="w-6 h-6" />
               </button>
            </div>
            
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
               <div className="w-12 h-12 bg-blue-100 text-[#0F4C81] rounded-full flex items-center justify-center font-bold text-lg">
                 {user.name.charAt(0)}
               </div>
               <div>
                  <p className="font-bold text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500">Cartão SUS: {user.susNumber || 'Não informado'}</p>
               </div>
            </div>

            <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
               <button onClick={() => handleNavigation('/patient-portal')} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium text-left transition-colors">
                  <Home className="w-5 h-5 text-slate-400" /> Início
               </button>
               <button onClick={() => handleNavigation('/patient-portal/schedule')} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium text-left transition-colors">
                  <Calendar className="w-5 h-5 text-slate-400" /> Agendar Consulta
               </button>
               <button onClick={() => { setIsMenuOpen(false); alert('Suas consultas estão no painel inicial.'); }} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium text-left transition-colors">
                  <FileText className="w-5 h-5 text-slate-400" /> Minhas Consultas
               </button>
               <button onClick={() => { setIsMenuOpen(false); alert('Em breve!'); }} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium text-left transition-colors">
                  <MapPin className="w-5 h-5 text-slate-400" /> Unidades de Saúde
               </button>
               <Link to="/perfil" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium text-left transition-colors">
                  <UserIcon className="w-5 h-5 text-slate-400" /> Meu Perfil
               </Link>
            </nav>

            <div className="p-4 border-t border-slate-100">
               <button onClick={onLogout} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-50 text-red-600 font-bold text-left transition-colors">
                  <LogOut className="w-5 h-5" /> Sair
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-3xl mx-auto flex flex-col px-4 py-6">
        {children}
      </main>
    </div>
  );
};
