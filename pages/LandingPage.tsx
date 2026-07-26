import React from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  HeartPulse,
  Lock,
  MapPin,
  MonitorPlay,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import logo from '@/src/assets/images/conectasaudeolinda.png';
import prefeituraLogo from '@/src/assets/images/prefeitura-olinda.png';

const mainBenefits = [
  'Mais praticidade para marcar consultas',
  'Menos espera nas unidades',
  'Atendimento mais organizado',
  'Comunicação simples com o cidadão',
];

const features = [
  {
    title: 'Agendamento de consultas',
    description: 'O cidadão solicita atendimento pelo portal e acompanha suas consultas de forma simples.',
    icon: CalendarCheck,
    color: 'text-primary',
    bg: 'bg-blue-50',
  },
  {
    title: 'Organização de filas',
    description: 'A recepção acompanha chegadas, senhas e chamadas com mais clareza durante o atendimento.',
    icon: Users,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    title: 'Unidades de saúde',
    description: 'As unidades ficam reunidas em um único ambiente para facilitar acesso, vínculo e orientação.',
    icon: Building2,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    title: 'Portal do paciente',
    description: 'Cada pessoa acessa seus agendamentos, orientações e notificações pelo celular ou computador.',
    icon: Smartphone,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
  },
  {
    title: 'Painel de chamada',
    description: 'A tela de TV ajuda a recepção a chamar pacientes e tornar o fluxo mais visível na unidade.',
    icon: MonitorPlay,
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    title: 'Lembretes e avisos',
    description: 'Notificações ajudam o cidadão a lembrar de consultas e acompanhar mudanças importantes.',
    icon: BellRing,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
  },
];

const audience = [
  {
    title: 'Cidadãos de Olinda',
    description: 'Acesso mais rápido aos serviços de saúde, com menos deslocamentos desnecessários.',
    icon: HeartPulse,
  },
  {
    title: 'Unidades de saúde',
    description: 'Rotina de atendimento mais organizada, com check-in, fila e agenda em um só lugar.',
    icon: Building2,
  },
  {
    title: 'Rede municipal',
    description: 'Um sistema integrado para fortalecer o cuidado e aproximar os serviços da população.',
    icon: ShieldCheck,
  },
];

const importanceItems = [
  'Reduz a necessidade de filas presenciais para agendar atendimento.',
  'Ajuda as unidades a organizarem melhor o fluxo diário.',
  'Melhora a comunicação entre o serviço de saúde e o cidadão.',
  'Fortalece a transparência no acesso aos atendimentos municipais.',
  'Aproxima tecnologia, cuidado e serviço público da população.',
];

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-24 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5 min-w-0">
            <img src={prefeituraLogo} alt="Prefeitura de Olinda" className="h-14 w-auto object-contain shrink-0" />
            <div className="h-12 w-px bg-slate-200 hidden sm:block" />
            <img src={logo} alt="Conecta Saúde Olinda" className="h-16 w-auto object-contain shrink-0" />
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a href="#projeto" className="hover:text-primary transition-colors">Projeto</a>
            <a href="#funcionalidades" className="hover:text-primary transition-colors">Funcionalidades</a>
            <a href="#publico" className="hover:text-primary transition-colors">Para quem serve</a>
            <a href="#importancia" className="hover:text-primary transition-colors">Importância</a>
          </nav>

          <Link
            to="/login"
            className="hidden sm:inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-5 py-3 rounded-lg shadow-sm transition-colors"
          >
            <Lock className="w-4 h-4" />
            Acessar Portal
          </Link>
        </div>
      </header>

      <main>
        <section id="projeto" className="relative overflow-hidden border-b border-slate-200">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1586773860418-d37222d8fce3?q=80&w=2200&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
          <div className="absolute inset-x-0 bottom-0 h-3 flex">
            <div className="flex-1 bg-primary" />
            <div className="flex-1 bg-green-500" />
            <div className="flex-1 bg-yellow-400" />
            <div className="flex-1 bg-red-500" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-primary px-4 py-2 rounded-full text-xs font-black uppercase">
                Tecnologia a serviço da saúde pública
              </div>

              <h1 className="mt-7 text-4xl sm:text-5xl lg:text-6xl font-black leading-tight text-slate-950">
                Conecta Saúde Olinda
              </h1>

              <p className="mt-5 text-xl sm:text-2xl font-bold text-primary leading-snug">
                Uma plataforma municipal para facilitar o acesso, organizar atendimentos e cuidar melhor das pessoas.
              </p>

              <p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-2xl">
                O sistema foi criado para modernizar o atendimento da rede pública de saúde de Olinda. Ele reúne agendamento, portal do paciente, recepção, chamadas e acompanhamento de consultas em um ambiente simples, seguro e acessível.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-7 py-4 rounded-lg shadow-lg shadow-blue-900/20 transition-colors"
                >
                  Acessar o Portal
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <a
                  href="#funcionalidades"
                  className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-primary border border-primary/30 font-bold px-7 py-4 rounded-lg transition-colors"
                >
                  Conhecer funcionalidades
                </a>
              </div>

              <div className="mt-9 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {mainBenefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2 bg-white/85 border border-slate-200 rounded-lg px-3 py-3 shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <span className="text-sm font-semibold text-slate-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-primary px-6 py-5 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-blue-100">Fluxo de atendimento</p>
                    <h2 className="text-2xl font-black">Do agendamento à chamada</h2>
                  </div>
                  <HeartPulse className="w-10 h-10 text-yellow-300" />
                </div>
              </div>

              <div className="p-6 space-y-4">
                {[
                  ['1', 'Cidadão acessa o portal', 'Consulta informações e solicita agendamento.'],
                  ['2', 'Unidade organiza a agenda', 'Recepção acompanha chegadas e fluxo de atendimento.'],
                  ['3', 'Paciente recebe orientação', 'Avisos e chamadas tornam o atendimento mais claro.'],
                  ['4', 'Serviço público ganha eficiência', 'A rotina fica mais simples para todos os envolvidos.'],
                ].map(([number, title, description]) => (
                  <div key={number} className="flex gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-black shrink-0">
                      {number}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800">{title}</h3>
                      <p className="text-sm text-slate-600 mt-1">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="funcionalidades" className="py-20 lg:py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-wide text-green-700">Funcionalidades</p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black text-slate-950">O que o sistema entrega na prática</h2>
              <p className="mt-4 text-lg text-slate-600">
                O Conecta Saúde Olinda foi pensado para simplificar tarefas comuns da saúde municipal e tornar o atendimento mais previsível para a população.
              </p>
            </div>

            <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((feature) => (
                <article key={feature.title} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:border-primary/40 hover:shadow-md transition-all">
                  <div className={`w-12 h-12 ${feature.bg} ${feature.color} rounded-lg flex items-center justify-center mb-5`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="publico" className="py-20 lg:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-primary">Para quem serve</p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black text-slate-950">Um sistema para aproximar a saúde pública de quem precisa dela</h2>
              <p className="mt-4 text-lg text-slate-600 leading-relaxed">
                A plataforma apoia o atendimento cotidiano, melhora o acesso do cidadão e ajuda a rede municipal a trabalhar de forma mais integrada.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {audience.map((item) => (
                <article key={item.title} className="border border-slate-200 rounded-xl p-6 bg-slate-50">
                  <item.icon className="w-9 h-9 text-primary mb-5" />
                  <h3 className="font-black text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="importancia" className="py-20 lg:py-24 bg-[#F0F7FF] border-y border-blue-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-amber-700">Importância para Olinda</p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black text-slate-950">Mais organização, mais acesso e mais cuidado com a população</h2>
              <p className="mt-4 text-lg text-slate-600 leading-relaxed">
                Quando a saúde pública ganha ferramentas simples e bem organizadas, o cidadão sente a diferença: menos incerteza, mais orientação e um atendimento mais humano.
              </p>

              <div className="mt-8 space-y-3">
                {importanceItems.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                    <span className="font-semibold text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden border border-blue-100 bg-white shadow-xl">
              <div className="p-7">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-green-50 text-green-700 rounded-xl flex items-center justify-center">
                    <MapPin className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">Serviço municipal</p>
                    <h3 className="text-2xl font-black text-slate-950">Saúde conectada ao território</h3>
                  </div>
                </div>

                <p className="mt-5 text-slate-600 leading-relaxed">
                  O Conecta Saúde Olinda ajuda a transformar a relação entre a população e a rede pública: o cidadão encontra serviços com mais facilidade, e as unidades conseguem acolher melhor quem chega.
                </p>

                <div className="mt-6 grid sm:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-blue-50 p-4 border border-blue-100">
                    <Clock className="w-7 h-7 text-primary mb-3" />
                    <p className="font-black text-slate-900">Tempo melhor aproveitado</p>
                    <p className="text-sm text-slate-600 mt-1">Menos espera desnecessária e mais previsibilidade para o atendimento.</p>
                  </div>
                  <div className="rounded-xl bg-green-50 p-4 border border-green-100">
                    <HeartPulse className="w-7 h-7 text-green-700 mb-3" />
                    <p className="font-black text-slate-900">Cuidado mais próximo</p>
                    <p className="text-sm text-slate-600 mt-1">A tecnologia apoia uma saúde pública mais acolhedora e acessível.</p>
                  </div>
                </div>
              </div>

              <div className="h-3 flex">
                <div className="flex-1 bg-primary" />
                <div className="flex-1 bg-green-500" />
                <div className="flex-1 bg-yellow-400" />
                <div className="flex-1 bg-red-500" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col lg:flex-row justify-between gap-8">
          <div className="flex items-center gap-5">
            <img src={prefeituraLogo} alt="Prefeitura de Olinda" className="h-12 w-auto object-contain bg-white rounded-md p-1" />
            <div className="h-10 w-px bg-white/20 hidden sm:block" />
            <img src={logo} alt="Conecta Saúde Olinda" className="h-12 w-auto object-contain" />
          </div>

          <div className="max-w-xl lg:text-right">
            <div className="flex items-center gap-2 lg:justify-end text-blue-100 font-semibold">
              <ShieldCheck className="w-5 h-5 text-green-400" />
              Plataforma oficial de apoio aos serviços municipais de saúde
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Prefeitura Municipal de Olinda. Trabalho presente, futuro pra gente.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
