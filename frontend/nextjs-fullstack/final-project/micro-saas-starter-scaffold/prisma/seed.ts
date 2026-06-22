import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { name: 'free' },
      update: {},
      create: { name: 'free', priceMonthly: 0, projectLimit: 3, documentLimit: 50 },
    }),
    prisma.plan.upsert({
      where: { name: 'pro' },
      update: {},
      create: { name: 'pro', priceMonthly: 9900, projectLimit: 20, documentLimit: 500 },
    }),
    prisma.plan.upsert({
      where: { name: 'team' },
      update: {},
      create: { name: 'team', priceMonthly: 29900, projectLimit: 100, documentLimit: 5000 },
    }),
  ]);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice',
      hashedPassword: hashSync('password123', 10),
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob',
      hashedPassword: hashSync('password123', 10),
    },
  });

  const team = await prisma.team.upsert({
    where: { id: 'seed-team' },
    update: {},
    create: {
      id: 'seed-team',
      name: 'Demo Team',
      members: {
        create: [
          { userId: alice.id, role: 'owner' },
          { userId: bob.id, role: 'member' },
        ],
      },
      subscriptions: {
        create: { planId: plans[1].id, status: 'active' },
      },
    },
  });

  await prisma.project.createMany({
    data: [
      { name: 'Launch Plan', status: 'active', teamId: team.id },
      { name: 'AI Writing Kit', status: 'draft', teamId: team.id },
      { name: 'Marketing Copy', status: 'archived', teamId: team.id },
    ],
    skipDuplicates: true,
  });

  console.log('Seed completed:', { plans: plans.length, users: 2, team: team.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
