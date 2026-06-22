import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { deleteProjectAction, updateProjectStatusAction } from './actions';
import { CreateProjectForm } from './create-form';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  draft: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-gray-100 text-gray-600',
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requireUser();
  const member = user.members[0];
  const params = await searchParams;
  const q = params.q || '';
  const statusFilter = params.status || '';
  const page = parseInt(params.page || '1', 10);
  const pageSize = 10;

  const where: Record<string, unknown> = {};
  if (member) where.teamId = member.teamId;
  if (q) where.name = { contains: q, mode: 'insensitive' };
  if (statusFilter) where.status = statusFilter;

  const [projects, total] = await Promise.all([
    db.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { documents: true } } },
    }),
    db.project.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const role = (member?.role || 'member') as 'owner' | 'admin' | 'member';

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">项目</h1>
        {can(role, 'project:create') && <CreateProjectForm />}
      </div>

      <form className="flex gap-2 mb-4" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="搜索项目名称..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          name="status"
          defaultValue={statusFilter}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="active">活跃</option>
          <option value="archived">已归档</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-300 transition"
        >
          筛选
        </button>
      </form>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
          暂无项目，点击右上角创建第一个项目
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <Link
                  href={`/projects/${project.id}`}
                  className="font-medium hover:text-brand-600 transition"
                >
                  {project.name}
                </Link>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[project.status] || ''}`}>
                  {project.status}
                </span>
                <span className="text-xs text-gray-400">
                  {project._count.documents} 份文档
                </span>
              </div>
              <div className="flex items-center gap-2">
                {can(role, 'project:update') && (
                  <select
                    defaultValue={project.status}
                    className="rounded border border-gray-200 px-2 py-1 text-xs"
                    onChange={async (e) => {
                      'use server';
                      await updateProjectStatusAction(project.id, e.target.value);
                    }}
                  >
                    <option value="draft">草稿</option>
                    <option value="active">活跃</option>
                    <option value="archived">归档</option>
                  </select>
                )}
                {can(role, 'project:delete') && (
                  <form action={async () => {
                    'use server';
                    await deleteProjectAction(project.id);
                  }}>
                    <button
                      type="submit"
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition"
                    >
                      删除
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/projects?page=${p}&q=${q}&status=${statusFilter}`}
              className={`rounded-lg px-3 py-1 text-sm ${p === page ? 'bg-brand-600 text-white' : 'bg-gray-200 hover:bg-gray-300'} transition`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
