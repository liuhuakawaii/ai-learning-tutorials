/**
 * OAuth 登录组件
 * 集成第三方 OAuth 登录能力（微信、GitHub、Google 等）
 */

import React, { useState, useCallback } from 'react';

export interface OAuthProvider {
  /** 提供商名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 图标 */
  icon: string;
  /** 授权端点 */
  authUrl: string;
  /** 客户端 ID */
  clientId: string;
  /** 重定向 URI */
  redirectUri: string;
  /** 申请的权限范围 */
  scope?: string;
}

export interface OAuthLoginProps {
  /** 可用的 OAuth 提供商列表 */
  providers: OAuthProvider[];
  /** 登录成功回调 */
  onSuccess: (provider: string, token: string) => void;
  /** 登录失败回调 */
  onError: (error: string) => void;
  /** 布局方向 */
  direction?: 'horizontal' | 'vertical';
  /** 按钮样式 */
  variant?: 'default' | 'outlined' | 'text';
}

/**
 * OAuth 登录组件
 * 支持多个 OAuth 提供商的统一登录入口
 */
export const OAuthLogin: React.FC<OAuthLoginProps> = ({
  providers,
  onSuccess,
  onError,
  direction = 'vertical',
  variant = 'default',
}) => {
  const [loading, setLoading] = useState<string | null>(null);

  /**
   * 发起 OAuth 授权
   * 跳转到第三方授权页面
   */
  const handleLogin = useCallback(
    (provider: OAuthProvider) => {
      setLoading(provider.name);

      try {
        // 构建授权 URL
        const params = new URLSearchParams({
          client_id: provider.clientId,
          redirect_uri: provider.redirectUri,
          response_type: 'code',
          scope: provider.scope || 'openid',
          state: `${provider.name}_${Date.now()}`, // 防 CSRF
        });

        const authUrl = `${provider.authUrl}?${params.toString()}`;

        // 打开授权窗口
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          authUrl,
          `oauth_${provider.name}`,
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // 监听授权回调
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'oauth_callback') {
            window.removeEventListener('message', handleMessage);
            popup?.close();

            if (event.data.error) {
              onError(event.data.error);
            } else {
              onSuccess(provider.name, event.data.token);
            }
            setLoading(null);
          }
        };

        window.addEventListener('message', handleMessage);

        // 超时清理
        setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          setLoading(null);
        }, 300000); // 5 分钟超时
      } catch (error: any) {
        onError(error.message);
        setLoading(null);
      }
    },
    [onSuccess, onError]
  );

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 20px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    transition: 'all 0.2s',
    border: variant === 'outlined' ? '1px solid #d9d9d9' : 'none',
    background: variant === 'text' ? 'transparent' : '#fff',
    color: '#333',
    width: direction === 'vertical' ? '100%' : 'auto',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction === 'vertical' ? 'column' : 'row',
        gap: 12,
        width: '100%',
      }}
    >
      {providers.map((provider) => (
        <button
          key={provider.name}
          onClick={() => handleLogin(provider)}
          disabled={loading !== null}
          style={{
            ...buttonStyle,
            opacity: loading && loading !== provider.name ? 0.5 : 1,
          }}
        >
          <span style={{ fontSize: 20 }}>{provider.icon}</span>
          <span>
            {loading === provider.name
              ? '跳转中...'
              : `使用 ${provider.displayName} 登录`}
          </span>
        </button>
      ))}
    </div>
  );
};

export default OAuthLogin;
