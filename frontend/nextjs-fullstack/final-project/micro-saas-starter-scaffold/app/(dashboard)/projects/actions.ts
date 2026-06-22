'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser, getUserTeamRole } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { parseFormData } from '@/lib/utils';
import { projectSchema } from '@/lib/validations';

export async function createProjectAction(_prevState: unknown, formData: FormData) {
  const user = await requireUser();
  const member = user.members[0];
  if (!member) return { errors: { _form: '请先加入或创建团队' } };

  requirePermission(member.role as 'owner' | 'admin' | 'member', 'project:create');

  const parsed = parseFormData(projectSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };

  await db.project.create({
    data: {
      name: parsed.data.name,
      status: parsed.data.status,
      teamId: member.teamId,
    },
  });

  await db.auditLog.create({
    data: {
      action: 'project:create',
      targetType: 'project',
      actorId: user.id,
    },
  });

  revalidatePath('/projects');
  return { success: true };
}

export async function deleteProjectAction(projectId: string) {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  const role = await getUserTeamRole(user.id, project.teamId);
  if (!role) throw new Error('Not a team member');
  requirePermission(role, 'project:delete');

  await db.project.delete({ where: { id: projectId } });

  await db.auditLog.create({
    data: {
      action: 'project:delete',
      targetType: 'project',
      targetId: projectId,
      actorId: user.id,
    },
  });

  revalidatePath('/projects');
}

export async function updateProjectStatusAction(projectId: string, status: string) {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  const role = await getUserTeamRole(user.id, project.teamId);
  if (!role) throw new Error('Not a team member');
  requirePermission(role, 'project:update');

  await db.project.update({
    where: { id: projectId },
    data: { status },
  });

  revalidatePath('/projects');
}
