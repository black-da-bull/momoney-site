-- CreateTable
CREATE TABLE "maestro_projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    CONSTRAINT "maestro_projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "maestro_projects_updatedAt_idx" ON "maestro_projects"("updatedAt");
