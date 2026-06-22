/**
 * 富文本编辑器组件
 * 支持格式化文本编辑、图片插入、链接等功能
 */

import React, { useRef, useState, useCallback } from 'react';

export interface RichTextEditorProps {
  /** 编辑器内容（HTML 格式） */
  value?: string;
  /** 内容变更回调 */
  onChange?: (html: string) => void;
  /** 占位提示 */
  placeholder?: string;
  /** 编辑器高度 */
  height?: number;
  /** 是否只读 */
  readOnly?: boolean;
  /** 工具栏配置 */
  toolbar?: string[];
}

/**
 * 富文本编辑器组件
 * 基于 contentEditable 实现，提供常见的文本格式化能力
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder = '在此输入内容...',
  height = 300,
  readOnly = false,
  toolbar = ['bold', 'italic', 'underline', 'heading', 'list', 'link', 'image', 'code'],
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  /**
   * 执行格式化命令
   * 使用 document.execCommand 实现基础格式化
   */
  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    // 触发内容变更
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  /**
   * 处理内容变更
   */
  const handleInput = useCallback(() => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  /** 工具栏按钮配置 */
  const toolbarItems: { key: string; label: string; command: string; value?: string }[] = [
    { key: 'bold', label: 'B', command: 'bold' },
    { key: 'italic', label: 'I', command: 'italic' },
    { key: 'underline', label: 'U', command: 'underline' },
    { key: 'heading', label: 'H', command: 'formatBlock', value: 'h2' },
    { key: 'list', label: '≡', command: 'insertUnorderedList' },
    { key: 'link', label: '🔗', command: 'createLink', value: '' },
    { key: 'image', label: '🖼', command: 'insertImage', value: '' },
    { key: 'code', label: '<>', command: 'formatBlock', value: 'pre' },
  ];

  const activeToolbar = toolbarItems.filter((item) => toolbar.includes(item.key));

  return (
    <div
      style={{
        border: `1px solid ${isFocused ? '#1890ff' : '#d9d9d9'}`,
        borderRadius: 6,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* 工具栏 */}
      {!readOnly && (
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: '6px 8px',
            background: '#fafafa',
            borderBottom: '1px solid #e8e8e8',
            flexWrap: 'wrap',
          }}
        >
          {activeToolbar.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                let val = item.value;
                if (item.key === 'link') {
                  val = prompt('请输入链接地址:') || '';
                  if (!val) return;
                }
                if (item.key === 'image') {
                  val = prompt('请输入图片地址:') || '';
                  if (!val) return;
                }
                execCommand(item.command, val);
              }}
              title={item.key}
              style={{
                width: 32,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: '1px solid transparent',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: item.key === 'bold' ? 700 : 400,
                fontStyle: item.key === 'italic' ? 'italic' : 'normal',
                color: '#333',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = '#e8e8e8';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = 'none';
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* 编辑区域 */}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        dangerouslySetInnerHTML={{ __html: value }}
        data-placeholder={placeholder}
        style={{
          padding: 12,
          minHeight: height,
          outline: 'none',
          fontSize: 14,
          lineHeight: 1.6,
          color: '#333',
          cursor: readOnly ? 'default' : 'text',
        }}
      />

      {/* 空内容时显示占位提示的样式 */}
      <style>{`
        [contenteditable]:empty::before {
          content: attr(data-placeholder);
          color: #bbb;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
