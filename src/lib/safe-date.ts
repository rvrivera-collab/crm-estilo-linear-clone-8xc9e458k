/**
 * Utilitários de data tolerantes a valores ausentes/inválidos.
 *
 * Resolve o erro "Invalid time value": o PocketBase devolve datas como
 * "1988-08-15 00:00:00.000Z" (ESPAÇO em vez de "T") e "0001-01-01 00:00:00.000Z"
 * quando o campo está vazio. Montar o payload de salvar com essas strings
 * (ex.: `new Date(valor + "T00:00:00.000Z")`) gera um Date inválido e
 * `toISOString()` lança RangeError: Invalid time value.
 */

const ZERO_DATE_PREFIX = '0001-01-01'

/** Remove a parte de hora e normaliza o separador (" " ou "T") de uma data. */
function datePart(value: string): string {
  return String(value).trim().split(' ')[0].split('T')[0]
}

function isCalendarDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Data "zero" do PocketBase (campo vazio). */
export function isZeroDate(value?: string | null): boolean {
  return !!value && datePart(value).startsWith(ZERO_DATE_PREFIX)
}

/**
 * Interpreta qualquer data vinda do backend de forma segura e cross-browser.
 * Retorna null quando vazia, zero-date ou inválida — nunca lança.
 */
export function safeParseDate(value?: string | null): Date | null {
  if (!value || isZeroDate(value)) return null
  const raw = String(value).trim()
  // Formato PocketBase "YYYY-MM-DD HH:MM:SS.SSSZ" não é ISO: troca o espaço por "T"
  const normalized = /^[T ]/.test(raw) ? raw : raw.replace(' ', 'T')
  const parsed = new Date(
    isCalendarDay(datePart(raw)) && !/T|\d{2}:/.test(raw)
      ? `${datePart(raw)}T00:00:00.000Z`
      : normalized,
  )
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Parte "YYYY-MM-DD" segura de qualquer data (ISO ou formato PocketBase).
 * Retorna '' quando vazia, zero-date ou inválida — nunca lança.
 */
export function safeDatePart(value?: string | null): string {
  const parsed = safeParseDate(value)
  if (!parsed) return ''
  return parsed.toISOString().slice(0, 10)
}

/**
 * Converte uma data do registro para o valor aceito por <input type="date">.
 * Retorna '' quando vazia, zero-date ou inválida (nunca lança).
 */
export function safeDateInput(value?: string | null): string {
  return safeDatePart(value)
}

/**
 * Converte o valor de <input type="date"> para ISO UTC.
 * Retorna null quando vazio/inválido (limpa o campo em vez de estourar "Invalid time value").
 */
export function safeIsoOrNull(value?: string | null): string | null {
  if (!value) return null
  const part = datePart(String(value).trim())
  if (!isCalendarDay(part) || part.startsWith(ZERO_DATE_PREFIX)) return null
  const parsed = new Date(`${part}T00:00:00.000Z`)
  return isNaN(parsed.getTime()) ? null : parsed.toISOString()
}
