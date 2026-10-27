import { useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Coffee,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { importSpreadsheetData, type ImportSpreadsheetProgress } from '@/lib/import-excel'
import type { SpreadsheetImportSummary } from '@/types/crm'

interface ImportSpreadsheetModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ImportSpreadsheetModal({ open, onClose, onSuccess }: ImportSpreadsheetModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<ImportSpreadsheetProgress | null>(null)
  const [summary, setSummary] = useState<SpreadsheetImportSummary | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const resetState = () => {
    setFile(null)
    setIsProcessing(false)
    setProgress(null)
    setSummary(null)
    setErrorMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      const ext = selected.name.toLowerCase().split('.').pop()
      if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
        setErrorMessage('Por favor, selecione um arquivo de planilha válido (.xlsx, .xls ou .csv).')
        return
      }
      setFile(selected)
      setErrorMessage(null)
      setSummary(null)
    }
  }

  const handleStartImport = async () => {
    if (!file) return
    setIsProcessing(true)
    setErrorMessage(null)
    setSummary(null)

    try {
      const res = await importSpreadsheetData(file, (p) => {
        setProgress(p)
      })
      setSummary(res)
      onSuccess()
    } catch (err) {
      console.error('Falha na importação de planilha:', err)
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro ao processar e gravar os dados da planilha. Tente novamente.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCloseModal = () => {
    if (isProcessing) return
    resetState()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isProcessing) handleCloseModal()
      }}
    >
      <div className="flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-xl sm:border sm:border-[#e2e8f0] sm:shadow-2xl overflow-hidden animate-panel-rise">
        {/* Header estilo Linear */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-700">
              <FileSpreadsheet className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#1c1c1e]">
                Importar Base de Clientes (XLSX)
              </h2>
              <p className="text-[11px] text-[#64748b]">
                Fazenda São Domingos · Clientes, vendas e aniversários
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleCloseModal}
            className="rounded p-1 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {!summary ? (
            <>
              {/* Card explicativo */}
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-3.5 text-[11px] text-[#475569] space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <Coffee className="size-3.5 text-amber-700" />
                  <span>Mapeamento Automático Inteligente</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90">
                  O importador lê a aba <strong>"Base de Clientes"</strong> e sincroniza contatos
                  (nome, telefone, cidade/UF, aniversário DD/MM, preferência de café, endereço de
                  envio, canal e observações). Se a aba <strong>"Registro de Vendas"</strong>{' '}
                  estiver presente, as compras são lançadas e a fidelidade é recalculada.
                </p>
                <div className="flex items-center gap-1 text-[10px] text-amber-800 font-medium">
                  <span className="font-bold">⚡ Deduplicação por nome:</span> contatos já
                  existentes são atualizados nos campos vazios, sem criar registros duplicados.
                </div>
              </div>

              {/* Seletor de Arquivo */}
              <div
                onClick={() => {
                  if (!isProcessing) fileInputRef.current?.click()
                }}
                className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
                  file
                    ? 'border-amber-400 bg-amber-50/20'
                    : 'border-[#cbd5e1] hover:border-amber-400 hover:bg-[#f8fafc]'
                } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="mb-2 grid size-12 place-items-center rounded-full bg-slate-100 text-[#64748b] group-hover:bg-amber-100 group-hover:text-amber-800 transition">
                  <Upload className="size-5" />
                </div>

                {file ? (
                  <div>
                    <p className="text-xs font-bold text-[#1c1c1e]">{file.name}</p>
                    <p className="mt-0.5 text-[10px] text-[#64748b]">
                      {(file.size / 1024).toFixed(1)} KB · Clique para trocar de arquivo
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-[#1c1c1e]">
                      Arraste ou clique para selecionar a planilha
                    </p>
                    <p className="mt-1 text-[10px] text-[#94a3b8]">
                      Suporta arquivos .xlsx ou .csv da Fazenda São Domingos
                    </p>
                  </div>
                )}
              </div>

              {/* Erros amigáveis */}
              {errorMessage && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Aviso na Importação</p>
                    <p className="text-[11px] leading-relaxed mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Progresso durante importação */}
              {isProcessing && progress && (
                <div className="rounded-lg border border-[#e2e8f0] bg-[#fafbfc] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#1c1c1e]">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin text-amber-600" />
                      {progress.message}
                    </span>
                    <span className="font-mono text-[11px] text-amber-700">
                      {progress.percent}%
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>

                  {progress.totalClients > 0 && (
                    <p className="text-[10px] text-[#64748b] text-right font-mono">
                      {progress.processedClients} de {progress.totalClients} clientes analisados
                      {progress.processedPurchases > 0 &&
                        ` · ${progress.processedPurchases} vendas`}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Tela de Sucesso com Resumo */
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4">
                <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-emerald-950">
                    Importação Concluída com Sucesso!
                  </h3>
                  <p className="text-[11px] text-emerald-800">
                    A base do CRM foi atualizada em tempo real no banco de dados.
                  </p>
                </div>
              </div>

              {/* Grid com métricas da importação */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-center shadow-2xs">
                  <div className="flex justify-center text-amber-600 mb-1">
                    <UserPlus className="size-4" />
                  </div>
                  <span className="text-lg font-black text-[#1c1c1e]">
                    {summary.clientsCreated}
                  </span>
                  <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
                    Criados
                  </span>
                </div>

                <div className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-center shadow-2xs">
                  <div className="flex justify-center text-blue-600 mb-1">
                    <UserCheck className="size-4" />
                  </div>
                  <span className="text-lg font-black text-[#1c1c1e]">
                    {summary.clientsUpdated}
                  </span>
                  <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
                    Atualizados
                  </span>
                </div>

                <div className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-center shadow-2xs">
                  <div className="flex justify-center text-slate-500 mb-1">
                    <Users className="size-4" />
                  </div>
                  <span className="text-lg font-black text-[#1c1c1e]">
                    {summary.clientsUnchanged}
                  </span>
                  <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
                    Inalterados
                  </span>
                </div>

                <div className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-center shadow-2xs">
                  <div className="flex justify-center text-emerald-600 mb-1">
                    <Coffee className="size-4" />
                  </div>
                  <span className="text-lg font-black text-[#1c1c1e]">
                    {summary.purchasesImported}
                  </span>
                  <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
                    Compras
                  </span>
                </div>
              </div>

              {summary.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-[11px] text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <AlertCircle className="size-3.5 text-amber-700" />
                    Avisos durante o processamento ({summary.warnings.length}):
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-amber-800 max-h-24 overflow-y-auto">
                    {summary.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé com botões de ação */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#e5e7eb] bg-[#fafafa] px-4 py-3 sm:px-6">
          {!summary ? (
            <>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCloseModal}
                className="h-8 rounded-md border border-[#cbd5e1] bg-white px-3 text-[11px] font-semibold text-[#475569] hover:bg-[#f1f5f9] transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!file || isProcessing}
                onClick={handleStartImport}
                className="flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3.5 text-[11px] font-bold text-white shadow-xs hover:bg-amber-600 transition disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    <span>Iniciar Importação</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetState}
                className="flex h-8 items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-3 text-[11px] font-semibold text-[#475569] hover:bg-[#f1f5f9] transition"
              >
                <RefreshCw className="size-3 text-[#64748b]" />
                Importar outro arquivo
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex h-8 items-center gap-1.5 rounded-md bg-[#1c1c1e] px-4 text-[11px] font-bold text-white shadow-xs hover:bg-black transition"
              >
                Concluir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
