import React, { useMemo } from 'react'
import {
  Input,
  InputNumber,
  Select,
  Radio,
  Checkbox,
  Switch,
  DatePicker,
  Upload,
  Button,
  Typography,
  Image,
  Divider,
  Form,
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { ComponentInstance } from '../../types'
import { useAppStore } from '../../stores/appStore'

const { Text } = Typography
const { TextArea } = Input
const { Option } = Select

interface ComponentRendererProps {
  component: ComponentInstance
  isDesignMode?: boolean
  isSelected?: boolean
  onClick?: () => void
}

const ComponentRenderer: React.FC<ComponentRendererProps> = ({
  component,
  isDesignMode = false,
  isSelected = false,
  onClick,
}) => {
  const { dataSources } = useAppStore()
  const { type, props, dataSource } = component

  const boundData = useMemo(() => {
    if (!dataSource) return null
    const ds = dataSources.find((d) => d.id === dataSource)
    return ds?.data
  }, [dataSource, dataSources])

  const label = (props.label as string) || ''
  const placeholder = (props.placeholder as string) || ''
  const required = (props.required as boolean) || false
  const options = (props.options as { label: string; value: string }[]) || []

  const width = (props.width as string) || '100'
  const customWidth = (props.customWidth as number) || 300
  const align = (props.align as 'left' | 'center' | 'right') || 'left'
  const textAlign = (props.textAlign as 'left' | 'center' | 'right') || 'left'
  const marginTop = (props.marginTop as number) || 0
  const marginBottom = (props.marginBottom as number) || 16
  const padding = (props.padding as number) || 0
  const hidden = (props.hidden as boolean) || false
  const bgColor = (props.bgColor as string) || 'transparent'
  const borderStyle = (props.borderStyle as string) || 'none'
  const dividerOrientation = (props.dividerOrientation as 'left' | 'center' | 'right') || 'center'

  if (hidden) {
    if (!isDesignMode) return null
    return (
      <div
        style={{
          width: '100%',
          textAlign: align,
          marginTop,
          marginBottom,
        }}
        onClick={onClick}
      >
        <div
          style={{
            display: 'inline-block',
            width: width === 'custom' ? `${customWidth}px` : `${width}%`,
            padding,
            border: '1px dashed #d9d9d9',
            borderRadius: 4,
            textAlign: 'center',
            color: '#999',
            fontSize: 12,
            paddingTop: 8,
            paddingBottom: 8,
            cursor: isDesignMode ? 'pointer' : 'default',
            backgroundColor: '#fafafa',
            ...(isDesignMode && isSelected
              ? { outline: '2px solid #1890ff', outlineOffset: 2 }
              : {}),
          }}
        >
          [已隐藏 - 点击编辑]
        </div>
      </div>
    )
  }

  const computedWidth = width === 'custom' ? `${customWidth}px` : `${width}%`

  const outerStyle: React.CSSProperties = {
    width: '100%',
    textAlign: align,
    marginTop,
    marginBottom,
  }

  const wrapperStyle: React.CSSProperties = {
    width: computedWidth,
    display: 'inline-block',
    verticalAlign: 'top',
    padding,
    textAlign,
    ...(isDesignMode && isSelected
      ? {
          outline: '2px solid #1890ff',
          outlineOffset: 2,
        }
      : {}),
    ...(isDesignMode && !isSelected
      ? {
          outline: '1px dashed #d9d9d9',
          outlineOffset: 2,
        }
      : {}),
    cursor: isDesignMode ? 'pointer' : 'default',
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDesignMode && onClick) {
      onClick()
    }
  }

  const renderComponent = () => {
    switch (type) {
      case 'input':
        return <Input placeholder={placeholder} value={(boundData?.value as string) || ''} />
      case 'textarea':
        return (
          <TextArea
            placeholder={placeholder}
            rows={(props.rows as number) || 4}
            value={(boundData?.value as string) || ''}
          />
        )
      case 'number':
        return (
          <InputNumber
            min={(props.min as number) || 0}
            max={(props.max as number) || 100}
            style={{ width: '100%' }}
            value={(boundData?.value as number) || ''}
          />
        )
      case 'select':
        return (
          <Select
            placeholder={placeholder}
            allowClear
            style={{ width: '100%' }}
            value={(boundData?.value as string) || undefined}
          >
            {options.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        )
      case 'radio':
        return (
          <Radio.Group value={(boundData?.value as string) || undefined}>
            {options.map((opt) => (
              <Radio key={opt.value} value={opt.value}>
                {opt.label}
              </Radio>
            ))}
          </Radio.Group>
        )
      case 'checkbox':
        return (
          <Checkbox.Group value={(boundData?.value as string[]) || []}>
            {options.map((opt) => (
              <Checkbox key={opt.value} value={opt.value}>
                {opt.label}
              </Checkbox>
            ))}
          </Checkbox.Group>
        )
      case 'switch':
        return <Switch checked={(boundData?.value as boolean) || false} />
      case 'datePicker':
        return <DatePicker style={{ width: '100%' }} />
      case 'upload':
        return (
          <Upload>
            <Button icon={<UploadOutlined />}>点击上传</Button>
          </Upload>
        )
      case 'button': {
        const buttonWidthMode = (props.buttonWidthMode as 'fixed' | 'full') || 'fixed'
        const buttonFixedWidth = (props.buttonFixedWidth as number) || 120
        const buttonStyle: React.CSSProperties = buttonWidthMode === 'full'
          ? { width: '100%' }
          : { width: `${buttonFixedWidth}px` }
        return (
          <Button
            type={(props.type as 'primary' | 'default' | 'danger' | 'link') || 'primary'}
            style={buttonStyle}
          >
            {(props.text as string) || '按钮'}
          </Button>
        )
      }
      case 'text':
        return (
          <Text style={{ fontSize: `${(props.fontSize as number) || 14}px` }}>
            {(boundData?.value as string) || (props.content as string) || '文本内容'}
          </Text>
        )
      case 'image':
        return (
          <Image
            src={(props.src as string) || 'https://placehold.co/200x150'}
            alt={(props.alt as string) || '图片'}
            width={(props.width as number) || 200}
          />
        )
      case 'divider':
        return <Divider orientation={dividerOrientation} style={{ margin: '16px 0' }} />
      case 'container':
        return (
          <div
            style={{
              border: borderStyle === 'none' ? 'none' : `1px ${borderStyle} #d9d9d9`,
              backgroundColor: bgColor,
              minHeight: 100,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text type="secondary">容器组件</Text>
          </div>
        )
      default:
        return null
    }
  }

  if (type === 'divider') {
    return (
      <div style={outerStyle} onClick={handleClick}>
        <div style={wrapperStyle}>{renderComponent()}</div>
      </div>
    )
  }

  if (type === 'text') {
    return (
      <div style={outerStyle} onClick={handleClick}>
        <div style={wrapperStyle}>
          {renderComponent()}
          {dataSource && isDesignMode && (
            <Text type="secondary" className="block text-xs mt-1">
              已绑定数据源
            </Text>
          )}
        </div>
      </div>
    )
  }

  if (type === 'image') {
    return (
      <div style={outerStyle} onClick={handleClick}>
        <div style={wrapperStyle}>
          {renderComponent()}
          {dataSource && isDesignMode && (
            <Text type="secondary" className="block text-xs mt-1">
              已绑定数据源
            </Text>
          )}
        </div>
      </div>
    )
  }

  if (type === 'button') {
    const buttonAlign = (props.buttonAlign as 'left' | 'center' | 'right') || 'left'
    const buttonInnerWrapperStyle: React.CSSProperties = {
      width: '100%',
      textAlign: buttonAlign,
    }
    return (
      <div style={outerStyle} onClick={handleClick}>
        <div style={wrapperStyle}>
          <div style={buttonInnerWrapperStyle}>
            {renderComponent()}
          </div>
        </div>
      </div>
    )
  }

  if (type === 'container') {
    return (
      <div style={outerStyle} onClick={handleClick}>
        <div style={wrapperStyle}>{renderComponent()}</div>
      </div>
    )
  }

  return (
    <div style={outerStyle} onClick={handleClick}>
      <Form.Item
        label={label}
        required={required}
        style={wrapperStyle}
      >
        {renderComponent()}
        {dataSource && isDesignMode && (
          <Text type="secondary" className="block text-xs mt-1">
            已绑定数据源
          </Text>
        )}
      </Form.Item>
    </div>
  )
}

export default ComponentRenderer
