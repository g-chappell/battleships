/**
 * Reset all user gold to 0.
 * Run via: npx tsx server/scripts/reset-gold.ts
 * Or in Docker: docker compose exec server npx tsx scripts/reset-gold.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    data: { gold: 0 },
  });
  console.log(`Reset gold to 0 for ${result.count} user(s).`);
}

main()
  .catch((e) => {
    console.error('Failed to reset gold:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
