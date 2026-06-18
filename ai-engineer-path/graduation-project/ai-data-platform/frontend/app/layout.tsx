import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI 数据分析平台',
  description: '多 Agent 驱动的智能数据分析平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
