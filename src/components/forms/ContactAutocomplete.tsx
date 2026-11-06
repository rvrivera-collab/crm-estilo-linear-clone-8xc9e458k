import { useState, useEffect, useRef, useMemo, useId } from 'react'
import {
  Check,
  ChevronsUpDown,
  Coffee,
  Phone,
  Search,
  User,
  UserPlus,
  X,
  LoaderCircle,
} from 'lucide-react'
import type { Contact } from '@/types/crm'
import { cn } from '@/lib/utils'

export interface ContactAutocompleteProps {
  contacts: Contact[]
  selectedContactId: string
  onSelectContact: (contact: Contact) => void
  onClear: () => void
  /**
   * Chamado quando o usuário digita um nome que não existe na base
   * e escolhe cadastrar/seguir como novo cliente avulso na hora.
   */
  onCreateQuickContact?: (name: string) => Promise<Contact | null>
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
}

/**
 * Remove acentuação e converte para minúsculas para busca sem acento e case-insensitive.
 */
function normalizeSearchText(text?: string | null): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Componente de Autocomplete de Cliente para o OrderDialog.
 *
 * Funcionalidades:
 * - Campo de texto direto com digitação contínua.
 * - Teclado abre no celular sem perder foco na 1ª letra.
 * - Filtra por nome, apelido, telefone ou café favorito (sem acento, case-insensitive).
 * - Lista suspensa rolável com destaque de informações secundárias (telefone, café favorito).
 * - Navegação via teclado (setas Cima/Baixo, Enter para selecionar, Esc para fechar).
 * - Botão de limpar (X) para buscar outro cliente.
 * - Caso nenhum cliente corresponda, avisa "Nenhum cliente encontrado" e oferece opção
 *   de criar/selecionar cliente avulso com o nome digitado.
 */
export function ContactAutocomplete({
  contacts,
  selectedContactId,
  onSelectContact,
  onClear,
  onCreateQuickContact,
  disabled = false,
  required = false,
  autoFocus = false,
}: ContactAutocompleteProps) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) || null,
    [contacts, selectedContactId],
  )

  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isCreatingQuick, setIsCreatingQuick] = useState(false)

  // Quando o diálogo abre ou o selectedContact muda externamente, sincroniza o texto
  useEffect(() => {
    if (selectedContact) {
      setInputValue(selectedContact.name)
    } else if (!selectedContactId) {
      setInputValue('')
    }
  }, [selectedContact, selectedContactId])

  // Filtragem dos clientes
  const filteredContacts = useMemo(() => {
    const q = normalizeSearchText(inputValue)
    if (!q) {
      // Se não há texto, mostra os primeiros 15 clientes mais recentes/cadastrados
      return contacts.slice(0, 15)
    }

    const matches = contacts.filter((c) => {
      const nameNorm = normalizeSearchText(c.name)
      const nicknameNorm = normalizeSearchText(c.nickname)
      const phoneNorm = (c.phone || '').replace(/\D/g, '')
      const qDigits = q.replace(/\D/g, '')
      const coffeeNorm = normalizeSearchText(c.favorite_coffee)
      const emailNorm = normalizeSearchText(c.email)

      const matchesText =
        nameNorm.includes(q) ||
        nicknameNorm.includes(q) ||
        coffeeNorm.includes(q) ||
        emailNorm.includes(q)

      const matchesPhone = qDigits.length >= 2 && phoneNorm.includes(qDigits)

      return matchesText || matchesPhone
    })

    return matches.slice(0, 20)
  }, [contacts, inputValue])

  // Reseta o índice destacado quando a lista de sugestões muda
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredContacts])

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        // Se saiu do campo sem selecionar, restaura o nome do cliente selecionado ou limpa
        if (selectedContact) {
          setInputValue(selectedContact.name)
        } else {
          setInputValue('')
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedContact])

  // Rola a lista para manter o item destacado visível no teclado
  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const activeEl = listRef.current.children[highlightedIndex] as HTMLElement | undefined
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex, isOpen])

  const handleSelect = (contact: Contact) => {
    onSelectContact(contact)
    setInputValue(contact.name)
    setIsOpen(false)
  }

  const handleClear = () => {
    onClear()
    setInputValue('')
    setIsOpen(true)
    inputRef.current?.focus()
  }

  const handleCreateQuick = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || !onCreateQuickContact) return
    setIsCreatingQuick(true)
    try {
      const newContact = await onCreateQuickContact(trimmed)
      if (newContact) {
        onSelectContact(newContact)
        setInputValue(newContact.name)
        setIsOpen(false)
      }
    } finally {
      setIsCreatingQuick(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      setHighlightedIndex((prev) => (prev < filteredContacts.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'Enter') {
      if (isOpen && filteredContacts.length > 0) {
        e.preventDefault()
        const target = filteredContacts[highlightedIndex]
        if (target) {
          handleSelect(target)
        }
      } else if (
        isOpen &&
        filteredContacts.length === 0 &&
        onCreateQuickContact &&
        inputValue.trim()
      ) {
        e.preventDefault()
        handleCreateQuick()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      if (selectedContact) {
        setInputValue(selectedContact.name)
      }
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-2.5 text-[#94a3b8]">
          <User className="size-3.5" />
        </span>

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          disabled={disabled}
          required={required && !selectedContactId}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            if (!isOpen) setIsOpen(true)
            // Se o usuário alterou o texto de um cliente já selecionado, limpa o vínculo até re-selecionar
            if (selectedContact && e.target.value !== selectedContact.name) {
              onClear()
            }
          }}
          onFocus={() => {
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Digite o nome do cliente para buscar..."
          className={cn(
            'w-full rounded-md border border-[#cbd5e1] bg-white pl-8 pr-16 py-1.5 text-xs text-[#1c1c1e] outline-none transition',
            'focus:border-amber-500 focus:ring-1 focus:ring-amber-500',
            selectedContact && 'border-amber-400 bg-amber-50/20 font-medium',
            disabled && 'bg-slate-100 opacity-60 cursor-not-allowed',
          )}
        />

        <div className="absolute right-1.5 flex items-center gap-0.5">
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Limpar e buscar outro cliente"
              className="rounded p-1 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569] transition"
            >
              <X className="size-3" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsOpen((prev) => !prev)
              inputRef.current?.focus()
            }}
            tabIndex={-1}
            className="rounded p-1 text-[#94a3b8] hover:text-[#475569]"
          >
            <ChevronsUpDown className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Badge ou indicação visual do cliente selecionado */}
      {selectedContact && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-amber-900 bg-amber-50/70 border border-amber-200/80 rounded px-2 py-0.5">
          <span className="truncate flex items-center gap-1">
            <span className="font-semibold text-amber-950">{selectedContact.name}</span>
            {selectedContact.phone && (
              <span className="text-[#64748b] text-[10px]">· {selectedContact.phone}</span>
            )}
            {selectedContact.favorite_coffee && (
              <span className="text-[#8c531b] text-[10px] hidden sm:inline">
                · {selectedContact.favorite_coffee}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-amber-700 hover:text-amber-900 font-semibold underline shrink-0 ml-1.5"
          >
            Trocar
          </button>
        </div>
      )}

      {/* Dropdown de sugestões */}
      {isOpen && (
        <div
          id={listboxId}
          className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#ded2c3] bg-white text-[#1c1c1e] shadow-lg animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {filteredContacts.length === 0 ? (
            <div className="p-3 text-center text-xs space-y-2">
              <p className="text-[#64748b]">
                Nenhum cliente cadastrado encontrado para "{inputValue.trim()}".
              </p>
              {onCreateQuickContact && inputValue.trim().length >= 2 && (
                <button
                  type="button"
                  disabled={isCreatingQuick}
                  onClick={handleCreateQuick}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#8c531b] text-white px-2.5 py-1.5 text-[11px] font-bold shadow-xs hover:bg-[#724113] transition"
                >
                  {isCreatingQuick ? (
                    <LoaderCircle className="size-3 animate-spin" />
                  ) : (
                    <UserPlus className="size-3" />
                  )}
                  Cadastrar "{inputValue.trim()}" como cliente avulso
                </button>
              )}
            </div>
          ) : (
            <ul ref={listRef} role="listbox" className="p-1 divide-y divide-[#f1f5f9]">
              {filteredContacts.map((contact, idx) => {
                const isSelected = contact.id === selectedContactId
                const isHighlighted = idx === highlightedIndex

                return (
                  <li
                    key={contact.id}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelect(contact)}
                    className={cn(
                      'flex items-center justify-between gap-2 px-2.5 py-2 text-xs rounded-md cursor-pointer transition select-none',
                      isHighlighted && 'bg-[#f7efe0] text-[#2b1c13]',
                      isSelected && 'bg-amber-100/60 font-semibold',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-semibold text-[#1c1c1e]">{contact.name}</span>
                        {contact.nickname && (
                          <span className="text-[10px] text-[#705e4d]">("{contact.nickname}")</span>
                        )}
                      </div>

                      {/* Dados secundários: Telefone ou Café favorito */}
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#64748b]">
                        {contact.phone ? (
                          <span className="flex items-center gap-0.5 font-mono">
                            <Phone className="size-2.5 text-[#94a3b8]" />
                            {contact.phone}
                          </span>
                        ) : null}

                        {contact.favorite_coffee ? (
                          <span className="flex items-center gap-0.5 truncate text-[#8c531b]">
                            <Coffee className="size-2.5 text-amber-700 shrink-0" />
                            {contact.favorite_coffee}
                          </span>
                        ) : null}

                        {contact.city && !contact.favorite_coffee ? (
                          <span className="truncate text-[#94a3b8]">
                            {contact.city}
                            {contact.state ? `/${contact.state}` : ''}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {isSelected && <Check className="size-3.5 text-amber-800 shrink-0" />}
                  </li>
                )
              })}
            </ul>
          )}

          {/* Dica de teclado discreta */}
          <div className="border-t border-[#f1f5f9] bg-[#fbf9f5] px-2.5 py-1 text-[10px] text-[#94a3b8] flex items-center justify-between">
            <span>Use ↑↓ e Enter para selecionar</span>
            <span>{filteredContacts.length} sugestão(ões)</span>
          </div>
        </div>
      )}
    </div>
  )
}
