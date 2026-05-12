import React, { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  message,
  Typography,
  Tabs,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import { Role, User } from '../../types'

const { Title } = Typography
const { Option } = Select

const allPermissions = [
  { label: '设计器', value: 'design', description: '页面设计和组件配置' },
  { label: '预览', value: 'preview', description: '页面预览' },
  { label: '数据源', value: 'data', description: '数据源管理' },
  { label: '权限管理', value: 'permission', description: '用户和角色管理' },
  { label: '发布', value: 'publish', description: '页面发布' },
]

const PermissionPanel: React.FC = () => {
  const { roles, users, addRole, updateRole, deleteRole, addUser, updateUser, deleteUser } =
    useAppStore()

  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [roleForm] = Form.useForm()
  const [userForm] = Form.useForm()

  const handleAddRole = () => {
    setEditingRole(null)
    roleForm.resetFields()
    setRoleModalOpen(true)
  }

  const handleEditRole = (record: Role) => {
    setEditingRole(record)
    roleForm.setFieldsValue(record)
    setRoleModalOpen(true)
  }

  const handleDeleteRole = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除角色后，分配给该角色的用户将失去相关权限。是否继续？',
      onOk: () => {
        deleteRole(id)
        message.success('角色已删除')
      },
    })
  }

  const handleSubmitRole = () => {
    roleForm.validateFields().then((values) => {
      if (editingRole) {
        updateRole(editingRole.id, values)
        message.success('角色已更新')
      } else {
        addRole(values)
        message.success('角色已添加')
      }
      setRoleModalOpen(false)
    })
  }

  const handleAddUser = () => {
    setEditingUser(null)
    userForm.resetFields()
    setUserModalOpen(true)
  }

  const handleEditUser = (record: User) => {
    setEditingUser(record)
    userForm.setFieldsValue(record)
    setUserModalOpen(true)
  }

  const handleDeleteUser = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该用户吗？',
      onOk: () => {
        deleteUser(id)
        message.success('用户已删除')
      },
    })
  }

  const handleSubmitUser = () => {
    userForm.validateFields().then((values) => {
      if (editingUser) {
        updateUser(editingUser.id, values)
        message.success('用户已更新')
      } else {
        addUser(values)
        message.success('用户已添加')
      }
      setUserModalOpen(false)
    })
  }

  const roleColumns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '权限列表',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[]) => {
        if (permissions.includes('*')) {
          return <Typography.Text type="success">全部权限</Typography.Text>
        }
        return (
          <Space wrap>
            {permissions.map((p) => {
              const perm = allPermissions.find((ap) => ap.value === p)
              return perm ? (
                <Typography.Text key={p} className="text-sm px-2 py-1 bg-gray-100 rounded">
                  {perm.label}
                </Typography.Text>
              ) : null
            })}
          </Space>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Role) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => handleEditRole(record)} size="small">
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDeleteRole(record.id)}
            size="small"
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '角色',
      dataIndex: 'roleId',
      key: 'roleId',
      render: (roleId: string) => {
        const role = roles.find((r) => r.id === roleId)
        return role ? role.name : '未分配角色'
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: User) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => handleEditUser(record)} size="small">
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDeleteUser(record.id)}
            size="small"
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Card className="h-full" bodyStyle={{ height: '100%', padding: 0 }}>
      <Tabs
        items={[
          {
            key: 'roles',
            label: (
              <Space>
                <SafetyCertificateOutlined />
                角色管理
              </Space>
            ),
            children: (
              <div style={{ padding: 24 }}>
                <Space style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRole}>
                    新建角色
                  </Button>
                </Space>
                <Table
                  columns={roleColumns}
                  dataSource={roles}
                  rowKey="id"
                  pagination={false}
                />
              </div>
            ),
          },
          {
            key: 'users',
            label: (
              <Space>
                <TeamOutlined />
                用户管理
              </Space>
            ),
            children: (
              <div style={{ padding: 24 }}>
                <Space style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUser}>
                    新建用户
                  </Button>
                </Space>
                <Table
                  columns={userColumns}
                  dataSource={users}
                  rowKey="id"
                  pagination={false}
                />
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={roleModalOpen}
        onOk={handleSubmitRole}
        onCancel={() => setRoleModalOpen(false)}
        width={500}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item name="permissions" label="权限列表">
            <Checkbox.Group>
              <Space direction="vertical">
                {allPermissions.map((perm) => (
                  <Checkbox key={perm.value} value={perm.value}>
                    {perm.label} - {perm.description}
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={userModalOpen}
        onOk={handleSubmitUser}
        onCancel={() => setUserModalOpen(false)}
        width={500}
      >
        <Form form={userForm} layout="vertical">
          <Form.Item
            name="name"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="roleId"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              {roles.map((role) => (
                <Option key={role.id} value={role.id}>
                  {role.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default PermissionPanel
