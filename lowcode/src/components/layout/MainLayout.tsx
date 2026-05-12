import React, { useState, useMemo } from 'react'
import { Layout } from 'antd'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { v4 as uuidv4 } from 'uuid'
import Header from './Header'
import { useAppStore } from '../../stores/appStore'
import ComponentPanel from '../designer/ComponentPanel'
import DesignCanvas from '../designer/DesignCanvas'
import PropertyPanel from '../designer/PropertyPanel'
import PreviewPanel from '../preview/PreviewPanel'
import DataSourcePanel from '../data/DataSourcePanel'
import PermissionPanel from '../permission/PermissionPanel'
import ComponentRenderer from '../designer/ComponentRenderer'
import { ComponentInstance } from '../../types'
import { componentConfigs } from '../designer/componentConfigs'

const { Content, Sider } = Layout

const MainLayout: React.FC = () => {
  const {
    activeTab,
    darkMode,
    addComponent,
    moveComponent,
    componentConfigs: storeComponentConfigs,
    selectedComponentId,
    currentPage,
  } = useAppStore()

  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragData, setActiveDragData] = useState<Record<string, unknown> | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const handleDragStart = (event: { active: { id: string; data: { current: Record<string, unknown> } } }) => {
    setActiveDragId(event.active.id as string)
    setActiveDragData(event.active.data.current)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    setActiveDragData(null)

    if (!over) return

    if (active.data.current?.isNew) {
      const type = active.data.current?.type as string
      const config = componentConfigs.find((c) => c.type === type)

      if (config) {
        const newComponent: ComponentInstance = {
          id: uuidv4(),
          type: config.type,
          props: { ...config.defaultProps },
        }
        addComponent(newComponent)
      }
    } else if (active.id !== over.id && over.id === 'canvas-drop-zone') {
      // 拖到画布空白区域，不做特殊处理
    } else if (active.id !== over.id) {
      moveComponent(active.id as string, over.id as string)
    }
  }

  const dragPreviewComponent = useMemo(() => {
    if (!activeDragId) return null

    if (activeDragData?.isNew) {
      const type = activeDragData.type as string
      const config = componentConfigs.find((c) => c.type === type)
      if (config) {
        const tempComponent: ComponentInstance = {
          id: 'preview',
          type: config.type,
          props: { ...config.defaultProps },
        }
        return <ComponentRenderer component={tempComponent} isDesignMode />
      }
    } else {
      const component = currentPage.components.find((c) => c.id === activeDragId)
      if (component) {
        return <ComponentRenderer component={component} isDesignMode />
      }
    }
    return null
  }, [activeDragId, activeDragData, currentPage.components])

  const renderContent = () => {
    switch (activeTab) {
      case 'designer':
        return (
          <Layout style={{ height: '100%' }}>
            <Sider width={280} theme={darkMode ? 'dark' : 'light'} style={{ height: '100%' }}>
              <ComponentPanel />
            </Sider>
            <Content style={{ padding: 16, height: '100%', overflow: 'hidden' }}>
              <DesignCanvas />
            </Content>
            <Sider width={320} theme={darkMode ? 'dark' : 'light'} style={{ height: '100%' }}>
              <PropertyPanel />
            </Sider>
          </Layout>
        )
      case 'preview':
        return (
          <Content style={{ padding: 16, height: '100%', overflow: 'hidden' }}>
            <PreviewPanel />
          </Content>
        )
      case 'data':
        return (
          <Content style={{ padding: 16, height: '100%', overflow: 'hidden' }}>
            <DataSourcePanel />
          </Content>
        )
      case 'permission':
        return (
          <Content style={{ padding: 16, height: '100%', overflow: 'hidden' }}>
            <PermissionPanel />
          </Content>
        )
      default:
        return null
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Layout style={{ height: '100vh' }}>
        <Header />
        <Layout style={{ height: 'calc(100vh - 64px)' }}>{renderContent()}</Layout>
      </Layout>

      <DragOverlay>
        {dragPreviewComponent ? (
          <div style={{ opacity: 0.8 }}>{dragPreviewComponent}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export default MainLayout
