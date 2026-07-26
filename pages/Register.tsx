import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { HealthUnit } from '../types';
import { MOCK_UNITS } from '../constants';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
} from 'lucide-react';
import { BrandLockup } from '../components/BrandLockup';
import { PernambucoStripe } from '../components/VisualPrimitives';

const registerStepContent = [
  {
    title: 'Seus dados pessoais',
    subtitle: 'Preencha as informações exatamente como estão nos documentos.',
  },
  {
    title: 'Onde você mora',
    subtitle: 'Usaremos seu endereço para encontrar a unidade mais próxima.',
  },
  {
    title: 'Sua unidade de referência',
    subtitle: 'Confirme a unidade básica que acompanhará o seu cuidado.',
  },
];

type RegisterAddressDetails = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  number: string;
  complement: string;
};

const normalizeDigits = (value = '') => value.replace(/\D/g, '');

const normalizeText = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const resolveReferenceUnit = (
  units: HealthUnit[],
  cep: string,
  addressDetails: RegisterAddressDetails,
) => {
  const cepDigits = normalizeDigits(cep);
  if (!units.length || cepDigits.length !== 8) return null;

  const exactCepMatch = units.find((unit) => normalizeDigits(unit.cep || '') === cepDigits);
  if (exactCepMatch) return exactCepMatch;

  const patientNeighborhood = normalizeText(addressDetails.neighborhood);
  const patientCity = normalizeText(addressDetails.city);
  const unitsInSameCity = units.filter((unit) => {
    const unitCity = normalizeText(unit.city);
    return !patientCity || !unitCity || patientCity.includes(unitCity) || unitCity.includes(patientCity);
  });

  if (patientNeighborhood) {
    const neighborhoodMatch = unitsInSameCity.find((unit) => {
      const unitNeighborhood = normalizeText(unit.neighborhood);
      const unitAddress = normalizeText(unit.address);
      return unitNeighborhood === patientNeighborhood || unitAddress.includes(patientNeighborhood);
    });

    if (neighborhoodMatch) return neighborhoodMatch;
  }

  return null;
};

const getUnitAddress = (unit: HealthUnit) =>
  [
    unit.address,
    unit.addressNumber,
    unit.neighborhood,
    unit.city || 'Olinda',
    unit.state,
  ].filter(Boolean).join(', ');

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [units, setUnits] = useState<HealthUnit[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    susNumber: '',
    birthDate: '',
    cep: '',
    phone: '',
    email: '',
    unitId: '',
  });

  const [addressDetails, setAddressDetails] = useState({
    street: '',
    neighborhood: '',
    city: '',
    state: '',
    number: '',
    complement: '',
  });

  useEffect(() => {
    let isMounted = true;

    const loadUnits = async () => {
      const shouldUseLocalUnits = import.meta.env.DEV && !import.meta.env.VITE_API_URL;
      const availableUnits = shouldUseLocalUnits ? MOCK_UNITS : await api.units.getAll();
      const safeUnits = availableUnits.length > 0 ? availableUnits : MOCK_UNITS;

      if (isMounted) {
        setUnits(safeUnits);
      }
    };

    loadUnits();

    return () => {
      isMounted = false;
    };
  }, []);

  const isValidCPF = (cpf: string) => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;

    const split = cpf.split('');
    let v1 = 0;
    let v2 = 0;

    for (let i = 0; i < 9; i++) {
      v1 += parseInt(split[i], 10) * (10 - i);
      v2 += parseInt(split[i], 10) * (11 - i);
    }

    v1 = (v1 * 10) % 11;
    if (v1 === 10 || v1 === 11) v1 = 0;
    if (v1 !== parseInt(split[9], 10)) return false;

    v2 += v1 * 2;
    v2 = (v2 * 10) % 11;
    if (v2 === 10 || v2 === 11) v2 = 0;

    return v2 === parseInt(split[10], 10);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setFormData(prev => ({ ...prev, cpf: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = value;

    if (value.length > 10) {
      formatted = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (value.length > 6) {
      formatted = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      formatted = value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else if (value.length > 0) {
      formatted = value.replace(/^(\d*)/, '($1');
    }

    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '').slice(0, 8);
    const formattedCep = cep.length > 5 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;
    setFormData(prev => ({ ...prev, cep: formattedCep, unitId: '' }));

    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddressDetails(prev => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
          }));
        }
      } catch {
        setError('Não foi possível buscar o CEP automaticamente.');
      }
    }
  };

  const updateAddressDetails = (field: keyof typeof addressDetails, value: string) => {
    setAddressDetails(prev => ({ ...prev, [field]: value }));
    setFormData(prev => ({ ...prev, unitId: '' }));
  };

  const referenceUnit = useMemo(
    () => resolveReferenceUnit(units, formData.cep, addressDetails),
    [addressDetails, formData.cep, units],
  );

  const referenceUnitId = referenceUnit?.id || '';
  const selectedUnitId = referenceUnitId || formData.unitId;
  const canChooseUnitManually = formData.cep.replace(/\D/g, '').length === 8 && !referenceUnit && units.length > 0;
  const displayedUnits = referenceUnit ? [referenceUnit] : units;

  useEffect(() => {
    if (!referenceUnitId) return;
    setFormData(prev => prev.unitId === referenceUnitId ? prev : { ...prev, unitId: referenceUnitId });
  }, [referenceUnitId]);

  const validateStep = (stepIndex: number) => {
    setError('');

    if (stepIndex === 0) {
      if (!formData.name.trim() || !formData.cpf || !formData.susNumber || !formData.birthDate || !formData.phone || !formData.email) {
        setError('Preencha todos os dados pessoais obrigatórios.');
        return false;
      }

      if (!isValidCPF(formData.cpf)) {
        setError('CPF inválido. Verifique o número digitado.');
        return false;
      }

      if (formData.phone.replace(/\D/g, '').length < 10) {
        setError('Telefone inválido. Digite com DDD.');
        return false;
      }
    }

    if (stepIndex === 1) {
      if (formData.cep.replace(/\D/g, '').length !== 8 || !addressDetails.street.trim() || !addressDetails.number.trim() || !addressDetails.neighborhood.trim() || !addressDetails.city.trim() || !addressDetails.state.trim()) {
        setError('Preencha o endereço completo para continuar.');
        return false;
      }
    }

    if (stepIndex === 2) {
      if (!selectedUnitId) {
        setError('Selecione a unidade de referência.');
        return false;
      }
    }

    return true;
  };

  const goNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep(step => Math.min(step + 1, registerStepContent.length - 1));
  };

  const goBack = () => {
    setError('');
    setCurrentStep(step => Math.max(step - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) return;

    setLoading(true);
    setError('');

    const fullAddress = [
      `${addressDetails.street}, ${addressDetails.number}`,
      addressDetails.complement ? `Complemento: ${addressDetails.complement}` : '',
      `Bairro: ${addressDetails.neighborhood}`,
      `${addressDetails.city} - ${addressDetails.state}`,
      `CEP: ${formData.cep}`,
    ].filter(Boolean).join('. ');

    try {
      const response = await api.auth.registerPatient({
        name: formData.name,
        cpf: formData.cpf,
        birthDate: formData.birthDate,
        address: fullAddress,
        cep: formData.cep,
        phone: formData.phone,
        susNumber: formData.susNumber,
        email: formData.email,
        unitId: selectedUnitId,
      });

      if (response) {
        navigate('/login');
      } else {
        setError('Erro ao cadastrar paciente. Verifique os dados.');
      }
    } catch {
      setError('Erro ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">
      <PernambucoStripe />
      <header className="simple-header">
        <Link to="/">
          <BrandLockup />
        </Link>
        <div>
          Já possui cadastro?
          <Link to="/login">Entrar</Link>
        </div>
      </header>

      <section className="register-shell">
        <div className="register-heading">
          <Link to="/login">
            <ArrowLeft size={18} /> Voltar para o login
          </Link>
          <span>Cadastro gratuito</span>
          <h1>Cadastro do paciente</h1>
          <p>Leva poucos minutos e aproxima você dos serviços de saúde.</p>
        </div>

        <ol className="stepper" aria-label="Etapas do cadastro">
          {['Dados', 'Endereço', 'Unidade'].map((label, index) => (
            <li className={index <= currentStep ? 'active' : ''} key={label}>
              <span>{index < currentStep ? <Check size={16} /> : index + 1}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>

        <form className="register-card" onSubmit={handleSubmit}>
          <div className="register-card-heading">
            <span>{currentStep + 1} de 3</span>
            <h2>{registerStepContent[currentStep].title}</h2>
            <p>{registerStepContent[currentStep].subtitle}</p>
          </div>

          {currentStep === 0 && (
            <div className="form-grid">
              <label className="field-full">
                Nome completo
                <input
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Como aparece no seu documento"
                  required
                  value={formData.name}
                />
              </label>
              <label>
                CPF
                <input inputMode="numeric" maxLength={14} onChange={handleCpfChange} placeholder="000.000.000-00" required value={formData.cpf} />
              </label>
              <label>
                Cartão SUS
                <input inputMode="numeric" onChange={e => setFormData({ ...formData, susNumber: e.target.value })} placeholder="000 0000 0000 0000" required value={formData.susNumber} />
              </label>
              <label>
                Data de nascimento
                <input onChange={e => setFormData({ ...formData, birthDate: e.target.value })} required type="date" value={formData.birthDate} />
              </label>
              <label>
                Telefone celular
                <input inputMode="tel" maxLength={15} onChange={handlePhoneChange} placeholder="(81) 90000-0000" required value={formData.phone} />
              </label>
              <label className="field-full">
                E-mail
                <input onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" required type="email" value={formData.email} />
              </label>
            </div>
          )}

          {currentStep === 1 && (
            <div className="form-grid">
              <label>
                CEP
                <input inputMode="numeric" maxLength={9} onChange={handleCepChange} placeholder="00000-000" required value={formData.cep} />
              </label>
              <label>
                Bairro
                <input onChange={e => updateAddressDetails('neighborhood', e.target.value)} placeholder="Bairro" required value={addressDetails.neighborhood} />
              </label>
              <label className="field-full">
                Endereço
                <input onChange={e => updateAddressDetails('street', e.target.value)} placeholder="Rua ou avenida" required value={addressDetails.street} />
              </label>
              <label>
                Número
                <input onChange={e => updateAddressDetails('number', e.target.value)} placeholder="Ex.: 120" required value={addressDetails.number} />
              </label>
              <label>
                Complemento
                <input onChange={e => updateAddressDetails('complement', e.target.value)} placeholder="Casa, apto. (opcional)" value={addressDetails.complement} />
              </label>
              <label>
                Cidade
                <input onChange={e => updateAddressDetails('city', e.target.value)} placeholder="Olinda" required value={addressDetails.city} />
              </label>
              <label>
                UF
                <input maxLength={2} onChange={e => updateAddressDetails('state', e.target.value.toUpperCase())} placeholder="PE" required value={addressDetails.state} />
              </label>
            </div>
          )}

          {currentStep === 2 && (
            <div className="unit-options">
              {units.length === 0 ? (
                <div className="selection-note">
                  <Info size={17} />
                  Nenhuma unidade disponível no momento. Tente novamente mais tarde.
                </div>
              ) : (
                <>
                  <div className={`selection-note ${referenceUnit ? 'selection-note-success' : 'selection-note-warning'}`}>
                    {referenceUnit ? <BadgeCheck size={17} /> : <Info size={17} />}
                    {referenceUnit
                      ? 'Unidade definida automaticamente a partir do CEP informado.'
                      : 'Não encontramos uma unidade única para este CEP. Escolha a unidade de referência abaixo.'}
                  </div>

                  {displayedUnits.map((unit) => (
                    <label className={referenceUnit ? 'unit-locked' : ''} key={unit.id}>
                      <input
                        checked={selectedUnitId === unit.id}
                        name="unit"
                        onChange={() => {
                          if (!canChooseUnitManually) return;
                          setFormData({ ...formData, unitId: unit.id });
                        }}
                        readOnly={!canChooseUnitManually}
                        type="radio"
                      />
                      <span className="unit-radio" />
                      <span className="unit-icon">
                        <Building2 size={21} />
                      </span>
                      <span>
                        <strong>{unit.name}</strong>
                        <small>{getUnitAddress(unit) || 'Unidade municipal de referência'}</small>
                      </span>
                      {referenceUnit && <BadgeCheck className="recommended-icon" size={20} />}
                    </label>
                  ))}
                </>
              )}

              <div className="selection-note">
                <Info size={17} />
                A unidade será vinculada ao seu cadastro para facilitar agendamentos e atendimentos.
              </div>
            </div>
          )}

          {error && (
            <div className="auth-error register-error" role="alert">
              {error}
            </div>
          )}

          <div className="register-actions">
            <button
              className="button button-secondary"
              disabled={currentStep === 0}
              onClick={goBack}
              type="button"
            >
              <ChevronLeft size={18} /> Voltar
            </button>
            {currentStep < registerStepContent.length - 1 ? (
              <button className="button button-primary" onClick={goNext} type="button">
                Continuar
                <ChevronRight size={18} />
              </button>
            ) : (
              <button className="button button-primary" disabled={loading} type="submit">
                {loading ? 'Criando conta' : 'Concluir cadastro'}
                {loading ? <Loader2 className="loading-spin" size={18} /> : <Check size={18} />}
              </button>
            )}
          </div>
        </form>
      </section>

      <footer className="register-footer">
        Prefeitura Municipal de Olinda. Cadastro gratuito no Conecta Saúde.
      </footer>
    </main>
  );
};
