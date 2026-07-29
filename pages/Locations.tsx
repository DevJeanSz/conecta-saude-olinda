import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Location, LocationType, User, UserRole } from '../types';
import { LayoutList, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

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
    <div className="locations-page">
      {/* Cabeçalho */}
      <div className="locations-header">
        <div className="locations-header-left">
          <span className="locations-icon"><LayoutList size={22} /></span>
          <div>
            <h1>Salas e Guichês</h1>
            <p>Gerencie os locais de atendimento da unidade</p>
          </div>
        </div>
        {canEdit(user.role) && (
          <button
            className="button button-primary"
            onClick={() => { setShowForm(true); setFormNumber(''); }}
            type="button"
          >
            <Plus size={18} /> Novo local
          </button>
        )}
      </div>

      {/* Alertas */}
      {error && (
        <div className="alert alert-error" role="alert">{error}</div>
      )}
      {success && (
        <div className="alert alert-success" role="status">{success}</div>
      )}

      {/* Formulário de novo local */}
      {showForm && canEdit(user.role) && (
        <div className="locations-form-card">
          <h3 className="locations-form-title">Cadastrar novo local</h3>
          <div className="locations-form-row">
            <div className="locations-form-group">
              <label htmlFor="loc-type">Tipo *</label>
              <select
                id="loc-type"
                value={formType}
                onChange={e => setFormType(e.target.value as LocationType)}
              >
                <option value="GUICHE">Guichê</option>
                <option value="SALA">Sala</option>
                <option value="MESA">Mesa</option>
              </select>
            </div>
            <div className="locations-form-group">
              <label htmlFor="loc-number">Número *</label>
              <input
                id="loc-number"
                type="number"
                min={1}
                max={999}
                placeholder="Ex: 1"
                value={formNumber}
                onChange={e => setFormNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="locations-form-preview">
              {formNumber && parseInt(formNumber) > 0
                ? <strong>{TYPE_DISPLAY[formType]} {String(parseInt(formNumber)).padStart(2, '0')}</strong>
                : <span className="preview-placeholder">Pré-visualização</span>}
            </div>
          </div>
          <div className="locations-form-actions">
            <button
              className="button button-secondary"
              onClick={() => setShowForm(false)}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="button button-primary"
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
        <div className="locations-loading">Carregando locais...</div>
      ) : locations.length === 0 ? (
        <div className="locations-empty">
          <LayoutList size={48} />
          <p>Nenhum local cadastrado ainda.</p>
          {canEdit(user.role) && (
            <p className="locations-empty-hint">Clique em "Novo local" para começar.</p>
          )}
        </div>
      ) : (
        <div className="locations-grid">
          {(['GUICHE', 'SALA', 'MESA'] as LocationType[]).map(type => {
            const items = locations
              .filter(l => l.type === type)
              .sort((a, b) => a.number - b.number);
            if (items.length === 0) return null;
            return (
              <section key={type} className="locations-group">
                <h2 className="locations-group-title">{TYPE_LABELS[type]}s</h2>
                <div className="locations-list">
                  {items.map(loc => (
                    <div
                      key={loc.id}
                      className={`locations-item${!loc.active ? ' inactive' : ''}`}
                    >
                      <div className="locations-item-name">
                        <span className={`locations-badge badge-${type.toLowerCase()}`}>
                          {type === 'GUICHE' ? 'G' : type[0]}
                        </span>
                        <strong>{loc.name}</strong>
                      </div>
                      <div className="locations-item-actions">
                        <span className={`locations-status${loc.active ? ' status-active' : ' status-inactive'}`}>
                          {loc.active ? 'Ativo' : 'Inativo'}
                        </span>
                        {canEdit(user.role) && (
                          <button
                            className="btn-icon"
                            onClick={() => handleToggle(loc)}
                            title={loc.active ? 'Desativar' : 'Ativar'}
                            type="button"
                            aria-label={loc.active ? `Desativar ${loc.name}` : `Ativar ${loc.name}`}
                          >
                            {loc.active
                              ? <ToggleRight size={22} style={{ color: '#16a34a' }} />
                              : <ToggleLeft size={22} style={{ color: '#94a3b8' }} />}
                          </button>
                        )}
                        {canDelete(user.role) && (
                          <button
                            className="btn-icon btn-icon-danger"
                            onClick={() => handleDelete(loc)}
                            title={`Excluir ${loc.name}`}
                            type="button"
                            aria-label={`Excluir ${loc.name}`}
                          >
                            <Trash2 size={17} />
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
