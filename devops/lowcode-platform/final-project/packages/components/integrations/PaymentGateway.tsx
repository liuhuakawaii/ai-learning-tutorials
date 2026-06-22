/**
 * 支付网关集成组件
 * 集成微信支付、支付宝等国内主流支付方式
 */

import React, { useState, useCallback } from 'react';

export interface PaymentMethod {
  /** 支付方式标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标 */
  icon: string;
  /** 是否可用 */
  enabled: boolean;
}

export interface PaymentOrder {
  /** 订单号 */
  orderId: string;
  /** 金额（分） */
  amount: number;
  /** 货币类型 */
  currency?: string;
  /** 商品描述 */
  description: string;
  /** 支付方式 */
  method: string;
}

export interface PaymentGatewayProps {
  /** 可用的支付方式 */
  methods?: PaymentMethod[];
  /** 支付金额（分） */
  amount: number;
  /** 商品描述 */
  description: string;
  /** 支付发起回调 */
  onPay: (order: PaymentOrder) => Promise<{ payUrl?: string; qrCode?: string }>;
  /** 支付成功回调 */
  onSuccess: (orderId: string) => void;
  /** 支付失败回调 */
  onError: (error: string) => void;
}

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: 'wechat', name: '微信支付', icon: '💚', enabled: true },
  { id: 'alipay', name: '支付宝', icon: '💙', enabled: true },
];

/**
 * 支付网关组件
 * 提供统一的支付发起和状态查询界面
 */
export const PaymentGateway: React.FC<PaymentGatewayProps> = ({
  methods = DEFAULT_METHODS,
  amount,
  description,
  onPay,
  onSuccess,
  onError,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<string>(methods[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'paying' | 'success' | 'failed'>('idle');

  /** 将分转换为元的显示格式 */
  const formatAmount = (fen: number) => (fen / 100).toFixed(2);

  /**
   * 发起支付
   */
  const handlePay = useCallback(async () => {
    if (!selectedMethod) {
      onError('请选择支付方式');
      return;
    }

    setLoading(true);
    setStatus('paying');

    try {
      const order: PaymentOrder = {
        orderId: `ORD_${Date.now()}`,
        amount,
        currency: 'CNY',
        description,
        method: selectedMethod,
      };

      const result = await onPay(order);

      if (result.qrCode) {
        setQrCode(result.qrCode);
      } else if (result.payUrl) {
        setPayUrl(result.payUrl);
        // 尝试打开支付页面
        window.open(result.payUrl, '_blank');
      }

      // 开始轮询支付状态（实际应由后端 WebSocket 推送）
      startPolling(order.orderId);
    } catch (error: any) {
      setStatus('failed');
      onError(error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMethod, amount, description, onPay, onError]);

  /**
   * 轮询支付结果
   * 实际生产环境应使用 WebSocket 推送
   */
  const startPolling = (orderId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 最多轮询 60 次

    const timer = setInterval(() => {
      attempts++;
      // 演示模式：模拟支付成功
      if (attempts >= 3) {
        clearInterval(timer);
        setStatus('success');
        onSuccess(orderId);
      }
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        setStatus('failed');
        onError('支付超时，请重新发起');
      }
    }, 2000);
  };

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h3 style={{ color: '#52c41a' }}>支付成功</h3>
        <p style={{ color: '#999' }}>金额: ¥{formatAmount(amount)}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      {/* 金额展示 */}
      <div
        style={{
          textAlign: 'center',
          padding: '24px 0',
          borderBottom: '1px solid #e8e8e8',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 14, color: '#999', marginBottom: 8 }}>{description}</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#333' }}>
          ¥{formatAmount(amount)}
        </div>
      </div>

      {/* 支付方式选择 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>选择支付方式</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {methods
            .filter((m) => m.enabled)
            .map((method) => (
              <div
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  border: `2px solid ${selectedMethod === method.id ? '#1890ff' : '#e8e8e8'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  background: selectedMethod === method.id ? '#e6f7ff' : '#fff',
                }}
              >
                <span style={{ fontSize: 24 }}>{method.icon}</span>
                <span style={{ fontWeight: 500 }}>{method.name}</span>
                {selectedMethod === method.id && (
                  <span style={{ marginLeft: 'auto', color: '#1890ff' }}>✓</span>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* 二维码展示 */}
      {qrCode && (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={qrCode} alt="扫码支付" style={{ width: 200, height: 200 }} />
          <p style={{ color: '#999', fontSize: 13 }}>请使用{methods.find((m) => m.id === selectedMethod)?.name}扫码</p>
        </div>
      )}

      {/* 支付按钮 */}
      <button
        onClick={handlePay}
        disabled={loading || !selectedMethod}
        style={{
          width: '100%',
          padding: '14px',
          background: loading ? '#d9d9d9' : '#1890ff',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '发起支付中...' : `确认支付 ¥${formatAmount(amount)}`}
      </button>

      {/* 支付状态提示 */}
      {status === 'paying' && !qrCode && (
        <p style={{ textAlign: 'center', color: '#faad14', marginTop: 12, fontSize: 13 }}>
          正在等待支付结果，请勿关闭页面...
        </p>
      )}
      {status === 'failed' && (
        <p style={{ textAlign: 'center', color: '#ff4d4f', marginTop: 12, fontSize: 13 }}>
          支付失败，请重试
        </p>
      )}
    </div>
  );
};

export default PaymentGateway;
