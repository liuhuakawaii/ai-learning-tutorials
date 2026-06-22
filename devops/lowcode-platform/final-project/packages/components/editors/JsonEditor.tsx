/**
 * JSON 编辑器组件
 * 用于编辑 JSON 格式的数据，支持语法验证和格式化
 */

import React, { useState, useCallback, useEffect } from 'react';

export interface JsonEditorProps {
  /** JSON 值 */
  value?: any;
  /** 值变更回调 */
  onChange?: (value: any) => void;
  /** 编辑器高度 */
  height?: number;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否显示行号 */
  showLineNumbers?: boolean;
  /** 缩进空格数 */
  indent?: number;
}

/**
 * JSON 编辑器组件
 * 提供 JSON 编辑、语法验证、格式化和压缩能力
 */
export const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  height = 300,
  readOnly = false,
  indent = 2,
}) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setText(value !== undefined ? JSON.stringify(value, null, indent) : '');
      setError(null);
    } catch {
      setText(String(value));
    }
  }, [value, indent]);

  /**
   * 处理文本变更
   * 实时验证 JSON 语法
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);

      try {
        const parsed = JSON.parse(newText);
        setError(null);
        onChange?.(parsed);
      } catch (err: any) {
        setError(err.message);
      }
    },
    [onChange]
  );

  /**
   * 格式化 JSON
   */
  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed, null, indent));
      setError(null);
    } catch {
      setError('无法格式化：JSON 语法错误');
    }
  }, [text, indent]);

  /**
   * 压缩 JSON
   */
  const handleMinify = useCallback(() => {
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed));
      setError(null);
    } catch {
      setError('无法压缩：JSON 语法错误');
    }
  }, [text]);

  /**
   * 复制到剪贴板
   */
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
  }, [text]);

  return (
    <div
      style={{
        border: `1px solid ${error ? '#ff4d4f' : '#d9d9d9'}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {/* 工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 12px',
          background: '#fafafa',
          borderBottom: '1px solid #e8e8e8',
          fontSize: 12,
        }}
      >
        <span style={{ color: '#666' }}>JSON</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleFormat} style={toolBtnStyle} title="格式化">
            格式化
          </button>
          <button onClick={handleMinify} style={toolBtnStyle} title="压缩">
            压缩
          </button>
          <button onClick={handleCopy} style={toolBtnStyle} title="复制">
            复制
          </button>
        </div>
      </div>

      {/* 编辑区域 */}
      <textarea
        value={text}
        onChange={handleChange}
        readOnly={readOnly}
        spellCheck={false}
        style={{
          width: '100%',
          height,
          padding: 12,
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          fontFamily: "'Fira Code', 'Consolas', monospace",
          fontSize: 13,
          lineHeight: '1.5em',
          background: '#fff',
          color: '#333',
          tabSize: indent,
          boxSizing: 'border-box',
        }}
      />

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            padding: '6px 12px',
            background: '#fff2f0',
            borderTop: '1px solid #ffccc7',
            color: '#ff4d4f',
            fontSize: 12,
          }}
        >
          JSON 语法错误：{error}
        </div>
      )}
    </div>
  );
};

const toolBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  cursor: 'pointer',
  color: '#666',
  fontSize: 11,
  padding: '2px 8px',
};

export default JsonEditor;
