import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://battleships:battleships@localhost:5432/battleships';

const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });
