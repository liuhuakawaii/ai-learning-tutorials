import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export default async function AdminAuditPage() {
  const user = await requireUser();
  const member = user.members[0];

  if (!member || member.role === 'member') {
    redirect('/projects');
  }

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { actor: true },
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">审计日志</h1>

      {logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
          暂无审计记录
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">时间</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">操作者</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">动作</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">目标</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">
                    {log.createdAt.toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    {log.actor.name || log.actor.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {log.targetType ? `${log.targetType}:${log.targetId || '-'}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
