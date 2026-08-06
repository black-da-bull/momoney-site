import { NextRequest } from "next/server";
import { createProject, listProjects } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listProjects(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("project list failed", error);
    return Response.json({ error: "Project storage is unavailable. Verify DATABASE_URL and database migration status." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title } = (await req.json()) as { title?: string };
    if (!title?.trim()) return Response.json({ error: "title required" }, { status: 400 });
    const project = await createProject(title.trim());
    return Response.json({ id: project.id, title: project.title }, { status: 201 });
  } catch (error) {
    console.error("project creation failed", error);
    return Response.json({ error: "Session could not be created. Verify the console database connection." }, { status: 503 });
  }
}
