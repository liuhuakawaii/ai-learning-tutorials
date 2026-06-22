/**
 * 设计器状态管理
 * 使用 Zustand 管理设计器的全局状态，支持撤销/重做
 */

import { create } from 'zustand';
import type { ComponentNode } from './index';

export type { ComponentNode };

interface DesignerStore {
  // 组件树
  tree: ComponentNode[];
  // 选中的节点 ID
  selectedId: string | null;
  // 悬停的节点 ID
  hoveredId: string | null;
  // 剪贴板
  clipboard: ComponentNode | null;
  // 历史记录（用于撤销/重做）
  history: ComponentNode[][];
  historyIndex: number;
  // 拖拽状态
  dragState: {
    isDragging: boolean;
    sourceId: string | null;
    targetId: string | null;
    position: 'before' | 'after' | 'inside' | null;
  };

  // 操作方法
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  addChild: (parentId: string, node: ComponentNode) => void;
  addRootNode: (node: ComponentNode) => void;
  removeNode: (id: string) => void;
  updateNodeProps: (id: string, props: Record<string, any>) => void;
  moveNode: (sourceId: string, targetId: string) => void;
  copyNode: (id: string) => void;
  pasteNode: (parentId: string) => void;
  duplicateNode: (id: string) => void;
  undo: () => void;
  redo: () => void;
  setTree: (tree: ComponentNode[]) => void;
  clearCanvas: () => void;
}

/**
 * 保存当前状态到历史记录
 * 用于支持撤销/重做功能
 */
function pushHistory(tree: ComponentNode[], history: ComponentNode[][], historyIndex: number) {
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(tree)));
  // 限制历史记录最多 50 步
  if (newHistory.length > 50) newHistory.shift();
  return { history: newHistory, historyIndex: newHistory.length - 1 };
}

/**
 * 在组件树中递归查找节点
 */
function findNodeInTree(nodes: ComponentNode[], id: string): ComponentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 从组件树中移除指定节点
 * 返回移除后的树和被移除的节点
 */
function removeFromTree(nodes: ComponentNode[], id: string): [ComponentNode[], ComponentNode | null] {
  let removed: ComponentNode | null = null;
  const result = nodes.filter((node) => {
    if (node.id === id) {
      removed = node;
      return false;
    }
    if (node.children) {
      const [newChildren, r] = removeFromTree(node.children, id);
      if (r) removed = r;
      node.children = newChildren;
    }
    return true;
  });
  return [result, removed];
}

/**
 * 更新指定节点的属性
 */
function updatePropsInTree(nodes: ComponentNode[], id: string, props: Record<string, any>): ComponentNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, props: { ...node.props, ...props } };
    }
    if (node.children) {
      return { ...node, children: updatePropsInTree(node.children, id, props) };
    }
    return node;
  });
}

/**
 * 创建设计器状态管理 Store
 */
export const useDesignerStore = create<DesignerStore>((set, get) => ({
  tree: [],
  selectedId: null,
  hoveredId: null,
  clipboard: null,
  history: [[]],
  historyIndex: 0,
  dragState: {
    isDragging: false,
    sourceId: null,
    targetId: null,
    position: null,
  },

  selectNode: (id) => set({ selectedId: id }),

  hoverNode: (id) => set({ hoveredId: id }),

  /**
   * 在指定父节点下添加子节点
   */
  addChild: (parentId, node) => {
    const { tree, history, historyIndex } = get();
    const addToParent = (nodes: ComponentNode[]): ComponentNode[] =>
      nodes.map((n) => {
        if (n.id === parentId) {
          return { ...n, children: [...(n.children || []), { ...node, parentId }] };
        }
        if (n.children) {
          return { ...n, children: addToParent(n.children) };
        }
        return n;
      });

    const newTree = addToParent(tree);
    set({
      tree: newTree,
      selectedId: node.id,
      ...pushHistory(newTree, history, historyIndex),
    });
  },

  /**
   * 在根级别添加节点
   */
  addRootNode: (node) => {
    const { tree, history, historyIndex } = get();
    const newTree = [...tree, node];
    set({
      tree: newTree,
      selectedId: node.id,
      ...pushHistory(newTree, history, historyIndex),
    });
  },

  /**
   * 移除指定节点
   */
  removeNode: (id) => {
    const { tree, history, historyIndex, selectedId } = get();
    const [newTree] = removeFromTree(tree, id);
    set({
      tree: newTree,
      selectedId: selectedId === id ? null : selectedId,
      ...pushHistory(newTree, history, historyIndex),
    });
  },

  /**
   * 更新指定节点的属性
   */
  updateNodeProps: (id, props) => {
    const { tree, history, historyIndex } = get();
    const newTree = updatePropsInTree(tree, id, props);
    set({
      tree: newTree,
      ...pushHistory(newTree, history, historyIndex),
    });
  },

  /**
   * 移动节点到新的位置
   */
  moveNode: (sourceId, targetId) => {
    const { tree, history, historyIndex } = get();
    const [treeWithoutSource, removed] = removeFromTree(tree, sourceId);
    if (!removed) return;

    const addToTarget = (nodes: ComponentNode[]): ComponentNode[] =>
      nodes.map((n) => {
        if (n.id === targetId) {
          return { ...n, children: [...(n.children || []), removed] };
        }
        if (n.children) {
          return { ...n, children: addToTarget(n.children) };
        }
        return n;
      });

    const newTree = addToTarget(treeWithoutSource);
    set({
      tree: newTree,
      ...pushHistory(newTree, history, historyIndex),
    });
  },

  copyNode: (id) => {
    const { tree } = get();
    const node = findNodeInTree(tree, id);
    if (node) {
      set({ clipboard: JSON.parse(JSON.stringify(node)) });
    }
  },

  /**
   * 粘贴剪贴板中的节点到目标父节点下
   */
  pasteNode: (parentId) => {
    const { clipboard, tree, history, historyIndex } = get();
    if (!clipboard) return;

    const newNode = {
      ...JSON.parse(JSON.stringify(clipboard)),
      id: `node-${Date.now()}`,
    };

    const addToParent = (nodes: ComponentNode[]): ComponentNode[] =>
      nodes.map((n) => {
        if (n.id === parentId) {
          return { ...n, children: [...(n.children || []), newNode] };
        }
        if (n.children) {
          return { ...n, children: addToParent(n.children) };
        }
        return n;
      });

    const newTree = addToParent(tree);
    set({
      tree: newTree,
      selectedId: newNode.id,
      ...pushHistory(newTree, history, historyIndex),
    });
  },

  /**
   * 复制指定节点为副本
   */
  duplicateNode: (id) => {
    const { tree, history, historyIndex } = get();
    const node = findNodeInTree(tree, id);
    if (!node) return;

    const duplicate = {
      ...JSON.parse(JSON.stringify(node)),
      id: `node-${Date.now()}`,
    };

    // 在同级节点后面插入副本
    const insertAfter = (nodes: ComponentNode[]): ComponentNode[] => {
      const result: ComponentNode[] = [];
      for (const n of nodes) {
        result.push(n);
        if (n.id === id) {
          result.push(duplicate);
        }
        if (n.children) {
          n.children = insertAfter(n.children);
        }
      }
      return result;
    };

    const newTree = insertAfter(tree);
    set({
      tree: newTree,
      selectedId: duplicate.id,
      ...pushHistory(newTree, history, historyIndex),
    });
  },

  /**
   * 撤销操作
   */
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        tree: JSON.parse(JSON.stringify(history[newIndex])),
        historyIndex: newIndex,
      });
    }
  },

  /**
   * 重做操作
   */
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        tree: JSON.parse(JSON.stringify(history[newIndex])),
        historyIndex: newIndex,
      });
    }
  },

  setTree: (tree) => {
    const { history, historyIndex } = get();
    set({
      tree,
      ...pushHistory(tree, history, historyIndex),
    });
  },

  clearCanvas: () => {
    set({
      tree: [],
      selectedId: null,
      history: [[]],
      historyIndex: 0,
    });
  },
}));
