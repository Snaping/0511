import { ComponentConfig } from '../../types'

export const commonLayoutProperties = [
  {
    name: 'width',
    label: '宽度 (%)',
    type: 'select' as const,
    defaultValue: '100',
    options: [
      { label: '100% (自适应)', value: '100' },
      { label: '75%', value: '75' },
      { label: '50% (半栏)', value: '50' },
      { label: '33% (三分之一)', value: '33' },
      { label: '25% (四分之一)', value: '25' },
      { label: '自定义', value: 'custom' },
    ],
  },
  {
    name: 'customWidth',
    label: '自定义宽度 (px)',
    type: 'number' as const,
    defaultValue: 300,
  },
  {
    name: 'align',
    label: '组件对齐',
    type: 'select' as const,
    defaultValue: 'left',
    options: [
      { label: '左对齐', value: 'left' },
      { label: '居中', value: 'center' },
      { label: '右对齐', value: 'right' },
    ],
  },
  {
    name: 'textAlign',
    label: '内容对齐',
    type: 'select' as const,
    defaultValue: 'left',
    options: [
      { label: '左对齐', value: 'left' },
      { label: '居中', value: 'center' },
      { label: '右对齐', value: 'right' },
    ],
  },
  {
    name: 'marginTop',
    label: '上边距 (px)',
    type: 'number' as const,
    defaultValue: 0,
  },
  {
    name: 'marginBottom',
    label: '下边距 (px)',
    type: 'number' as const,
    defaultValue: 16,
  },
  {
    name: 'padding',
    label: '内边距 (px)',
    type: 'number' as const,
    defaultValue: 0,
  },
  {
    name: 'hidden',
    label: '隐藏组件',
    type: 'boolean' as const,
    defaultValue: false,
  },
]

export const commonDefaultProps = {
  width: '100',
  customWidth: 300,
  align: 'left',
  textAlign: 'left',
  marginTop: 0,
  marginBottom: 16,
  padding: 0,
  hidden: false,
}

export const componentConfigs: ComponentConfig[] = [
  {
    type: 'input',
    name: '输入框',
    icon: 'FormOutlined',
    category: '表单',
    defaultProps: {
      label: '输入框',
      placeholder: '请输入',
      required: false,
      ...commonDefaultProps,
    },
    properties: [
      { name: 'label', label: '标签', type: 'text', defaultValue: '输入框' },
      { name: 'placeholder', label: '占位符', type: 'text', defaultValue: '请输入' },
      { name: 'required', label: '必填', type: 'boolean', defaultValue: false },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'textarea',
    name: '文本域',
    icon: 'AlignLeftOutlined',
    category: '表单',
    defaultProps: {
      label: '文本域',
      placeholder: '请输入',
      rows: 4,
      ...commonDefaultProps,
    },
    properties: [
      { name: 'label', label: '标签', type: 'text', defaultValue: '文本域' },
      { name: 'placeholder', label: '占位符', type: 'text', defaultValue: '请输入' },
      { name: 'rows', label: '行数', type: 'number', defaultValue: 4 },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'number',
    name: '数字输入',
    icon: 'NumberOutlined',
    category: '表单',
    defaultProps: {
      label: '数字',
      min: 0,
      max: 100,
      ...commonDefaultProps,
    },
    properties: [
      { name: 'label', label: '标签', type: 'text', defaultValue: '数字' },
      { name: 'min', label: '最小值', type: 'number', defaultValue: 0 },
      { name: 'max', label: '最大值', type: 'number', defaultValue: 100 },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'select',
    name: '下拉选择',
    icon: 'DownOutlined',
    category: '表单',
    defaultProps: {
      label: '选择',
      options: [
        { label: '选项1', value: '1' },
        { label: '选项2', value: '2' },
      ],
      ...commonDefaultProps,
    },
    properties: [
      { name: 'label', label: '标签', type: 'text', defaultValue: '选择' },
      { name: 'options', label: '选项', type: 'options' },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'radio',
    name: '单选框',
    icon: 'CheckCircleOutlined',
    category: '表单',
    defaultProps: {
      label: '单选',
      options: [
        { label: '选项1', value: '1' },
        { label: '选项2', value: '2' },
      ],
      ...commonDefaultProps,
    },
    properties: [
      { name: 'label', label: '标签', type: 'text', defaultValue: '单选' },
      { name: 'options', label: '选项', type: 'options' },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'checkbox',
    name: '多选框',
    icon: 'CheckSquareOutlined',
    category: '表单',
    defaultProps: {
      label: '多选',
      options: [
        { label: '选项1', value: '1' },
        { label: '选项2', value: '2' },
      ],
      ...commonDefaultProps,
    },
    properties: [
      { name: 'label', label: '标签', type: 'text', defaultValue: '多选' },
      { name: 'options', label: '选项', type: 'options' },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'switch',
    name: '开关',
    icon: 'SwitcherOutlined',
    category: '表单',
    defaultProps: {
      label: '开关',
      ...commonDefaultProps,
    },
    properties: [
      { name: 'label', label: '标签', type: 'text', defaultValue: '开关' },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'datePicker',
    name: '日期选择',
    icon: 'CalendarOutlined',
    category: '表单',
    defaultProps: {
      label: '日期',
      ...commonDefaultProps,
    },
    properties: [
      { name: 'label', label: '标签', type: 'text', defaultValue: '日期' },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'upload',
    name: '上传',
    icon: 'UploadOutlined',
    category: '表单',
    defaultProps: {
      label: '上传',
      ...commonDefaultProps,
    },
    properties: [
      { name: 'label', label: '标签', type: 'text', defaultValue: '上传' },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'button',
    name: '按钮',
    icon: 'PlayCircleOutlined',
    category: '基础',
    defaultProps: {
      text: '按钮',
      type: 'primary',
      buttonWidthMode: 'fixed',
      buttonFixedWidth: 120,
      buttonAlign: 'left',
      ...commonDefaultProps,
    },
    properties: [
      { name: 'text', label: '按钮文字', type: 'text', defaultValue: '按钮' },
      {
        name: 'type',
        label: '类型',
        type: 'select',
        defaultValue: 'primary',
        options: [
          { label: '主要', value: 'primary' },
          { label: '默认', value: 'default' },
          { label: '危险', value: 'danger' },
          { label: '链接', value: 'link' },
        ],
      },
      {
        name: 'buttonWidthMode',
        label: '宽度模式',
        type: 'select',
        defaultValue: 'fixed',
        options: [
          { label: '固定宽度', value: 'fixed' },
          { label: '填满容器', value: 'full' },
        ],
      },
      {
        name: 'buttonFixedWidth',
        label: '固定宽度 (px)',
        type: 'number',
        defaultValue: 120,
      },
      {
        name: 'buttonAlign',
        label: '按钮对齐',
        type: 'select',
        defaultValue: 'left',
        options: [
          { label: '居左', value: 'left' },
          { label: '居中', value: 'center' },
          { label: '居右', value: 'right' },
        ],
      },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'text',
    name: '文本',
    icon: 'FontSizeOutlined',
    category: '展示',
    defaultProps: {
      content: '文本内容',
      fontSize: 14,
      ...commonDefaultProps,
    },
    properties: [
      { name: 'content', label: '内容', type: 'text', defaultValue: '文本内容' },
      { name: 'fontSize', label: '字号', type: 'number', defaultValue: 14 },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'image',
    name: '图片',
    icon: 'ImageOutlined',
    category: '展示',
    defaultProps: {
      src: '',
      alt: '图片',
      width: 200,
      ...commonDefaultProps,
    },
    properties: [
      { name: 'src', label: '图片地址', type: 'text', defaultValue: '' },
      { name: 'alt', label: '替代文本', type: 'text', defaultValue: '图片' },
      { name: 'width', label: '图片宽度 (px)', type: 'number', defaultValue: 200 },
      ...commonLayoutProperties.filter((p) => p.name !== 'width'),
    ],
  },
  {
    type: 'divider',
    name: '分割线',
    icon: 'ColumnHeightOutlined',
    category: '布局',
    defaultProps: {
      ...commonDefaultProps,
    },
    properties: [
      {
        name: 'dividerOrientation',
        label: '分割线位置',
        type: 'select',
        defaultValue: 'center',
        options: [
          { label: '居中', value: 'center' },
          { label: '左侧', value: 'left' },
          { label: '右侧', value: 'right' },
        ],
      },
      ...commonLayoutProperties,
    ],
  },
  {
    type: 'container',
    name: '容器',
    icon: 'LayoutOutlined',
    category: '布局',
    defaultProps: {
      ...commonDefaultProps,
      padding: 16,
    },
    properties: [
      {
        name: 'bgColor',
        label: '背景色',
        type: 'select',
        defaultValue: 'transparent',
        options: [
          { label: '透明', value: 'transparent' },
          { label: '浅灰', value: '#f5f5f5' },
          { label: '白色', value: '#ffffff' },
          { label: '蓝色', value: '#e6f7ff' },
          { label: '绿色', value: '#f6ffed' },
        ],
      },
      {
        name: 'borderStyle',
        label: '边框样式',
        type: 'select',
        defaultValue: 'none',
        options: [
          { label: '无边框', value: 'none' },
          { label: '实线', value: 'solid' },
          { label: '虚线', value: 'dashed' },
        ],
      },
      ...commonLayoutProperties,
    ],
  },
]
