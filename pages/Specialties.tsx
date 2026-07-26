import React, { useState, useEffect } from 'react';
import { Specialty, HealthUnit } from '../types';
import { api } from '../services/api';
import { Plus, Trash2, Edit2, Activity } from 'lucide-react';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Segunda' },
  { id: 2, name: 'Terça' },
  { id: 3, name: 'Quarta' },
  { id: 4, name: 'Quinta' },
  { id: 5, name: 'Sexta' },
  { id: 6, name: 'Sábado' },
  { id: 0, name: 'Domingo' }
];

export const Specialties: React.FC = () => {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const defaultForm: Partial<Specialty> = {
    name: '',
    isGlobal: true,
    maxDailyAppointments: 20,
    unitIds: [],
    schedule: []
  };

  const [formData, setFormData] = useState<Partial<Specialty>>(defaultForm);

  const loadData = async () => {
    const [specData, unitsData] = await Promise.all([
      api.specialties.getAll(),
      api.units.getAll()
    ]);
    setSpecialties(specData);
    setUnits(unitsData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingId(null);
  };

  const handleEdit = (spec: Specialty) => {
    setFormData({
      ...spec,
      schedule: spec.schedule || [],
      unitIds: spec.unitIds || [],
      isGlobal: spec.isGlobal ?? true,
      maxDailyAppointments: spec.maxDailyAppointments || 20
    });
    setEditingId(spec.id);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    const payload = {
        name: formData.name,
        isGlobal: formData.isGlobal,
        maxDailyAppointments: formData.maxDailyAppointments,
        unitIds: formData.isGlobal ? [] : formData.unitIds,
        schedule: formData.schedule
    };

    if (editingId) {
      await api.specialties.update(editingId, payload);
    } else {
      await api.specialties.add(payload as Omit<Specialty, 'id'>);
    }
    
    loadData();
    setShowModal(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta especialidade?')) {
      await api.specialties.delete(id);
      loadData();
    }
  };

  const toggleDay = (dayId: number) => {
      const currentSchedule = formData.schedule || [];
      const hasDay = currentSchedule.find(s => s.dayOfWeek === dayId);
      
      if (hasDay) {
          setFormData({
              ...formData,
              schedule: currentSchedule.filter(s => s.dayOfWeek !== dayId)
          });
      } else {
          setFormData({
              ...formData,
              schedule: [...currentSchedule, { dayOfWeek: dayId, startTime: '08:00', endTime: '17:00' }]
          });
      }
  };

  const toggleUnit = (unitId: string) => {
      const currentUnits = formData.unitIds || [];
      if (currentUnits.includes(unitId)) {
          setFormData({ ...formData, unitIds: currentUnits.filter(id => id !== unitId) });
      } else {
          setFormData({ ...formData, unitIds: [...currentUnits, unitId] });
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Especialidades Médicas</h2>
           <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie regras de atendimento e cotas das especialidades</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Especialidade
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {specialties.map(spec => (
            <div key={spec.id} className="bg-white dark:bg-slate-950 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-primary transition-all relative group flex flex-col">
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => handleEdit(spec)}
                        className="text-slate-400 hover:text-primary dark:hover:text-primary p-1 bg-slate-50 dark:bg-slate-900 rounded-md"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => handleDelete(spec.id)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-500 p-1 bg-slate-50 dark:bg-slate-900 rounded-md"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-primary/10 p-3 rounded-lg text-primary">
                        <Activity className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{spec.name}</h3>
                </div>
                
                <div className="space-y-3 text-sm mt-auto border-t border-slate-100 dark:border-slate-800 pt-4">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Cota Diária:</span>
                        <span className="font-semibold">{spec.maxDailyAppointments || 'Ilimitado'} atendimentos</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Escopo:</span>
                        <span className="font-semibold">{spec.isGlobal ? 'Todas as Unidades' : `${spec.unitIds?.length || 0} Unidades`}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Dias:</span>
                        <span className="font-semibold truncate max-w-[150px] text-right" title={spec.schedule?.map(s => DAYS_OF_WEEK.find(d => d.id === s.dayOfWeek)?.name).join(', ')}>
                            {spec.schedule && spec.schedule.length > 0 
                                ? spec.schedule.map(s => DAYS_OF_WEEK.find(d => d.id === s.dayOfWeek)?.name?.slice(0,3)).join(', ') 
                                : 'Não configurado'}
                        </span>
                    </div>
                </div>
            </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl p-6 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">{editingId ? 'Editar Especialidade' : 'Cadastrar Especialidade'}</h3>
            <form onSubmit={handleSave} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Especialidade</label>
                      <input 
                        required
                        placeholder="Ex: Cardiologia"
                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={formData.name || ''}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Limite Diário de Consultas</label>
                      <input 
                        type="number"
                        min="1"
                        required
                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={formData.maxDailyAppointments || ''}
                        onChange={e => setFormData({...formData, maxDailyAppointments: parseInt(e.target.value) || 0})}
                      />
                   </div>
               </div>

               <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dias de Atendimento na Semana</label>
                   <div className="flex flex-wrap gap-2">
                       {DAYS_OF_WEEK.map(day => {
                           const isSelected = (formData.schedule || []).some(s => s.dayOfWeek === day.id);
                           return (
                               <button
                                   type="button"
                                   key={day.id}
                                   onClick={() => toggleDay(day.id)}
                                   className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${isSelected ? 'bg-primary text-white border-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:border-slate-300'}`}
                               >
                                   {day.name}
                               </button>
                           );
                       })}
                   </div>
               </div>

               <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 text-primary focus:ring-primary border-slate-300 rounded"
                            checked={formData.isGlobal}
                            onChange={(e) => setFormData({...formData, isGlobal: e.target.checked})}
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Regra válida para todas as Unidades de Saúde</span>
                    </label>

                    {!formData.isGlobal && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 mt-2">
                            <p className="text-sm text-slate-500 mb-2">Selecione as unidades onde esta especialidade atende:</p>
                            <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                                {units.map(unit => (
                                    <label key={unit.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-primary focus:ring-primary border-slate-300 rounded"
                                            checked={(formData.unitIds || []).includes(unit.id)}
                                            onChange={() => toggleUnit(unit.id)}
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{unit.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
               </div>

               <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                 <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancelar</button>
                 <button type="submit" className="px-5 py-2.5 font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm">
                     {editingId ? 'Salvar Alterações' : 'Cadastrar'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};