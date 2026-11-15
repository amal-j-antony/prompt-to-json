import type { BriefSettings, FieldDocs } from './brief-docs'

export interface UserDto {
  id: string
  email: string
}

export interface HistoryEntryDto {
  id: string
  savedAt: number
  docs: FieldDocs
  settings: BriefSettings
}

export interface SaveResultDto {
  entry: HistoryEntryDto
  duplicate: boolean
}

export interface HealthDto {
  ok: boolean
  db: 'connected' | 'connecting' | 'error'
  uptime: number
}

export interface MeDto {
  user: UserDto | null
}

export interface AuthRequestDto {
  email: string
  password: string
}

export interface SaveRequestDto {
  docs: FieldDocs
  settings: BriefSettings
}

export interface ApiErrorDto {
  error: string
  code?: string
}
