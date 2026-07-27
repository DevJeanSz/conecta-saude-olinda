import React, { useState, useEffect } from 'react';
import { User, UserRole, HealthUnit, Specialty, DoctorSchedule } from '../types';
import { api } from '../services/api';
import { ROLE_LABELS } from '../constants';
import { Plus, UserPlus, Building2, Edit2, RotateCcw, Clock, Trash, Users as UsersIcon, Info, Search } from 'lucide-react';
import { CnesSyncBanner } from '../components/CnesSyncBanner';

export const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  
  // New User Form State
  const [formData, setFormData] = useState({
    name: '',
    matricula: '',
    email: '',
    password: '',
    role: UserRole.DOCTOR,
    specialtyId: '',
    crm: '',
    unitId: '',
    unitIds: [] as string[],
    maxDailyPatients: 20, // Default value
    schedule: [] as DoctorSchedule[]
  });

  // Helper for schedule
  const [tempSchedule, setTempSchedule] = useState({ dayOfWeek: 1, startTime: '08:00', endTime: '17:00' });

  const loadData = async () => {
    const stored = localStorage.getItem('health_user');
    if (stored) {
      const u = JSON.parse(stored);
      setCurrentUser(u);
      setFormData(prev => ({ ...prev, unitId: u.unitId }));
      const fetchedUsers = u.role === UserRole.ADMIN ? await api.users.getAll() : await api.users.getByUnit(u.unitId);
      setUsers(fetchedUsers.filter((usr: User) => usr.role !== UserRole.PATIENT));
    }
    setUnits(await api.units.getAll());
    setSpecialties(await api.specialties.getAll());
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = (unitId: string) => {
      setFormData({ 
          name: '', 
          matricula: '',
          email: '', 
          password: '', 
          role: UserRole.DOCTOR, 
          specialtyId: '', 
          crm: '', 
          unitId: unitId,
          unitIds: [unitId],
          maxDailyPatients: 20,
          schedule: []
      });
      setEditingId(null);
  };

  const handleEdit = (user: User) => {
      setEditingId(user.id);
      setFormData({
          name: user.name,
          matricula: user.matricula || '',
          email: user.email,
          password: '', 
          role: user.role,
          specialtyId: user.specialtyId || '',
          crm: user.crm || '',
          unitId: user.unitId || '',
          unitIds: user.unitIds || (user.unitId ? [user.unitId] : []),
          maxDailyPatients: user.maxDailyPatients || 20,
          schedule: user.schedule || []
      });
      setShowModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unitId) return;

    const userData: any = {
        name: formData.name,
        matricula: formData.matricula,
        email: formData.email,
        role: formData.role,
        unitId: formData.unitIds[0] || formData.unitId,
        unitIds: formData.unitIds.length > 0 ? formData.unitIds : [formData.unitId]
    };

    if (formData.role === UserRole.DOCTOR) {
        userData.specialtyId = formData.specialtyId;
        userData.crm = formData.crm;
        userData.maxDailyPatients = formData.maxDailyPatients;
        userData.schedule = formData.schedule;
    }

    if (editingId) {
        await api.users.update(editingId, userData);
    } else {
        if (!formData.password && formData.role !== UserRole.PATIENT) {
            alert('Senha é obrigatória para novos usuários.');
            return;
        }
        userData.password = formData.password;
        await api.users.add(userData);
    }
    
    if (currentUser) {
        const updatedUsers = currentUser.role === UserRole.ADMIN ? await api.users.getAll() : await api.users.getByUnit(currentUser.unitId);
        setUsers(updatedUsers.filter((usr: User) => usr.role !== UserRole.PATIENT));
    }
    
    setShowModal(false);
    if (currentUser) resetForm(currentUser.unitId);
  };

  const handleAddSchedule = () => {
    setFormData(prev => ({
        ...prev,
        schedule: [...prev.schedule, tempSchedule]
    }));
  };

  const removeSchedule = (index: number) => {
      setFormData(prev => ({
          ...prev,
          schedule: prev.schedule.filter((_, i) => i !== index)
      }));
  };

  const getDayName = (day: number) => {
      const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      return days[day];
  };

  const handleResetPassword = async () => {
      if (editingId && formData.password) {
          await api.users.update(editingId, { password: formData.password });
          alert('Senha redefinida com sucesso.');
      } else {
          alert('Digite a nova senha no campo de senha para redefinir.');
      }
  };

  const handleDeleteUser = async (id: string) => {
      if (!confirm('Tem certeza que deseja excluir este usuario?')) return;
      await api.users.delete(id);
      if (currentUser) {
        setUsers(currentUser.role === UserRole.ADMIN ? await api.users.getAll() : await api.users.getByUnit(currentUser.unitId));
      }
  };

  const handleRestoreUserCnes = async (id: string) => {
      if (!confirm('Tem certeza que deseja descartar suas edições manuais e restaurar os dados oficiais do CNES para este profissional?')) return;
      await api.users.restoreCnes(id);
      if (currentUser) {
        setUsers(currentUser.role === UserRole.ADMIN ? await api.users.getAll() : await api.users.getByUnit(currentUser.unitId));
      }
  };

  const getSpecialtyName = (id?: string) => specialties.find(s => s.id === id)?.name || 'N/A';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Equipe Médica e Usuários</h2>
           <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie os profissionais e usuários do sistema.</p>
        </div>
        <div className="flex gap-2">
            {currentUser?.role === UserRole.ADMIN && (
               <CnesSyncBanner 
                 entityName="Profissionais do CNES" 
                 syncType="professionals"
                 description=""
                 onSyncComplete={loadData}
               />
            )}
            <button 
               onClick={() => { resetForm(currentUser?.unitId || ''); setShowModal(true); }}
               className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 h-[42px]"
            >
               <UserPlus className="w-5 h-5" />
               Novo Usuário
            </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
               <tr>
                 <th className="p-4 font-medium text-slate-500 dark:text-slate-400">Nome</th>
                 <th className="p-4 font-medium text-slate-500 dark:text-slate-400">Matrícula</th>
                 <th className="p-4 font-medium text-slate-500 dark:text-slate-400">Função</th>
                 <th className="p-4 font-medium text-slate-500 dark:text-slate-400">Detalhes</th>
                 <th className="p-4 font-medium text-slate-500 dark:text-slate-400 text-right">Ações</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
               {users.map(u => (
                 <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                   <td className="p-4 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                   <td className="p-4 text-slate-600 dark:text-slate-400">{u.matricula || '-'}</td>
                   <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                          u.role === UserRole.GENERAL_SUPERVISOR ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                          u.role === UserRole.DOCTOR ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                          u.role === UserRole.SOCIAL_WORKER ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                          u.role === UserRole.PATIENT ? 'bg-green-100 text-green-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                          {ROLE_LABELS[u.role]}
                      </span>
                   </td>
                   <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                      {u.role === UserRole.DOCTOR && (
                          <div>
                              <p>CRM: <span className="text-slate-700 dark:text-slate-300">{u.crm}</span></p>
                              <p className="text-slate-700 dark:text-slate-300">{getSpecialtyName(u.specialtyId)}</p>
                              {u.maxDailyPatients && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Max: {u.maxDailyPatients} pac/dia</p>}
                          </div>
                      )}
                   </td>
                   <td className="p-4 text-right">
                       <div className="flex justify-end gap-1">
                           {u.localOverride && (
                             <button 
                                onClick={() => handleRestoreUserCnes(u.id)}
                                className="text-amber-500 hover:text-amber-600 p-2 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                                title="Restaurar dados do CNES"
                             >
                                <RotateCcw className="w-4 h-4" />
                             </button>
                           )}
                           <button 
                              onClick={() => handleEdit(u)}
                              className="text-slate-400 hover:text-primary dark:hover:text-primary transition-colors p-2 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                              title="Editar"
                          >
                              <Edit2 className="w-4 h-4" />
                          </button>
                          {!u.cnesId && (
                            <button 
                                onClick={() => handleDeleteUser(u.id)}
                                className="text-slate-400 hover:text-red-600 dark:hover:text-red-500 transition-colors p-2 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                                title="Excluir"
                            >
                                <Trash className="w-4 h-4" />
                            </button>
                          )}
                       </div>
                    </td>
                 </tr>
               ))}
             </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh] border border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">{editingId ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</h3>
            <form onSubmit={handleSaveUser} className="space-y-5">
               
               <div className="grid grid-cols-1 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Unidades de Saúde</label>
                      <div className="mb-2 relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input 
                          type="text"
                          placeholder="Filtrar unidades..."
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-slate-900 dark:text-slate-100"
                          value={unitSearchQuery}
                          onChange={(e) => setUnitSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto custom-scrollbar">
                        {units.filter(u => u.name.toLowerCase().includes(unitSearchQuery.toLowerCase())).map(unit => (
                            <label key={unit.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-950"
                                    checked={formData.unitIds?.includes(unit.id) || (!formData.unitIds?.length && formData.unitId === unit.id)}
                                    onChange={(e) => {
                                        const currentIds = formData.unitIds?.length ? formData.unitIds : (formData.unitId ? [formData.unitId] : []);
                                        if (e.target.checked) {
                                            setFormData({...formData, unitIds: [...currentIds, unit.id]});
                                        } else {
                                            setFormData({...formData, unitIds: currentIds.filter(id => id !== unit.id)});
                                        }
                                    }}
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{unit.name}</span>
                            </label>
                        ))}
                        {units.filter(u => u.name.toLowerCase().includes(unitSearchQuery.toLowerCase())).length === 0 && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 p-2 col-span-full">Nenhuma unidade encontrada.</p>
                        )}
                      </div>
                    </div>

                   <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Usuário</label>
                      <select 
                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={formData.role}
                        onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                      >
                        <option value={UserRole.GENERAL_SUPERVISOR}>Supervisor Geral</option>
                        <option value={UserRole.DOCTOR}>Médico</option>
                        <option value={UserRole.ATTENDANT}>Atendente</option>
                        <option value={UserRole.SOCIAL_WORKER}>Assistente Social</option>
                        <option value={UserRole.ADMIN}>Administrador</option>
                      </select>
                   </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
                        <input 
                            required
                            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Matrícula</label>
                        <input 
                            required
                            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            value={formData.matricula}
                            onChange={e => setFormData({...formData, matricula: e.target.value})}
                        />
                    </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email de contato</label>
                        <input 
                            required type="email"
                            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                    </div>
               </div>

               {formData.role !== UserRole.PATIENT && (
                 <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          {editingId ? 'Redefinir Senha' : 'Senha de Acesso *'}
                      </label>
                      <div className="flex gap-2">
                          <input 
                              required={!editingId}
                              type="password"
                              placeholder={editingId ? "Nova senha (opcional)" : "Digite a senha"}
                              className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                              value={formData.password}
                              onChange={e => setFormData({...formData, password: e.target.value})}
                          />
                          {editingId && (
                              <button 
                                  type="button" 
                                  onClick={handleResetPassword}
                                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                              >
                                  <RotateCcw className="w-4 h-4" />
                              </button>
                          )}
                      </div>
                      {editingId && <p className="text-xs text-slate-500 mt-2">Deixe em branco se não quiser alterar a senha atual.</p>}
                 </div>
               )}

               {formData.role === UserRole.DOCTOR && (
                 <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Especialidade</label>
                            <select 
                                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                                value={formData.specialtyId}
                                onChange={e => setFormData({...formData, specialtyId: e.target.value})}
                            >
                                <option value="">Selecione...</option>
                                {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CRM/UF</label>
                            <input 
                                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                                placeholder="12345/SP"
                                value={formData.crm}
                                onChange={e => setFormData({...formData, crm: e.target.value})}
                            />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max. Pacientes/Dia</label>
                             <div className="relative">
                                <UsersIcon className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                <input 
                                    type="number"
                                    min="1"
                                    className="w-full pl-10 p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                                    value={formData.maxDailyPatients}
                                    onChange={e => setFormData({...formData, maxDailyPatients: parseInt(e.target.value)})}
                                />
                             </div>
                        </div>
                    </div>

                    <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-xl border border-primary/20 dark:border-primary/30">
                        <h4 className="font-semibold text-primary dark:text-blue-400 mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Horário de Atendimento
                        </h4>
                        
                        <div className="flex gap-2 mb-4 items-end">
                            <div className="flex-1">
                                <label className="text-xs font-medium text-primary dark:text-blue-400 mb-1 block">Dia</label>
                                <select 
                                    className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                                    value={tempSchedule.dayOfWeek}
                                    onChange={e => setTempSchedule({...tempSchedule, dayOfWeek: Number(e.target.value)})}
                                >
                                    <option value={1}>Segunda</option>
                                    <option value={2}>Terça</option>
                                    <option value={3}>Quarta</option>
                                    <option value={4}>Quinta</option>
                                    <option value={5}>Sexta</option>
                                    <option value={6}>Sábado</option>
                                    <option value={0}>Domingo</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-primary dark:text-blue-400 mb-1 block">Início</label>
                                <input type="time" className="p-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100" value={tempSchedule.startTime} onChange={e => setTempSchedule({...tempSchedule, startTime: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-primary dark:text-blue-400 mb-1 block">Fim</label>
                                <input type="time" className="p-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100" value={tempSchedule.endTime} onChange={e => setTempSchedule({...tempSchedule, endTime: e.target.value})} />
                            </div>
                            <button type="button" onClick={handleAddSchedule} className="bg-primary text-white p-2 rounded-lg hover:bg-primary-dark transition-colors"><Plus className="w-5 h-5"/></button>
                        </div>

                        <div className="space-y-2">
                            {formData.schedule.map((s, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-lg text-sm text-slate-700 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-800">
                                    <span className="font-medium">{getDayName(s.dayOfWeek)}: {s.startTime} - {s.endTime}</span>
                                    <button type="button" onClick={() => removeSchedule(idx)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 bg-red-50 dark:bg-red-900/20 rounded"><Trash className="w-4 h-4" /></button>
                                </div>
                            ))}
                            {formData.schedule.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum horário configurado.</p>}
                        </div>
                    </div>
                 </>
               )}

               <div className="pt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-6">
                 <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancelar</button>
                 <button type="submit" className="px-5 py-2.5 font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm">
                     {editingId ? 'Atualizar Dados' : 'Criar Usuário'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
