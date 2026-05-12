import React, { useMemo } from 'react'
import {
  Card,
  Typography,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Button,
  Space,
  Collapse,
} from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import { ComponentProperty } from '../../types'
import { commonLayoutProperties } from './componentConfigs'

const { Title } = Typography
const { TextArea } = Input
const { Option } = Select
const { Panel } = Collapse

interface OptionsEditorProps {
  value?: { label: string; value: string }[]
  onChange?: (value: { label: string; value: string }[]) => void
}

const OptionsEditor: React.FC<OptionsEditorProps> = ({ value = [], onChange }) => {
  const handleAdd = () => {
    onChange?.([...value, { label: `选项${value.length + 1}`, value: String(value.length + 1) }])
  }

  const handleRemove = (index: number) => {
    const newOptions = value.filter((_, i) => i !== index)
    onChange?.(newOptions)
  }

  const handleChange = (index: number, field: 'label' | 'value', newValue: string) => {
    const newOptions = [...value]
    newOptions[index] = { ...newOptions[index], [field]: newValue }
    onChange?.(newOptions)
  }

  return (
    <div className="space-y-2">
      {value.map((option, index) => (
        <Space key={index} className="w-full">
          <Input
            placeholder="标签"
            value={option.label}
            onChange={(e) => handleChange(index, 'label', e.target.value)}
            style={{ flex: 1 }}
          />
          <Input
            placeholder="值"
            value={option.value}
            onChange={(e) => handleChange(index, 'value', e.target.value)}
            style={{ flex: 1 }}
          />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleRemove(index)} size="small" />
        </Space>
      ))}
      <Button onClick={handleAdd} type="dashed" block>
        添加选项
      </Button>
    </div>
  )
}

const layoutPropertyNames = new Set(commonLayoutProperties.map((p) => p.name))

const PropertyPanel: React.FC = () => {
  const {
    componentConfigs,
    currentPage,
    selectedComponentId,
    updateComponent,
    deleteComponent,
    dataSources,
  } = useAppStore()

  const selectedComponent = useMemo(
    () =>
      currentPage.components.find((c) => c.id === selectedComponentId) ||
      (() => {
        for (const comp of currentPage.components) {
          if (comp.children) {
            const found = comp.children.find((c) => c.id === selectedComponentId)
            if (found) return found
          }
        }
        return null
      })(),
    [currentPage.components, selectedComponentId],
  )

  const config = useMemo(
    () =>
      selectedComponent ? componentConfigs.find((c) => c.type === selectedComponent.type) : null,
    [componentConfigs, selectedComponent],
  )

  if (!selectedComponent || !config) {
    return (
      <Card bordered={false} className="h-full">
        <Title level={5}>属性配置</Title>
        <Typography.Paragraph type="secondary">请选择一个组件</Typography.Paragraph>
      </Card>
    )
  }

  const widthValue = (selectedComponent.props.width as string) || '100'
  const buttonWidthMode = (selectedComponent.props.buttonWidthMode as string) || 'fixed'
  const isButton = selectedComponent.type === 'button'

  const renderProperty = (prop: ComponentProperty) => {
    if (prop.name === 'customWidth' && widthValue !== 'custom') {
      return null
    }
    if (isButton && prop.name === 'buttonFixedWidth' && buttonWidthMode !== 'fixed') {
      return null
    }

    const value = selectedComponent.props[prop.name]

    switch (prop.type) {
      case 'text':
        return (
          <Form.Item label={prop.label} key={prop.name}>
            <Input
              value={value as string}
              onChange={(e) => updateComponent(selectedComponent.id, { [prop.name]: e.target.value })}
            />
          </Form.Item>
        )
      case 'number':
        return (
          <Form.Item label={prop.label} key={prop.name}>
            <InputNumber
              value={value as number}
              onChange={(val) =>
                updateComponent(selectedComponent.id, { [prop.name]: val ?? prop.defaultValue })
              }
              style={{ width: '100%' }}
            />
          </Form.Item>
        )
      case 'boolean':
        return (
          <Form.Item label={prop.label} key={prop.name}>
            <Switch
              checked={value as boolean}
              onChange={(checked) => updateComponent(selectedComponent.id, { [prop.name]: checked })}
            />
          </Form.Item>
        )
      case 'select':
        return (
          <Form.Item label={prop.label} key={prop.name}>
            <Select
              value={value as string}
              onChange={(val) => updateComponent(selectedComponent.id, { [prop.name]: val })}
            >
              {prop.options?.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )
      case 'options':
        return (
          <Form.Item label={prop.label} key={prop.name}>
            <OptionsEditor
              value={value as { label: string; value: string }[]}
              onChange={(val) => updateComponent(selectedComponent.id, { [prop.name]: val })}
            />
          </Form.Item>
        )
      default:
        return null
    }
  }

  const basicProperties = config.properties.filter((p) => !layoutPropertyNames.has(p.name))
  const layoutProperties = config.properties.filter((p) => layoutPropertyNames.has(p.name))

  return (
    <Card bordered={false} className="h-full overflow-auto">
      <Title level={5}>属性配置</Title>
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <Typography.Paragraph strong className="mb-0">
          {config.name}
        </Typography.Paragraph>
        <Typography.Text type="secondary" className="text-xs">
          ID: {selectedComponent.id}
        </Typography.Text>
      </div>

      <Collapse
        defaultActiveKey={['basic', 'layout']}
        ghost
        accordion={false}
      >
        {basicProperties.length > 0 && (
          <Panel header="基本属性" key="basic">
            <Form layout="vertical">{basicProperties.map(renderProperty)}</Form>
          </Panel>
        )}

        {layoutProperties.length > 0 && (
          <Panel header="布局属性" key="layout">
            <Form layout="vertical">{layoutProperties.map(renderProperty)}</Form>
          </Panel>
        )}
      </Collapse>

      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="绑定数据源">
          <Select
            value={selectedComponent.dataSource}
            allowClear
            placeholder="选择数据源"
            onChange={(val) => updateComponent(selectedComponent.id, { dataSource: val })}
          >
            {dataSources.map((ds) => (
              <Option key={ds.id} value={ds.id}>
                {ds.name}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Form>

      <div className="mt-6 pt-4 border-t">
        <Button danger block icon={<DeleteOutlined />} onClick={() => deleteComponent(selectedComponent.id)}>
          删除组件
        </Button>
      </div>
    </Card>
  )
}

export default PropertyPanel
