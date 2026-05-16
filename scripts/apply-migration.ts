import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Applying missing columns to users table...");
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name text;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tier text;`);
    console.log("Migration applied successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
