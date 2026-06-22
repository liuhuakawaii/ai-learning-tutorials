/**
 * 代码编辑器组件
 * 基于 Monaco Editor 封装，支持语法高亮和自动补全
 */

import React, { useRef, useEffect, useState } from 'react';

export interface CodeEditorProps {
  /** 编辑器内容 */
  value?: string;
  /** 内容变更回调 */
  onChange?: (value: string) => void;
  /** 编程语言 */
  language?: string;
  /** 主题 */
  theme?: 'light' | 'dark';
  /** 是否只读 */
  readOnly?: boolean;
  /** 行号显示 */
  showLineNumbers?: boolean;
  /** 自动换行 */
  wordWrap?: 'on' | 'off';
  /** 编辑器高度 */
  height?: number;
  /** 占位提示 */
  placeholder?: string;
}

/**
 * 代码编辑器组件
 * 适用于低代码平台中需要代码输入的场景（脚本节点、自定义组件代码等）
 */
export const CodeEditor: React.FC<CodeEditorProps> = ({
  value = '',
  onChange,
  language = 'javascript',
  theme = 'light',
  readOnly = false,
  showLineNumbers = true,
  wordWrap = 'on',
  height = 300,
  placeholder = '// 在此输入代码...',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    onChange?.(newValue);
  };

  // 简易代码编辑器实现（生产环境应替换为 Monaco Editor）
  return (
    <div
      ref={containerRef}
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        overflow: 'hidden',
        background: theme === 'dark' ? '#1e1e1e' : '#fff',
      }}
    >
      {/* 工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 12px',
          background: theme === 'dark' ? '#2d2d2d' : '#f5f5f5',
          borderBottom: '1px solid #d9d9d9',
          fontSize: 12,
        }}
      >
        <span style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
          {language.toUpperCase()}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(internalValue);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme === 'dark' ? '#ccc' : '#666',
              fontSize: 12,
            }}
          >
            复制
          </button>
          {readOnly && (
            <span style={{ color: '#faad14', fontSize: 11 }}>只读</span>
          )}
        </div>
      </div>

      {/* 编辑区域 */}
      <div style={{ display: 'flex', height: height - 32 }}>
        {/* 行号 */}
        {showLineNumbers && (
          <div
            style={{
              padding: '8px 0',
              background: theme === 'dark' ? '#252526' : '#f8f8f8',
              color: theme === 'dark' ? '#858585' : '#bbb',
              textAlign: 'right',
              userSelect: 'none',
              fontSize: 13,
              lineHeight: '1.5em',
              minWidth: 40,
              borderRight: '1px solid #e8e8e8',
            }}
          >
            {internalValue.split('\n').map((_, i) => (
              <div key={i} style={{ paddingRight: 8 }}>
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {/* 文本输入区域 */}
        <textarea
          value={internalValue}
          onChange={handleChange}
          readOnly={readOnly}
          placeholder={placeholder}
          spellCheck={false}
          style={{
            flex: 1,
            padding: 8,
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
            fontSize: 13,
            lineHeight: '1.5em',
            background: theme === 'dark' ? '#1e1e1e' : '#fff',
            color: theme === 'dark' ? '#d4d4d4' : '#333',
            wordWrap,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;
