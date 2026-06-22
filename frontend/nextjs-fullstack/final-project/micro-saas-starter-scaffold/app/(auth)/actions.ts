'use server';

import { compareSync, hashSync } from 'bcryptjs';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { parseFormData } from '@/lib/utils';
import { loginSchema, registerSchema } from '@/lib/validations';

export async function loginAction(_prevState: unknown, formData: FormData) {
  const parsed = parseFormData(loginSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };

  const { email, password } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !compareSync(password, user.hashedPassword)) {
    return { errors: { _form: '邮箱或密码错误' } };
  }

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  redirect('/projects');
}

export async function registerAction(_prevState: unknown, formData: FormData) {
  const parsed = parseFormData(registerSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };

  const { name, email, password } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { errors: { email: '该邮箱已注册' } };

  const user = await db.user.create({
    data: {
      name,
      email,
      hashedPassword: hashSync(password, 10),
    },
  });

  const freePlan = await db.plan.findUnique({ where: { name: 'free' } });
  if (freePlan) {
    const team = await db.team.create({
      data: {
        name: `${name} 的团队`,
        members: { create: { userId: user.id, role: 'owner' } },
        subscriptions: { create: { planId: freePlan.id } },
      },
    });

    const session = await getSession();
    session.userId = user.id;
    session.teamId = team.id;
    await session.save();
  }

  redirect('/projects');
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect('/login');
}
