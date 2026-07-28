import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Accessibility,
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  HeartPulse,
  Megaphone,
  MapPin,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BrandLockup } from '../components/BrandLockup';
import { PernambucoStripe } from '../components/VisualPrimitives';
import { api } from '../services/api';
import { HealthPostIcon } from '../types';
import { buildDefaultHealthPosts, getHealthPostIconMeta } from '../src/healthPosts';
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

const healthPostIcons: Record<HealthPostIcon, LucideIcon> = {
  shield: ShieldCheck,
  heart: HeartPulse,
  bell: BellRing,
  newspaper: Newspaper,
  calendar: CalendarDays,
  stethoscope: Stethoscope,
  syringe: Syringe,
  megaphone: Megaphone,
};

export const LandingPage: React.FC = () => {
  const fallbackPosts = useMemo(() => buildDefaultHealthPosts(), []);
  const [healthPosts, setHealthPosts] = useState(fallbackPosts);

  useEffect(() => {
    let active = true;

    api.healthPosts.getPublished()
      .then(posts => {
        if (active && posts.length > 0) setHealthPosts(posts);
      })
      .catch(() => {
        if (active) setHealthPosts(fallbackPosts);
      });

    return () => {
      active = false;
    };
  }, [fallbackPosts]);

  return (
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
        <h2>Informação que ajuda você a cuidar da sua família</h2>
        <p>
          Quando a saúde chama, ninguém quer ficar perdido. Aqui você encontra
          avisos da rede de Olinda, campanhas e orientações simples para se
          preparar melhor e cuidar de quem está perto.
        </p>
      </div>

      <div className="news-grid">
        {healthPosts.map((post) => {
          const iconMeta = getHealthPostIconMeta(post.icon);
          const Icon = healthPostIcons[post.icon] || Newspaper;
          return (
            <article
              className="news-card"
              key={post.id}
              style={{
                '--news-accent': iconMeta.accent,
                '--news-accent-secondary': iconMeta.accentSecondary,
              } as React.CSSProperties}
            >
              <img className="news-card-image" src={post.imageUrl} alt="" />
              <div className="news-card-body">
                <span className="news-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <small>{post.context}</small>
                <h3>{post.title}</h3>
                <p>{post.text}</p>
              </div>
            </article>
          );
        })}
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
};
