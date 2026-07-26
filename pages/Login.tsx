import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { User } from '../types';
import {
  ArrowLeft,
  BriefcaseMedical,
  CreditCard,
  Lock,
  Loader2,
  Menu,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
} from 'lucide-react';
import logo from '@/src/assets/images/conectasaudeolinda.png';
import prefeituraLogo from '@/src/assets/images/prefeitura-olinda.png';
import olindaOrla from '@/src/assets/images/olinda-orla.png';

interface LoginProps {
  onLogin: (user: User) => void;
  initialMode?: LoginMode;
  lockedMode?: LoginMode;
}

type LoginMode = 'PROFESSIONAL' | 'PATIENT';

const loginSlogan = 'A saúde de Olinda em um só lugar';

const bannerStyle: React.CSSProperties = {
  backgroundImage: `linear-gradient(90deg, rgba(4, 36, 91, 0.94) 0%, rgba(4, 61, 137, 0.76) 48%, rgba(4, 61, 137, 0.28) 100%), url(${olindaOrla})`,
  backgroundPosition: 'center 46%',
};

const MunicipalStripe = ({ className = 'w-3' }: { className?: string }) => (
  <div className={`flex flex-col overflow-hidden ${className}`}>
    <div className="flex-1 bg-primary" />
    <div className="flex-1 bg-yellow-400" />
    <div className="flex-1 bg-red-500" />
    <div className="flex-1 bg-green-600" />
  </div>
);

export const Login: React.FC<LoginProps> = ({ onLogin, initialMode = 'PATIENT', lockedMode }) => {
  const [mode, setMode] = useState<LoginMode>(lockedMode ?? initialMode);
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [patientName, setPatientName] = useState('');
  const [susNumber, setSusNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successUnit, setSuccessUnit] = useState('');

  const switchMode = (nextMode: LoginMode) => {
    setMode(nextMode);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = mode === 'PROFESSIONAL'
        ? await api.auth.loginProfessional(matricula, password)
        : await api.auth.loginPatient(patientName, susNumber);

      if (!response) {
        setError(mode === 'PROFESSIONAL'
          ? 'Credenciais inválidas. Verifique matrícula e senha.'
          : 'Paciente não encontrado. Verifique nome e Cartão SUS.'
        );
        setLoading(false);
        return;
      }

      if (response.unit) {
        setSuccessUnit(response.unit.name);
      }

      window.setTimeout(() => {
        onLogin(response.user);
      }, 700);
    } catch {
      setError('Erro ao conectar ao servidor.');
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#F4F8FC] text-slate-900 font-sans flex flex-col">
      <header className="shrink-0 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto h-14 sm:h-20 px-3 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <img src={prefeituraLogo} alt="Prefeitura de Olinda" className="h-8 sm:h-11 w-auto object-contain shrink-0" />
            <div className="hidden sm:block h-10 w-px bg-slate-200" />
            <img src={logo} alt="Conecta Saúde Olinda" className="h-10 sm:h-14 w-auto object-contain shrink-0" />
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-600">
            <Link to="/" className="text-primary">Início</Link>
            <Link to="/cadastro" className="hover:text-primary transition-colors">Cadastro</Link>
          </nav>

          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-yellow-400 px-4 py-2 text-slate-950 font-black">
            <Lock className="w-4 h-4" />
            Entrar
          </div>

          <button type="button" className="sm:hidden w-9 h-9 rounded-lg border border-slate-200 text-primary flex items-center justify-center">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 px-3 sm:px-6 py-2 sm:py-4">
        <div className="max-w-6xl mx-auto h-full flex flex-col min-h-0">
          <section
            className="relative h-24 sm:h-36 lg:h-44 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-cover shadow-lg shadow-blue-900/10"
            style={bannerStyle}
          >
            <MunicipalStripe className="absolute inset-y-0 left-0 z-10 w-3 sm:w-6" />
            <div className="relative z-20 h-full pl-7 sm:pl-12 pr-4 flex flex-col justify-center text-white">
              <h1 className="max-w-xl text-xl sm:text-3xl lg:text-4xl font-black leading-tight drop-shadow">
                {loginSlogan}
              </h1>
              <p className="hidden sm:block mt-3 text-base font-semibold text-blue-50">
                Acesso seguro aos serviços da rede municipal.
              </p>
            </div>
          </section>

          <section className="relative z-30 -mt-4 sm:-mt-7 mx-auto w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl shadow-blue-900/10 p-3 sm:p-5 lg:p-6">
            {successUnit ? (
              <div className="h-[330px] sm:h-[380px] flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-green-50 text-green-700 border border-green-100 flex items-center justify-center mb-5">
                  <ShieldCheck className="w-9 h-9" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Acesso permitido</h2>
                <p className="text-sm text-slate-500 mt-2">Redirecionando para sua unidade.</p>
                <p className="text-primary font-black mt-1">{successUnit}</p>
                <Loader2 className="w-7 h-7 animate-spin text-primary mt-7" />
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-black text-primary">Acesse sua conta</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Informe seus dados para entrar no portal.</p>
                </div>

                <div className="mt-3 sm:mt-5 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => switchMode('PATIENT')}
                    className={`h-10 rounded-md text-sm font-black flex items-center justify-center gap-2 transition-colors ${
                      mode === 'PATIENT' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    <UserIcon className="w-4 h-4" />
                    Paciente
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('PROFESSIONAL')}
                    className={`h-10 rounded-md text-sm font-black flex items-center justify-center gap-2 transition-colors ${
                      mode === 'PROFESSIONAL' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    <BriefcaseMedical className="w-4 h-4" />
                    Profissional
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-3 sm:mt-4 space-y-2.5 sm:space-y-3">
                  {mode === 'PATIENT' ? (
                    <>
                      <div>
                        <label className="block text-sm font-black text-slate-700 mb-1">Nome completo</label>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                          <input
                            type="text"
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            placeholder="Digite seu nome completo"
                            className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white text-slate-900 placeholder-slate-400 font-semibold"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-black text-slate-700 mb-1">Cartão SUS</label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                          <input
                            type="text"
                            value={susNumber}
                            onChange={(e) => setSusNumber(e.target.value)}
                            placeholder="Digite o número do Cartão SUS"
                            className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white text-slate-900 placeholder-slate-400 font-semibold"
                            required
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-black text-slate-700 mb-1">Matrícula</label>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                          <input
                            type="text"
                            value={matricula}
                            onChange={(e) => setMatricula(e.target.value)}
                            placeholder="Digite sua matrícula"
                            className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white text-slate-900 placeholder-slate-400 font-semibold"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-black text-slate-700 mb-1">Senha</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Digite sua senha"
                            className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white text-slate-900 placeholder-slate-400 font-semibold"
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {error && (
                    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-primary hover:bg-primary-dark text-white rounded-lg font-black transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/15"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                    Entrar
                  </button>
                </form>

                <div className="mt-3 text-center text-sm">
                  {mode === 'PATIENT' ? (
                    <Link
                      to="/cadastro"
                      className="h-10 border border-green-600 text-green-700 rounded-lg font-black hover:bg-green-50 flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Criar cadastro
                    </Link>
                  ) : (
                    <button type="button" className="text-primary font-black hover:underline">
                      Esqueci minha senha
                    </button>
                  )}
                </div>

                <Link
                  to="/"
                  className="mt-2 h-8 flex items-center justify-center gap-2 text-primary hover:text-primary-dark font-black text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao início
                </Link>
              </>
            )}
          </section>
        </div>
      </main>

      <footer className="shrink-0 bg-white border-t border-slate-200">
        <div className="h-2 flex">
          <div className="flex-1 bg-primary" />
          <div className="flex-1 bg-green-500" />
          <div className="flex-1 bg-yellow-400" />
          <div className="flex-1 bg-red-500" />
        </div>
        <div className="h-7 sm:h-9 px-4 flex items-center justify-center text-center text-[10px] sm:text-[11px] font-semibold text-slate-500">
          Prefeitura Municipal de Olinda. Trabalho presente, futuro pra gente.
        </div>
      </footer>
    </div>
  );
};
