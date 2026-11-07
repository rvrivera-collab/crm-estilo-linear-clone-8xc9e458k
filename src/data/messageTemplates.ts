import type { Contact } from '@/types/crm'
import { getLoyaltyLevel, getCoffeeProgressInLevel } from '@/types/crm'

export interface MessageTemplate {
  id: string
  title: string
  category:
    | 'recorrencia_30d'
    | 'aniversario'
    | 'nivel_fidelidade'
    | 'progresso_fidelidade'
    | 'avaliacao_google'
    | 'personalizado'
  description: string
  text: string
  tags?: string[]
}

/**
 * Biblioteca de Mensagens Pré-Prontas de Encantamento no tom "Experiência Disney":
 * Foco em fazer o cliente se sentir único, valorizado, com atenção minuciosa aos detalhes do paladar.
 * Variáveis suportadas:
 * - {nome}: Primeiro nome do cliente
 * - {apelido}: Como prefere ser chamado (ou primeiro nome se não houver)
 * - {cafe_favorito}: Café favorito cadastrado (ou "café especial fresquinho")
 * - {metodo}: Método preferido (V60, Prensa Francesa, Espresso...)
 * - {torra}: Torra preferida
 * - {nivel}: Nível de fidelidade por extenso
 * - {cupom}: Código do cupom atribuído (ou cupom padrão)
 * - {desconto}: Percentual de desconto (% OFF)
 * - {link_avaliacao}: Link para avaliação no Google
 */
/** Link oficial da ficha do Google (perfil Empresa) usado em mensagens e cards. */
export const GOOGLE_REVIEW_URL = 'https://g.page/r/Cc1UruBeWXaZEBE/review'

export const DISNEY_MESSAGE_TEMPLATES: MessageTemplate[] = [
  // ==========================================
  // RECOMPRA 30 DIAS (3 Variantes Calorosas com Tom Disney)
  // ==========================================
  {
    id: 'recompra_30d_aroma_saudade',
    title: 'Aroma & Saudade (Variante 1)',
    category: 'recorrencia_30d',
    description: 'Tom caloroso e poético sobre o grão acabando em casa e safras novas chegando.',
    tags: ['Recompra', '30 dias', 'Afetivo'],
    text: `Oi, {apelido}! ☕💛 Sentimos sua falta por aqui!

Passando com muito carinho para saber como você está e se os seus grãos especiais de {cafe_favorito} já estão no finzinho em casa.

Aqui na cafeteria acabamos de receber novos lotes fresquinhos com notas aromáticas incríveis e torra no ponto perfeito! Quando puder, dá um pulinho aqui para batermos um papo e prepararmos aquela extração do jeitinho que você gosta.

Separamos um cantinho especial esperando por você! Um abraço caloroso da nossa equipe. ✨☕`,
  },
  {
    id: 'recompra_30d_ritual_fresco',
    title: 'O Seu Ritual Merece Grãos Frescos (Variante 2)',
    category: 'recorrencia_30d',
    description:
      'Enfatiza a atenção aos detalhes do preparo do café preferido e o frescor da torra.',
    tags: ['Recompra', '30 dias', 'Método'],
    text: `Olá, {apelido}! ✨☕ Esperamos que seu dia esteja leve e inspirador!

Lembramos de você hoje ao calibrar o moinho: já faz 30 dias desde a sua última visita e sabemos o quanto você valoriza um {cafe_favorito} fresco no seu dia a dia.

Para nós, cada xícara sua é um momento que merece perfeição. Nossos microlotes desta semana estão excepcionais e queremos muito garantir que sua despensa continue abastecida com o melhor aroma!

Se quiser, já deixamos o seu pacote separado ou moído para o seu preparo favorito. Te esperamos com um sorriso! ✨`,
  },
  {
    id: 'recompra_30d_mimo_retorno',
    title: 'Boas-Vindas com Mimo Especial (Variante 3)',
    category: 'recorrencia_30d',
    description: 'Convite caloroso oferecendo cupom ou mimo exclusivo para retorno após 30 dias.',
    tags: ['Recompra', '30 dias', 'Cupom'],
    text: `Oi, {apelido}! ☕💛 Que saudade de ver você por aqui!

Passou voando: faz exatamente um mês desde o seu último pedido de {cafe_favorito}. Como anda a sua xícara pela manhã?

Para tornar o seu retorno ainda mais doce e acolhedor, preparamos um mimo especial de boas-vindas: use o código *{cupom}* na sua próxima visita e ganhe *{desconto}* nos nossos grãos artesanais!

Vem tomar aquele café com a gente e contar as novidades! Um abraço cheio de afeto. 🎁✨`,
  },

  // ==========================================
  // PEDIR AVALIAÇÃO DO GOOGLE (Pós-Recebimento do Pedido)
  // ==========================================
  {
    id: 'avaliacao_google_calorosa',
    title: 'Agradecimento & Avaliação no Google',
    category: 'avaliacao_google',
    description: 'Agradece a confiança no pedido entregue e pede avaliação gentil no Google.',
    tags: ['Google', 'Avaliação', 'Pós-venda'],
    text: `Olá, {apelido}! 🌟☕ Tudo bem?

Vimos que o seu pedido de café especial acabou de chegar aí para você! Esperamos de coração que a experiência de abrir o pacote e sentir o primeiro aroma tenha sido mágica.

O seu carinho e a sua opinião são fundamentais para que a nossa cafeteria continue encantando mais pessoas. Se você tiver 1 minutinho, significaria o mundo para nós se pudesse deixar uma avaliação sincera no Google:

👉 {link_avaliacao}

Muito obrigado por fazer parte da nossa história e permitir que façamos parte do seu dia a dia. Qualquer detalhe, estamos sempre por aqui! Com carinho, equipe de Cafés Especiais. ✨💛`,
  },

  // ==========================================
  // ANIVERSÁRIO
  // ==========================================
  {
    id: 'aniversario_disney_presente',
    title: 'Celebração de Aniversário com Cupom 15%',
    category: 'aniversario',
    description: 'Mensagem festiva Disney parabenizando pelo ciclo de vida com cupom de presente.',
    tags: ['Aniversário', 'Festa', 'Presente'],
    text: `Olá, {apelido}! 🎂✨ Parabéns pelo seu dia!

Hoje é uma data verdadeiramente especial e aqui na cafeteria nós celebramos a sua vida com muito carinho e aroma de café fresco!

Sabemos do seu amor por *{cafe_favorito}* e queremos que seu novo ciclo seja repleto de doçura, saúde e conquistas inspiradoras.

🎁 Preparamos um presente exclusivo: use o seu cupom pessoal *{cupom}* para garantir *15% OFF* na sua próxima visita ou pedido!

Que seu dia seja maravilhoso! Te esperamos para um brinde com a xícara perfeita! ☕🎉`,
  },

  // ==========================================
  // PROGRESSO & NÍVEL DE FIDELIDADE
  // ==========================================
  {
    id: 'fidelidade_progresso_cafezinhos',
    title: 'Progresso com Barrinha de Cafezinhos',
    category: 'progresso_fidelidade',
    description:
      'Mensagem pós-compra com barrinha visual de cafezinhos ☕ acumulados no nível e contagem para subir de nível.',
    tags: ['Fidelidade', 'Clube', 'Cafezinhos', 'Pós-compra'],
    text: `Oi, {apelido}! ☕✨ Obrigado pela sua compra realizada em *{data_hoje}* (sua *compra nº {compras_total}*) — é uma alegria imensa fazer parte do seu dia!

📊 *Seu progresso no Clube de Fidelidade:*
• Nível atual: *{nivel}*
• Progresso do nível: {barra_cafezinhos}
• {faltam_compras}

Sabemos do seu bom gosto pelo nosso café *{cafe_favorito}* preparado na {metodo} — cada xícara sua é um momento único.

Te esperamos de braços abertos para a próxima xícara! ✨💛`,
  },
  {
    id: 'fidelidade_novo_patamar',
    title: 'Parabéns por Novo Nível de Fidelidade',
    category: 'nivel_fidelidade',
    description:
      'Reconhecimento do avanço de nível com barrinha completa de cafezinhos, sem revelar a recompensa (uso interno).',
    tags: ['Fidelidade', 'Clube', 'VIP'],
    text: `Parabéns, {apelido}! ⭐☕ Você atingiu o *{nivel}* no nosso Clube de Fidelidade!

Data da compra: *{data_hoje}* (sua *compra nº {compras_total}*).
Progresso no nível: ☕☕☕☕☕☕☕☕☕☕ (10/10 — Nível Conquistado!)

Cada visita sua enriquece a nossa história e nos enche de orgulho. Temos uma surpresa especial reservada para celebrar você na cafeteria!

O seu amor por *{cafe_favorito}* faz toda a diferença para o nosso time!

Obrigado por confiar no nosso trabalho artesanal. Esperamos você em breve para brindar essa conquista! ✨🏆`,
  },

  // ==========================================
  // ATENDIMENTO ESPECIAL / PERSONALIZADO
  // ==========================================
  {
    id: 'personalizado_atencao_detalhes',
    title: 'Atenção Aos Detalhes & Carinho Especial',
    category: 'personalizado',
    description: 'Mensagem de encantamento geral destacando o cuidado nos detalhes.',
    tags: ['Personalizado', 'Encantamento'],
    text: `Olá, {apelido}! ☕✨ Esperamos que o seu dia esteja maravilhoso!

Passando apenas para desejar momentos inspiradores e cheios de aconchego com uma xícara quentinha de café especial.

Sabemos do seu carinho por *{cafe_favorito}* e estamos sempre à disposição para sugerir novidades ou separar microlotes exclusivos para você.

Tenha uma semana radiante! Um abraço carinhoso da nossa equipe. 💛`,
  },
]

/**
 * Preenche as variáveis {nome}, {apelido}, {cafe_favorito}, {metodo}, {torra}, {nivel}, {cupom}, {desconto}, {link_avaliacao}
 * com os dados reais do cliente.
 */
export function formatTemplateText(
  templateText: string,
  contact: Contact,
  overrides?: {
    couponCode?: string
    discountText?: string
    googleReviewUrl?: string
    customCoffee?: string
  },
): string {
  const firstName = contact.name.trim().split(' ')[0] || 'Cliente'
  const displayName = contact.nickname?.trim() || firstName
  const coffee =
    overrides?.customCoffee || contact.favorite_coffee?.trim() || 'café especial fresquinho'
  const method = contact.brew_method_preference?.trim() || 'seu método favorito'
  const roast = contact.roast_preference?.trim() || 'torra artesanal'
  const count = contact.purchase_count || 0
  const loyalty = getLoyaltyLevel(count)
  const progress = getCoffeeProgressInLevel(count)
  const coupon = overrides?.couponCode || contact.last_coupon_code || 'CAFE-ESPECIAL'
  const discount = overrides?.discountText || '10% OFF'
  const reviewUrl = overrides?.googleReviewUrl || 'https://g.page/r/sua-cafeteria/review' // URL de exemplo padrão configurável

  const todayStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())

  const remaining = loyalty.remainingToNext
  const nextLevelName = getLoyaltyLevel(loyalty.nextThreshold).name
  const faltamComprasText =
    remaining > 0
      ? `Faltam só *${remaining} ${remaining === 1 ? 'compra' : 'compras'}* para você subir de nível (*${nextLevelName}*)!`
      : `Você já conquistou o nível máximo *${loyalty.name}* — clube VIP da casa! 👑`

  const barText =
    progress.coffeesCount > 0
      ? `${progress.coffeeBar} (${progress.coffeesCount}/${progress.totalInSpan})`
      : `☕ (1ª compra rumo ao próximo nível)`

  const levelDisplay =
    loyalty.level > 0
      ? `Nível ${loyalty.level} — ${loyalty.name}`
      : `Iniciante (Rumo ao Nível 1 — ${nextLevelName})`

  return templateText
    .replace(/\{nome\}/g, firstName)
    .replace(/\{apelido\}/g, displayName)
    .replace(/\{cafe_favorito\}/g, coffee)
    .replace(/\{metodo\}/g, method)
    .replace(/\{torra\}/g, roast)
    .replace(/\{nivel\}/g, levelDisplay)
    .replace(/\{barra_cafezinhos\}/g, barText)
    .replace(/\{faltam_compras\}/g, faltamComprasText)
    .replace(/\{compras_total\}/g, String(Math.max(1, count)))
    .replace(/\{data_hoje\}/g, todayStr)
    .replace(/\{cupom\}/g, coupon)
    .replace(/\{desconto\}/g, discount)
    .replace(/\{link_avaliacao\}/g, reviewUrl)
}
