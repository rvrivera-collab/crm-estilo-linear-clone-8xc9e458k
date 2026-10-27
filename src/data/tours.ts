import type { PageTourDefinition } from '@/types/tour'

export const PAGE_TOURS: Record<string, PageTourDefinition> = {
  '/ask': {
    pagePath: '/ask',
    pageName: 'Agent IA',
    steps: [
      {
        target: '[data-tour-id="agent-chat-input"]',
        title: 'Input Central do CRM Agent',
        description:
          'Digite comandos em linguagem natural para consultar indicadores, criar negócios, buscar contatos ou atualizar estágios do pipeline.',
        placement: 'bottom',
        badge: 'Enter para enviar',
      },
      {
        target: '[data-tour-id="agent-skills-button"]',
        title: 'Habilidades Integradas da IA',
        description:
          'Conheça as capacidades ativas do assistente: consulta ao pipeline, pesquisa avançada de contatos e movimentação assistida de propostas.',
        placement: 'bottom',
        badge: 'Automação inteligente',
      },
      {
        target: '[data-tour-id="agent-history-dropdown"]',
        title: 'Histórico de Conversas',
        description:
          'Alterne rapidamente entre chats anteriores, inicie uma nova conversa ou consulte respostas passadas com facilidade.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="agent-clear-button"]',
        title: 'Limpar Conversa',
        description:
          'Redefina as mensagens do chat atual a qualquer momento mantendo o título da conversa no seu histórico.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="agent-example-cards"]',
        title: 'Sugestões e Atalhos Rápidos',
        description:
          'Clique em qualquer um dos cards sugeridos para disparar análises prontas sobre risco de perda, fechamentos e criação de negócios.',
        placement: 'top',
      },
    ],
  },
  '/dashboard': {
    pagePath: '/dashboard',
    pageName: 'Dashboard',
    steps: [
      {
        target: '[data-tour-id="dashboard-period-filter"]',
        title: 'Filtros de Período e Data Limite',
        description:
          'Filtre todo o painel por 7, 30 ou 90 dias, mês corrente ou histórico completo, com opção de definir uma data limite precisa.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="dashboard-kpis"]',
        title: 'Indicadores Principais (KPIs)',
        description:
          'Acompanhe o volume total movimentado, negócios ganhos, taxa de conversão (Win Rate) e leads em aberto em tempo real.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="dashboard-custom-metrics"]',
        title: 'Métricas Personalizadas',
        description:
          'Crie cartões de métricas customizados combinando agregações (soma, média, contagem, win rate) com estágios específicos do pipeline.',
        placement: 'bottom',
        badge: 'Customizável',
      },
      {
        target: '[data-tour-id="dashboard-funnel-section"]',
        title: 'Funil Completo & Dias Parado',
        description:
          'Visualize o volume por estágio do funil e o tempo médio que os negócios passam estagnados em cada fase, alertando riscos de perda.',
        placement: 'top',
        badge: 'Gargalos & Alertas',
      },
      {
        target: '[data-tour-id="dashboard-deals-table"]',
        title: 'Oportunidades Ativas no Período',
        description:
          'Tabela analítica dos negócios da janela selecionada, com ordenação por dias parado e valor financeiro.',
        placement: 'top',
      },
    ],
  },
  '/pipeline': {
    pagePath: '/pipeline',
    pageName: 'Pipeline',
    steps: [
      {
        target: '[data-tour-id="pipeline-header-stats"]',
        title: 'Visão Geral do Fluxo Comercial',
        description:
          'Visualize a contagem total de negócios ativos e a receita financeira consolidada em negociação.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="pipeline-kanban-board"]',
        title: 'Kanban Interativo de Negócios',
        description:
          'Arraste e solte (Drag & Drop) os cards entre os estágios comerciais para atualizar a evolução das vendas instantaneamente.',
        placement: 'bottom',
        badge: 'Drag & Drop',
      },
      {
        target: '[data-tour-id="pipeline-deal-card"]',
        title: 'Card de Negócio & Alerta de Dias Parado',
        description:
          'Cada card destaca a temperatura do lead, dias sem contato e badge de alerta quando o negócio está parado há 7 ou 14 dias.',
        placement: 'right',
        badge: 'Atenção aos alertas',
      },
      {
        target: '[data-tour-id="pipeline-new-deal-btn"]',
        title: 'Adicionar Nova Oportunidade',
        description:
          'Cadastre novos negócios diretamente na coluna desejada informando título, valor previsto, contato e responsável.',
        placement: 'top',
      },
    ],
  },
  '/recuperacao': {
    pagePath: '/recuperacao',
    pageName: 'Recuperação de Leads',
    steps: [
      {
        target: '[data-tour-id="recovery-kpis"]',
        title: 'Monitor de Leads Esfriando',
        description:
          'Painel de controle com leads sem contato há mais de 5 dias, destacando casos críticos de 10+ dias e receita sob risco.',
        placement: 'bottom',
        badge: 'Prevenção de Churn',
      },
      {
        target: '[data-tour-id="recovery-filters"]',
        title: 'Filtros Rápidos & Modos de Visualização',
        description:
          'Pesquise por nome da empresa ou código, filtre por temperatura ou estágio e alterne entre a visão em cards e tabela Linear.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="recovery-retomar-ia"]',
        title: 'Retomada Instantânea com IA',
        description:
          'Dispare e-mails de follow-up personalizados gerados por IA, ajustando argumentos com base no histórico do lead.',
        placement: 'left',
        badge: 'Follow-up Inteligente',
      },
    ],
  },
  '/negocios': {
    pagePath: '/negocios',
    pageName: 'Negócios',
    steps: [
      {
        target: '[data-tour-id="deals-search-filters"]',
        title: 'Busca e Agrupamentos Flexíveis',
        description:
          'Localize propostas rapidamente e agrupe a lista por estágio, responsável comercial ou status de fechamento.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="deals-table-header"]',
        title: 'Tabela Linear de Oportunidades',
        description:
          'Visualize colunas completas com temperatura, dias sem contato, dias parado, estágio e valor financeiro.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="deals-first-row"]',
        title: 'Detalhes do Negócio & Ações Rápidas',
        description:
          'Clique em qualquer linha para abrir a gaveta lateral completa com histórico de atividades, notas e envio de e-mails.',
        placement: 'bottom',
      },
    ],
  },
  '/contatos': {
    pagePath: '/contatos',
    pageName: 'Contatos',
    steps: [
      {
        target: '[data-tour-id="contacts-header-actions"]',
        title: 'Gestão de Relacionamentos Comerciais',
        description:
          'Cadastre novos decisores, leads ou clientes vinculando empresas, cargos, telefones e responsáveis pela conta.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="contacts-search-bar"]',
        title: 'Busca Rápida e Filtro por Status',
        description:
          'Filtre contatos entre Leads, Ativos ou Inativos e encontre qualquer pessoa por nome ou empresa em tempo real.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="contacts-table-list"]',
        title: 'Lista de Contatos e Gaveta Lateral',
        description:
          'Clique em um contato para acessar seu histórico completo de interações, negócios associados e notas de reunião.',
        placement: 'top',
      },
    ],
  },
  '/empresas': {
    pagePath: '/empresas',
    pageName: 'Empresas',
    steps: [
      {
        target: '[data-tour-id="empresas-header-actions"]',
        title: 'Contas & Organizações',
        description:
          'Gerencie as contas comerciais da sua base. Crie empresas e centralize todos os contatos e oportunidades sob a mesma entidade jurídica.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="empresas-search-bar"]',
        title: 'Busca por Setor e Porte',
        description:
          'Localize empresas por nome comercial, setor de mercado ou porte (pequena, média, grande) instantaneamente.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="empresas-table-list"]',
        title: 'Visão Consolidada de Negócios e Contatos',
        description:
          'Veja quantos decisores estão cadastrados, negócios abertos e o valor total em pipeline de cada organização. Clique para abrir o raio-X completo da empresa.',
        placement: 'top',
      },
    ],
  },
  '/campanhas': {
    pagePath: '/campanhas',
    pageName: 'Campanhas de Captação',
    steps: [
      {
        target: '[data-tour-id="campaigns-header-actions"]',
        title: 'Criação de Campanhas de Captação',
        description:
          'Organize suas fontes de tráfego (Google, Meta, Eventos, Parcerias) e vincule formulários específicos para rastreio.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="campaigns-table"]',
        title: 'Tabela de Campanhas & Conversão',
        description:
          'Acompanhe o status (ativa, pausada, encerrada) e a quantidade de leads capturados em cada iniciativa.',
        placement: 'right',
      },
      {
        target: '[data-tour-id="campaigns-embed-preview"]',
        title: 'Prévia e Embed de Captação',
        description:
          'Obtenha o link direto ou copie o código iframe/script pronto para colar em landing pages e sites externos.',
        placement: 'left',
        badge: 'Pronto para uso',
      },
    ],
  },
  '/formularios': {
    pagePath: '/formularios',
    pageName: 'Formulários de Captação',
    steps: [
      {
        target: '[data-tour-id="forms-selector-header"]',
        title: 'Gerenciador de Formulários',
        description:
          'Crie múltiplos formulários públicos para diferentes produtos, públicos-alvo ou campanhas da sua empresa.',
        placement: 'bottom',
      },
      {
        target: '[data-tour-id="forms-tabs-nav"]',
        title: 'Abas Personalizar e Embed',
        description:
          'Alterne entre a personalização visual dos campos e a aba Embed para obter códigos de integração externa.',
        placement: 'bottom',
        badge: 'Personalizar vs Embed',
      },
      {
        target: '[data-tour-id="forms-custom-fields-section"]',
        title: 'Campos Personalizados do Formulário',
        description:
          'Adicione campos extras como seleção de opções, cargo, faturamento ou perguntas abertas com total flexibilidade.',
        placement: 'right',
      },
      {
        target: '[data-tour-id="forms-live-preview"]',
        title: 'Pré-visualização em Tempo Real',
        description:
          'Teste como o formulário se comporta na visão Desktop e Mobile, incluindo cores da marca e mensagem de sucesso.',
        placement: 'left',
      },
    ],
  },
}

export function getTourForPath(path: string): PageTourDefinition | undefined {
  // Normalizar /ask/ => /ask, /dashboard/ => /dashboard
  const cleanPath = path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  if (cleanPath === '/' || cleanPath === '') {
    return PAGE_TOURS['/ask']
  }
  return PAGE_TOURS[cleanPath]
}
