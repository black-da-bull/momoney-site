import { NextRequest } from "next/server";
import { MAESTRO_SCHEMA_VERSION } from "@/lib/maestro/types";
import { newProjectSnapshot } from "@/lib/maestro/state";
import { createDbProject, hasMaestroDatabase, listDbProjects } from "@/lib/maestro/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slug(title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "untitled";
  return `${base}-${Date.now().toString(36)}`;
}

export async function GET() {
  if (!hasMaestroDatabase()) return Response.json({ error: "Maestro database is not configured" }, { status: 503 });
  return Response.json(await listDbProjects());
}

export async function POST(req: NextRequest) {
  if (!hasMaestroDatabase()) return Response.json({ error: "Maestro database is not configured" }, { status: 503 });
  const { title } = (await req.json()) as { title?: string };
  if (!title?.trim()) return Response.json({ error: "title required" }, { status: 400 });
  const id = slug(title.trim());
  const createdAt = new Date().toISOString();
  const snapshot = newProjectSnapshot(id, MAESTRO_SCHEMA_VERSION);
  await createDbProject({ id, title: title.trim(), schemaVersion: MAESTRO_SCHEMA_VERSION, createdAt, seedRaw: null }, snapshot);
  return Response.json({ id, title: title.trim(), createdAt, phase: "INTAKE" });
}
