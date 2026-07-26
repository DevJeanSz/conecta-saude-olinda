import React from 'react';
import { Link } from 'react-router-dom';
import {
  Accessibility,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
import { BrandLockup } from '../components/BrandLockup';
import { PernambucoStripe } from '../components/VisualPrimitives';

const landingServices = [
  {
    icon: CalendarDays,
    title: 'Consultas sem complicação',
    description: 'Encontre a unidade, a especialidade e o melhor horário para você.',
  },
  {
    icon: Stethoscope,
    title: 'Cuidado acompanhado',
    description: 'Consulte seus atendimentos, exames e orientações em um só lugar.',
  },
  {
    icon: MapPin,
    title: 'Rede perto de você',
    description: 'Veja as unidades municipais, horários e serviços disponíveis.',
  },
];

export const LandingPage: React.FC = () => (
  <main className="landing-page">
    <PernambucoStripe />
    <header className="landing-header">
      <Link className="brand-button" to="/">
        <BrandLockup />
      </Link>

      <nav className="landing-nav" aria-label="Navegação principal">
        <a href="#servicos">Serviços</a>
        <a href="#projeto">Sobre o projeto</a>
        <a href="#unidades">Unidades</a>
      </nav>

      <Link className="button button-primary header-action" to="/login">
        Acessar portal
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
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
          <Link className="button button-yellow" to="/login">
            Acessar portal
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
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
          Atendimento conectado
        </div>
        <strong>Acesse os serviços da rede</strong>
        <div className="hero-card-grid">
          <Link to="/login">
            <CalendarDays size={22} aria-hidden="true" />
            <span>Agendar</span>
            <small>consulta</small>
          </Link>
          <Link to="/login">
            <Users size={22} aria-hidden="true" />
            <span>Acompanhar</span>
            <small>atendimento</small>
          </Link>
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
            <Link to="/login">
              Acessar serviço <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>

    <section className="municipal-section" id="projeto">
      <div>
        <span className="municipal-kicker">Prefeitura Municipal de Olinda</span>
        <h2>Unidades, equipes e cidadãos no mesmo fluxo</h2>
        <p>
          O Conecta Saúde Olinda organiza agendamentos, recepção e
          acompanhamento em uma jornada única para a rede municipal.
        </p>
      </div>
      <div className="municipal-stat">
        <strong>24h</strong>
        <span>portal disponível para solicitações</span>
      </div>
      <div className="municipal-stat" id="unidades">
        <strong>Rede única</strong>
        <span>unidades e equipes conectadas</span>
      </div>
    </section>

    <section className="access-section" id="acesso">
      <div>
        <span>Comece agora</span>
        <h2>Seu acesso à saúde de Olinda em um só lugar.</h2>
      </div>
      <Link className="button button-primary" to="/login">
        Entrar no Conecta Saúde
        <ArrowRight size={19} aria-hidden="true" />
      </Link>
    </section>

    <footer className="landing-footer">
      <BrandLockup light />
      <p>Prefeitura Municipal de Olinda • Saúde pública mais conectada.</p>
    </footer>
  </main>
);
