/**
 * 页面预览渲染器
 * 将设计器产出的组件树渲染为可交互的页面
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import type { ComponentNode } from '../designer/store';
import { getComponentMeta } from '../components/registry';
import { RuntimeEngine } from './RuntimeEngine';

interface PreviewRendererProps {
  /** 组件树定义 */
  tree: ComponentNode[];
  /** 页面全局变量 */
  variables?: Record<string, any>;
  /** 是否为设计模式（设计模式下不可交互） */
  designMode?: boolean;
}

/**
 * 页面预览渲染器
 * 根据组件树定义渲染完整页面，支持数据绑定和事件处理
 */
export const PreviewRenderer: React.FC<PreviewRendererProps> = ({
  tree,
  variables = {},
  designMode = false,
}) => {
  const [state, setState] = useState<Record<string, any>>(variables);
  const [apiData, setApiData] = useState<Record<string, any>>({});
  const runtime = useMemo(() => new RuntimeEngine(), []);

  /**
   * 处理组件事件
   * 根据事件配置执行相应动作
   */
  const handleEvent = useCallback(
    async (nodeId: string, eventName: string, eventConfig: any) => {
      if (designMode) return;

      switch (eventConfig.type) {
        case 'navigate':
          // 页面跳转
          window.location.href = eventConfig.config.url;
          break;

        case 'api':
          // 调用 API 接口
          try {
            const result = await runtime.callApi(eventConfig.config.endpoint, eventConfig.config.method, {
              ...eventConfig.config.body,
              __state: state,
            });
            setApiData((prev) => ({ ...prev, [`${nodeId}_${eventName}`]: result }));
          } catch (error) {
            console.error('API 调用失败:', error);
          }
          break;

        case 'script':
          // 执行自定义脚本
          runtime.executeScript(eventConfig.config.script, state, setState);
          break;

        case 'state':
          // 更新全局状态
          setState((prev) => ({
            ...prev,
            [eventConfig.config.key]: eventConfig.config.value,
          }));
          break;
      }
    },
    [designMode, runtime, state]
  );

  /**
   * 解析组件的数据绑定
   * 将数据源配置解析为实际数据
   */
  const resolveDataSource = useCallback(
    (dataSource: any): any => {
      if (!dataSource) return undefined;

      switch (dataSource.type) {
        case 'static':
          return dataSource.config.value;

        case 'api':
          return apiData[dataSource.config.apiId];

        case 'model':
          return apiData[`model_${dataSource.config.modelName}`];

        case 'state':
          return state[dataSource.config.field];

        default:
          return undefined;
      }
    },
    [apiData, state]
  );

  /**
   * 递归渲染组件树中的每个节点
   */
  const renderNode = useCallback(
    (node: ComponentNode): React.ReactNode => {
      const Component = getComponentRenderer(node.type);
      const props: Record<string, any> = { ...node.props };

      // 解析数据绑定
      if (node.dataSource) {
        const data = resolveDataSource(node.dataSource);
        if (data !== undefined) {
          if (node.type === 'Table') {
            props.dataSource = data;
          } else if (node.type === 'List') {
            props.dataSource = data;
          } else if (node.type === 'Chart') {
            props.data = data;
          } else {
            props.value = data;
          }
        }
      }

      // 绑定事件处理器
      if (node.events) {
        for (const [eventName, handler] of Object.entries(node.events)) {
          props[eventName] = (...args: any[]) => handleEvent(node.id, eventName, handler);
        }
      }

      // 递归渲染子节点
      const children = node.children?.map((child) => renderNode(child));

      return (
        <Component key={node.id} {...props}>
          {children}
        </Component>
      );
    },
    [handleEvent, resolveDataSource]
  );

  return (
    <div className="preview-container" style={{ padding: 16 }}>
      {tree.map((node) => renderNode(node))}
    </div>
  );
};

/**
 * 获取组件渲染器
 * 将组件类型映射到实际的 React 组件
 */
function getComponentRenderer(type: string): React.ComponentType<any> {
  const renderers: Record<string, React.ComponentType<any>> = {
    Button: ({ children, onClick, ...props }) => (
      <button onClick={onClick} {...filterHtmlProps(props)}>
        {children}
      </button>
    ),
    Input: ({ value, onChange, placeholder, ...props }) => (
      <input
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        {...filterHtmlProps(props)}
      />
    ),
    Text: ({ content, style }) => <span style={style}>{content}</span>,
    Container: ({ children, direction, gap, style }) => (
      <div
        style={{
          display: 'flex',
          flexDirection: direction === 'horizontal' ? 'row' : 'column',
          gap,
          ...style,
        }}
      >
        {children}
      </div>
    ),
    Card: ({ title, children, extra }) => (
      <div
        style={{
          border: '1px solid #e8e8e8',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>{title}</h3>
            {extra}
          </div>
        )}
        {children}
      </div>
    ),
    Table: ({ columns, dataSource, pagination }) => (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns?.map((col: any, i: number) => (
              <th
                key={i}
                style={{
                  padding: '8px 12px',
                  borderBottom: '2px solid #e8e8e8',
                  textAlign: 'left',
                  fontWeight: 600,
                }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource?.map((row: any, rowIndex: number) => (
            <tr key={rowIndex}>
              {columns?.map((col: any, colIndex: number) => (
                <td
                  key={colIndex}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #e8e8e8',
                  }}
                >
                  {row[col.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
    Chart: ({ type, data, xField, yField }) => (
      <div
        style={{
          padding: 24,
          background: '#fafafa',
          borderRadius: 8,
          textAlign: 'center',
          color: '#999',
        }}
      >
        📊 图表组件（{type}）- 数据量: {data?.length || 0}
      </div>
    ),
    Form: ({ children, onFinish }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onFinish?.(new FormData(e.currentTarget));
        }}
      >
        {children}
      </form>
    ),
    Grid: ({ children, columns, gutter }) => (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: gutter,
        }}
      >
        {children}
      </div>
    ),
    Divider: ({ dashed }) => (
      <hr
        style={{
          border: 'none',
          borderTop: `1px ${dashed ? 'dashed' : 'solid'} #e8e8e8`,
          margin: '12px 0',
        }}
      />
    ),
  };

  return (
    renderers[type] ||
    (({ children }) => (
      <div style={{ padding: 8, border: '1px dashed #d9d9d9', borderRadius: 4 }}>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>未知组件: {type}</div>
        {children}
      </div>
    ))
  );
}

/**
 * 过滤非 HTML 属性，避免 React 警告
 */
function filterHtmlProps(props: Record<string, any>): Record<string, any> {
  const htmlProps: Record<string, any> = {};
  const allowed = ['style', 'className', 'id', 'disabled', 'onClick', 'onChange', 'placeholder'];
  for (const key of allowed) {
    if (key in props) htmlProps[key] = props[key];
  }
  return htmlProps;
}

export default PreviewRenderer;
