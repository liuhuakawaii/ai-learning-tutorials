/**
 * 组件注册表
 * 管理所有可用的页面组件，提供元数据查询和组件实例化能力
 */

/** 组件属性定义 */
export interface PropDefinition {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'json' | 'dataSource';
  defaultValue?: any;
  options?: string[];
  required?: boolean;
  description?: string;
}

/** 组件元数据 */
export interface ComponentMeta {
  name: string;
  displayName: string;
  category: string;
  icon: string;
  description: string;
  props: PropDefinition[];
  events: string[];
  slots?: string[];
}

/** 组件分类 */
export interface ComponentCategory {
  name: string;
  icon: string;
  components: ComponentMeta[];
}

/**
 * 内置组件注册表
 * 定义了低代码平台所有内置组件的元数据
 */
export const componentRegistry: Record<string, ComponentMeta> = {
  // ===== 基础组件 =====
  Button: {
    name: 'Button',
    displayName: '按钮',
    category: '基础组件',
    icon: '🔘',
    description: '触发操作的按钮组件',
    props: [
      { name: 'type', displayName: '类型', type: 'select', options: ['primary', 'default', 'dashed', 'link', 'text'], defaultValue: 'default' },
      { name: 'size', displayName: '尺寸', type: 'select', options: ['small', 'middle', 'large'], defaultValue: 'middle' },
      { name: 'disabled', displayName: '禁用', type: 'boolean', defaultValue: false },
      { name: 'loading', displayName: '加载中', type: 'boolean', defaultValue: false },
      { name: 'children', displayName: '文本', type: 'string', defaultValue: '按钮' },
    ],
    events: ['onClick'],
  },
  Input: {
    name: 'Input',
    displayName: '输入框',
    category: '基础组件',
    icon: '📝',
    description: '文本输入框',
    props: [
      { name: 'placeholder', displayName: '占位提示', type: 'string', defaultValue: '请输入' },
      { name: 'disabled', displayName: '禁用', type: 'boolean', defaultValue: false },
      { name: 'allowClear', displayName: '可清除', type: 'boolean', defaultValue: true },
      { name: 'maxLength', displayName: '最大长度', type: 'number' },
    ],
    events: ['onChange', 'onPressEnter', 'onBlur', 'onFocus'],
  },
  Select: {
    name: 'Select',
    displayName: '选择器',
    category: '基础组件',
    icon: '📋',
    description: '下拉选择器',
    props: [
      { name: 'placeholder', displayName: '占位提示', type: 'string', defaultValue: '请选择' },
      { name: 'options', displayName: '选项', type: 'json', defaultValue: [] },
      { name: 'multiple', displayName: '多选', type: 'boolean', defaultValue: false },
      { name: 'disabled', displayName: '禁用', type: 'boolean', defaultValue: false },
    ],
    events: ['onChange', 'onDropdownVisibleChange'],
  },
  DatePicker: {
    name: 'DatePicker',
    displayName: '日期选择',
    category: '基础组件',
    icon: '📅',
    description: '日期选择器',
    props: [
      { name: 'placeholder', displayName: '占位提示', type: 'string', defaultValue: '请选择日期' },
      { name: 'format', displayName: '格式', type: 'string', defaultValue: 'YYYY-MM-DD' },
      { name: 'showTime', displayName: '显示时间', type: 'boolean', defaultValue: false },
    ],
    events: ['onChange'],
  },
  Switch: {
    name: 'Switch',
    displayName: '开关',
    category: '基础组件',
    icon: '🔀',
    description: '开关切换组件',
    props: [
      { name: 'checked', displayName: '选中状态', type: 'boolean', defaultValue: false },
      { name: 'disabled', displayName: '禁用', type: 'boolean', defaultValue: false },
    ],
    events: ['onChange'],
  },

  // ===== 布局组件 =====
  Container: {
    name: 'Container',
    displayName: '容器',
    category: '布局组件',
    icon: '📦',
    description: '通用容器组件，用于组合其他组件',
    props: [
      { name: 'direction', displayName: '排列方向', type: 'select', options: ['vertical', 'horizontal'], defaultValue: 'vertical' },
      { name: 'gap', displayName: '间距', type: 'number', defaultValue: 8 },
      { name: 'align', displayName: '对齐方式', type: 'select', options: ['start', 'center', 'end', 'stretch'], defaultValue: 'stretch' },
    ],
    events: [],
    slots: ['children'],
  },
  Grid: {
    name: 'Grid',
    displayName: '栅格',
    category: '布局组件',
    icon: '⊞',
    description: '栅格布局容器',
    props: [
      { name: 'columns', displayName: '列数', type: 'number', defaultValue: 3 },
      { name: 'gutter', displayName: '间距', type: 'number', defaultValue: 16 },
    ],
    events: [],
    slots: ['children'],
  },
  Card: {
    name: 'Card',
    displayName: '卡片',
    category: '布局组件',
    icon: '🃏',
    description: '卡片容器',
    props: [
      { name: 'title', displayName: '标题', type: 'string', defaultValue: '卡片标题' },
      { name: 'bordered', displayName: '显示边框', type: 'boolean', defaultValue: true },
      { name: 'hoverable', displayName: '悬浮效果', type: 'boolean', defaultValue: false },
    ],
    events: [],
    slots: ['children', 'extra'],
  },
  Tabs: {
    name: 'Tabs',
    displayName: '标签页',
    category: '布局组件',
    icon: '📑',
    description: '标签页切换容器',
    props: [
      { name: 'items', displayName: '标签项', type: 'json', defaultValue: [] },
      { name: 'defaultActiveKey', displayName: '默认激活', type: 'string' },
    ],
    events: ['onChange'],
  },
  Divider: {
    name: 'Divider',
    displayName: '分割线',
    category: '布局组件',
    icon: '➖',
    description: '内容分割线',
    props: [
      { name: 'orientation', displayName: '方向', type: 'select', options: ['left', 'center', 'right'], defaultValue: 'center' },
      { name: 'dashed', displayName: '虚线', type: 'boolean', defaultValue: false },
    ],
    events: [],
  },

  // ===== 数据组件 =====
  Table: {
    name: 'Table',
    displayName: '表格',
    category: '数据组件',
    icon: '📊',
    description: '数据表格，支持排序、筛选、分页',
    props: [
      { name: 'columns', displayName: '列定义', type: 'json', defaultValue: [] },
      { name: 'dataSource', displayName: '数据源', type: 'dataSource', defaultValue: [] },
      { name: 'pagination', displayName: '分页', type: 'boolean', defaultValue: true },
      { name: 'bordered', displayName: '边框', type: 'boolean', defaultValue: false },
      { name: 'size', displayName: '尺寸', type: 'select', options: ['small', 'middle', 'large'], defaultValue: 'middle' },
    ],
    events: ['onRow', 'onChange'],
  },
  List: {
    name: 'List',
    displayName: '列表',
    category: '数据组件',
    icon: '📃',
    description: '通用列表组件',
    props: [
      { name: 'dataSource', displayName: '数据源', type: 'dataSource', defaultValue: [] },
      { name: 'itemLayout', displayName: '布局', type: 'select', options: ['horizontal', 'vertical'], defaultValue: 'horizontal' },
      { name: 'pagination', displayName: '分页', type: 'boolean', defaultValue: false },
    ],
    events: [],
  },
  Tree: {
    name: 'Tree',
    displayName: '树形',
    category: '数据组件',
    icon: '🌳',
    description: '树形结构展示',
    props: [
      { name: 'treeData', displayName: '数据', type: 'json', defaultValue: [] },
      { name: 'showLine', displayName: '连接线', type: 'boolean', defaultValue: true },
      { name: 'defaultExpandAll', displayName: '默认展开', type: 'boolean', defaultValue: false },
    ],
    events: ['onSelect', 'onExpand'],
  },
  Form: {
    name: 'Form',
    displayName: '表单',
    category: '数据组件',
    icon: '📄',
    description: '数据收集表单',
    props: [
      { name: 'layout', displayName: '布局', type: 'select', options: ['horizontal', 'vertical', 'inline'], defaultValue: 'horizontal' },
      { name: 'labelCol', displayName: '标签宽度', type: 'json' },
    ],
    events: ['onFinish', 'onFinishFailed'],
    slots: ['children'],
  },

  // ===== 图表组件 =====
  Chart: {
    name: 'Chart',
    displayName: '图表',
    category: '图表组件',
    icon: '📈',
    description: '通用图表组件（折线、柱状、饼图等）',
    props: [
      { name: 'type', displayName: '图表类型', type: 'select', options: ['line', 'bar', 'pie', 'area', 'scatter'], defaultValue: 'line' },
      { name: 'data', displayName: '数据', type: 'dataSource', defaultValue: [] },
      { name: 'xField', displayName: 'X 轴字段', type: 'string' },
      { name: 'yField', displayName: 'Y 轴字段', type: 'string' },
      { name: 'color', displayName: '颜色', type: 'color' },
    ],
    events: ['onClick'],
  },
};

/**
 * 按分类组织组件列表
 * 供组件面板使用
 */
export const componentCategories: ComponentCategory[] = [
  {
    name: '基础组件',
    icon: '🧱',
    components: Object.values(componentRegistry).filter((c) => c.category === '基础组件'),
  },
  {
    name: '布局组件',
    icon: '📐',
    components: Object.values(componentRegistry).filter((c) => c.category === '布局组件'),
  },
  {
    name: '数据组件',
    icon: '💾',
    components: Object.values(componentRegistry).filter((c) => c.category === '数据组件'),
  },
  {
    name: '图表组件',
    icon: '📊',
    components: Object.values(componentRegistry).filter((c) => c.category === '图表组件'),
  },
];

/**
 * 获取指定组件的元数据
 */
export function getComponentMeta(name: string): ComponentMeta | null {
  return componentRegistry[name] || null;
}

/**
 * 注册自定义组件
 * 允许用户扩展平台的组件能力
 */
export function registerComponent(meta: ComponentMeta): void {
  componentRegistry[meta.name] = meta;
}
