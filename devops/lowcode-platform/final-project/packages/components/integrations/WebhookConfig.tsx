/**
 * Webhook 配置组件
 * 用于配置和管理 Webhook 回调地址及触发事件
 */

import React, { useState, useCallback } from 'react';

export interface Webhook {
  id: string;
  /** Webhook 名称 */
  name: string;
  /** 回调 URL */
  url: string;
  /** 触发事件列表 */
  events: string[];
  /** 请求头 */
  headers?: Record<string, string>;
  /** 密钥（用于签名验证） */
  secret?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 最后触发时间 */
  lastTriggeredAt?: string;
  /** 最后触发状态 */
  lastStatus?: 'success' | 'failed';
}

export interface WebhookConfigProps {
  /** 已配置的 Webhook 列表 */
  webhooks: Webhook[];
  /** Webhook 列表变更回调 */
  onChange: (webhooks: Webhook[]) => void;
  /** 可选的事件类型 */
  availableEvents?: string[];
}

/**
 * Webhook 配置组件
 * 提供 Webhook 的添加、编辑、删除和测试能力
 */
export const WebhookConfig: React.FC<WebhookConfigProps> = ({
  webhooks,
  onChange,
  availableEvents = [
    'data.created',
    'data.updated',
    'data.deleted',
    'workflow.completed',
    'workflow.failed',
    'user.login',
    'approval.completed',
  ],
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  /**
   * 添加新的 Webhook
   */
  const handleAdd = useCallback(() => {
    const newWebhook: Webhook = {
      id: `wh_${Date.now()}`,
      name: '',
      url: '',
      events: [],
      enabled: true,
    };
    onChange([...webhooks, newWebhook]);
    setEditingId(newWebhook.id);
  }, [webhooks, onChange]);

  /**
   * 更新 Webhook 配置
   */
  const handleUpdate = useCallback(
    (id: string, updates: Partial<Webhook>) => {
      onChange(webhooks.map((wh) => (wh.id === id ? { ...wh, ...updates } : wh)));
    },
    [webhooks, onChange]
  );

  /**
   * 删除 Webhook
   */
  const handleDelete = useCallback(
    (id: string) => {
      onChange(webhooks.filter((wh) => wh.id !== id));
    },
    [webhooks, onChange]
  );

  /**
   * 测试 Webhook 连通性
   */
  const handleTest = useCallback(
    async (webhook: Webhook) => {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...webhook.headers,
          },
          body: JSON.stringify({
            event: 'test',
            timestamp: new Date().toISOString(),
            data: { message: '这是来自低代码平台的 Webhook 测试请求' },
          }),
        });

        setTestResult({
          id: webhook.id,
          success: response.ok,
          message: response.ok ? '测试成功' : `HTTP ${response.status}`,
        });
      } catch (error: any) {
        setTestResult({
          id: webhook.id,
          success: false,
          message: error.message,
        });
      }
    },
    []
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Webhook 列表 */}
      {webhooks.map((webhook) => (
        <div
          key={webhook.id}
          style={{
            border: '1px solid #e8e8e8',
            borderRadius: 8,
            padding: 16,
            background: webhook.enabled ? '#fff' : '#fafafa',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{webhook.name || '未命名 Webhook'}</span>
              {webhook.lastTriggeredAt && (
                <span style={{ fontSize: 12, color: webhook.lastStatus === 'success' ? '#52c41a' : '#ff4d4f' }}>
                  最后触发: {new Date(webhook.lastTriggeredAt).toLocaleString()}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleTest(webhook)} style={btnStyle}>
                测试
              </button>
              <button onClick={() => setEditingId(editingId === webhook.id ? null : webhook.id)} style={btnStyle}>
                {editingId === webhook.id ? '收起' : '编辑'}
              </button>
              <button onClick={() => handleDelete(webhook.id)} style={{ ...btnStyle, color: '#ff4d4f' }}>
                删除
              </button>
            </div>
          </div>

          {/* 测试结果提示 */}
          {testResult?.id === webhook.id && (
            <div
              style={{
                padding: '6px 12px',
                marginBottom: 12,
                borderRadius: 4,
                background: testResult.success ? '#f6ffed' : '#fff2f0',
                border: `1px solid ${testResult.success ? '#b7eb8f' : '#ffccc7'}`,
                color: testResult.success ? '#52c41a' : '#ff4d4f',
                fontSize: 13,
              }}
            >
              {testResult.message}
            </div>
          )}

          {/* 编辑面板 */}
          {editingId === webhook.id && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>名称</label>
                <input
                  value={webhook.name}
                  onChange={(e) => handleUpdate(webhook.id, { name: e.target.value })}
                  placeholder="输入 Webhook 名称"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>回调 URL</label>
                <input
                  value={webhook.url}
                  onChange={(e) => handleUpdate(webhook.id, { url: e.target.value })}
                  placeholder="https://example.com/webhook"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>触发事件</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availableEvents.map((event) => (
                    <label key={event} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={webhook.events.includes(event)}
                        onChange={(e) => {
                          const events = e.target.checked
                            ? [...webhook.events, event]
                            : webhook.events.filter((ev) => ev !== event);
                          handleUpdate(webhook.id, { events });
                        }}
                      />
                      {event}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>密钥（可选）</label>
                <input
                  value={webhook.secret || ''}
                  onChange={(e) => handleUpdate(webhook.id, { secret: e.target.value })}
                  placeholder="用于签名验证的密钥"
                  style={inputStyle}
                  type="password"
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={webhook.enabled}
                  onChange={(e) => handleUpdate(webhook.id, { enabled: e.target.checked })}
                />
                启用
              </label>
            </div>
          )}
        </div>
      ))}

      {/* 添加按钮 */}
      <button
        onClick={handleAdd}
        style={{
          ...btnStyle,
          padding: '12px',
          border: '1px dashed #d9d9d9',
          borderRadius: 8,
          width: '100%',
          textAlign: 'center',
        }}
      >
        + 添加 Webhook
      </button>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  cursor: 'pointer',
  color: '#666',
  fontSize: 13,
  padding: '4px 12px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: '#666',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

export default WebhookConfig;
