import { NextRequest } from "next/server";
import { getProject } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) return Response.json({ error: "unknown project" }, { status: 404 });
  return Response.json(project);
}
