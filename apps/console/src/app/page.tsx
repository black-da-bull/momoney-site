"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ProjectRow {
  id: string;
  title: string;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  async function create() {
    if (!title.trim() || creating) return;
    setCreating(true);
    const r = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    const p = await r.json();
    if (p.id) router.push(`/studio/${p.id}`);
    else setCreating(false);
  }

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <p className="wordmark">
        MO<span>MONEY</span>STUDIOS <span style={{ color: "var(--muted)", fontWeight: 600 }}>· MAESTRO CONSOLE</span>
      </p>

      <div className="faceplate" style={{ padding: "3rem 2.5rem", marginTop: "2rem" }}>
        <p className="label">The Runtime · In Your Browser</p>
        <h1
          style={{
            fontFamily: "var(--display)",
            fontWeight: 900,
            fontSize: "clamp(2.6rem, 8vw, 5rem)",
            lineHeight: 0.92,
            textTransform: "uppercase",
            margin: ".5rem 0",
          }}
        >
          Bring an unfinished song.
        </h1>
        <p style={{ color: "var(--muted)", maxWidth: "38rem", marginTop: "1rem" }}>
          Maestro is a music collaborator holding a whole record label in its head — and it
          never makes you feel the machinery. Start with anything: a line, a vibe, a voice
          note you typed out, a &ldquo;does this land.&rdquo;
        </p>
        <div style={{ display: "flex", gap: "0.8rem", marginTop: "2rem", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Name the project — a working title is fine"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            style={{ flex: 1, minWidth: "16rem" }}
          />
          <button className="btn solid" onClick={create} disabled={creating || !title.trim()}>
            {creating ? "Opening…" : "Open a session"}
          </button>
        </div>
      </div>

      <section style={{ marginTop: "3rem" }}>
        <p className="label">Sessions on file</p>
        <div style={{ marginTop: "1rem", display: "grid", gap: ".6rem" }}>
          {projects == null && <p style={{ color: "var(--muted)" }}>…</p>}
          {projects?.length === 0 && (
            <p style={{ color: "var(--muted)" }}>Nothing yet. The first record starts above.</p>
          )}
          {projects?.map((p) => (
            <a
              key={p.id}
              href={`/studio/${p.id}`}
              style={{
                border: "1px solid var(--seam)",
                background: "var(--panel)",
                padding: "1rem 1.25rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "1rem",
              }}
            >
              <span style={{ color: "var(--cream)", fontWeight: 600 }}>{p.title}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: ".68rem", color: "var(--muted)" }}>
                {new Date(p.createdAt).toLocaleDateString()}
              </span>
            </a>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: "4rem", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <p style={{ fontFamily: "var(--mono)", fontSize: ".65rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--muted)" }}>
          Your vision. Our mission.
        </p>
        <p style={{ fontFamily: "var(--mono)", fontSize: ".65rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--muted)" }}>
          Powered by Maestro · Rendered on Suno
        </p>
      </footer>
    </main>
  );
}
