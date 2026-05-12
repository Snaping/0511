export type ComponentType =
  | 'input'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'datePicker'
  | 'upload'
  | 'button'
  | 'text'
  | 'image'
  | 'divider'
  | 'container'

export interface ComponentProperty {
  name: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'options'
  options?: { label: string; value: string }[]
  defaultValue?: unknown
}

export interface ComponentConfig {
  type: ComponentType
  name: string
  icon: string
  category: string
  properties: ComponentProperty[]
  defaultProps: Record<string, unknown>
}

export interface ComponentInstance {
  id: string
  type: ComponentType
  props: Record<string, unknown>
  children?: ComponentInstance[]
  dataSource?: string
  permissions?: string[]
}

export interface DataSource {
  id: string
  name: string
  type: 'local' | 'api'
  url?: string
  method?: 'GET' | 'POST'
  data?: Record<string, unknown>
}

export interface Role {
  id: string
  name: string
  permissions: string[]
}

export interface User {
  id: string
  name: string
  roleId: string
}

export interface PageConfig {
  id: string
  name: string
  components: ComponentInstance[]
  dataSources: DataSource[]
  published: boolean
  publishedAt?: string
}
