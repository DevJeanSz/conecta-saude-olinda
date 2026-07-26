import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { CalendarCheck, CalendarDays, Stethoscope, Building2, FlaskConical, ClipboardList, BellRing, Info, ChevronRight, User as UserIcon } from 'lucide-react';

interface PatientDashboardProps {
  user: User;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ user }) => {
  const navigate = useNavigate();

  const menuOptions = [
    {
      title: 'Agendamento de Consulta',
      description: 'Agende sua consulta de forma rápida.',
      icon: CalendarCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      path: '/patient-portal/schedule'
    },
    {
      title: 'Minhas Consultas',
      description: 'Acompanhe suas consultas agendadas.',
      icon: CalendarDays,
      color: 'text-[#0F4C81]',
      bgColor: 'bg-blue-50',
      path: '/patient-portal'
    },
    {
      title: 'Atendimentos',
      description: 'Veja seu histórico de atendimentos.',
      icon: Stethoscope,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      path: '/patient-portal'
    },
    {
      title: 'Unidades de Saúde',
      description: 'Encontre unidades de saúde perto de você.',
      icon: Building2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      path: '/patient-portal'
    },
    {
      title: 'Agendamento de Exames',
      description: 'Agende seus exames com facilidade.',
      icon: FlaskConical,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      path: '/patient-portal'
    },
    {
      title: 'Meus Exames',
      description: 'Acompanhe seus exames e resultados.',
      icon: ClipboardList,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      path: '/patient-portal'
    },
    {
      title: 'Lembretes',
      description: 'Receba alertas sobre consultas e exames.',
      icon: BellRing,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      path: '/patient-portal'
    },
    {
      title: 'Informações',
      description: 'Dicas de saúde e informações úteis.',
      icon: Info,
      color: 'text-[#0F4C81]',
      bgColor: 'bg-blue-50',
      path: '/patient-portal'
    }
  ];

  return (
    <div className="flex-1 p-4 md:p-6 pb-20 animate-fade-in">
      
      {/* Greeting Section */}
      <div className="flex items-center gap-4 mb-8 pt-2">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-[#0F4C81] flex-shrink-0">
          <UserIcon className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-[#0F4C81] tracking-tight">Olá!</h1>
          <p className="text-slate-600 font-medium text-lg leading-snug">Como podemos<br/>ajudar você hoje?</p>
        </div>
      </div>

      {/* Grid of Options */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {menuOptions.map((option, index) => (
          <button
            key={index}
            onClick={() => {
               if (option.title === 'Agendamento de Consulta' || option.title === 'Minhas Consultas') {
                   navigate('/patient-portal/schedule');
               } else {
                   alert(`A funcionalidade "${option.title}" está em desenvolvimento e será disponibilizada em breve!`);
               }
            }}
            className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-100 flex flex-col text-left hover:shadow-md hover:border-[#0F4C81]/30 transition-all group active:scale-95"
          >
            <div className={`w-10 h-10 ${option.bgColor} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
               <option.icon className={`w-6 h-6 ${option.color}`} />
            </div>
            
            <h3 className={`font-bold text-sm md:text-base leading-tight mb-1 flex-1 ${option.color === 'text-[#0F4C81]' ? 'text-[#0F4C81]' : option.color === 'text-green-600' ? 'text-green-600' : option.color === 'text-yellow-600' ? 'text-yellow-600' : option.color === 'text-purple-600' ? 'text-purple-600' : option.color === 'text-red-600' ? 'text-red-600' : option.color === 'text-orange-500' ? 'text-orange-500' : 'text-slate-800'}`}>
              {option.title}
            </h3>
            
            <p className="text-[10px] md:text-xs text-slate-500 leading-snug mb-2 flex-1">
              {option.description}
            </p>
            
            <div className="flex justify-end mt-auto">
               <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0F4C81] transition-colors" />
            </div>
          </button>
        ))}
      </div>
      
    </div>
  );
};
