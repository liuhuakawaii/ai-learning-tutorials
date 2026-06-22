import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { logoutAction } from '@/app/(auth)/actions';

const navItems = [
  { href: '/projects', label: '项目' },
  { href: '/teams', label: '团队' },
  { href: '/settings', label: '设置' },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-gray-200 bg-white p-4 flex flex-col">
        <Link href="/" className="text-lg font-bold mb-6 px-2">
          Micro SaaS
        </Link>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-200 pt-4 mt-4">
          <p className="text-sm text-gray-600 px-2 mb-2">{user.name || user.email}</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
            >
              退出登录
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
