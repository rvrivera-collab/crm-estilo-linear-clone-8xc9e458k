export interface TourStep {
  /**
   * Seletor CSS ou atributo data-tour-id (ex: '[data-tour-id="kanban"]')
   * Se omitido ou o elemento não for encontrado na página, o modal é centralizado.
   */
  target?: string
  title: string
  description: string
  /**
   * Posição preferida para ancorar o balão em relação ao elemento alvo.
   */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  /**
   * Dica contextual ou atalho opcional
   */
  badge?: string
}

export interface PageTourDefinition {
  pagePath: string
  pageName: string
  steps: TourStep[]
}
