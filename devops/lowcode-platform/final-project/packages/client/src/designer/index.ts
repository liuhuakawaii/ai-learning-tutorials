/**
 * 可视化页面设计器入口
 * 提供拖拽式页面搭建能力
 */

export { DesignerCanvas } from './Canvas';
export { ComponentPanel } from './ComponentPanel';
export { PropertyPanel } from './PropertyPanel';
export { useDesignerStore } from './store';

// 设计器核心类型定义
export interface ComponentNode {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: ComponentNode[];
  parentId?: string;
  layout?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  events?: Record<string, EventHandler>;
  dataSource?: DataBinding;
}

export interface EventHandler {
  type: 'navigate' | 'api' | 'script' | 'state';
  config: Record<string, any>;
}

export interface DataBinding {
  type: 'static' | 'api' | 'model' | 'state';
  config: {
    apiId?: string;
    modelName?: string;
    field?: string;
    value?: any;
    transform?: string;
  };
}

export interface DesignerState {
  tree: ComponentNode[];
  selectedId: string | null;
  hoveredId: string | null;
  clipboard: ComponentNode | null;
  history: ComponentNode[][];
  historyIndex: number;
  dragState: {
    isDragging: boolean;
    sourceId: string | null;
    targetId: string | null;
    position: 'before' | 'after' | 'inside' | null;
  };
}
