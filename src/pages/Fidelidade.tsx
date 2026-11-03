import { useMemo, useState } from 'react'
import { Coffee, Gift, Info, Lock, Search, Sparkles, Users } from 'lucide-react'
import { ContactDrawer } from '@/components/ContactDrawer'
import { ContactDialog } from '@/components/forms/ContactDialog'
import { PageSkeleton } from '@/components/PageSkeleton'
import { useCrm } from '@/contexts/CrmContext'
import { cn } from '@/lib/utils'
import { getLoyaltyLevel, initials, LOYALTY_LEVELS, type Contact } from '@/types/crm'

/** Página Fidelidade — panorama do programa + visão da base em tempo real. */
export default function Fidelidade() {
  const { contacts, loading } = useCrm()
  const [query, setQuery] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const detail = contacts.find((contact) => contact.id === detailId) || null

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      q
        ? contacts.filter((contact) =>
            `${contact.name} ${contact.email || ''} ${contact.phone || ''}`
              .toLowerCase()
              .includes(q),
          )
        : contacts,
    [contacts, q],
  )
  // Ordena por compras desc (maiores níveis primeiro)
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => (b.purchase_count || 0) - (a.purchase_count || 0) || a.name.localeCompare(b.name),
      ),
    [filtered],
  )

  const distribution = useMemo(() => {
    const counts = new Map<number, number>()
    for (const contact of contacts) {
      const level = getLoyaltyLevel(contact.purchase_count || 0).level
      counts.set(level, (counts.get(level) || 0) + 1)
    }
    return counts
  }, [contacts])

  const baseTotal = contacts.length
  const withLevel = contacts.filter(
    (c) => (c.purchase_count || 0) >= LOYALTY_LEVELS[0].minPurchases,
  ).length
  const maxCount = Math.max(
    1,
    ...LOYALTY_LEVELS.map((l) => distribution.get(l.level) || 0),
    distribution.get(0) || 0,
  )

  if (loading) return <PageSkeleton />

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#faf7f2]">
      {/* Cabeçalho */}
      <div className="shrink-0 border-b border-[#ded2c3] bg-[#fbf9f5] px-4 pb-3 pt-4 sm:px-5 shadow-2xs">
        <div className="flex items-start gap-2">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[#8c531b] font-bold">
              Programa de Fidelidade · São Domingos
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#2b1c13]">
              Fidelidade
            </h1>
            <p className="mt-1 text-xs text-[#705e4d]">
              Panorama do programa, níveis e progresso de cada cliente da base em tempo real.
            </p>
          </div>
          <div className="flex-1" />
          <div className="hidden sm:flex h-9 items-center gap-2 rounded-md border border-amber-500/30 bg-amber-50 px-3 shadow-2xs">
            <Coffee className="size-3.5 text-amber-600" />
            <span className="text-[10px] font-semibold text-[#5c4735]">
              {withLevel} de {baseTotal} cliente(s) com nível
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-5">
          {/* Como funciona */}
          <section
            data-tour-id="fidelidade-how-it-works"
            className="rounded-lg border border-[#ded2c3] bg-[#fbf9f5] p-4 shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Info className="size-4 shrink-0 text-amber-600" />
              <h2 className="text-[13px] font-bold tracking-[-.01em] text-[#2b1c13]">
                Como funciona
              </h2>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#705e4d]">
              A cada <strong className="text-[#2b1c13]">10 compras</strong> o cliente sobe de nível
              — um nível a cada 10 compras, do nível 1 (10 compras) até o nível 10 (100 compras).
              Com 0 a 9 compras o cliente ainda está sem nível, e ele pode{' '}
              <strong className="text-[#2b1c13]">pular níveis</strong> (ex.: 35 compras → nível 3).
              As recompensas de cada nível são de{' '}
              <strong className="text-[#2b1c13]">uso interno</strong>: ficam registradas aqui no CRM
              e <strong className="text-[#2b1c13]">nunca são enviadas ao cliente</strong> em
              mensagens.
            </p>
          </section>

          {/* Grade dos 10 níveis */}
          <section data-tour-id="fidelidade-levels-grid" className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-600" />
              <h2 className="text-[13px] font-bold tracking-[-.01em] text-[#2b1c13]">
                Os 10 níveis do programa
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {LOYALTY_LEVELS.map((levelMeta) => {
                const count = distribution.get(levelMeta.level) || 0
                return (
                  <div
                    key={levelMeta.level}
                    className="flex flex-col rounded-lg border border-[#ded2c3] bg-[#fbf9f5] p-3 shadow-2xs transition hover:border-amber-500/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold',
                          levelMeta.badgeColor,
                        )}
                      >
                        Nível {levelMeta.level} · {levelMeta.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] font-bold text-[#8c531b]">
                        {levelMeta.minPurchases}+
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] uppercase tracking-wider text-[#9c8978]">
                      Meta: {levelMeta.minPurchases} compra{levelMeta.minPurchases > 1 ? 's' : ''} ·{' '}
                      {count} cliente{count === 1 ? '' : 's'}
                    </p>
                    <div className="mt-2 flex-1 rounded-md border border-dashed border-[#d6c7b6] bg-white/60 p-2">
                      <div className="flex items-center gap-1">
                        <Gift className="size-3 shrink-0 text-amber-600" />
                        <span className="font-mono text-[8px] font-bold uppercase tracking-[.12em] text-[#8c531b]">
                          Recompensa · uso interno
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-medium leading-snug text-[#5c4735]">
                        {levelMeta.reward}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-start gap-1.5 rounded-md bg-amber-50/70 border border-amber-500/25 px-2.5 py-1.5">
              <Lock className="mt-0.5 size-3 shrink-0 text-amber-700" />
              <p className="text-[9.5px] leading-snug text-[#8c531b]">
                Recompensas marcadas como <strong>uso interno</strong>: somente a equipe vê — nunca
                aparecem em mensagens, WhatsApp ou telas do cliente.
              </p>
            </div>
          </section>

          {/* Distribuição da base por nível */}
          <section data-tour-id="fidelidade-distribution" className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-amber-600" />
              <h2 className="text-[13px] font-bold tracking-[-.01em] text-[#2b1c13]">
                Distribuição da base por nível
              </h2>
            </div>
            <div className="rounded-lg border border-[#ded2c3] bg-[#fbf9f5] p-3 shadow-2xs">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <DistributionBar
                  label="Sem nível"
                  hint="0–9 compras"
                  count={distribution.get(0) || 0}
                  maxCount={maxCount}
                  barClass="bg-slate-300"
                />
                {LOYALTY_LEVELS.map((levelMeta) => (
                  <DistributionBar
                    key={levelMeta.level}
                    label={`Nv.${levelMeta.level}`}
                    hint={`${levelMeta.minPurchases}+ compras`}
                    count={distribution.get(levelMeta.level) || 0}
                    maxCount={maxCount}
                    barClass="bg-amber-600"
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Lista de clientes com nível atual e progresso */}
          <section data-tour-id="fidelidade-client-list" className="space-y-2 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Coffee className="size-4 text-amber-600" />
                <h2 className="text-[13px] font-bold tracking-[-.01em] text-[#2b1c13]">
                  Clientes e progresso
                </h2>
                <span className="rounded-full bg-[#f3ece0] px-2 py-0.5 font-mono text-[9px] font-bold text-[#8c531b]">
                  {filtered.length}
                </span>
              </div>
              <div className="flex-1" />
              <div className="flex h-8 min-w-0 flex-1 sm:flex-none sm:w-72 items-center rounded-md border border-[#d6c7b6] bg-white px-2.5 shadow-2xs transition-colors focus-within:border-amber-600 focus-within:ring-1 focus-within:ring-amber-500/30">
                <Search className="mr-2 size-3.5 shrink-0 text-[#8c7865]" />
                <input
                  type="search"
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar cliente na lista..."
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-[#2b1c13] outline-none placeholder:text-[#9c8978]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Limpar busca"
                    className="ml-1 px-1 text-[11px] font-bold text-[#8c7865] hover:text-[#2b1c13]"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-[#ded2c3] bg-[#fbf9f5] shadow-2xs">
              {sorted.map((contact) => {
                const loyalty = getLoyaltyLevel(contact.purchase_count || 0)
                const detailParam = detail && detail.id === contact.id
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => setDetailId(contact.id)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-[#f1ebe1] px-3 py-2.5 text-left transition last:border-b-0 hover:bg-[#f3ece0]/60',
                      detailParam && 'bg-amber-50/50',
                    )}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-800">
                      {initials(contact.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[11px] font-bold text-[#2b1c13]">
                          {contact.name}
                        </span>
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9px] font-bold',
                            loyalty.badgeColor,
                          )}
                        >
                          {loyalty.level > 0 ? `Nv.${loyalty.level} ${loyalty.name}` : 'Sem nível'}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[9px] text-[#8c7865]">
                        {contact.purchase_count || 0} compra
                        {(contact.purchase_count || 0) === 1 ? '' : 's'}
                        {loyalty.level > 0 && loyalty.remainingToNext > 0 && (
                          <span className="ml-2 text-[#8c531b]">
                            faltam {loyalty.remainingToNext} para Nv.{loyalty.level + 1} ·{' '}
                            {loyalty.nextThreshold} compras
                          </span>
                        )}
                        {loyalty.level > 0 && loyalty.remainingToNext === 0 && (
                          <span className="ml-2 text-purple-700">nível máximo atingido 👑</span>
                        )}
                      </p>
                      <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#ece4d8]">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            loyalty.level > 0 ? 'bg-amber-600' : 'bg-slate-300',
                          )}
                          style={{ width: `${Math.max(3, loyalty.progressPct)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                )
              })}
              {!sorted.length && (
                <div className="grid h-32 place-items-center text-xs text-[#94a3b8]">
                  Nenhum cliente encontrado.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <ContactDrawer
        contact={detail}
        onClose={() => setDetailId(null)}
        onEdit={(contact) => {
          setEditing(contact)
          setDialogOpen(true)
        }}
      />
      <ContactDialog open={dialogOpen} onOpenChange={setDialogOpen} contact={editing} />
    </div>
  )
}

function DistributionBar({
  label,
  hint,
  count,
  maxCount,
  barClass,
}: {
  label: string
  hint: string
  count: number
  maxCount: number
  barClass: string
}) {
  const pct = Math.round((count / maxCount) * 100)
  return (
    <div className="flex min-w-[52px] flex-col items-center gap-1">
      <span className="font-mono text-[10px] font-bold text-[#2b1c13]">{count}</span>
      <div className="flex h-16 w-8 items-end overflow-hidden rounded bg-[#ece4d8]">
        <div
          className={cn('w-full rounded-t transition-all', barClass)}
          style={{ height: `${count === 0 ? 2 : Math.max(6, pct)}%` }}
        />
      </div>
      <span className="text-[9px] font-bold text-[#5c4735]">{label}</span>
      <span className="text-[8px] text-[#9c8978]">{hint}</span>
    </div>
  )
}
