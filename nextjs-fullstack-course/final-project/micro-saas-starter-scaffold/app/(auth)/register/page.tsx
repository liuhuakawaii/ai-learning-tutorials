'use client';

import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">注册</h1>
        <form className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">名称</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="你的名称"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">邮箱</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="至少 6 位"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 py-2 text-white font-medium hover:bg-brand-700 transition"
          >
            注册
          </button>
        </form>
        <p className="text-center text-sm text-gray-500">
          已有账号？{' '}
          <Link href="/login" className="text-brand-600 hover:underline">
            登录
          </Link>
        </p>
      </div>
    </main>
  );
}
