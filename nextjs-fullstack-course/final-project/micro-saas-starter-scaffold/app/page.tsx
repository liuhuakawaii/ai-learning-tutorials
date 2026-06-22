import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Micro SaaS Starter</h1>
      <p className="text-lg text-gray-600 max-w-md text-center">
        AI 内容工具站 — 创建项目、上传资料、生成内容、管理团队
      </p>
      <div className="flex gap-4">
        {user ? (
          <Link
            href="/projects"
            className="rounded-lg bg-brand-600 px-6 py-3 text-white font-medium hover:bg-brand-700 transition"
          >
            进入工作台
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg bg-brand-600 px-6 py-3 text-white font-medium hover:bg-brand-700 transition"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-100 transition"
            >
              注册
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
