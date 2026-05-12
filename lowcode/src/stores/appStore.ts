import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import {
  ComponentConfig,
  ComponentInstance,
  DataSource,
  PageConfig,
  Role,
  User,
} from '../types'
import { componentConfigs } from '../components/designer/componentConfigs'

interface AppState {
  darkMode: boolean
  toggleDarkMode: () => void

  componentConfigs: ComponentConfig[]

  currentPage: PageConfig
  pages: PageConfig[]
  selectedComponentId: string | null

  addComponent: (component: ComponentInstance) => void
  updateComponent: (id: string, props: Record<string, unknown>) => void
  deleteComponent: (id: string) => void
  selectComponent: (id: string | null) => void
  moveComponent: (activeId: string, overId: string) => void

  dataSources: DataSource[]
  addDataSource: (dataSource: Omit<DataSource, 'id'>) => void
  updateDataSource: (id: string, dataSource: Partial<DataSource>) => void
  deleteDataSource: (id: string) => void

  roles: Role[]
  users: User[]
  currentUser: User | null

  addRole: (role: Omit<Role, 'id'>) => void
  updateRole: (id: string, role: Partial<Role>) => void
  deleteRole: (id: string) => void

  addUser: (user: Omit<User, 'id'>) => void
  updateUser: (id: string, user: Partial<User>) => void
  deleteUser: (id: string) => void
  login: (name: string) => boolean

  addPage: (name: string) => void
  selectPage: (id: string) => void
  publishPage: (id: string) => void

  activeTab: 'designer' | 'preview' | 'data' | 'permission'
  setActiveTab: (tab: 'designer' | 'preview' | 'data' | 'permission') => void
}

const defaultPage: PageConfig = {
  id: uuidv4(),
  name: '新页面',
  components: [],
  dataSources: [],
  published: false,
}

const defaultRoles: Role[] = [
  { id: '1', name: '管理员', permissions: ['*'] },
  { id: '2', name: '开发者', permissions: ['design', 'preview', 'data'] },
  { id: '3', name: '用户', permissions: ['preview'] },
]

const defaultUsers: User[] = [
  { id: '1', name: 'admin', roleId: '1' },
  { id: '2', name: 'developer', roleId: '2' },
  { id: '3', name: 'user', roleId: '3' },
]

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      darkMode: false,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

      componentConfigs,

      currentPage: defaultPage,
      pages: [defaultPage],
      selectedComponentId: null,

      addComponent: (component) =>
        set((state) => ({
          currentPage: {
            ...state.currentPage,
            components: [...state.currentPage.components, component],
          },
          selectedComponentId: component.id,
        })),

      updateComponent: (id, props) =>
        set((state) => {
          const updateRecursive = (components: ComponentInstance[]): ComponentInstance[] =>
            components.map((comp) => {
              if (comp.id === id) {
                return { ...comp, props: { ...comp.props, ...props } }
              }
              if (comp.children) {
                return { ...comp, children: updateRecursive(comp.children) }
              }
              return comp
            })

          return {
            currentPage: {
              ...state.currentPage,
              components: updateRecursive(state.currentPage.components),
            },
          }
        }),

      deleteComponent: (id) =>
        set((state) => {
          const deleteRecursive = (components: ComponentInstance[]): ComponentInstance[] =>
            components
              .filter((comp) => comp.id !== id)
              .map((comp) => ({
                ...comp,
                children: comp.children ? deleteRecursive(comp.children) : undefined,
              }))

          return {
            currentPage: {
              ...state.currentPage,
              components: deleteRecursive(state.currentPage.components),
            },
            selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId,
          }
        }),

      selectComponent: (id) => set({ selectedComponentId: id }),

      moveComponent: (activeId, overId) =>
        set((state) => {
          const components = [...state.currentPage.components]
          const activeIndex = components.findIndex((c) => c.id === activeId)
          const overIndex = components.findIndex((c) => c.id === overId)

          if (activeIndex === -1 || overIndex === -1) return state

          const [activeComponent] = components.splice(activeIndex, 1)
          components.splice(overIndex, 0, activeComponent)

          return {
            currentPage: {
              ...state.currentPage,
              components,
            },
          }
        }),

      dataSources: [],
      addDataSource: (dataSource) =>
        set((state) => ({
          dataSources: [...state.dataSources, { ...dataSource, id: uuidv4() }],
        })),
      updateDataSource: (id, dataSource) =>
        set((state) => ({
          dataSources: state.dataSources.map((ds) =>
            ds.id === id ? { ...ds, ...dataSource } : ds,
          ),
        })),
      deleteDataSource: (id) =>
        set((state) => ({
          dataSources: state.dataSources.filter((ds) => ds.id !== id),
        })),

      roles: defaultRoles,
      users: defaultUsers,
      currentUser: null,

      addRole: (role) =>
        set((state) => ({
          roles: [...state.roles, { ...role, id: uuidv4() }],
        })),
      updateRole: (id, role) =>
        set((state) => ({
          roles: state.roles.map((r) => (r.id === id ? { ...r, ...role } : r)),
        })),
      deleteRole: (id) =>
        set((state) => ({
          roles: state.roles.filter((r) => r.id !== id),
        })),

      addUser: (user) =>
        set((state) => ({
          users: [...state.users, { ...user, id: uuidv4() }],
        })),
      updateUser: (id, user) =>
        set((state) => ({
          users: state.users.map((u) => (u.id === id ? { ...u, ...user } : u)),
        })),
      deleteUser: (id) =>
        set((state) => ({
          users: state.users.filter((u) => u.id !== id),
        })),
      login: (name) => {
        const user = get().users.find((u) => u.name === name)
        if (user) {
          set({ currentUser: user })
          return true
        }
        return false
      },

      addPage: (name) => {
        const newPage: PageConfig = {
          id: uuidv4(),
          name,
          components: [],
          dataSources: [],
          published: false,
        }
        set((state) => ({
          pages: [...state.pages, newPage],
          currentPage: newPage,
          selectedComponentId: null,
        }))
      },
      selectPage: (id) =>
        set((state) => ({
          currentPage: state.pages.find((p) => p.id === id) || state.currentPage,
          selectedComponentId: null,
        })),
      publishPage: (id) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === id ? { ...p, published: true, publishedAt: new Date().toISOString() } : p,
          ),
          currentPage:
            state.currentPage.id === id
              ? { ...state.currentPage, published: true, publishedAt: new Date().toISOString() }
              : state.currentPage,
        })),

      activeTab: 'designer',
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'lowcode-platform-storage',
      partialize: (state) => ({
        darkMode: state.darkMode,
        pages: state.pages,
        currentPage: state.currentPage,
        dataSources: state.dataSources,
        roles: state.roles,
        users: state.users,
        currentUser: state.currentUser,
        activeTab: state.activeTab,
      }),
    },
  ),
)
