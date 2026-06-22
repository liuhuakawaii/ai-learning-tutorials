import { db } from './db';
import { getSession } from './session';
import { redirect } from 'next/navigation';

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      members: {
        include: { team: true },
      },
    },
  });

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function getUserTeamRole(userId: string, teamId: string) {
  const member = await db.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  return member?.role ?? null;
}
