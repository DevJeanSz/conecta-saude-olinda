import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BriefcaseMedical,
  CalendarCheck2,
  CreditCard,
  Lock,
  Loader2,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { BrandLockup } from '../components/BrandLockup';
import { PernambucoStripe } from '../components/VisualPrimitives';

interface LoginProps {
  onLogin: (user: User) => void;
  initialMode?: LoginMode;
  lockedMode?: LoginMode;
}

type LoginMode = 'PROFESSIONAL' | 'PATIENT';

function AuthFeature({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="auth-feature">
      <span>
        <Icon size={20} aria-hidden="true" />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}

export const Login: React.FC<LoginProps> = ({ onLogin, initialMode = 'PATIENT', lockedMode }) => {
  const [mode, setMode] = useState<LoginMode>(lockedMode ?? initialMode);
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [patientName, setPatientName] = useState('');
  const [susNumber, setSusNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successUnit, setSuccessUnit] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  React.useEffect(() => {
    const savedMode = localStorage.getItem('login_mode') as LoginMode;
    if (savedMode && !lockedMode) {
      setMode(savedMode);
    }
    
    if (savedMode === 'PATIENT') {
      const savedName = localStorage.getItem('patient_name');
      const savedSus = localStorage.getItem('sus_number');
      if (savedName) setPatientName(savedName);
      if (savedSus) {
        setSusNumber(savedSus);
        setRememberMe(true);
      }
    } else {
      const savedMatricula = localStorage.getItem('prof_matricula');
      if (savedMatricula) {
        setMatricula(savedMatricula);
        setRememberMe(true);
      }
    }
  }, [lockedMode]);

  const switchMode = (nextMode: LoginMode) => {
    if (lockedMode) return;
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

      // Save credentials if remember me is checked
      localStorage.setItem('login_mode', mode);
      if (rememberMe) {
        if (mode === 'PATIENT') {
          localStorage.setItem('patient_name', patientName);
          localStorage.setItem('sus_number', susNumber);
        } else {
          localStorage.setItem('prof_matricula', matricula);
        }
      } else {
        localStorage.removeItem('patient_name');
        localStorage.removeItem('sus_number');
        localStorage.removeItem('prof_matricula');
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
    <main className="auth-page">
      <PernambucoStripe />
      <section className="auth-visual">
        <div className="auth-visual-pattern" aria-hidden="true" />
        <Link className="auth-back" to="/">
          <ArrowLeft size={18} /> Página Inicial
        </Link>
        <BrandLockup light />
        <div className="auth-message">
          <span>Conexão que cuida</span>
          <h1>A saúde de Olinda em um só lugar.</h1>
          <p>Acesse seus serviços com segurança, rapidez e informação clara.</p>
          <div className="auth-feature-list">
            <AuthFeature
              icon={CalendarCheck2}
              text="Escolha unidade, especialidade e horário."
              title="Agendamento simplificado"
            />
            <AuthFeature
              icon={ShieldCheck}
              text="Informações pessoais protegidas."
              title="Acesso seguro"
            />
            <AuthFeature
              icon={Bell}
              text="Lembretes de consultas e exames."
              title="Você sempre informado"
            />
          </div>
        </div>
        <p className="photo-credit">Vista do Alto da Sé • Foto: Prefeitura de Olinda</p>
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <BrandLockup />
        </div>
        <div className="auth-card">
          {successUnit ? (
            <div className="auth-success">
              <span>
                <ShieldCheck size={38} aria-hidden="true" />
              </span>
              <h2>Acesso permitido</h2>
              <p>Redirecionando para sua unidade.</p>
              <strong>{successUnit}</strong>
              <Loader2 className="loading-spin" size={28} aria-hidden="true" />
            </div>
          ) : (
            <>
              <span className="form-kicker">
                <span />
                Portal seguro
              </span>
              <h2>Acesse sua conta</h2>
              <p>Informe seus dados para continuar.</p>

              <div className="mode-switch" role="tablist" aria-label="Tipo de acesso">
                <button
                  aria-selected={mode === 'PATIENT'}
                  className={mode === 'PATIENT' ? 'active' : ''}
                  onClick={() => switchMode('PATIENT')}
                  role="tab"
                  type="button"
                >
                  <UserIcon size={18} /> Paciente
                </button>
                <button
                  aria-selected={mode === 'PROFESSIONAL'}
                  className={mode === 'PROFESSIONAL' ? 'active' : ''}
                  onClick={() => switchMode('PROFESSIONAL')}
                  role="tab"
                  type="button"
                >
                  <BriefcaseMedical size={18} /> Profissional
                </button>
              </div>

              <form className="auth-form" onSubmit={handleSubmit}>
                {mode === 'PATIENT' ? (
                  <>
                    <label>
                      Nome completo
                      <span className="input-wrap">
                        <UserIcon size={19} />
                        <input
                          aria-label="Nome completo"
                          onChange={(e) => setPatientName(e.target.value)}
                          placeholder="Digite seu nome completo"
                          required
                          value={patientName}
                        />
                      </span>
                    </label>
                    <label>
                      Cartão SUS
                      <span className="input-wrap">
                        <CreditCard size={19} />
                        <input
                          aria-label="Cartão SUS"
                          inputMode="numeric"
                          onChange={(e) => setSusNumber(e.target.value)}
                          placeholder="000 0000 0000 0000"
                          required
                          value={susNumber}
                        />
                      </span>
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Matrícula
                      <span className="input-wrap">
                        <CreditCard size={19} />
                        <input
                          aria-label="Matrícula"
                          onChange={(e) => setMatricula(e.target.value)}
                          placeholder="Digite sua matrícula"
                          required
                          value={matricula}
                        />
                      </span>
                    </label>
                    <label>
                      Senha
                      <span className="input-wrap">
                        <Lock size={19} />
                        <input
                          aria-label="Senha"
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Digite sua senha"
                          required
                          type="password"
                          value={password}
                        />
                      </span>
                    </label>
                  </>
                )}

                {error && (
                  <div className="auth-error" role="alert">
                    {error}
                  </div>
                )}

                <div className="form-helper-row">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    /> <span>Lembrar meus dados</span>
                  </label>
                  <button className="link-button" type="button">
                    Preciso de ajuda
                  </button>
                </div>

                <button className="button button-primary auth-submit" disabled={loading} type="submit">
                  {loading ? <Loader2 className="loading-spin" size={19} /> : 'Entrar no portal'}
                  {!loading && <ArrowRight size={19} />}
                </button>
              </form>

              {mode === 'PATIENT' ? (
                <div className="register-callout">
                  <span>Primeiro acesso?</span>
                  <Link to="/register">Faça seu cadastro gratuito</Link>
                </div>
              ) : (
                <div className="register-callout">
                  <span>Acesso profissional</span>
                  <button className="link-button" type="button">Esqueci minha senha</button>
                </div>
              )}

              <div className="privacy-note">
                <ShieldCheck size={16} />
                Ambiente protegido conforme a Lei Geral de Proteção de Dados.
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
};
