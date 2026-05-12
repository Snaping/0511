import React from 'react'
import { Card, List, Typography } from 'antd'
import { useDraggable } from '@dnd-kit/core'
import { useAppStore } from '../../stores/appStore'
import IconWrapper from './IconWrapper'

const { Title, Text } = Typography

interface DraggableComponentProps {
  type: string
  name: string
  icon: string
}

const DraggableComponent: React.FC<DraggableComponentProps> = ({ type, name, icon }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `new-${type}`,
    data: { type, isNew: true },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-3 bg-white border border-gray-200 rounded-lg cursor-grab hover:border-blue-400 hover:shadow-md transition-all"
    >
      <div className="flex flex-col items-center gap-2">
        <IconWrapper name={icon} className="text-2xl text-blue-500" />
        <Text type="secondary" className="text-sm">
          {name}
        </Text>
      </div>
    </div>
  )
}

const ComponentPanel: React.FC = () => {
  const { componentConfigs } = useAppStore()

  const categories = [...new Set(componentConfigs.map((c) => c.category))]

  return (
    <div className="h-full overflow-auto">
      <Card bordered={false} className="h-full">
        <Title level={5} style={{ marginBottom: 16 }}>
          组件库
        </Title>
        {categories.map((category) => (
          <div key={category} className="mb-6">
            <Text strong className="block mb-3 text-gray-600">
              {category}
            </Text>
            <List
              grid={{ gutter: 8, column: 2 }}
              dataSource={componentConfigs.filter((c) => c.category === category)}
              renderItem={(config) => (
                <List.Item>
                  <DraggableComponent
                    type={config.type}
                    name={config.name}
                    icon={config.icon}
                  />
                </List.Item>
              )}
            />
          </div>
        ))}
      </Card>
    </div>
  )
}

export default ComponentPanel
