import React from 'react'
import * as Icons from '@ant-design/icons'

interface IconWrapperProps {
  name: string
  className?: string
  style?: React.CSSProperties
}

const IconWrapper: React.FC<IconWrapperProps> = ({ name, className, style }) => {
  const Icon = (Icons as unknown as Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>>)[name]
  return Icon ? <Icon className={className} style={style} /> : null
}

export default IconWrapper
