import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit2,
  FileSearch,
  FlaskConical,
  Hospital,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { STATUS_LABELS } from '../constants';
import { api } from '../services/api';
import { Exam, ExamStatus, ExamType, HealthUnit, Patient, User, UserRole } from '../types';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Segunda' },
  { id: 2, name: 'Terça' },
  { id: 3, name: 'Quarta' },
  { id: 4, name: 'Quinta' },
  { id: 5, name: 'Sexta' },
  { id: 6, name: 'Sábado' },
  { id: 0, name: 'Domingo' },
];

const defaultForm: Partial<ExamType> = {
  name: '',
  isGlobal: true,
  maxDailyAppointments: 20,
  unitIds: [],
  schedule: [],
  preparation: '',
  requiresReferral: true,
};

const formatDate = (value: string) => {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
};

interface ExamTypesProps {
  user: User;
}

export const ExamTypes: React.FC<ExamTypesProps> = ({ user }) => {
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'types'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ExamType>>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [typeData, unitsData, patientData, examData] = await Promise.all([
      api.examTypes.getAll(),
      api.units.getAll(),
      api.patients.getAll(),
      api.exams.getAll(),
    ]);

    setExamTypes(typeData);
    setUnits(unitsData);
    setPatients(patientData);
    setExams(examData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const patientById = useMemo(() => new Map(patients.map(patient => [patient.id, patient])), [patients]);
  const unitById = useMemo(() => new Map(units.map(unit => [unit.id, unit])), [units]);
  const canManageTypes = user.role === UserRole.ADMIN || user.role === UserRole.GENERAL_SUPERVISOR;

  const filteredExamTypes = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-BR');
    return examTypes.filter(type => !query || type.name.toLocaleLowerCase('pt-BR').includes(query));
  }, [examTypes, searchQuery]);

  const filteredExams = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-BR');
    return exams.filter((exam) => {
      const patientName = patientById.get(exam.patientId)?.name || '';
      const unitName = unitById.get(exam.unitId)?.name || '';
      return !query
        || exam.type.toLocaleLowerCase('pt-BR').includes(query)
        || patientName.toLocaleLowerCase('pt-BR').includes(query)
        || unitName.toLocaleLowerCase('pt-BR').includes(query)
        || (exam.requestCode || '').toLocaleLowerCase('pt-BR').includes(query);
    });
  }, [exams, patientById, searchQuery, unitById]);

  const scheduledCount = exams.filter(exam => exam.status === ExamStatus.SCHEDULED).length;
  const availableCount = exams.filter(exam => exam.status === ExamStatus.AVAILABLE).length;
  const unitLinkedTypes = examTypes.filter(type => !type.isGlobal).length;

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingId(null);
  };

  const handleEdit = (examType: ExamType) => {
    setFormData({
      ...examType,
      schedule: examType.schedule || [],
      unitIds: examType.unitIds || [],
      isGlobal: examType.isGlobal ?? true,
      maxDailyAppointments: examType.maxDailyAppointments || 20,
      requiresReferral: examType.requiresReferral ?? true,
    });
    setEditingId(examType.id);
    setShowModal(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name?.trim()) return;

    const payload: Omit<ExamType, 'id'> = {
      name: formData.name.trim(),
      isGlobal: formData.isGlobal ?? true,
      maxDailyAppointments: Number(formData.maxDailyAppointments) || undefined,
      unitIds: formData.isGlobal ? [] : formData.unitIds || [],
      schedule: formData.schedule || [],
      preparation: formData.preparation?.trim() || undefined,
      requiresReferral: formData.requiresReferral ?? true,
    };

    if (editingId) {
      await api.examTypes.update(editingId, payload);
      setFeedback('Tipo de exame atualizado.');
    } else {
      await api.examTypes.add(payload);
      setFeedback('Tipo de exame cadastrado.');
    }

    await loadData();
    setShowModal(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este tipo de exame?')) return;
    await api.examTypes.delete(id);
    setFeedback('Tipo de exame removido.');
    await loadData();
  };

  const updateExamStatus = async (exam: Exam, status: ExamStatus) => {
    await api.exams.update(exam.id, {
      status,
      resultAvailable: status === ExamStatus.AVAILABLE ? true : undefined,
    });
    setFeedback(status === ExamStatus.AVAILABLE ? 'Resultado liberado para o paciente.' : 'Status do exame atualizado.');
    await loadData();
  };

  const cancelExam = async (exam: Exam) => {
    const reason = window.prompt('Motivo do cancelamento (obrigatório):');
    if (!reason || !reason.trim()) {
      if (reason !== null) alert('O motivo do cancelamento é obrigatório.');
      return;
    }

    await api.exams.cancel(exam.id, reason.trim());
    setFeedback('Exame cancelado.');
    await loadData();
  };

  const toggleDay = (dayId: number) => {
    const currentSchedule = formData.schedule || [];
    const hasDay = currentSchedule.find(schedule => schedule.dayOfWeek === dayId);

    setFormData({
      ...formData,
      schedule: hasDay
        ? currentSchedule.filter(schedule => schedule.dayOfWeek !== dayId)
        : [...currentSchedule, { dayOfWeek: dayId, startTime: '08:00', endTime: '17:00' }],
    });
  };

  const toggleUnit = (unitId: string) => {
    const currentUnits = formData.unitIds || [];
    setFormData({
      ...formData,
      unitIds: currentUnits.includes(unitId)
        ? currentUnits.filter(id => id !== unitId)
        : [...currentUnits, unitId],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.22em] text-primary">Central de exames</span>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">Exames da rede municipal</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Acompanhe solicitações, libere resultados e configure exames disponíveis por unidade.
          </p>
        </div>
        {canManageTypes && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-black text-white transition-colors hover:bg-primary-dark"
            type="button"
          >
            <Plus className="h-4 w-4" />
            Novo tipo de exame
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Solicitações', String(exams.length), FileSearch, 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'],
          ['Agendados', String(scheduledCount), Clock3, 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'],
          ['Resultados', String(availableCount), CheckCircle2, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'],
          ['Tipos vinculados', String(unitLinkedTypes), Hospital, 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'],
        ].map(([label, value, Icon, tone]) => {
          const MetricIcon = Icon as typeof FileSearch;
          return (
            <article key={label as string} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone as string}`}>
                <MetricIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label as string}</p>
                <strong className="text-xl font-black text-slate-900 dark:text-slate-100">{value as string}</strong>
              </div>
            </article>
          );
        })}
      </div>

      {feedback && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
          {feedback}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
            {[
              ['requests', 'Solicitações'],
              ['types', 'Tipos de exame'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as 'requests' | 'types')}
                className={`h-10 rounded-lg px-4 text-sm font-black transition-colors ${
                  activeTab === id
                    ? 'bg-white text-primary shadow-sm dark:bg-slate-800 dark:text-blue-300'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <label className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'requests' ? 'Buscar por paciente, exame ou unidade' : 'Buscar tipo de exame'}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-black">Paciente</th>
                  <th className="px-5 py-4 font-black">Exame</th>
                  <th className="px-5 py-4 font-black">Unidade</th>
                  <th className="px-5 py-4 font-black">Data</th>
                  <th className="px-5 py-4 font-black">Status</th>
                  <th className="px-5 py-4 text-right font-black">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td className="px-5 py-10 text-center font-bold text-slate-500" colSpan={6}>Carregando exames...</td>
                  </tr>
                ) : filteredExams.length === 0 ? (
                  <tr>
                    <td className="px-5 py-10 text-center font-bold text-slate-500" colSpan={6}>Nenhuma solicitação de exame encontrada.</td>
                  </tr>
                ) : filteredExams.map((exam) => {
                  const patient = patientById.get(exam.patientId);
                  const unit = unitById.get(exam.unitId);
                  return (
                    <tr key={exam.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950/40">
                      <td className="px-5 py-4">
                        <div className="font-black text-slate-900 dark:text-slate-100">{patient?.name || 'Paciente'}</div>
                        <div className="text-xs font-semibold text-slate-500">{patient?.susNumber || exam.requestCode || 'Sem código'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-black text-slate-900 dark:text-slate-100">{exam.type}</div>
                        <div className="text-xs font-semibold text-slate-500">{exam.preparation ? 'Preparo informado' : 'Sem preparo específico'}</div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-300">{unit?.name || 'Unidade'}</td>
                      <td className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-300">
                        {formatDate(exam.date)} às {exam.time}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                          exam.status === ExamStatus.AVAILABLE
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : exam.status === ExamStatus.CANCELLED
                              ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                              : exam.status === ExamStatus.NO_SHOW
                                ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                        }`}>
                          {STATUS_LABELS[exam.status] || exam.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          {exam.status === ExamStatus.SCHEDULED && (
                            <>
                              <button
                                onClick={() => updateExamStatus(exam, ExamStatus.AVAILABLE)}
                                className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700"
                                type="button"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Liberar resultado
                              </button>
                              <button
                                onClick={() => updateExamStatus(exam, ExamStatus.NO_SHOW)}
                                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                type="button"
                              >
                                <Clock3 className="h-4 w-4" />
                                Faltou
                              </button>
                            </>
                          )}
                          {exam.status === ExamStatus.AVAILABLE && (
                            <button
                              onClick={() => updateExamStatus(exam, ExamStatus.SCHEDULED)}
                              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              type="button"
                            >
                              <Activity className="h-4 w-4" />
                              Reabrir
                            </button>
                          )}
                          {exam.status !== ExamStatus.CANCELLED && (
                            <button
                              onClick={() => cancelExam(exam)}
                              className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-black text-red-600 hover:bg-red-50 dark:border-red-900/70 dark:hover:bg-red-950/30"
                              type="button"
                            >
                              <XCircle className="h-4 w-4" />
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-black">Tipo de exame</th>
                  <th className="px-5 py-4 font-black">Cota diária</th>
                  <th className="px-5 py-4 font-black">Dias de atendimento</th>
                  <th className="px-5 py-4 font-black">Escopo</th>
                  <th className="px-5 py-4 text-right font-black">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredExamTypes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center font-bold text-slate-500">
                      Nenhum tipo de exame cadastrado.
                    </td>
                  </tr>
                ) : filteredExamTypes.map(examType => (
                  <tr key={examType.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950/40">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-primary dark:bg-blue-950/40 dark:text-blue-300">
                          <FlaskConical className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="font-black text-slate-900 dark:text-slate-100">{examType.name}</div>
                          <div className="text-xs font-semibold text-slate-500">
                            {examType.requiresReferral ? 'Encaminhamento obrigatório' : 'Sem encaminhamento obrigatório'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-300">
                      {examType.maxDailyAppointments || 'Ilimitado'} por dia
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-300">
                      {examType.schedule?.length
                        ? examType.schedule.map(schedule => DAYS_OF_WEEK.find(day => day.id === schedule.dayOfWeek)?.name?.slice(0, 3)).join(', ')
                        : 'Não configurado'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                        examType.isGlobal
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                      }`}>
                        {examType.isGlobal ? 'Todas as unidades' : `${examType.unitIds?.length || 0} unidade(s)`}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {canManageTypes ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(examType)}
                            className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:text-primary dark:bg-slate-800 dark:text-slate-300"
                            title="Editar"
                            type="button"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(examType.id)}
                            className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:text-red-600 dark:bg-slate-800 dark:text-slate-300"
                            title="Excluir"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="block text-right text-xs font-bold text-slate-400">Somente leitura</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">Configuração</span>
                <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">
                  {editingId ? 'Editar tipo de exame' : 'Cadastrar tipo de exame'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                type="button"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Nome do exame</span>
                  <input
                    required
                    placeholder="Ex: Hemograma completo"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    value={formData.name || ''}
                    onChange={event => setFormData({ ...formData, name: event.target.value })}
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Cota diária</span>
                  <input
                    type="number"
                    min="1"
                    required
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    value={formData.maxDailyAppointments || ''}
                    onChange={event => setFormData({ ...formData, maxDailyAppointments: parseInt(event.target.value, 10) || 0 })}
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Obrigatoriedade</span>
                  <select
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    value={formData.requiresReferral ? 'yes' : 'no'}
                    onChange={event => setFormData({ ...formData, requiresReferral: event.target.value === 'yes' })}
                  >
                    <option value="yes">Exige encaminhamento</option>
                    <option value="no">Não exige encaminhamento</option>
                  </select>
                </label>
              </div>

              <label>
                <span className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Preparo do paciente</span>
                <textarea
                  placeholder="Ex: Jejum de 8 horas, levar documento com foto e cartão SUS."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  value={formData.preparation || ''}
                  onChange={event => setFormData({ ...formData, preparation: event.target.value })}
                />
              </label>

              <div>
                <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Dias de atendimento</span>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => {
                    const isSelected = (formData.schedule || []).some(schedule => schedule.dayOfWeek === day.id);
                    return (
                      <button
                        type="button"
                        key={day.id}
                        onClick={() => toggleDay(day.id)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-black transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary text-white'
                            : 'border-transparent bg-slate-100 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {day.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={formData.isGlobal}
                    onChange={event => setFormData({ ...formData, isGlobal: event.target.checked })}
                  />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Disponível para todas as unidades</span>
                </label>

                {!formData.isGlobal && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                    <p className="mb-2 text-sm font-bold text-slate-500 dark:text-slate-400">Selecione as unidades onde este exame será ofertado:</p>
                    <div className="max-h-44 space-y-1 overflow-y-auto pr-2">
                      {units.map(unit => (
                        <label key={unit.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-white dark:hover:bg-slate-900">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            checked={(formData.unitIds || []).includes(unit.id)}
                            onChange={() => toggleUnit(unit.id)}
                          />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{unit.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-11 rounded-xl px-5 font-black text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 font-black text-white hover:bg-primary-dark">
                  <CalendarClock className="h-4 w-4" />
                  {editingId ? 'Salvar alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
