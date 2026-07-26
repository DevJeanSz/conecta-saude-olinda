"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Accessibility,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  Building2,
  Calendar,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Clock3,
  FileText,
  HeartPulse,
  Home,
  IdCard,
  Info,
  ListPlus,
  LockKeyhole,
  LogOut,
  MapPin,
  MapPinned,
  Menu,
  MonitorPlay,
  MoreHorizontal,
  PhoneCall,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube2,
  TrendingDown,
  TrendingUp,
  User,
  UserPlus,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";

type View =
  | "landing"
  | "login"
  | "register"
  | "portal"
  | "dashboard"
  | "reception"
  | "tv";

const viewPaths: Record<View, string> = {
  landing: "/",
  login: "/login",
  register: "/register",
  portal: "/patient-portal",
  dashboard: "/admin",
  reception: "/admin/reception",
  tv: "/display-tv",
};

const pathViews = Object.fromEntries(
  Object.entries(viewPaths).map(([key, value]) => [value, key]),
) as Record<string, View>;

const screenLabels: Record<View, string> = {
  landing: "Inicial",
  login: "Login",
  register: "Cadastro",
  portal: "Cidadão",
  dashboard: "Gestor",
  reception: "Recepção",
  tv: "Painel TV",
};

type Navigate = (view: View) => void;

function Brand({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <span
      className={`brand-lockup${compact ? " brand-compact" : ""}${
        light ? " brand-lockup-light" : ""
      }`}
    >
      <span className="brand-symbol">
        <HeartPulse aria-hidden="true" />
      </span>
      <span className="brand-copy">
        <strong>Conecta Saúde</strong>
        <small>Olinda</small>
      </span>
    </span>
  );
}

function PernambucoStripe() {
  return (
    <div className="pernambuco-stripe" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

function PrototypeNavigator({
  current,
  go,
}: {
  current: View;
  go: Navigate;
}) {
  const [open, setOpen] = useState(false);

  return (
    <aside className={`prototype-nav${open ? " is-open" : ""}`}>
      {open && (
        <div className="prototype-nav-panel">
          <div>
            <strong>Mapa de telas</strong>
            <button
              aria-label="Fechar mapa de telas"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X size={17} />
            </button>
          </div>
          <p>Navegue pelo protótipo completo.</p>
          <nav aria-label="Telas do protótipo">
            {(Object.keys(screenLabels) as View[]).map((view) => (
              <button
                className={current === view ? "active" : ""}
                key={view}
                onClick={() => {
                  go(view);
                  setOpen(false);
                }}
                type="button"
              >
                <span>{screenLabels[view]}</span>
                <ArrowRight size={15} />
              </button>
            ))}
          </nav>
        </div>
      )}
      <button
        className="prototype-nav-trigger"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <CircleGauge size={18} />
        Ver todas as telas
      </button>
    </aside>
  );
}

const landingServices = [
  {
    icon: CalendarDays,
    title: "Consultas sem complicação",
    description:
      "Encontre a unidade, a especialidade e o melhor horário para você.",
  },
  {
    icon: Stethoscope,
    title: "Cuidado acompanhado",
    description:
      "Consulte seus atendimentos, exames e orientações em um só lugar.",
  },
  {
    icon: MapPin,
    title: "Rede perto de você",
    description:
      "Veja as unidades municipais, horários e serviços disponíveis.",
  },
];

function Landing({ go }: { go: Navigate }) {
  return (
    <main className="landing-page">
      <PernambucoStripe />
      <header className="landing-header">
        <button
          className="brand-button"
          onClick={() => go("landing")}
          type="button"
        >
          <Brand />
        </button>

        <nav className="landing-nav" aria-label="Navegação principal">
          <a href="#servicos">Serviços</a>
          <a href="#projeto">Sobre o projeto</a>
          <a href="#unidades">Unidades</a>
        </nav>

        <button
          className="button button-primary header-action"
          onClick={() => go("login")}
          type="button"
        >
          Acessar portal
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-image" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-two" aria-hidden="true" />

        <div className="hero-content">
          <div className="eyebrow">
            <span className="eyebrow-icon">
              <Sparkles size={15} aria-hidden="true" />
            </span>
            Saúde pública mais conectada
          </div>

          <h1>
            Mais perto da sua saúde, <span>mais perto de você.</span>
          </h1>
          <p>
            Uma plataforma municipal para facilitar o acesso, organizar
            atendimentos e cuidar melhor das pessoas em Olinda.
          </p>

          <div className="hero-actions">
            <button
              className="button button-yellow"
              onClick={() => go("login")}
              type="button"
            >
              Acessar portal
              <ArrowRight size={20} aria-hidden="true" />
            </button>
            <a className="button button-ghost" href="#projeto">
              Conhecer projeto
            </a>
          </div>

          <div className="trust-row">
            <span>
              <CheckCircle2 size={18} aria-hidden="true" />
              Gratuito para o cidadão
            </span>
            <span>
              <ShieldCheck size={18} aria-hidden="true" />
              Dados protegidos
            </span>
            <span>
              <Accessibility size={18} aria-hidden="true" />
              Acessível para todos
            </span>
          </div>
        </div>

        <aside className="hero-service-card" aria-label="Resumo do serviço">
          <div className="hero-card-top">
            <span className="live-dot" aria-hidden="true" />
            Rede municipal conectada
          </div>
          <strong>Seu cuidado começa aqui</strong>
          <div className="hero-card-grid">
            <button onClick={() => go("login")} type="button">
              <CalendarDays size={22} aria-hidden="true" />
              <span>Agende</span>
              <small>sua consulta</small>
            </button>
            <button onClick={() => go("login")} type="button">
              <Users size={22} aria-hidden="true" />
              <span>Acompanhe</span>
              <small>seu atendimento</small>
            </button>
          </div>
        </aside>
      </section>

      <section className="services-section" id="servicos">
        <div className="section-heading">
          <span>Feito para cuidar</span>
          <h2>Saúde municipal de um jeito mais simples</h2>
          <p>
            Informação clara e acesso rápido para pacientes, profissionais e
            gestores da rede pública de Olinda.
          </p>
        </div>

        <div className="service-grid">
          {landingServices.map(({ icon: Icon, title, description }) => (
            <article className="service-card" key={title}>
              <span className="service-icon">
                <Icon size={24} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
              <button onClick={() => go("login")} type="button">
                Acessar serviço <ArrowRight size={17} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="municipal-section" id="projeto">
        <div>
          <span className="municipal-kicker">Prefeitura Municipal de Olinda</span>
          <h2>Uma rede inteira trabalhando em conexão</h2>
          <p>
            O Conecta Saúde Olinda aproxima o cidadão dos serviços municipais e
            dá às equipes uma visão mais clara de cada atendimento.
          </p>
        </div>
        <div className="municipal-stat">
          <strong>24h</strong>
          <span>acesso às suas informações</span>
        </div>
        <div className="municipal-stat" id="unidades">
          <strong>1 só</strong>
          <span>portal para toda a rede</span>
        </div>
      </section>

      <section className="access-section" id="acesso">
        <div>
          <span>Comece agora</span>
          <h2>Seu acesso à saúde de Olinda em um só lugar.</h2>
        </div>
        <button
          className="button button-primary"
          onClick={() => go("login")}
          type="button"
        >
          Entrar no Conecta Saúde
          <ArrowRight size={19} aria-hidden="true" />
        </button>
      </section>

      <footer className="landing-footer">
        <Brand light />
        <p>Prefeitura Municipal de Olinda • Saúde pública mais conectada.</p>
      </footer>
    </main>
  );
}

function AuthFeature({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
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

function Login({ go }: { go: Navigate }) {
  const [mode, setMode] = useState<"patient" | "professional">("patient");

  return (
    <main className="auth-page">
      <PernambucoStripe />
      <section className="auth-visual">
        <div className="auth-visual-pattern" aria-hidden="true" />
        <button
          className="auth-back"
          onClick={() => go("landing")}
          type="button"
        >
          <ArrowLeft size={18} /> Voltar ao site
        </button>
        <Brand light />
        <div className="auth-message">
          <span>Conexão que cuida</span>
          <h1>A saúde de Olinda em um só lugar.</h1>
          <p>
            Acesse seus serviços com segurança, rapidez e informação clara.
          </p>
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
        <p className="photo-credit">
          Vista do Alto da Sé • Foto: Prefeitura de Olinda
        </p>
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-card">
          <span className="form-kicker">
            <span />
            Portal seguro
          </span>
          <h2>Acesse sua conta</h2>
          <p>Informe seus dados para continuar.</p>

          <div className="mode-switch" role="tablist" aria-label="Tipo de acesso">
            <button
              aria-selected={mode === "patient"}
              className={mode === "patient" ? "active" : ""}
              onClick={() => setMode("patient")}
              role="tab"
              type="button"
            >
              <User size={18} /> Paciente
            </button>
            <button
              aria-selected={mode === "professional"}
              className={mode === "professional" ? "active" : ""}
              onClick={() => setMode("professional")}
              role="tab"
              type="button"
            >
              <Stethoscope size={18} /> Profissional
            </button>
          </div>

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              go(mode === "patient" ? "portal" : "dashboard");
            }}
          >
            {mode === "patient" ? (
              <>
                <label>
                  Nome completo
                  <span className="input-wrap">
                    <User size={19} />
                    <input
                      aria-label="Nome completo"
                      placeholder="Digite seu nome completo"
                      required
                    />
                  </span>
                </label>
                <label>
                  Cartão SUS
                  <span className="input-wrap">
                    <IdCard size={19} />
                    <input
                      aria-label="Cartão SUS"
                      inputMode="numeric"
                      placeholder="000 0000 0000 0000"
                      required
                    />
                  </span>
                </label>
              </>
            ) : (
              <>
                <label>
                  Matrícula
                  <span className="input-wrap">
                    <IdCard size={19} />
                    <input
                      aria-label="Matrícula"
                      placeholder="Digite sua matrícula"
                      required
                    />
                  </span>
                </label>
                <label>
                  Senha
                  <span className="input-wrap">
                    <LockKeyhole size={19} />
                    <input
                      aria-label="Senha"
                      placeholder="Digite sua senha"
                      required
                      type="password"
                    />
                  </span>
                </label>
              </>
            )}

            <div className="form-helper-row">
              <label className="checkbox-label">
                <input type="checkbox" /> <span>Lembrar meus dados</span>
              </label>
              <button className="link-button" type="button">
                Preciso de ajuda
              </button>
            </div>

            <button className="button button-primary auth-submit" type="submit">
              Entrar no portal <ArrowRight size={19} />
            </button>
          </form>

          {mode === "patient" && (
            <div className="register-callout">
              <span>Primeiro acesso?</span>
              <button onClick={() => go("register")} type="button">
                Faça seu cadastro gratuito
              </button>
            </div>
          )}

          <div className="privacy-note">
            <ShieldCheck size={16} />
            Ambiente protegido conforme a Lei Geral de Proteção de Dados.
          </div>
        </div>
      </section>
    </main>
  );
}

const registerStepContent = [
  {
    title: "Seus dados pessoais",
    subtitle: "Preencha as informações exatamente como estão nos documentos.",
  },
  {
    title: "Onde você mora",
    subtitle: "Usaremos seu endereço para encontrar a unidade mais próxima.",
  },
  {
    title: "Sua unidade de referência",
    subtitle: "Confirme a unidade básica que acompanhará o seu cuidado.",
  },
];

function Register({ go }: { go: Navigate }) {
  const [step, setStep] = useState(0);

  return (
    <main className="register-page">
      <PernambucoStripe />
      <header className="simple-header">
        <button onClick={() => go("landing")} type="button">
          <Brand />
        </button>
        <div>
          Já possui cadastro?
          <button onClick={() => go("login")} type="button">
            Entrar
          </button>
        </div>
      </header>

      <section className="register-shell">
        <div className="register-heading">
          <button onClick={() => go("login")} type="button">
            <ArrowLeft size={18} /> Voltar para o login
          </button>
          <span>Cadastro gratuito</span>
          <h1>Cadastro do paciente</h1>
          <p>Leva poucos minutos e aproxima você dos serviços de saúde.</p>
        </div>

        <ol className="stepper" aria-label="Etapas do cadastro">
          {["Dados", "Endereço", "Unidade"].map((label, index) => (
            <li className={index <= step ? "active" : ""} key={label}>
              <span>{index < step ? <Check size={16} /> : index + 1}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>

        <form
          className="register-card"
          onSubmit={(event) => {
            event.preventDefault();
            if (step < 2) setStep((value) => value + 1);
            else go("portal");
          }}
        >
          <div className="register-card-heading">
            <span>{step + 1} de 3</span>
            <h2>{registerStepContent[step].title}</h2>
            <p>{registerStepContent[step].subtitle}</p>
          </div>

          {step === 0 && (
            <div className="form-grid">
              <label className="field-full">
                Nome completo
                <input placeholder="Como aparece no seu documento" required />
              </label>
              <label>
                CPF
                <input inputMode="numeric" placeholder="000.000.000-00" required />
              </label>
              <label>
                Cartão SUS
                <input
                  inputMode="numeric"
                  placeholder="000 0000 0000 0000"
                  required
                />
              </label>
              <label>
                Data de nascimento
                <input required type="date" />
              </label>
              <label>
                Telefone celular
                <input inputMode="tel" placeholder="(81) 90000-0000" required />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="form-grid">
              <label>
                CEP
                <input inputMode="numeric" placeholder="00000-000" required />
              </label>
              <label>
                Bairro
                <select aria-label="Bairro" required>
                  <option value="">Selecione</option>
                  <option>Amaro Branco</option>
                  <option>Bairro Novo</option>
                  <option>Casa Caiada</option>
                  <option>Rio Doce</option>
                </select>
              </label>
              <label className="field-full">
                Endereço
                <input placeholder="Rua ou avenida" required />
              </label>
              <label>
                Número
                <input placeholder="Ex.: 120" required />
              </label>
              <label>
                Complemento
                <input placeholder="Casa, apto. (opcional)" />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="unit-options">
              <label>
                <input defaultChecked name="unit" type="radio" />
                <span className="unit-radio" />
                <span className="unit-icon">
                  <Building2 size={21} />
                </span>
                <span>
                  <strong>USF Bairro Novo</strong>
                  <small>Av. Getúlio Vargas, 521 • 850 m de você</small>
                </span>
                <BadgeCheck className="recommended-icon" size={20} />
              </label>
              <label>
                <input name="unit" type="radio" />
                <span className="unit-radio" />
                <span className="unit-icon">
                  <Building2 size={21} />
                </span>
                <span>
                  <strong>USF Amaro Branco</strong>
                  <small>Rua do Sol, 108 • 1,7 km de você</small>
                </span>
              </label>
              <div className="selection-note">
                <Info size={17} />
                A unidade recomendada foi definida com base no endereço
                informado.
              </div>
            </div>
          )}

          <div className="register-actions">
            <button
              className="button button-secondary"
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              type="button"
            >
              <ChevronLeft size={18} /> Voltar
            </button>
            <button className="button button-primary" type="submit">
              {step === 2 ? "Concluir cadastro" : "Continuar"}
              {step === 2 ? <Check size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </form>
      </section>

      <footer className="register-footer">
        Prefeitura Municipal de Olinda. Cadastro gratuito no Conecta Saúde.
      </footer>
    </main>
  );
}

const patientModules: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    title: "Agendamento de Consulta",
    description: "Escolha especialidade e horário",
    icon: Calendar,
    tone: "blue",
  },
  {
    title: "Minhas Consultas",
    description: "Veja próximos atendimentos",
    icon: CalendarCheck2,
    tone: "green",
  },
  {
    title: "Atendimentos",
    description: "Acompanhe seu histórico",
    icon: Stethoscope,
    tone: "violet",
  },
  {
    title: "Unidades de Saúde",
    description: "Encontre atendimento perto",
    icon: MapPinned,
    tone: "yellow",
  },
  {
    title: "Agendamento de Exames",
    description: "Solicite seus exames",
    icon: TestTube2,
    tone: "red",
  },
  {
    title: "Meus Exames",
    description: "Consulte solicitações e datas",
    icon: FileText,
    tone: "cyan",
  },
  {
    title: "Lembretes",
    description: "Não perca nenhum cuidado",
    icon: Bell,
    tone: "orange",
  },
  {
    title: "Informações",
    description: "Orientações da rede municipal",
    icon: Info,
    tone: "navy",
  },
];

function PatientPortal({ go }: { go: Navigate }) {
  const [toast, setToast] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <main className="patient-page">
      <PernambucoStripe />
      <header className="patient-header">
        <button onClick={() => setMobileMenu((value) => !value)} type="button">
          <Menu size={22} />
        </button>
        <Brand compact />
        <div className="patient-actions">
          <button aria-label="Notificações" className="icon-button" type="button">
            <Bell size={20} />
            <span />
          </button>
          <button className="profile-chip" type="button">
            <span>MS</span>
            <span>
              <strong>Marina Silva</strong>
              <small>Paciente</small>
            </span>
            <ChevronDown size={16} />
          </button>
          <button
            aria-label="Sair"
            className="icon-button logout-button"
            onClick={() => go("login")}
            type="button"
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>

      {mobileMenu && (
        <div className="mobile-menu-panel">
          <button onClick={() => setMobileMenu(false)} type="button">
            Início
          </button>
          <button
            onClick={() => {
              setToast("Perfil selecionado para demonstração.");
              setMobileMenu(false);
            }}
            type="button"
          >
            Meu perfil
          </button>
          <button onClick={() => go("login")} type="button">
            Sair
          </button>
        </div>
      )}

      <div className="patient-shell">
        <section className="patient-welcome">
          <div>
            <span>Olá, Marina 👋</span>
            <h1>Como podemos ajudar você hoje?</h1>
            <p>Acesse seus serviços de saúde com poucos toques.</p>
          </div>
          <div className="health-id">
            <span>
              <ShieldCheck size={18} />
            </span>
            <div>
              <small>Cartão SUS verificado</small>
              <strong>702 •••• •••• 2489</strong>
            </div>
            <BadgeCheck size={22} />
          </div>
        </section>

        <section className="next-appointment">
          <div className="appointment-date">
            <span>AGO</span>
            <strong>02</strong>
            <small>sexta-feira</small>
          </div>
          <div className="appointment-info">
            <span className="status-badge scheduled">Próxima consulta</span>
            <h2>Clínica Geral</h2>
            <p>
              <Clock3 size={16} /> 09:30 <i /> <Building2 size={16} /> USF Bairro
              Novo
            </p>
          </div>
          <button
            onClick={() =>
              setToast("Detalhes da consulta abertos para demonstração.")
            }
            type="button"
          >
            Ver detalhes <ArrowRight size={17} />
          </button>
        </section>

        <section className="patient-modules">
          <div className="patient-section-title">
            <div>
              <span>Serviços digitais</span>
              <h2>O que você precisa?</h2>
            </div>
            <span>8 serviços disponíveis</span>
          </div>

          <div className="patient-module-grid">
            {patientModules.map(({ icon: Icon, title, description, tone }) => (
              <button
                className="patient-module-card"
                key={title}
                onClick={() =>
                  setToast(`${title}: fluxo selecionado para demonstração.`)
                }
                type="button"
              >
                <span className={`module-icon ${tone}`}>
                  <Icon size={23} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        </section>

        <section className="health-tip">
          <span>
            <HeartPulse size={22} />
          </span>
          <div>
            <strong>Cuide de você todos os dias</strong>
            <p>
              Mantenha seus dados atualizados para receber lembretes e
              orientações da rede municipal.
            </p>
          </div>
          <button
            onClick={() => setToast("Perfil selecionado para demonstração.")}
            type="button"
          >
            Atualizar perfil
          </button>
        </section>
      </div>

      <nav className="patient-bottom-nav" aria-label="Navegação do paciente">
        <button className="active" type="button">
          <Home size={20} /> <span>Início</span>
        </button>
        <button
          onClick={() => setToast("Agendamento selecionado.")}
          type="button"
        >
          <Calendar size={20} /> <span>Agendar</span>
        </button>
        <button
          onClick={() => setToast("Consultas selecionadas.")}
          type="button"
        >
          <FileText size={20} /> <span>Consultas</span>
        </button>
        <button onClick={() => setToast("Perfil selecionado.")} type="button">
          <User size={20} /> <span>Perfil</span>
        </button>
      </nav>

      {toast && (
        <div className="app-toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
    </main>
  );
}

const adminNav: Array<{
  label: string;
  id: string;
  icon: LucideIcon;
}> = [
  { label: "Dashboard", id: "dashboard", icon: CircleGauge },
  { label: "Unidades", id: "units", icon: Building2 },
  { label: "Equipe", id: "team", icon: UserPlus },
  { label: "Especialidades", id: "specialties", icon: ListPlus },
  { label: "Pacientes", id: "patients", icon: Users },
  { label: "Agendamentos", id: "schedule", icon: Calendar },
  { label: "Recepção e Senhas", id: "reception", icon: MonitorPlay },
  { label: "Relatórios", id: "reports", icon: FileText },
];

function AdminSidebar({
  active,
  onSelect,
  go,
}: {
  active: string;
  onSelect: (id: string) => void;
  go: Navigate;
}) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <Brand />
      </div>
      <nav aria-label="Administração">
        <span>Visão geral</span>
        {adminNav.map(({ label, id, icon: Icon }, index) => (
          <button
            className={active === id ? "active" : ""}
            key={id}
            onClick={() => {
              if (id === "reception") go("reception");
              else onSelect(id);
            }}
            type="button"
          >
            <Icon size={19} />
            <span>{label}</span>
            {index === 5 && <small>12</small>}
          </button>
        ))}
      </nav>
      <div className="admin-sidebar-footer">
        <div>
          <span>JS</span>
          <div>
            <strong>João Souza</strong>
            <small>Gestor municipal</small>
          </div>
        </div>
        <button aria-label="Sair" onClick={() => go("login")} type="button">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}

function AdminTopbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="admin-topbar">
      <div>
        <span>{subtitle}</span>
        <h1>{title}</h1>
      </div>
      <div className="admin-top-actions">
        <label className="admin-search">
          <Search size={18} />
          <input aria-label="Buscar" placeholder="Buscar no sistema..." />
        </label>
        <button aria-label="Notificações" className="icon-button" type="button">
          <Bell size={20} />
          <span />
        </button>
        <button className="admin-avatar" type="button">
          JS
        </button>
      </div>
    </header>
  );
}

const dashboardMetrics = [
  {
    label: "Consultas do Dia",
    value: "248",
    meta: "+12% vs. ontem",
    icon: Calendar,
    tone: "blue",
    trend: "up",
  },
  {
    label: "Consultas Realizadas",
    value: "186",
    meta: "75% concluídas",
    icon: CheckCircle2,
    tone: "green",
    trend: "up",
  },
  {
    label: "Taxa de Absenteísmo",
    value: "8,4%",
    meta: "-2,1% este mês",
    icon: TrendingDown,
    tone: "red",
    trend: "down",
  },
  {
    label: "Pacientes Ativos",
    value: "34.892",
    meta: "+428 este mês",
    icon: Users,
    tone: "violet",
    trend: "up",
  },
  {
    label: "Tempo Médio de Espera",
    value: "18 min",
    meta: "Meta: até 20 min",
    icon: Clock3,
    tone: "yellow",
    trend: "up",
  },
  {
    label: "Fila de Espera",
    value: "42",
    meta: "Em 8 unidades",
    icon: ClipboardCheck,
    tone: "orange",
    trend: "up",
  },
  {
    label: "Profissionais Ativos",
    value: "327",
    meta: "91% em atividade",
    icon: Stethoscope,
    tone: "cyan",
    trend: "up",
  },
  {
    label: "Unidades de Saúde",
    value: "26",
    meta: "24 abertas agora",
    icon: Building2,
    tone: "navy",
    trend: "up",
  },
];

const genericAdminData: Record<
  string,
  { title: string; eyebrow: string; icon: LucideIcon; items: string[] }
> = {
  units: {
    title: "Unidades de Saúde",
    eyebrow: "Rede municipal",
    icon: Building2,
    items: ["USF Bairro Novo", "USF Amaro Branco", "Policlínica de Rio Doce"],
  },
  team: {
    title: "Equipe e Profissionais",
    eyebrow: "Gestão de pessoas",
    icon: UserPlus,
    items: ["Dra. Ana Beatriz", "Dr. Paulo Mendes", "Enf. Carla Silva"],
  },
  specialties: {
    title: "Especialidades",
    eyebrow: "Catálogo assistencial",
    icon: ListPlus,
    items: ["Clínica Geral", "Pediatria", "Cardiologia"],
  },
  patients: {
    title: "Pacientes",
    eyebrow: "Cadastros da rede",
    icon: Users,
    items: ["Marina Silva", "José Carlos Lima", "Lúcia Ferreira"],
  },
  schedule: {
    title: "Agendamentos",
    eyebrow: "Agenda municipal",
    icon: Calendar,
    items: ["Consulta • 09:30", "Retorno • 10:15", "Pediatria • 11:00"],
  },
  reports: {
    title: "Relatórios",
    eyebrow: "Inteligência da rede",
    icon: FileText,
    items: [
      "Produção mensal",
      "Taxa de absenteísmo",
      "Atendimentos por unidade",
    ],
  },
};

function AdminModule({
  data,
}: {
  data: { title: string; eyebrow: string; icon: LucideIcon; items: string[] };
}) {
  const Icon = data.icon;
  return (
    <div className="admin-module-page">
      <div className="module-hero-card">
        <span>
          <Icon size={27} />
        </span>
        <div>
          <small>{data.eyebrow}</small>
          <h2>{data.title}</h2>
          <p>Consulte, organize e acompanhe os registros desta área.</p>
        </div>
        <button className="button button-primary" type="button">
          <Plus size={18} /> Adicionar
        </button>
      </div>
      <section className="admin-data-card">
        <div className="card-header">
          <div>
            <h3>Registros recentes</h3>
            <p>Informações atualizadas da rede municipal.</p>
          </div>
          <label className="small-search">
            <Search size={17} />
            <input aria-label={`Buscar em ${data.title}`} placeholder="Buscar" />
          </label>
        </div>
        <div className="generic-list">
          {data.items.map((item, index) => (
            <div key={item}>
              <span className="generic-list-icon">
                <Icon size={19} />
              </span>
              <div>
                <strong>{item}</strong>
                <small>
                  Registro #{String(index + 142).padStart(4, "0")} • Atualizado
                  hoje
                </small>
              </div>
              <span className="status-badge completed">Ativo</span>
              <button aria-label={`Mais opções para ${item}`} type="button">
                <MoreHorizontal size={19} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Dashboard({ go }: { go: Navigate }) {
  const [section, setSection] = useState("dashboard");
  const sectionData = genericAdminData[section];

  return (
    <main className="admin-page">
      <AdminSidebar active={section} go={go} onSelect={setSection} />
      <div className="admin-main">
        <AdminTopbar
          subtitle={
            section === "dashboard"
              ? "Sábado, 26 de julho de 2026"
              : sectionData?.eyebrow ?? "Gestão municipal"
          }
          title={
            section === "dashboard" ? "Painel gestor" : sectionData?.title ?? ""
          }
        />

        {section !== "dashboard" && sectionData ? (
          <AdminModule data={sectionData} />
        ) : (
          <div className="dashboard-content">
            <section className="dashboard-intro">
              <div>
                <span>Visão da rede</span>
                <h2>Bom dia, João!</h2>
                <p>
                  Acompanhe atendimentos, filas, unidades, profissionais e
                  indicadores da rede municipal de Olinda.
                </p>
              </div>
              <div className="system-status">
                <span />
                <div>
                  <strong>Sistema operacional</strong>
                  <small>Todas as unidades sincronizadas</small>
                </div>
              </div>
            </section>

            <section className="metric-grid">
              {dashboardMetrics.map(
                ({ label, value, meta, icon: Icon, tone, trend }) => (
                  <article className="metric-card" key={label}>
                    <span className={`metric-icon ${tone}`}>
                      <Icon size={21} />
                    </span>
                    <div>
                      <small>{label}</small>
                      <strong>{value}</strong>
                      <span className={trend}>
                        {trend === "up" ? (
                          <TrendingUp size={14} />
                        ) : (
                          <TrendingDown size={14} />
                        )}
                        {meta}
                      </span>
                    </div>
                  </article>
                ),
              )}
            </section>

            <section className="dashboard-lower-grid">
              <article className="chart-card">
                <div className="card-header">
                  <div>
                    <h3>Atendimentos da semana</h3>
                    <p>Consultas agendadas e realizadas</p>
                  </div>
                  <button type="button">
                    Últimos 7 dias <ChevronDown size={16} />
                  </button>
                </div>
                <div className="chart-legend">
                  <span className="legend-blue">Agendadas</span>
                  <span className="legend-green">Realizadas</span>
                </div>
                <div className="bar-chart" aria-label="Gráfico de atendimentos">
                  {[72, 88, 65, 93, 81, 48, 31].map((value, index) => (
                    <div className="bar-group" key={index}>
                      <div>
                        <i style={{ height: `${value}%` }} />
                        <i style={{ height: `${value - 13}%` }} />
                      </div>
                      <span>{["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"][index]}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="units-card">
                <div className="card-header">
                  <div>
                    <h3>Unidades em destaque</h3>
                    <p>Volume de atendimentos hoje</p>
                  </div>
                  <button onClick={() => setSection("units")} type="button">
                    Ver todas
                  </button>
                </div>
                {[
                  ["USF Bairro Novo", "42 atendimentos", 88],
                  ["Policlínica Rio Doce", "36 atendimentos", 76],
                  ["USF Amaro Branco", "29 atendimentos", 62],
                  ["USF Casa Caiada", "23 atendimentos", 51],
                ].map(([name, count, progress]) => (
                  <div className="unit-progress" key={String(name)}>
                    <div>
                      <strong>{name}</strong>
                      <small>{count}</small>
                    </div>
                    <span>
                      <i style={{ width: `${progress}%` }} />
                    </span>
                  </div>
                ))}
              </article>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

const receptionQueue = [
  {
    initials: "MS",
    name: "Marina Silva",
    service: "Clínica Geral",
    time: "09:30",
    status: "Aguardando",
  },
  {
    initials: "JC",
    name: "José Carlos",
    service: "Pediatria",
    time: "09:40",
    status: "Check-in feito",
  },
  {
    initials: "LF",
    name: "Lúcia Ferreira",
    service: "Cardiologia",
    time: "10:00",
    status: "Aguardando",
  },
  {
    initials: "RM",
    name: "Rafael Martins",
    service: "Clínica Geral",
    time: "10:20",
    status: "Aguardando",
  },
];

function Reception({ go }: { go: Navigate }) {
  const [called, setCalled] = useState("A-023");

  return (
    <main className="admin-page reception-page">
      <AdminSidebar active="reception" go={go} onSelect={() => go("dashboard")} />
      <div className="admin-main">
        <AdminTopbar
          subtitle="USF Bairro Novo • Atendimento em tempo real"
          title="Painel da Recepção"
        />
        <div className="reception-content">
          <section className="reception-heading">
            <div>
              <span>Recepção conectada</span>
              <h2>Gerencie o fluxo da unidade</h2>
              <p>Check-in, fila de espera, senhas e chamadas em um só painel.</p>
            </div>
            <button
              className="button button-primary"
              onClick={() => go("tv")}
              type="button"
            >
              <MonitorPlay size={19} /> Abrir Painel de TV
            </button>
          </section>

          <section className="reception-metrics">
            {[
              ["Atendidos hoje", "38", CheckCircle2, "green"],
              ["Na fila", "12", Users, "blue"],
              ["Tempo médio", "16 min", Clock3, "yellow"],
              ["Prioridades", "03", AlertCircle, "red"],
            ].map(([label, value, Icon, tone]) => {
              const MetricIcon = Icon as LucideIcon;
              return (
                <article key={String(label)}>
                  <span className={`metric-icon ${tone}`}>
                    <MetricIcon size={21} />
                  </span>
                  <div>
                    <small>{label as string}</small>
                    <strong>{value as string}</strong>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="reception-grid">
            <article className="checkin-card">
              <div className="card-header">
                <div>
                  <h3>Agenda de hoje</h3>
                  <p>Próximos pacientes da unidade</p>
                </div>
                <label className="small-search">
                  <Search size={17} />
                  <input aria-label="Buscar paciente" placeholder="Buscar paciente" />
                </label>
              </div>
              <div className="queue-table">
                <div className="queue-table-head">
                  <span>Paciente</span>
                  <span>Serviço</span>
                  <span>Horário</span>
                  <span>Status</span>
                  <span />
                </div>
                {receptionQueue.map((patient) => (
                  <div className="queue-table-row" key={patient.name}>
                    <span className="patient-cell">
                      <i>{patient.initials}</i>
                      <strong>{patient.name}</strong>
                    </span>
                    <span>{patient.service}</span>
                    <span>{patient.time}</span>
                    <span
                      className={`status-badge ${
                        patient.status === "Check-in feito"
                          ? "completed"
                          : "scheduled"
                      }`}
                    >
                      {patient.status}
                    </span>
                    <button aria-label={`Opções para ${patient.name}`} type="button">
                      <MoreHorizontal size={19} />
                    </button>
                  </div>
                ))}
              </div>
            </article>

            <aside className="call-card">
              <span className="call-kicker">
                <span /> Chamada atual
              </span>
              <div className="ticket-display">
                <small>SENHA</small>
                <strong>{called}</strong>
                <span>GUICHÊ 02</span>
              </div>
              <div className="called-person">
                <span>LM</span>
                <div>
                  <strong>Lucas Moura</strong>
                  <small>Clínica Geral • Prioridade</small>
                </div>
              </div>
              <button
                className="button button-success"
                onClick={() =>
                  setCalled((value) => (value === "A-023" ? "A-024" : "A-025"))
                }
                type="button"
              >
                <PhoneCall size={18} /> Chamar próxima senha
              </button>
              <button className="button button-secondary" type="button">
                Repetir chamada
              </button>
            </aside>
          </section>
        </div>
      </div>
    </main>
  );
}

function DisplayTV({ go }: { go: Navigate }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <main className="tv-page">
      <PernambucoStripe />
      <header className="tv-header">
        <Brand light />
        <div>
          <span>USF Bairro Novo</span>
          <strong>{time}</strong>
          <small>{date}</small>
        </div>
      </header>

      <section className="tv-content">
        <div className="tv-current-call">
          <div className="tv-live">
            <span /> Chamada atual
          </div>
          <p>Por favor, dirija-se ao local indicado</p>
          <strong>A-023</strong>
          <div className="tv-destination">
            <span>
              <small>LOCAL</small>
              <strong>GUICHÊ 02</strong>
            </span>
            <i />
            <span>
              <small>ATENDIMENTO</small>
              <strong>CLÍNICA GERAL</strong>
            </span>
          </div>
          <div className="tv-person">
            <UserRoundCheck size={24} />
            <span>
              <small>Paciente</small>
              <strong>Lucas Moura</strong>
            </span>
          </div>
        </div>

        <aside className="tv-next">
          <div>
            <span>Próximas senhas</span>
            <small>Aguarde sua chamada</small>
          </div>
          {[
            ["A-024", "Guichê 01", "Clínica Geral"],
            ["P-008", "Sala 03", "Prioridade"],
            ["A-025", "Guichê 02", "Pediatria"],
            ["E-014", "Sala 05", "Exames"],
          ].map(([ticket, room, service], index) => (
            <div className="next-ticket" key={ticket}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{ticket}</strong>
                <small>{service}</small>
              </div>
              <strong>{room}</strong>
            </div>
          ))}
          <div className="tv-orientation">
            <Info size={20} />
            Mantenha seu documento e cartão SUS em mãos.
          </div>
        </aside>
      </section>

      <footer className="tv-footer">
        <span>
          <HeartPulse size={21} /> Cuidar de Olinda é conectar pessoas à saúde
        </span>
        <strong>Prefeitura Municipal de Olinda</strong>
      </footer>

      <button
        aria-label="Voltar para a recepção"
        className="tv-back-button"
        onClick={() => go("reception")}
        type="button"
      >
        <ArrowLeft size={20} />
      </button>
    </main>
  );
}

export default function Prototype() {
  const [view, setView] = useState<View>("landing");

  useEffect(() => {
    const readRoute = () => {
      const path = window.location.hash.replace("#", "") || "/";
      setView(pathViews[path] ?? "landing");
    };
    readRoute();
    window.addEventListener("hashchange", readRoute);
    return () => window.removeEventListener("hashchange", readRoute);
  }, []);

  const go = (nextView: View) => {
    const path = viewPaths[nextView];
    if (window.location.hash.replace("#", "") === path) {
      setView(nextView);
    } else {
      window.location.hash = path;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const screen = useMemo(() => {
    switch (view) {
      case "login":
        return <Login go={go} />;
      case "register":
        return <Register go={go} />;
      case "portal":
        return <PatientPortal go={go} />;
      case "dashboard":
        return <Dashboard go={go} />;
      case "reception":
        return <Reception go={go} />;
      case "tv":
        return <DisplayTV go={go} />;
      default:
        return <Landing go={go} />;
    }
  }, [view]);

  return (
    <>
      {screen}
      <PrototypeNavigator current={view} go={go} />
    </>
  );
}
