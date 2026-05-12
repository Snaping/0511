import React, { useMemo } from 'react'
import { Card, Empty, Typography, Alert } from 'antd'
import { EyeOutlined, LockOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import ComponentRenderer from '../designer/ComponentRenderer'

const { Title, Paragraph } = Typography

const PreviewPanel: React.FC = () => {
  const { currentPage, currentUser, roles } = useAppStore()

  const userRole = useMemo(
    () => (currentUser ? roles.find((r) => r.id === currentUser.roleId) : null),
    [currentUser, roles],
  )

  const hasPreviewPermission = useMemo(() => {
    if (!userRole) return false
    if (userRole.permissions.includes('*')) return true
    return userRole.permissions.includes('preview')
  }, [userRole])

  const canEdit = useMemo(() => {
    if (!userRole) return false
    if (userRole.permissions.includes('*')) return true
    return userRole.permissions.includes('design')
  }, [userRole])

  return (
    <Card
      title={
        <Title level={5} style={{ margin: 0 }}>
          <EyeOutlined className="mr-2" />
          页面预览 - {currentPage.name}
        </Title>
      }
      className="h-full"
      bodyStyle={{ height: 'calc(100% - 57px)', overflow: 'auto', padding: 24 }}
    >
      {!currentUser ? (
        <Alert
          message="请先登录以查看预览"
          type="info"
          showIcon
          icon={<LockOutlined />}
          style={{ marginBottom: 16 }}
        />
      ) : !hasPreviewPermission ? (
        <Alert
          message="您没有预览权限"
          type="error"
          showIcon
          icon={<LockOutlined />}
        />
      ) : currentPage.components.length === 0 ? (
        <Empty
          description="该页面暂无组件，请先在设计器中添加组件"
          style={{ marginTop: 80 }}
        />
      ) : (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Alert
            message={
              <Paragraph type="secondary" style={{ margin: 0 }}>
                当前用户: <strong>{currentUser.name}</strong> ({userRole?.name})
                {canEdit && ' - 拥有编辑权限'}
              </Paragraph>
            }
            type={canEdit ? 'success' : 'info'}
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Card>
            <div style={{ padding: 24 }}>
              <Title level={3} style={{ marginBottom: 24 }}>
                {currentPage.name}
              </Title>
              {currentPage.components.map((component) => (
                <ComponentRenderer key={component.id} component={component} isDesignMode={false} />
              ))}
            </div>
          </Card>

          {currentPage.published && (
            <Alert
              message={
                <Paragraph type="secondary" style={{ margin: 0 }}>
                  页面发布时间: {currentPage.publishedAt}
                </Paragraph>
              }
              type="success"
              style={{ marginTop: 24 }}
            />
          )}
        </div>
      )}
    </Card>
  )
}

export default PreviewPanel
