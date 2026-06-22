import { requireUser } from '@/lib/auth';

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      <section className="rounded-lg border border-gray-200 bg-white p-6 mb-6">
        <h2 className="font-medium mb-4">个人信息</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">邮箱</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">名称</span>
            <span className="font-medium">{user.name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">注册时间</span>
            <span className="font-medium">{user.createdAt.toLocaleDateString('zh-CN')}</span>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="font-medium mb-4">修改密码</h2>
        <form className="space-y-3">
          <div>
            <label htmlFor="current-password" className="block text-sm text-gray-500 mb-1">当前密码</label>
            <input
              id="current-password"
              type="password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm text-gray-500 mb-1">新密码</label>
            <input
              id="new-password"
              type="password"
              minLength={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition"
          >
            更新密码
          </button>
        </form>
      </section>
    </div>
  );
}
