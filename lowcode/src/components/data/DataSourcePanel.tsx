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
  InputNumber,
  message,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import { DataSource } from '../../types'

const { Title } = Typography
const { Option } = Select
const { TextArea } = Input

const DataSourcePanel: React.FC = () => {
  const { dataSources, addDataSource, updateDataSource, deleteDataSource } = useAppStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null)
  const [form] = Form.useForm()

  const handleAdd = () => {
    setEditingDataSource(null)
    form.resetFields()
    setIsModalOpen(true)
  }

  const handleEdit = (record: DataSource) => {
    setEditingDataSource(record)
    form.setFieldsValue({
      ...record,
      data: record.data ? JSON.stringify(record.data, null, 2) : '{}',
    })
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除数据源后，依赖该数据源的组件将无法正常工作。是否继续？',
      onOk: () => {
        deleteDataSource(id)
        message.success('数据源已删除')
      },
    })
  }

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const { data, ...rest } = values
      let parsedData: Record<string, unknown> = {}

      try {
        if (data) {
          parsedData = JSON.parse(data)
        }
      } catch {
        message.error('JSON 格式错误')
        return
      }

      if (editingDataSource) {
        updateDataSource(editingDataSource.id, { ...rest, data: parsedData })
        message.success('数据源已更新')
      } else {
        addDataSource({ ...rest, data: parsedData })
        message.success('数据源已添加')
      }

      setIsModalOpen(false)
    })
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span>{text}</span>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: 'local' | 'api') => (
        <span>
          {type === 'local' ? (
            <Space>
              <DatabaseOutlined /> 本地数据
            </Space>
          ) : (
            <Space>
              <GlobalOutlined /> API 数据
            </Space>
          )}
        </span>
      ),
    },
    {
      title: '数据预览',
      dataIndex: 'data',
      key: 'data',
      render: (data: Record<string, unknown>) => (
        <Typography.Text ellipsis style={{ maxWidth: 300, display: 'block' }}>
          {data ? JSON.stringify(data) : '无数据'}
        </Typography.Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: DataSource) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small">
            编辑
          </Button>
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} size="small">
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title={
        <Space>
          <DatabaseOutlined />
          <Title level={5} style={{ margin: 0 }}>
            数据源管理
          </Title>
        </Space>
      }
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建数据源
        </Button>
      }
      className="h-full"
      bodyStyle={{ height: 'calc(100% - 57px)', overflow: 'auto' }}
    >
      <Table
        columns={columns}
        dataSource={dataSources}
        rowKey="id"
        pagination={false}
        locale={{ emptyText: '暂无数据源，请点击上方按钮创建' }}
      />

      <Modal
        title={editingDataSource ? '编辑数据源' : '新建数据源'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="数据源名称"
            rules={[{ required: true, message: '请输入数据源名称' }]}
          >
            <Input placeholder="请输入数据源名称" />
          </Form.Item>

          <Form.Item
            name="type"
            label="数据源类型"
            rules={[{ required: true, message: '请选择数据源类型' }]}
            initialValue="local"
          >
            <Select>
              <Option value="local">本地数据 (JSON)</Option>
              <Option value="api">API 接口 (模拟)</Option>
            </Select>
          </Form.Item>

          <Form.Item shouldUpdate>
            {({ getFieldValue }) =>
              getFieldValue('type') === 'api' ? (
                <>
                  <Form.Item name="url" label="API 地址">
                    <Input placeholder="https://api.example.com/data" />
                  </Form.Item>
                  <Form.Item name="method" label="请求方法" initialValue="GET">
                    <Select>
                      <Option value="GET">GET</Option>
                      <Option value="POST">POST</Option>
                    </Select>
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>

          <Form.Item name="data" label="数据内容 (JSON 格式)">
            <TextArea
              rows={8}
              placeholder={`{\n  "value": "测试数据"\n}`}
              defaultValue="{}"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default DataSourcePanel
