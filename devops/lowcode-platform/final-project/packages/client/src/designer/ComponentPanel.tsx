/**
 * 组件面板
 * 展示所有可用组件，支持拖拽到画布
 */

import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { componentCategories } from '../components/registry';

/**
 * 组件面板组件
 * 按分类展示组件列表，每个组件可拖拽到画布
 */
export const ComponentPanel: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['基础组件', '数据组件']);

  /**
   * 切换分类展开/折叠状态
   */
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  /**
   * 根据搜索文本过滤组件
   */
  const filteredCategories = componentCategories
    .map((category) => ({
      ...category,
      components: category.components.filter(
        (comp) =>
          comp.displayName.includes(searchText) || comp.name.toLowerCase().includes(searchText.toLowerCase())
      ),
    }))
    .filter((category) => category.components.length > 0);

  return (
    <div
      style={{
        width: 260,
        borderRight: '1px solid #e8e8e8',
        background: '#fafafa',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {/* 搜索框 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8' }}>
        <input
          type="text"
          placeholder="搜索组件..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* 组件分类列表 */}
      {filteredCategories.map((category) => (
        <div key={category.name}>
          <div
            onClick={() => toggleCategory(category.name)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              color: '#666',
              background: '#f0f0f0',
              borderBottom: '1px solid #e8e8e8',
              userSelect: 'none',
            }}
          >
            {expandedCategories.includes(category.name) ? '▼' : '▶'} {category.name}
          </div>

          {expandedCategories.includes(category.name) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 12px' }}>
              {category.components.map((comp) => (
                <DraggableComponentItem key={comp.name} component={comp} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * 可拖拽的组件项
 * 使用 dnd-kit 的 useDraggable 实现拖拽能力
 */
const DraggableComponentItem: React.FC<{
  component: { name: string; displayName: string; icon: string };
}> = ({ component }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `panel-${component.name}`,
    data: { type: component.name },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '8px 4px',
        background: isDragging ? '#e6f7ff' : '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 6,
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        fontSize: 12,
        transition: 'all 0.2s',
      }}
    >
      <span style={{ fontSize: 20 }}>{component.icon}</span>
      <span>{component.displayName}</span>
    </div>
  );
};

export default ComponentPanel;
