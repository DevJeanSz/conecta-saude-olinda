import { HealthPost, HealthPostIcon, HealthPostPayload } from '../types';

export const HEALTH_POST_TEXT_LIMIT = 400;
export const HEALTH_POST_IMAGE_WIDTH = 1200;
export const HEALTH_POST_IMAGE_HEIGHT = 900;
export const HEALTH_POST_IMAGE_ASPECT_LABEL = '4:3';

export const HEALTH_POST_ICON_OPTIONS: Array<{
  id: HealthPostIcon;
  label: string;
  description: string;
  accent: string;
  accentSecondary: string;
}> = [
  {
    id: 'shield',
    label: 'Prevenção',
    description: 'Testagem, proteção e diagnóstico',
    accent: '#dc2626',
    accentSecondary: '#f87171',
  },
  {
    id: 'heart',
    label: 'Cuidado',
    description: 'Tratamento, acompanhamento e acolhimento',
    accent: '#16a34a',
    accentSecondary: '#86efac',
  },
  {
    id: 'bell',
    label: 'Campanha',
    description: 'Alertas e ações de conscientização',
    accent: '#f97316',
    accentSecondary: '#facc15',
  },
  {
    id: 'newspaper',
    label: 'Notícia',
    description: 'Novidades da rede municipal',
    accent: '#0b60c9',
    accentSecondary: '#7dd3fc',
  },
  {
    id: 'calendar',
    label: 'Calendário',
    description: 'Datas, mutirões e programação',
    accent: '#7c3aed',
    accentSecondary: '#c4b5fd',
  },
  {
    id: 'stethoscope',
    label: 'Orientação',
    description: 'Informações de saúde para o cidadão',
    accent: '#0891b2',
    accentSecondary: '#67e8f9',
  },
  {
    id: 'syringe',
    label: 'Vacinação',
    description: 'Vacinas, exames e prevenção',
    accent: '#2563eb',
    accentSecondary: '#93c5fd',
  },
  {
    id: 'megaphone',
    label: 'Aviso',
    description: 'Comunicados importantes',
    accent: '#be123c',
    accentSecondary: '#fda4af',
  },
];

export const getHealthPostIconMeta = (icon: HealthPostIcon) =>
  HEALTH_POST_ICON_OPTIONS.find(option => option.id === icon) || HEALTH_POST_ICON_OPTIONS[3];

const monthlyCampaigns = [
  {
    month: 'Janeiro',
    colors: 'Branco e Roxo',
    title: 'Saúde mental e combate à hanseníase',
    text: 'Um mês para acolher a saúde emocional e reforçar diagnóstico, tratamento e acompanhamento contra a hanseníase.',
  },
  {
    month: 'Fevereiro',
    colors: 'Roxo e Laranja',
    title: 'Lúpus, Alzheimer, fibromialgia e leucemia',
    text: 'A rede chama atenção para sinais, acompanhamento contínuo e cuidado precoce em doenças crônicas e hematológicas.',
  },
  {
    month: 'Março',
    colors: 'Lilás e Azul Escuro',
    title: 'Câncer do colo do útero e colorretal',
    text: 'Prevenção, exames de rastreio e informação ajudam a identificar riscos e orientar o cuidado no momento certo.',
  },
  {
    month: 'Abril',
    colors: 'Azul',
    title: 'Conscientização sobre autismo',
    text: 'Informação, respeito e acolhimento fortalecem uma rede mais inclusiva para pessoas autistas e suas famílias.',
  },
  {
    month: 'Maio',
    colors: 'Amarelo, Roxo e Vermelho',
    title: 'Trânsito seguro, doenças intestinais e hepatites',
    text: 'O cuidado passa pela prevenção de acidentes, atenção aos sintomas persistentes e atualização de exames.',
  },
  {
    month: 'Junho',
    colors: 'Laranja',
    title: 'Prevenção da anemia',
    text: 'Alimentação, acompanhamento e exames ajudam a proteger crianças, gestantes, idosos e pessoas com maior risco.',
  },
  {
    month: 'Julho',
    colors: 'Vermelho e Amarelo',
    title: 'Queimaduras e saúde cardiovascular',
    text: 'Julho reforça prevenção de queimaduras, cuidados em casa e atenção à pressão, ao coração e aos hábitos de vida.',
  },
  {
    month: 'Agosto',
    colors: 'Verde e Azul',
    title: 'Câncer de rim e saúde ocular',
    text: 'Consultas preventivas, hidratação e atenção à visão ajudam a manter o cuidado em dia ao longo do ano.',
  },
  {
    month: 'Setembro',
    colors: 'Amarelo',
    title: 'Prevenção ao suicídio',
    text: 'Escuta, acolhimento e acesso à rede de cuidado ajudam a proteger vidas e reduzir o sofrimento silencioso.',
  },
  {
    month: 'Outubro',
    colors: 'Rosa',
    title: 'Prevenção do câncer de mama',
    text: 'Outubro incentiva informação, autocuidado e avaliação profissional para ampliar diagnóstico precoce.',
  },
  {
    month: 'Novembro',
    colors: 'Azul',
    title: 'Prevenção do câncer de próstata',
    text: 'A campanha reforça orientação, acompanhamento e quebra de barreiras para cuidar da saúde do homem.',
  },
  {
    month: 'Dezembro',
    colors: 'Vermelho e Verde',
    title: 'Prevenção ao HIV/AIDS e consciência ambiental',
    text: 'O mês une prevenção, testagem, tratamento e atitudes que protegem a saúde coletiva e o ambiente.',
  },
];

export const getCurrentMonthlyCampaign = () => monthlyCampaigns[new Date().getMonth()] || monthlyCampaigns[0];

export const buildDefaultHealthPosts = (): HealthPost[] => {
  const campaign = getCurrentMonthlyCampaign();
  const basePosts: HealthPostPayload[] = [
    {
      title: 'Diagnóstico do HIV abre caminho para tratamento e vida digna',
      context: 'Testagem e cuidado',
      text: 'Testar cedo ajuda a iniciar acompanhamento e tratamento, proteger a saúde e reduzir riscos para o paciente.',
      icon: 'shield',
      imageUrl: '/news/noticia-hiv-testagem.png',
      published: true,
      displayOrder: 1,
    },
    {
      title: 'Tabagismo tem tratamento e apoio na rede de saúde',
      context: 'Parar de fumar',
      text: 'Com orientação profissional, plano de cuidado e acompanhamento, largar o cigarro se torna uma decisão possível.',
      icon: 'heart',
      imageUrl: '/news/noticia-tabagismo-tratamento.png',
      published: true,
      displayOrder: 2,
    },
    {
      title: campaign.title,
      context: `${campaign.month} ${campaign.colors}`,
      text: campaign.text,
      icon: 'bell',
      imageUrl: '/news/noticia-campanha-mensal.png',
      published: true,
      displayOrder: 3,
    },
    {
      title: 'Prevenção também é cuidado diário',
      context: 'Saúde em geral',
      text: 'Vacinação, consultas, exames e orientação de rotina mantêm a família acompanhada antes que o problema cresça.',
      icon: 'newspaper',
      imageUrl: '/news/noticia-saude-geral.png',
      published: true,
      displayOrder: 4,
    },
  ];

  return basePosts.map((post, index) => ({
    id: `default-health-post-${index + 1}`,
    createdAt: '',
    updatedAt: '',
    ...post,
  }));
};
