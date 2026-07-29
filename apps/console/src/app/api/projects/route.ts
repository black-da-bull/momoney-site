import { NextRequest } from "next/server";
import { createProject, listProjects } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await listProjects());
}

export async function POST(req: NextRequest) {
  const { title } = (await req.json()) as { title?: string };
  if (!title?.trim()) return Response.json({ error: "title required" }, { status: 400 });
  const project = await createProject(title.trim());
  return Response.json({ id: project.id, title: project.title });
}
