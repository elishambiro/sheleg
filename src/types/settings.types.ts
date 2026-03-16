export type AppLanguage = 'he' | 'en'
export type AnnexLabelPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
export type VolumeStrategy = 'none' | 'by-size-mb' | 'by-page-count'
export type AnnexNumberingStyle = 'n-prefix' | 'alpha-he' | 'alpha-en' | 'alpha-ar' | 'numeric' | 'manual'

export interface DesignSettings {
  primaryColor: string
  fontFamily: string
  logoDataUrl?: string
  coverTitle: string
  coverSubtitle: string
  showPageNumbers: boolean
  pageNumberPosition: 'top' | 'bottom'
}

export interface CompilationSettings {
  language: AppLanguage
  includeToc: boolean
  includeCoverPage: boolean
  autoMarkFirstPage: boolean
  annexLabelPosition: AnnexLabelPosition
  numberingStyle: AnnexNumberingStyle
  numberingStartAt: string
  volumeStrategy: VolumeStrategy
  volumeMaxSizeMb: number
  volumeMaxPages: number
  design: DesignSettings
}
