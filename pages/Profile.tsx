import React, { useState, useEffect } from 'react';
import { User, HealthUnit, Patient } from '../types';
import { api } from '../services/api';
import { ROLE_LABELS } from '../constants';
import { User as UserIcon, Save, AlertCircle } from 'lucide-react';

interface ProfileProps {
  user: User;
}

export const Profile: React.FC<ProfileProps> = ({ user }) => {
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    password: '',
    unitId: user.unitId || ''
  });
  
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [patientData, setPatientData] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    api.units.getAll().then(setUnits).catch(console.error);
    if (user.role === 'PATIENT') {
       api.patients.getByUserId(user.id).then(setPatientData).catch(console.error);
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const updatedUser = await api.users.updateProfile(formData);
      
      // Update local storage so the session has the new data
      const stored = localStorage.getItem('health_user');
      if (stored) {
         const sessionUser = JSON.parse(stored);
         const newSession = { ...sessionUser, ...updatedUser };
         localStorage.setItem('health_user', JSON.stringify(newSession));
         
         // Reload page to reflect changes in the Layout user object
         window.location.reload();
      } else {
         setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar perfil.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-black text-[#0F4C81] mb-2">Meu Perfil</h2>
        <p className="text-slate-600 text-lg">Atualize suas informações pessoais e credenciais.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
        {user.role === 'PATIENT' ? (
           <div className="space-y-6">
             <div className="flex items-center gap-4 mb-6">
               <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100">
                 <UserIcon className="w-8 h-8 text-[#0F4C81]" />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-slate-800">{user.name}</h3>
                  <p className="text-slate-500 font-medium">Paciente</p>
               </div>
             </div>
             
             {patientData ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-[#0F4C81] mb-2">Nome Completo</label>
                      <div className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium">{patientData.name}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#0F4C81] mb-2">CPF</label>
                      <div className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium">{patientData.cpf}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#0F4C81] mb-2">Cartão SUS</label>
                      <div className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium">{patientData.susNumber}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#0F4C81] mb-2">E-mail</label>
                      <div className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium">{patientData.email || 'Não informado'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#0F4C81] mb-2">Telefone</label>
                      <div className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium">{patientData.phone}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#0F4C81] mb-2">Endereço</label>
                      <div className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium">{patientData.address || 'Não informado'}</div>
                    </div>
                 </div>
             ) : (
                 <div className="p-4 text-center text-slate-500">Carregando dados...</div>
             )}
           </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100">
              <UserIcon className="w-8 h-8 text-[#0F4C81]" />
            </div>
            <div>
               <h3 className="text-xl font-bold text-slate-800">{user.name}</h3>
               <p className="text-slate-500 font-medium">
                  {ROLE_LABELS[user.role] || user.role}
               </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-[#0F4C81] mb-2">Nome Completo</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-[#0F4C81] mb-2">E-mail</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#0F4C81] mb-2">Nova Senha (opcional)</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Deixe em branco para manter a atual"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0F4C81] outline-none"
              />
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              <AlertCircle size={20} />
              <p>{message.text}</p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-4 bg-[#0F4C81] hover:bg-blue-800 text-white font-medium rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              <Save size={18} />
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
