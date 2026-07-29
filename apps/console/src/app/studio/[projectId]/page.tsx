"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface Msg {
  role: "artist" | "maestro";
  text: string;
}
interface Slot {
  address: string;
  axis: string;
  key: string;
  value: string | null;
  status: string;
  provenance: string;
}
interface ProjectState {
  id: string;
  title: string;
  messages: { role: "artist" | "maestro"; text: string }[];
  grid: Slot[];
  changeLog: unknown[];
}

const AXIS_NAMES: Record<string, string> = {
  THY: "Theory",
  VOC: "Voices",
  STY: "Style",
  TIM: "Timbre",
  PER: "Performance",
  POST: "Post-Production",
  MAP: "Roadmap",
  LYR: "Lyrics",
};

export default function Studio() {
  const { projectId } = useParams<{ projectId: string }>();
  const [title, setTitle] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [grid, setGrid] = useState<Slot[]>([]);
  const [changes, setChanges] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadState = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}`);
    if (!r.ok) return;
    const p = (await r.json()) as ProjectState;
    setTitle(p.title);
    setMsgs(p.messages.filter((m) => m.text.trim().length > 0).map((m) => ({ role: m.role, text: m.text })));
    setGrid(p.grid.filter((s) => s.axis !== "VIS")); // dormant seam stays invisible
    setChanges(p.changeLog.length);
  }, [projectId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    setMsgs((m) => [...m, { role: "artist", text }, { role: "maestro", text: "" }]);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message: text }),
      });
      if (!r.ok || !r.body) {
        const err = await r.json().catch(() => ({ error: "the console hit a fault" }));
        setMsgs((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "maestro", text: `[console: ${err.error}]` };
          return copy;
        });
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMsgs((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, text: last.text + chunk };
          return copy;
        });
      }
    } finally {
      setBusy(false);
      // never leave a silent empty bubble — say what happened
      setMsgs((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === "maestro" && !last.text.trim()) {
          copy[copy.length - 1] = {
            role: "maestro",
            text: "[console: that one didn't come back — say it again and I'll pick it right up.]",
          };
        }
        return copy;
      });
      // refresh the quiet memory after the exchange settles
      setTimeout(loadState, 1200);
    }
  }

  const filled = grid.filter((s) => s.value != null).length;

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100svh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: ".8rem 1.5rem",
          borderBottom: "1px solid var(--seam)",
          background: "var(--panel)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", minWidth: 0 }}>
          <a href="/" className="wordmark" style={{ fontSize: "1rem", whiteSpace: "nowrap" }}>
            MO<span>MONEY</span>STUDIOS
          </a>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: ".7rem",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title || "…"}
          </span>
        </div>
        <button className="btn" onClick={() => setRoomOpen((v) => !v)} style={{ padding: ".5rem .9rem", fontSize: ".65rem" }}>
          {roomOpen ? "Close the room" : `See the room${filled ? ` · ${filled}` : ""}`}
        </button>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <section style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div ref={scrollRef} className="chat-scroll" style={{ flex: 1, overflowY: "auto", padding: "2rem 1.5rem" }}>
            {msgs.length === 0 && (
              <div className="faceplate" style={{ padding: "2rem", maxWidth: "40rem", margin: "2rem auto" }}>
                <p className="label">Session open</p>
                <p style={{ marginTop: ".8rem", color: "var(--muted)" }}>
                  Bring what you have — a line, a hook idea, a feeling the song needs to
                  express, lyrics as they come. Rough is the normal input state, not an
                  error.
                </p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.role}`} style={{ margin: m.role === "artist" ? "0 0 0 auto" : "0" }}>
                <p className="who">{m.role === "artist" ? "You" : "Maestro"}</p>
                {!m.text && busy && i === msgs.length - 1 ? (
                  <p className="body" aria-live="polite">
                    <span className="vu" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="vu-note">In the booth…</span>
                  </p>
                ) : (
                  <p className="body" style={{ color: m.role === "artist" ? "var(--muted)" : "var(--cream)" }}>
                    {m.text}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--seam)", padding: "1rem 1.5rem", background: "var(--panel)" }}>
            <div style={{ display: "flex", gap: ".8rem", alignItems: "flex-end", maxWidth: "56rem", margin: "0 auto" }}>
              <textarea
                rows={2}
                placeholder='Talk to Maestro — or ask for the build when you&apos;re ready ("make me the prompt")'
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button className="btn solid" onClick={send} disabled={busy || !input.trim()}>
                {busy ? (
                  <span className="vu" aria-label="processing">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  "Send"
                )}
              </button>
            </div>
          </div>
        </section>

        {roomOpen && (
          <aside
            className="chat-scroll"
            style={{
              width: "22rem",
              flexShrink: 0,
              borderLeft: "1px solid var(--seam)",
              background: "var(--panel)",
              overflowY: "auto",
              padding: "1.25rem",
            }}
          >
            <p className="label">The song&apos;s memory</p>
            <p style={{ fontFamily: "var(--mono)", fontSize: ".62rem", color: "var(--muted)", marginTop: ".5rem" }}>
              {filled} of {grid.length} addresses hold something · {changes} changes logged ·
              nothing locks without your say-so
            </p>
            {Object.keys(AXIS_NAMES).map((code) => {
              const slots = grid.filter((s) => s.axis === code);
              if (!slots.length) return null;
              return (
                <div key={code}>
                  <p className="axis-h">
                    {code} · {AXIS_NAMES[code]}
                  </p>
                  <div style={{ display: "grid", gap: ".35rem" }}>
                    {slots.map((s) => (
                      <div
                        key={s.address}
                        className={`grid-cell ${s.value == null ? "null" : s.status === "PROPOSED" ? "proposed" : ""}`}
                        title={s.provenance || undefined}
                      >
                        <span className="addr">{s.address}</span>
                        <span className="val">{s.value ?? "null — reserved, not missing"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </aside>
        )}
      </div>
    </main>
  );
}
