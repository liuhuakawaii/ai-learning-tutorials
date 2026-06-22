/**
 * 属性面板
 * 编辑选中组件的属性、样式和事件绑定
 */

import React, { useMemo } from 'react';
import { useDesignerStore } from './store';
import { getComponentMeta } from '../components/registry';

/**
 * 属性面板组件
 * 根据选中组件类型动态渲染对应的属性编辑表单
 */
export const PropertyPanel: React.FC = () => {
  const { tree, selectedId, updateNodeProps } = useDesignerStore();

  /**
   * 在组件树中查找选中的节点
   */
  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    return findNode(tree, selectedId);
  }, [tree, selectedId]);

  if (!selectedNode) {
    return (
      <div
        style={{
          width: 300,
          borderLeft: '1px solid #e8e8e8',
          padding: 16,
          color: '#999',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        请选择一个组件以编辑属性
      </div>
    );
  }

  const meta = getComponentMeta(selectedNode.type);
  if (!meta) return null;

  /**
   * 处理属性变更
   * 更新选中组件的指定属性值
   */
  const handlePropChange = (propName: string, value: any) => {
    updateNodeProps(selectedId!, { [propName]: value });
  };

  return (
    <div
      style={{
        width: 300,
        borderLeft: '1px solid #e8e8e8',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {/* 组件信息头部 */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e8e8e8',
          background: '#fafafa',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>{meta.displayName}</div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
          ID: {selectedNode.id}
        </div>
      </div>

      {/* 属性编辑区域 */}
      <div style={{ padding: 16 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#666' }}>基本属性</h4>
        {meta.props.map((prop) => (
          <PropField
            key={prop.name}
            prop={prop}
            value={selectedNode.props[prop.name]}
            onChange={(value) => handlePropChange(prop.name, value)}
          />
        ))}
      </div>

      {/* 样式编辑区域 */}
      <div style={{ padding: 16, borderTop: '1px solid #e8e8e8' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#666' }}>样式</h4>
        <StyleEditor
          styles={selectedNode.props.style || {}}
          onChange={(styles) => handlePropChange('style', styles)}
        />
      </div>

      {/* 事件绑定区域 */}
      <div style={{ padding: 16, borderTop: '1px solid #e8e8e8' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#666' }}>事件绑定</h4>
        <EventEditor
          events={selectedNode.events || {}}
          onChange={(events) => updateNodeProps(selectedId!, { __events: events })}
        />
      </div>

      {/* 数据绑定区域 */}
      <div style={{ padding: 16, borderTop: '1px solid #e8e8e8' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#666' }}>数据绑定</h4>
        <DataBindingEditor
          binding={selectedNode.dataSource}
          onChange={(binding) => updateNodeProps(selectedId!, { __dataSource: binding })}
        />
      </div>
    </div>
  );
};

/**
 * 属性字段编辑器
 * 根据属性类型自动选择合适的编辑控件
 */
const PropField: React.FC<{
  prop: { name: string; displayName: string; type: string; options?: string[] };
  value: any;
  onChange: (value: any) => void;
}> = ({ prop, value, onChange }) => {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>
        {prop.displayName}
      </label>
      {prop.type === 'string' && (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}
      {prop.type === 'number' && (
        <input
          type="number"
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          style={inputStyle}
        />
      )}
      {prop.type === 'boolean' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          {prop.displayName}
        </label>
      )}
      {prop.type === 'select' && prop.options && (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          <option value="">请选择</option>
          {prop.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}
      {prop.type === 'color' && (
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
};

/**
 * 样式编辑器
 * 支持常用 CSS 属性的可视化编辑
 */
const StyleEditor: React.FC<{
  styles: Record<string, any>;
  onChange: (styles: Record<string, any>) => void;
}> = ({ styles, onChange }) => {
  const styleFields = [
    { key: 'width', label: '宽度' },
    { key: 'height', label: '高度' },
    { key: 'padding', label: '内边距' },
    { key: 'margin', label: '外边距' },
    { key: 'background', label: '背景色', type: 'color' },
    { key: 'borderRadius', label: '圆角' },
    { key: 'fontSize', label: '字号' },
  ];

  return (
    <>
      {styleFields.map((field) => (
        <div key={field.key} style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#999', marginBottom: 2 }}>
            {field.label}
          </label>
          <input
            type={field.type === 'color' ? 'color' : 'text'}
            value={styles[field.key] || ''}
            onChange={(e) => onChange({ ...styles, [field.key]: e.target.value })}
            style={inputStyle}
          />
        </div>
      ))}
    </>
  );
};

/**
 * 事件编辑器
 * 配置组件触发时的响应动作
 */
const EventEditor: React.FC<{
  events: Record<string, any>;
  onChange: (events: Record<string, any>) => void;
}> = ({ events, onChange }) => {
  const commonEvents = ['onClick', 'onChange', 'onSubmit', 'onBlur', 'onFocus'];

  return (
    <>
      {commonEvents.map((eventName) => (
        <div key={eventName} style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#999', marginBottom: 2 }}>
            {eventName}
          </label>
          <select
            value={events[eventName]?.type || ''}
            onChange={(e) => {
              if (e.target.value) {
                onChange({ ...events, [eventName]: { type: e.target.value, config: {} } });
              } else {
                const { [eventName]: _, ...rest } = events;
                onChange(rest);
              }
            }}
            style={inputStyle}
          >
            <option value="">未绑定</option>
            <option value="navigate">页面跳转</option>
            <option value="api">调用接口</option>
            <option value="script">执行脚本</option>
            <option value="state">更新状态</option>
          </select>
        </div>
      ))}
    </>
  );
};

/**
 * 数据绑定编辑器
 * 配置组件数据来源（静态值、API、模型、全局状态）
 */
const DataBindingEditor: React.FC<{
  binding: any;
  onChange: (binding: any) => void;
}> = ({ binding, onChange }) => {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#999', marginBottom: 4 }}>
        数据来源
      </label>
      <select
        value={binding?.type || 'static'}
        onChange={(e) => onChange({ type: e.target.value, config: {} })}
        style={inputStyle}
      >
        <option value="static">静态值</option>
        <option value="api">API 接口</option>
        <option value="model">数据模型</option>
        <option value="state">全局状态</option>
      </select>

      {binding?.type === 'api' && (
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#999', marginBottom: 2 }}>
            接口地址
          </label>
          <input
            type="text"
            value={binding.config?.apiId || ''}
            onChange={(e) => onChange({ ...binding, config: { ...binding.config, apiId: e.target.value } })}
            style={inputStyle}
            placeholder="/api/data/users"
          />
        </div>
      )}

      {binding?.type === 'model' && (
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#999', marginBottom: 2 }}>
            模型名称
          </label>
          <input
            type="text"
            value={binding.config?.modelName || ''}
            onChange={(e) => onChange({ ...binding, config: { ...binding.config, modelName: e.target.value } })}
            style={inputStyle}
            placeholder="User"
          />
        </div>
      )}
    </div>
  );
};

// 通用输入框样式
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

/**
 * 在组件树中递归查找节点
 */
function findNode(nodes: any[], id: string): any {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export default PropertyPanel;
