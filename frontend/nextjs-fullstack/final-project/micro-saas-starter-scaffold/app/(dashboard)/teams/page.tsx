import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';

const roleLabels: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
};

export default async function TeamsPage() {
  const user = await requireUser();
  const member = user.members[0];

  if (!member) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">团队</h1>
        <p className="text-gray-500">你还没有加入任何团队。</p>
      </div>
    );
  }

  const team = await db.team.findUnique({
    where: { id: member.teamId },
    include: {
      members: {
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      },
      subscriptions: {
        include: { plan: true },
        where: { status: 'active' },
        take: 1,
      },
    },
  });

  if (!team) return null;

  const role = member.role as 'owner' | 'admin' | 'member';
  const subscription = team.subscriptions[0];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{team.name}</h1>
        {subscription && (
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            {subscription.plan.name.toUpperCase()} 套餐
          </span>
        )}
      </div>

      {subscription && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-2">套餐详情</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-400">月费</p>
              <p className="font-medium">¥{(subscription.plan.priceMonthly / 100).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-400">项目上限</p>
              <p className="font-medium">{subscription.plan.projectLimit}</p>
            </div>
            <div>
              <p className="text-gray-400">文档上限</p>
              <p className="font-medium">{subscription.plan.documentLimit}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-medium">成员 ({team.members.length})</h2>
          {can(role, 'member:invite') && (
            <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition">
              邀请成员
            </button>
          )}
        </div>
        <ul className="divide-y divide-gray-100">
          {team.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{m.user.name || m.user.email}</p>
                <p className="text-xs text-gray-400">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {roleLabels[m.role] || m.role}
                </span>
                {can(role, 'member:remove') && m.role !== 'owner' && (
                  <button className="text-xs text-red-600 hover:underline">移除</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
