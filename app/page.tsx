import {
  Accessibility,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  HeartPulse,
  MapPin,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

const services = [
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

export default function Home() {
  return (
    <main className="landing-page">
      <div className="pernambuco-stripe" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <header className="landing-header">
        <a className="brand-lockup" href="#inicio" aria-label="Conecta Saúde Olinda">
          <span className="brand-symbol">
            <HeartPulse aria-hidden="true" />
          </span>
          <span className="brand-copy">
            <strong>Conecta Saúde</strong>
            <small>Olinda</small>
          </span>
        </a>

        <nav className="landing-nav" aria-label="Navegação principal">
          <a href="#servicos">Serviços</a>
          <a href="#projeto">Sobre o projeto</a>
          <a href="#unidades">Unidades</a>
        </nav>

        <a className="button button-primary header-action" href="#acesso">
          Acessar portal
          <ArrowRight size={18} aria-hidden="true" />
        </a>
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
            <a className="button button-yellow" href="#acesso">
              Acessar portal
              <ArrowRight size={20} aria-hidden="true" />
            </a>
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
            <div>
              <CalendarDays size={22} aria-hidden="true" />
              <span>Agende</span>
              <small>sua consulta</small>
            </div>
            <div>
              <Users size={22} aria-hidden="true" />
              <span>Acompanhe</span>
              <small>seu atendimento</small>
            </div>
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
          {services.map(({ icon: Icon, title, description }) => (
            <article className="service-card" key={title}>
              <span className="service-icon">
                <Icon size={24} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
              <a href="#acesso">
                Saiba mais <ArrowRight size={17} aria-hidden="true" />
              </a>
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
        <a className="button button-primary" href="#inicio">
          Entrar no Conecta Saúde
          <ArrowRight size={19} aria-hidden="true" />
        </a>
      </section>

      <footer className="landing-footer">
        <div className="brand-lockup brand-lockup-light">
          <span className="brand-symbol">
            <HeartPulse aria-hidden="true" />
          </span>
          <span className="brand-copy">
            <strong>Conecta Saúde</strong>
            <small>Olinda</small>
          </span>
        </div>
        <p>Prefeitura Municipal de Olinda • Saúde pública mais conectada.</p>
      </footer>
    </main>
  );
}
