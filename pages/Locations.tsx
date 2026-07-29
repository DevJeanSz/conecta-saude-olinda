import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Location, LocationType, User, UserRole } from '../types';
import { LayoutList, Plus, Trash2, ToggleLeft, ToggleRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface LocationsProps {
  user: User;
}

const TYPE_LABELS: Record<LocationType, string> = {
  GUICHE: 'Guichê',
  SALA: 'Sala',
  MESA: 'Mesa',
};

const TYPE_DISPLAY: Record<LocationType, string> = {
  GUICHE: 'GUICHÊ',
  SALA: 'SALA',
  MESA: 'MESA',
};

const TYPE_COLORS: Record<LocationType, string> = {
  GUICHE: 'bg-blue-500 text-white',
  SALA: 'bg-purple-500 text-white',
  MESA: 'bg-orange-500 text-white',
};

const canEdit = (role: UserRole) =>
  [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT].includes(role);
const canDelete = (role: UserRole) =>
  [UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR].includes(role);

export const Locations: React.FC<LocationsProps> = ({ user }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<LocationType>('GUICHE');
  const [formNumber, setFormNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = user.unitId
        ? await api.locations.getByUnit(user.unitId)
        : await api.locations.getAll();
      setLocations(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user.unitId]);

  const showMsg = (msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleAdd = async () => {
    const num = parseInt(formNumber);
    if (!num || num < 1 || num > 999) {
      return showMsg('Informe um número válido entre 1 e 999.', true);
    }
    setSaving(true);
    try {
      await api.locations.add({ type: formType, number: num, unitId: user.unitId });
      setFormNumber('');
      setShowForm(false);
      showMsg(`${TYPE_LABELS[formType]} ${String(num).padStart(2, '0')} cadastrado com sucesso!`);
      await load();
    } catch (err: any) {
      showMsg(err?.message || 'Erro ao cadastrar local.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (loc: Location) => {
    try {
      await api.locations.update(loc.id, { active: !loc.active });
      showMsg('Status atualizado.');
      await load();
    } catch (err: any) {
      showMsg(err?.message || 'Erro ao alterar status.', true);
    }
  };

  const handleDelete = async (loc: Location) => {
    if (!window.confirm(`Deseja excluir "${loc.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.locations.delete(loc.id);
      showMsg(`"${loc.name}" excluído com sucesso.`);
      await load();
    } catch (err: any) {
      showMsg(err?.message || 'Erro ao excluir local.', true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl hidden sm:block">
            <LayoutList className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Salas e Guichês</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie os locais de atendimento da unidade</p>
          </div>
        </div>
        {canEdit(user.role) && (
          <button
            className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
            onClick={() => { setShowForm(true); setFormNumber(''); }}
            type="button"
          >
            <Plus className="w-5 h-5" /> Novo local
          </button>
        )}
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3 border border-red-200 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400" role="alert">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-3 border border-green-200 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400" role="status">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Formulário de novo local */}
      {showForm && canEdit(user.role) && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">Cadastrar novo local</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label htmlFor="loc-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Tipo *
              </label>
              <select
                id="loc-type"
                value={formType}
                onChange={e => setFormType(e.target.value as LocationType)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
              >
                <option value="GUICHE">Guichê</option>
                <option value="SALA">Sala</option>
                <option value="MESA">Mesa</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="loc-number" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Número *
              </label>
              <input
                id="loc-number"
                type="number"
                min={1}
                max={999}
                placeholder="Ex: 1"
                value={formNumber}
                onChange={e => setFormNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
              />
            </div>
            
            <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 h-[42px] mb-[2px]">
              {formNumber && parseInt(formNumber) > 0 ? (
                <strong className="text-slate-800 dark:text-slate-100 font-bold tracking-wide">
                  {TYPE_DISPLAY[formType]} {String(parseInt(formNumber)).padStart(2, '0')}
                </strong>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 text-sm">Pré-visualização</span>
              )}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <button
              className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
              onClick={() => setShowForm(false)}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-lg font-medium transition-colors disabled:opacity-50"
              onClick={handleAdd}
              disabled={saving}
              type="button"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de locais */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Carregando locais...</p>
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 rounded-full flex items-center justify-center mb-4">
            <LayoutList size={32} />
          </div>
          <p className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-1">Nenhum local cadastrado</p>
          {canEdit(user.role) && (
            <p className="text-slate-500 dark:text-slate-400">Clique em "Novo local" para começar.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {(['GUICHE', 'SALA', 'MESA'] as LocationType[]).map(type => {
            const items = locations
              .filter(l => l.type === type)
              .sort((a, b) => a.number - b.number);
            if (items.length === 0) return null;
            return (
              <section key={type} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    {TYPE_LABELS[type]}s
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs font-bold">
                      {items.length}
                    </span>
                  </h2>
                </div>
                
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 overflow-y-auto max-h-[600px]">
                  {items.map(loc => (
                    <div
                      key={loc.id}
                      className={`px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors ${!loc.active ? 'opacity-70 bg-slate-50/50 dark:bg-slate-950/30' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold shadow-sm ${TYPE_COLORS[type]} ${!loc.active ? 'grayscale opacity-80' : ''}`}>
                          {type === 'GUICHE' ? 'G' : type[0]}
                        </div>
                        <div>
                          <strong className="block text-slate-800 dark:text-slate-100">{loc.name}</strong>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${
                            loc.active 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {loc.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {canEdit(user.role) && (
                          <button
                            className={`p-2 rounded-lg transition-colors ${
                              loc.active 
                                ? 'text-green-600 hover:bg-green-50 dark:text-green-500 dark:hover:bg-green-900/20' 
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            onClick={() => handleToggle(loc)}
                            title={loc.active ? 'Desativar local' : 'Ativar local'}
                            type="button"
                            aria-label={loc.active ? `Desativar ${loc.name}` : `Ativar ${loc.name}`}
                          >
                            {loc.active
                              ? <ToggleRight size={22} />
                              : <ToggleLeft size={22} />}
                          </button>
                        )}
                        
                        {canDelete(user.role) && (
                          <button
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            onClick={() => handleDelete(loc)}
                            title={`Excluir ${loc.name}`}
                            type="button"
                            aria-label={`Excluir ${loc.name}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
