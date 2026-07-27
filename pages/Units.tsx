import React, { useState, useEffect } from 'react';
import { HealthUnit } from '../types';
import { api } from '../services/api';
import { Plus, MapPin, Phone, Building2, Edit2, Trash, Search, Info, RotateCcw } from 'lucide-react';
import { buscarCEP } from '../src/utils/validators';
import { CnesSyncBanner } from '../components/CnesSyncBanner';

export const Units: React.FC = () => {
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<HealthUnit>>({ name: '', address: '', phone: '', cep: '', addressNumber: '', neighborhood: '', city: '', state: '' });

  const loadUnits = async () => {
    const data = await api.units.getAll();
    setUnits(data);
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const resetForm = () => {
      setFormData({ name: '', address: '', phone: '', cep: '', addressNumber: '', neighborhood: '', city: '', state: '' });
      setEditingId(null);
  };

  const handleEdit = async (u: HealthUnit) => {
      setEditingId(u.id);
      setFormData({ ...u });
      setShowModal(true);
      
      // Fetch full details including services
      const details = await api.units.getById(u.id);
      if(details) {
          setFormData({ ...details });
      }
  };

  const handleCepBlur = async () => {
      if (formData.cep && formData.cep.replace(/\D/g, '').length === 8) {
          const data = await buscarCEP(formData.cep);
          if (data) {
              setFormData(prev => ({
                  ...prev,
                  address: data.logradouro,
                  neighborhood: data.bairro,
                  city: data.localidade,
                  state: data.uf
              }));
          }
      }
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
        await api.units.update(editingId, formData as Partial<HealthUnit>);
    } else {
        await api.units.add(formData as Omit<HealthUnit, 'id'>);
    }
    
    loadUnits();
    setShowModal(false);
    resetForm();
  };

  const handleDeleteUnit = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta unidade?')) return;
    await api.units.delete(id);
    loadUnits();
  };

  const handleRestoreCnes = async (id: string) => {
    if (!confirm('Tem certeza que deseja descartar suas edições manuais e restaurar os dados do CNES para esta unidade?')) return;
    await api.units.restoreCnes(id);
    loadUnits();
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const maskCep = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{5})(\d)/, '$1-$2')
      .slice(0, 9);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Unidades de Saúde</h2>
           <p className="text-sm text-slate-500 dark:text-slate-400">Postos de atendimento da rede integrados ao CNES</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Unidade
        </button>
      </div>

      <CnesSyncBanner 
        entityName="Unidades de Saúde" 
        syncType="units"
        description="Sincronização com o Cadastro Nacional de Estabelecimentos de Saúde (CNES) garantindo que os dados das unidades estejam sempre atualizados."
        onSyncComplete={loadUnits}
      />

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            placeholder="Buscar por nome, bairro ou CNES..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-6 py-4 font-semibold">Nome da Unidade</th>
                <th className="px-6 py-4 font-semibold">Endereço / Contato</th>
                <th className="px-6 py-4 font-semibold">Atendimento</th>
                <th className="px-6 py-4 font-semibold">CNES</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {units
                .filter(u => 
                  u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  (u.neighborhood || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (u.cnesCode || '').includes(searchQuery)
                )
                .map(unit => (
                <tr key={unit.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{unit.name}</div>
                    <div className="text-xs text-slate-500 mt-1">ID: {unit.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {unit.address} {unit.neighborhood ? `- ${unit.neighborhood}` : ''}</span>
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {unit.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md ${unit.attendanceType === 'SENHA' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                      {unit.attendanceType === 'SENHA' ? 'Por Senha' : 'Ordem de Chegada'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {unit.cnesCode ? (
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${unit.localOverride ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                        {unit.cnesCode} {unit.localOverride && '(Editado)'}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {unit.localOverride && (
                        <button 
                            onClick={() => handleRestoreCnes(unit.id)}
                            className="text-amber-500 hover:text-amber-600 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md"
                            title="Restaurar dados do CNES"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                          onClick={() => handleEdit(unit)}
                          className="text-slate-400 hover:text-primary dark:hover:text-primary p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md"
                          title="Editar Unidade"
                      >
                          <Edit2 className="w-4 h-4" />
                      </button>
                      {!unit.cnesCode && (
                        <button 
                            onClick={() => handleDeleteUnit(unit.id)}
                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-500 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md"
                            title="Excluir Unidade"
                        >
                            <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {units.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma unidade cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 border border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">{editingId ? 'Editar Unidade' : 'Cadastrar Nova Unidade'}</h3>
            <form onSubmit={handleSaveUnit} className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Unidade</label>
                  <input 
                    required
                    placeholder="Nome da Unidade"
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                    value={formData.name || ''}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Regra de Atendimento</label>
                  <select 
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                    value={formData.attendanceType || 'CHEGADA'}
                    onChange={e => setFormData({...formData, attendanceType: e.target.value as 'CHEGADA' | 'SENHA'})}
                  >
                    <option value="CHEGADA">Ordem de Chegada</option>
                    <option value="SENHA">Por Senha</option>
                  </select>
               </div>
               <div className="flex items-center gap-2 mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                  <input 
                    type="checkbox" 
                    id="isHospital"
                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={formData.isHospital || false}
                    onChange={e => setFormData({...formData, isHospital: e.target.checked})}
                  />
                  <label htmlFor="isHospital" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    É Hospital do Município (Livre Agendamento)
                  </label>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CEP</label>
                      <div className="relative">
                          <input 
                            placeholder="00000-000"
                            maxLength={9}
                            className="w-full p-2.5 pr-10 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            value={formData.cep || ''}
                            onChange={e => setFormData({...formData, cep: maskCep(e.target.value)})}
                            onBlur={handleCepBlur}
                          />
                          <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                      </div>
                  </div>
                  <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                      <input 
                        required
                        placeholder="(00) 0000-0000"
                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={formData.phone || ''}
                        onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})}
                      />
                  </div>
                  <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Logradouro / Endereço</label>
                      <input 
                        required
                        placeholder="Rua, Avenida, etc"
                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={formData.address || ''}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                      />
                  </div>
                  <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                         <span>Número</span>
                         <label className="flex items-center gap-1 text-xs font-normal text-slate-500 cursor-pointer">
                           <input type="checkbox" className="rounded border-slate-300 text-primary focus:ring-primary" checked={formData.addressNumber === 'S/N'} onChange={e => setFormData({...formData, addressNumber: e.target.checked ? 'S/N' : ''})} />
                           S/N
                         </label>
                      </label>
                      <input 
                        required
                        placeholder="123"
                        disabled={formData.addressNumber === 'S/N'}
                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all disabled:opacity-50"
                        value={formData.addressNumber || ''}
                        onChange={e => setFormData({...formData, addressNumber: e.target.value})}
                      />
                  </div>
                  <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bairro</label>
                      <input 
                        required
                        placeholder="Bairro"
                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={formData.neighborhood || ''}
                        onChange={e => setFormData({...formData, neighborhood: e.target.value})}
                      />
                  </div>
                  <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cidade</label>
                      <input 
                        required
                        placeholder="Cidade"
                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={formData.city || ''}
                        onChange={e => setFormData({...formData, city: e.target.value})}
                      />
                  </div>
                  <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">UF</label>
                      <input 
                        required
                        placeholder="PE"
                        maxLength={2}
                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={formData.state || ''}
                        onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})}
                      />
                  </div>

                  {formData.services && formData.services.length > 0 && (
                      <div className="md:col-span-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Serviços Sincronizados (CNES)</label>
                          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800">
                              <ul className="space-y-2">
                                  {formData.services.map(s => (
                                      <li key={s.id} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                          <div>
                                              <span className="font-semibold">{s.name}</span>
                                              {s.classification && <span className="block text-xs text-slate-500">{s.classification}</span>}
                                          </div>
                                      </li>
                                  ))}
                              </ul>
                          </div>
                      </div>
                  )}
               </div>
               <div className="pt-6 flex justify-end gap-3">
                 <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancelar</button>
                 <button type="submit" className="px-5 py-2.5 font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm">
                     {editingId ? 'Salvar Alterações' : 'Salvar Unidade'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
