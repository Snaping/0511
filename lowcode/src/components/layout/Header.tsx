import React, { useState } from 'react'
import { Layout, Button, Switch, Space, Typography, Select, Modal, Input, message } from 'antd'
import {
  BulbOutlined,
  CloudUploadOutlined,
  EyeOutlined,
  PlusOutlined,
  SaveOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'

const { Header: AntHeader } = Layout
const { Title } = Typography
const { Option } = Select

const Header: React.FC = () => {
  const {
    darkMode,
    toggleDarkMode,
    pages,
    currentPage,
    addPage,
    selectPage,
    publishPage,
    setActiveTab,
    activeTab,
    currentUser,
    login,
  } = useAppStore()

  const [newPageModal, setNewPageModal] = useState(false)
  const [newPageName, setNewPageName] = useState('')
  const [loginModal, setLoginModal] = useState(false)
  const [loginName, setLoginName] = useState('')

  const handleAddPage = () => {
    if (newPageName.trim()) {
      addPage(newPageName.trim())
      setNewPageName('')
      setNewPageModal(false)
      message.success('页面创建成功')
    }
  }

  const handleLogin = () => {
    if (login(loginName.trim())) {
      setLoginModal(false)
      message.success(`欢迎回来，${loginName}！`)
    } else {
      message.error('用户不存在')
    }
  }

  const handleLogout = () => {
    useAppStore.setState({ currentUser: null })
    message.success('已退出登录')
  }

  return (
    <>
      <AntHeader
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: darkMode ? '#001529' : '#ffffff',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Title level={4} style={{ margin: 0, color: darkMode ? '#fff' : '#000' }}>
            低代码平台
          </Title>
          <Select
            value={currentPage.id}
            onChange={(id) => selectPage(id)}
            style={{ minWidth: 150 }}
            suffixIcon={<PlusOutlined onClick={() => setNewPageModal(true)} />}
          >
            {pages.map((page) => (
              <Option key={page.id} value={page.id}>
                {page.name}
                {page.published && ' (已发布)'}
              </Option>
            ))}
          </Select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Space size="middle">
            <Button
              type={activeTab === 'designer' ? 'primary' : 'default'}
              onClick={() => setActiveTab('designer')}
              icon={<SaveOutlined />}
            >
              设计器
            </Button>
            <Button
              type={activeTab === 'preview' ? 'primary' : 'default'}
              onClick={() => setActiveTab('preview')}
              icon={<EyeOutlined />}
            >
              预览
            </Button>
            <Button
              type={activeTab === 'data' ? 'primary' : 'default'}
              onClick={() => setActiveTab('data')}
              icon={<SaveOutlined />}
            >
              数据源
            </Button>
            <Button
              type={activeTab === 'permission' ? 'primary' : 'default'}
              onClick={() => setActiveTab('permission')}
              icon={<UserOutlined />}
            >
              权限
            </Button>
            <Button
              type="primary"
              onClick={() => {
                publishPage(currentPage.id)
                message.success('页面已发布')
              }}
              icon={<CloudUploadOutlined />}
              disabled={currentPage.published}
            >
              发布
            </Button>
          </Space>

          <Space split={<span style={{ color: 'rgba(0,0,0,0.45)' }}>|</span>}>
            <Space>
              <BulbOutlined />
              <Switch checked={darkMode} onChange={toggleDarkMode} size="small" />
            </Space>

            {currentUser ? (
              <Space>
                <UserOutlined />
                <span style={{ color: darkMode ? '#fff' : '#000' }}>{currentUser.name}</span>
                <Button icon={<LogoutOutlined />} size="small" onClick={handleLogout}>
                  退出
                </Button>
              </Space>
            ) : (
              <Button icon={<UserOutlined />} onClick={() => setLoginModal(true)} size="small">
                登录
              </Button>
            )}
          </Space>
        </div>
      </AntHeader>

      <Modal
        title="新建页面"
        open={newPageModal}
        onOk={handleAddPage}
        onCancel={() => setNewPageModal(false)}
        okButtonProps={{ disabled: !newPageName.trim() }}
      >
        <Input
          placeholder="请输入页面名称"
          value={newPageName}
          onChange={(e) => setNewPageName(e.target.value)}
          onPressEnter={handleAddPage}
        />
      </Modal>

      <Modal
        title="用户登录"
        open={loginModal}
        onOk={handleLogin}
        onCancel={() => setLoginModal(false)}
        okButtonProps={{ disabled: !loginName.trim() }}
      >
        <Input
          placeholder="请输入用户名 (admin, developer, user)"
          value={loginName}
          onChange={(e) => setLoginName(e.target.value)}
          onPressEnter={handleLogin}
          prefix={<UserOutlined />}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          可用用户: admin(管理员), developer(开发者), user(普通用户)
        </Typography.Paragraph>
      </Modal>
    </>
  )
}

export default Header
