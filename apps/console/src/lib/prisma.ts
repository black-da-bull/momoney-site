import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.PRISMA_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.storage_DATABASE_URL ||
    process.env.storage_PRISMA_DATABASE_URL ||
    process.env.storage_POSTGRES_URL
  );
}

const resolvedDatabaseUrl = resolveDatabaseUrl();
if (resolvedDatabaseUrl && !process.env.DATABASE_URL) {
  // Prisma's generated client reads DATABASE_URL. Vercel Marketplace integrations
  // may prefix injected variables with the integration resource name.
  process.env.DATABASE_URL = resolvedDatabaseUrl;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  maestroSchemaReady?: Promise<void>;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function hasDatabase(): boolean {
  return Boolean(resolveDatabaseUrl());
}

export async function ensureMaestroSchema(): Promise<void> {
  if (!hasDatabase()) throw new Error("No Prisma/Postgres connection variable is configured");
  if (!globalForPrisma.maestroSchemaReady) {
    globalForPrisma.maestroSchemaReady = (async () => {
      // Preview bootstrap only. Staging/production should run `npm run db:migrate`
      // as an explicit deployment step before traffic promotion.
      if (process.env.VERCEL_ENV !== "preview") return;
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "maestro_projects" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "payload" JSONB NOT NULL,
          CONSTRAINT "maestro_projects_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "maestro_projects_updatedAt_idx"
        ON "maestro_projects"("updatedAt")
      `);
    })();
  }
  return globalForPrisma.maestroSchemaReady;
}
