/**
 * 设计器画布组件
 * 支持拖拽放置、选中高亮、缩放和平移
 */

import React, { useCallback, useRef } from 'react';
import { DndContext, type DragEndEvent, type DragOverEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useDesignerStore, type ComponentNode } from './store';

/**
 * 设计器画布
 * 用户在此区域通过拖拽组件来搭建页面布局
 */
export const DesignerCanvas: React.FC = () => {
  const { tree, selectedId, selectNode, moveNode, addChild } = useDesignerStore();
  const canvasRef = useRef<HTMLDivElement>(null);

  // 配置拖拽传感器，设置激活距离避免误触
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  /**
   * 处理拖拽结束事件
   * 判断是移动已有节点还是从组件面板拖入新组件
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const sourceId = active.id as string;
      const targetId = over.id as string;

      if (sourceId.startsWith('panel-')) {
        // 从组件面板拖入新组件
        const componentType = sourceId.replace('panel-', '');
        addChild(targetId, {
          id: `node-${Date.now()}`,
          type: componentType,
          props: getDefaultProps(componentType),
          children: [],
        });
      } else {
        // 移动已有节点
        moveNode(sourceId, targetId);
      }
    },
    [moveNode, addChild]
  );

  /**
   * 渲染组件树节点
   * 递归渲染每个节点及其子节点
   */
  const renderNode = useCallback(
    (node: ComponentNode): React.ReactNode => {
      const isSelected = selectedId === node.id;
      const Component = getComponentRenderer(node.type);

      return (
        <div
          key={node.id}
          data-node-id={node.id}
          onClick={(e) => {
            e.stopPropagation();
            selectNode(node.id);
          }}
          style={{
            outline: isSelected ? '2px solid #1890ff' : 'none',
            outlineOffset: 2,
            minHeight: node.type === 'Container' ? 60 : 'auto',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          <Component {...node.props}>
            {node.children?.map((child) => renderNode(child))}
          </Component>

          {/* 选中时显示操作工具栏 */}
          {isSelected && (
            <div
              style={{
                position: 'absolute',
                top: -28,
                right: 0,
                display: 'flex',
                gap: 4,
                background: '#1890ff',
                borderRadius: 4,
                padding: '2px 6px',
              }}
            >
              <span style={{ color: '#fff', fontSize: 12 }}>{node.type}</span>
            </div>
          )}
        </div>
      );
    },
    [selectedId, selectNode]
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        ref={canvasRef}
        className="designer-canvas"
        onClick={() => selectNode(null)}
        style={{
          flex: 1,
          padding: 24,
          background: '#f5f5f5',
          minHeight: '100vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            background: '#fff',
            borderRadius: 8,
            padding: 16,
            minHeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          {tree.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 400,
                color: '#999',
                fontSize: 16,
              }}
            >
              从左侧组件面板拖拽组件到此处开始搭建页面
            </div>
          ) : (
            tree.map((node) => renderNode(node))
          )}
        </div>
      </div>
    </DndContext>
  );
};

/**
 * 获取组件的默认属性
 * 当新组件拖入画布时，自动填充合理的默认值
 */
function getDefaultProps(type: string): Record<string, any> {
  const defaults: Record<string, Record<string, any>> = {
    Button: { type: 'primary', children: '按钮' },
    Input: { placeholder: '请输入', allowClear: true },
    Select: { placeholder: '请选择', options: [] },
    Table: { columns: [], dataSource: [], pagination: true },
    Form: { layout: 'horizontal' },
    Card: { title: '卡片标题' },
    Text: { content: '文本内容', style: { fontSize: 14 } },
    Image: { src: '', alt: '图片', width: 200 },
    Container: { direction: 'vertical', gap: 8 },
    Grid: { columns: 3, gutter: 16 },
    Tabs: { items: [{ key: '1', label: '标签一', children: [] }] },
    Chart: { type: 'line', data: [], xField: 'x', yField: 'y' },
  };
  return defaults[type] || {};
}

/**
 * 获取组件的渲染器
 * 根据组件类型返回对应的 React 组件
 */
function getComponentRenderer(type: string): React.ComponentType<any> {
  const renderers: Record<string, React.ComponentType<any>> = {
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
    Input: (props) => <input {...props} />,
    Text: ({ content, style }) => <span style={style}>{content}</span>,
    Container: ({ children, direction, gap, style }) => (
      <div style={{ display: 'flex', flexDirection: direction === 'horizontal' ? 'row' : 'column', gap, ...style }}>
        {children}
      </div>
    ),
    Card: ({ title, children }) => (
      <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 16 }}>
        {title && <h3 style={{ margin: '0 0 12px' }}>{title}</h3>}
        {children}
      </div>
    ),
  };

  return renderers[type] || (({ children }) => <div>{children}</div>);
}

export default DesignerCanvas;
