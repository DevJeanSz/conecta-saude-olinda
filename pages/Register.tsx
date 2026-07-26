import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { HealthUnit } from '../types';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Home,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
} from 'lucide-react';
import prefeituraLogo from '@/src/assets/images/prefeitura-olinda-oficial.svg';
import { BrandLockup } from '../components/BrandLockup';

const steps = [
  { title: 'Dados', description: 'Identificação do paciente' },
  { title: 'Endereço', description: 'Local de residência' },
  { title: 'Unidade', description: 'Referência de atendimento' },
];

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [units, setUnits] = useState<HealthUnit[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    rg: '',
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
    api.units.getAll()
      .then((availableUnits) => {
        setUnits(availableUnits);
        if (availableUnits.length === 1) {
          setFormData(prev => ({ ...prev, unitId: availableUnits[0].id }));
        }
      })
      .catch(() => setUnits([]));
  }, []);

  const inputClass = 'w-full h-10 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white text-sm text-slate-900 placeholder-slate-400 font-semibold';
  const labelClass = 'block text-xs font-black text-slate-700 mb-1';

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

  const handleRgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9xX]/g, '').toUpperCase().slice(0, 9);
    value = value.replace(/(\d{2})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})([0-9X])$/, '$1-$2');
    setFormData(prev => ({ ...prev, rg: value }));
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
    setFormData(prev => ({ ...prev, cep: formattedCep }));

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
  };

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
      if (formData.rg && formData.rg.replace(/[^0-9X]/gi, '').length < 5) {
        setError('RG inválido. Verifique o número digitado.');
        return false;
      }

      if (!formData.unitId) {
        setError('Selecione a unidade de referência.');
        return false;
      }
    }

    return true;
  };

  const goNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep(step => Math.min(step + 1, steps.length - 1));
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
      formData.rg ? `RG: ${formData.rg}` : '',
    ].filter(Boolean).join('. ');

    try {
      const response = await api.auth.registerPatient({
        name: formData.name,
        rg: formData.rg,
        cpf: formData.cpf,
        birthDate: formData.birthDate,
        address: fullAddress,
        cep: formData.cep,
        phone: formData.phone,
        susNumber: formData.susNumber,
        email: formData.email,
        unitId: formData.unitId,
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
    <div className="h-screen overflow-hidden bg-[#F4F8FC] text-slate-900 font-sans flex flex-col">
      <header className="shrink-0 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src={prefeituraLogo} alt="Prefeitura de Olinda" className="h-8 sm:h-11 w-auto object-contain shrink-0" />
            <div className="h-10 w-px bg-slate-200" />
            <BrandLockup compact />
          </div>

          <Link to="/login" className="hidden sm:flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-primary font-black text-sm">
            <ArrowLeft className="w-4 h-4" />
            Fazer login
          </Link>
        </div>
      </header>

      <main className="flex-1 min-h-0 px-4 sm:px-6 py-2 sm:py-4 lg:py-6">
        <div className="max-w-6xl mx-auto h-full grid lg:grid-cols-[minmax(360px,520px)_1fr] gap-6 items-center">
          <section className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-blue-900/5 p-3 sm:p-6 w-full max-w-xl mx-auto">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950">Crie sua conta</h1>
              <p className="text-primary text-base sm:text-lg font-bold mt-1">Portal do Paciente</p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {steps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => index < currentStep && setCurrentStep(index)}
                  className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                    index === currentStep
                      ? 'border-primary bg-blue-50 text-primary'
                      : index < currentStep
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                      index < currentStep ? 'bg-green-600 text-white' : index === currentStep ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {index < currentStep ? <Check className="w-3 h-3" /> : index + 1}
                    </span>
                    <span className="text-xs font-black">{step.title}</span>
                  </div>
                  <p className="hidden sm:block text-[11px] font-semibold mt-1 opacity-80">{step.description}</p>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-4">
              {currentStep === 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelClass}>Nome completo</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      <input className={`${inputClass} pl-10`} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nome do paciente" required />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>CPF</label>
                    <input className={inputClass} value={formData.cpf} onChange={handleCpfChange} placeholder="000.000.000-00" maxLength={14} required />
                  </div>

                  <div>
                    <label className={labelClass}>Nascimento</label>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      <input type="date" className={`${inputClass} pl-10`} value={formData.birthDate} onChange={e => setFormData({ ...formData, birthDate: e.target.value })} required />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      <input type="tel" className={`${inputClass} pl-10`} value={formData.phone} onChange={handlePhoneChange} placeholder="(00) 00000-0000" maxLength={15} required />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Cartão SUS</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      <input className={`${inputClass} pl-10`} value={formData.susNumber} onChange={e => setFormData({ ...formData, susNumber: e.target.value })} placeholder="Número SUS" required />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className={labelClass}>E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      <input type="email" className={`${inputClass} pl-10`} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" required />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>CEP</label>
                    <input className={inputClass} value={formData.cep} onChange={handleCepChange} placeholder="00000-000" maxLength={9} required />
                  </div>

                  <div>
                    <label className={labelClass}>Número</label>
                    <input className={inputClass} value={addressDetails.number} onChange={e => updateAddressDetails('number', e.target.value)} placeholder="Nº ou S/N" required />
                  </div>

                  <div className="col-span-2">
                    <label className={labelClass}>Logradouro</label>
                    <div className="relative">
                      <Home className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      <input className={`${inputClass} pl-10`} value={addressDetails.street} onChange={e => updateAddressDetails('street', e.target.value)} placeholder="Rua, avenida ou travessa" required />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Bairro</label>
                    <input className={inputClass} value={addressDetails.neighborhood} onChange={e => updateAddressDetails('neighborhood', e.target.value)} placeholder="Bairro" required />
                  </div>

                  <div className="grid grid-cols-[1fr_72px] gap-2">
                    <div>
                      <label className={labelClass}>Cidade</label>
                      <input className={inputClass} value={addressDetails.city} onChange={e => updateAddressDetails('city', e.target.value)} placeholder="Cidade" required />
                    </div>
                    <div>
                      <label className={labelClass}>UF</label>
                      <input className={inputClass} value={addressDetails.state} onChange={e => updateAddressDetails('state', e.target.value.toUpperCase())} placeholder="PE" maxLength={2} required />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className={labelClass}>Complemento opcional</label>
                    <input className={inputClass} value={addressDetails.complement} onChange={e => updateAddressDetails('complement', e.target.value)} placeholder="Apto, bloco, ponto de referência" />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>RG opcional</label>
                      <input className={inputClass} value={formData.rg} onChange={handleRgChange} placeholder="00.000.000-0" maxLength={12} />
                    </div>
                    <div>
                      <label className={labelClass}>Unidade</label>
                      <select className={inputClass} value={formData.unitId} onChange={e => setFormData({ ...formData, unitId: e.target.value })} required>
                        <option value="">{units.length ? 'Selecione' : 'Indisponível'}</option>
                        {units.map(unit => (
                          <option key={unit.id} value={unit.id}>{unit.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 flex gap-3">
                    <Lock className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h2 className="font-black text-primary">Cadastro seguro e gratuito</h2>
                      <p className="text-sm text-slate-600 mt-1">
                        Após concluir, sua conta ficará vinculada à unidade escolhida para acesso ao portal do paciente.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase text-slate-500">Resumo</p>
                    <p className="mt-1 font-black text-slate-900 truncate">{formData.name || 'Nome do paciente'}</p>
                    <p className="text-sm text-slate-600 truncate">{formData.email || 'E-mail não informado'}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
                  {error}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                {currentStep > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="h-11 px-4 rounded-lg border border-slate-300 text-slate-700 font-black flex items-center gap-2 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Voltar
                  </button>
                ) : (
                  <Link to="/login" className="h-11 px-4 rounded-lg border border-slate-300 text-slate-700 font-black flex items-center gap-2 hover:bg-slate-50">
                    <ArrowLeft className="w-5 h-5" />
                    Login
                  </Link>
                )}

                {currentStep < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="h-11 px-5 rounded-lg bg-primary hover:bg-primary-dark text-white font-black flex items-center gap-2"
                  >
                    Continuar
                    <ChevronRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-11 px-5 rounded-lg bg-primary hover:bg-primary-dark text-white font-black flex items-center gap-2 disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                    Criar conta
                  </button>
                )}
              </div>
            </form>
          </section>

          <aside className="hidden lg:block">
            <div className="border-l border-slate-200 pl-10">
              <p className="text-3xl font-black text-primary leading-tight">Cadastro rápido para o cidadão.</p>
              <p className="text-3xl font-black text-green-700 leading-tight">Acesso mais simples à saúde.</p>

              <div className="mt-8 space-y-5">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-primary flex items-center justify-center shrink-0">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-black text-slate-900">Identificação do paciente</h2>
                    <p className="text-sm text-slate-600 mt-1 max-w-sm">Dados básicos para localizar sua conta com segurança.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-50 text-green-700 flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-black text-slate-900">Endereço de referência</h2>
                    <p className="text-sm text-slate-600 mt-1 max-w-sm">Informações para orientar o vínculo com a rede municipal.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-black text-slate-900">Unidade de saúde</h2>
                    <p className="text-sm text-slate-600 mt-1 max-w-sm">Escolha onde seu cadastro ficará vinculado para atendimentos.</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-xl border border-blue-100 bg-white px-5 py-4 flex gap-3 items-center text-primary">
                <ShieldCheck className="w-7 h-7 shrink-0" />
                <p className="text-sm font-bold">Seus dados são protegidos conforme a Lei Geral de Proteção de Dados.</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="shrink-0 bg-white border-t border-slate-200">
        <div className="h-2 flex">
          <div className="flex-1 bg-primary" />
          <div className="flex-1 bg-green-500" />
          <div className="flex-1 bg-yellow-400" />
          <div className="flex-1 bg-red-500" />
        </div>
        <div className="h-8 sm:h-10 px-4 flex items-center justify-center text-center text-[10px] sm:text-[11px] font-semibold text-slate-500">
          Prefeitura Municipal de Olinda. Cadastro gratuito no Conecta Saúde.
        </div>
      </footer>
    </div>
  );
};
