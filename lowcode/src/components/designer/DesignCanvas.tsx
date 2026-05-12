import React from 'react'
import { Card, Empty, Typography } from 'antd'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { useAppStore } from '../../stores/appStore'
import ComponentRenderer from './ComponentRenderer'
import { ComponentInstance } from '../../types'

const { Title } = Typography

interface SortableItemProps {
  component: ComponentInstance
}

const SortableItem: React.FC<SortableItemProps> = ({ component }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: component.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const { selectedComponentId, selectComponent } = useAppStore()
  const isSelected = selectedComponentId === component.id

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ComponentRenderer
        component={component}
        isDesignMode
        isSelected={isSelected}
        onClick={() => selectComponent(component.id)}
      />
    </div>
  )
}

const DesignCanvas: React.FC = () => {
  const { currentPage, selectComponent, selectedComponentId } = useAppStore()

  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-drop-zone',
  })

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectComponent(null)
    }
  }

  return (
    <Card
      title={
        <Title level={5} style={{ margin: 0 }}>
          画布 - {currentPage.name}
          {currentPage.published && (
            <Typography.Text type="success" className="ml-2 text-sm">
              (已发布)
            </Typography.Text>
          )}
        </Title>
      }
      className="h-full"
      bodyStyle={{ height: 'calc(100% - 57px)', overflow: 'auto', padding: 24 }}
    >
      <SortableContext
        items={currentPage.components.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          onClick={handleCanvasClick}
          style={{
            minHeight: 400,
            position: 'relative',
            backgroundColor: isOver ? 'rgba(24, 144, 255, 0.05)' : 'transparent',
            border: isOver ? '2px dashed #1890ff' : '2px dashed transparent',
            borderRadius: 8,
            padding: 16,
            transition: 'all 0.2s ease',
          }}
        >
          {currentPage.components.length === 0 ? (
            <Empty
              description="拖拽组件到这里"
              style={{ marginTop: 80 }}
            />
          ) : (
            currentPage.components.map((component) => (
              <SortableItem key={component.id} component={component} />
            ))
          )}
        </div>
      </SortableContext>
    </Card>
  )
}

export default DesignCanvas
