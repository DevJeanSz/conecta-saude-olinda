import React from 'react';
import { Link } from 'react-router-dom';
import {
  Accessibility,
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  HeartPulse,
  MapPin,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
import { BrandLockup } from '../components/BrandLockup';
import { PernambucoStripe } from '../components/VisualPrimitives';
import beforeCareImage from '../src/assets/images/projeto-antes-fila-ubs.png';
import afterCareImage from '../src/assets/images/projeto-depois-agendamento-celular.png';

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

const healthNews = [
  {
    icon: Newspaper,
    tag: 'Rede municipal',
    title: 'Novas UBS e melhorias nos serviços',
    description: 'Acompanhe inaugurações, reformas e ampliações que deixam o atendimento mais perto dos bairros de Olinda.',
  },
  {
    icon: ShieldCheck,
    tag: 'Prevenção',
    title: 'Campanha contra o tabagismo',
    description: 'Informação, acolhimento e orientação para quem deseja parar de fumar e cuidar melhor da saúde respiratória.',
  },
  {
    icon: HeartPulse,
    tag: 'Cuidado mensal',
    title: 'Setembro Amarelo e saúde mental',
    description: 'Cada mês ganha uma pauta de conscientização para fortalecer prevenção, escuta e cuidado com a população.',
  },
  {
    icon: BellRing,
    tag: 'Avisos úteis',
    title: 'Vacinação, exames e mutirões',
    description: 'Fique por dentro de campanhas, horários especiais e ações municipais organizadas pela Secretaria de Saúde.',
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
        <a href="#noticias">Fique por dentro</a>
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
            <span>Marcar consulta</span>
            <small>unidade e horário</small>
          </Link>
          <Link to="/login">
            <Users size={22} aria-hidden="true" />
            <span>Acompanhar cuidado</span>
            <small>status e histórico</small>
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

    <section className="municipal-section project-story" id="projeto">
      <div className="project-story-copy">
        <span className="municipal-kicker">Conheça o projeto</span>
        <h2>Chega de filas: agora temos o Conecta Saúde</h2>
        <p>
          O projeto nasceu para atender a população que precisa utilizar o
          sistema público de saúde, reduzindo filas quilométricas e aproximando
          cada cidadão dos serviços municipais de Olinda.
        </p>
        <strong>
          Prefeitura de Olinda trabalhando para melhor servir a população olindense.
        </strong>
      </div>

      <div className="project-before-after">
        <article>
          <img src={beforeCareImage} alt="Moradores aguardando em fila para atendimento em uma unidade de saúde" />
          <span>Antes</span>
          <strong>Horas em filas para tentar uma ficha</strong>
        </article>
        <article>
          <img src={afterCareImage} alt="Cidadã usando o Conecta Saúde no celular para agendar atendimento em casa" />
          <span>Agora</span>
          <strong>Agendamento pelo celular, com mais conforto e clareza</strong>
        </article>
      </div>

      <div className="project-story-stats" id="unidades">
        <div className="municipal-stat">
          <strong>24h</strong>
          <span>portal disponível para solicitações</span>
        </div>
        <div className="municipal-stat">
          <strong>Rede única</strong>
          <span>unidades e equipes conectadas</span>
        </div>
      </div>
    </section>

    <section className="news-section" id="noticias">
      <div className="section-heading">
        <span>Fique por dentro</span>
        <h2>Notícias e campanhas de saúde para a população</h2>
        <p>
          Um espaço para acompanhar novidades da saúde de Olinda, campanhas de
          conscientização e orientações importantes ao longo do ano.
        </p>
      </div>

      <div className="news-grid">
        {healthNews.map(({ icon: Icon, tag, title, description }) => (
          <article className="news-card" key={title}>
            <span className="news-icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <small>{tag}</small>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
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
