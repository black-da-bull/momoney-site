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
interface ReviewNote {
  who: string;
  note: string;
  severity: string;
}
interface Triad {
  creativeUst: string;
  showSummary: string;
  personaProfile: string;
  personaStyleLine: string;
}
interface RunView {
  id: string;
  triad: Triad | null;
  reviewNotes: ReviewNote[];
  defended: { address: string; why: string }[];
  accepted: boolean;
  hash: string | null;
}
interface ProjectState {
  id: string;
  title: string;
  messages: { role: "artist" | "maestro"; text: string }[];
  grid: Slot[];
  changeLog: unknown[];
  runs?: RunView[];
}
interface StageRow {
  name: string;
  status: string;
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

const BUDGETS: Record<keyof Triad, number> = {
  creativeUst: 4995,
  showSummary: 1000,
  personaProfile: 2000,
  personaStyleLine: 150,
};

function stageLabel(name: string): string {
  if (name.startsWith("fill:")) return `Fill · ${AXIS_NAMES[name.slice(5)] ?? name.slice(5)}`;
  const map: Record<string, string> = {
    "draft-freeze": "Draft freeze",
    "round-robin": "Round-robin",
    resolve: "Resolve",
    foil: "FOIL",
    surfaces: "Triad drafting",
    budgets: "Budget check",
    package: "Package",
  };
  return map[name] ?? name;
}

function VU() {
  return (
    <span className="vu" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export default function Studio() {
  const { projectId } = useParams<{ projectId: string }>();
  const [title, setTitle] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [grid, setGrid] = useState<Slot[]>([]);
  const [changes, setChanges] = useState(0);
  // factory
  const [building, setBuilding] = useState(false);
  const [stages, setStages] = useState<StageRow[]>([]);
  const [run, setRun] = useState<RunView | null>(null);
  const [buildError, setBuildError] = useState("");
  const [locking, setLocking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadState = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}`);
    if (!r.ok) return;
    const p = (await r.json()) as ProjectState;
    setTitle(p.title);
    setMsgs(p.messages.filter((m) => m.text.trim().length > 0).map((m) => ({ role: m.role, text: m.text })));
    setGrid(p.grid.filter((s) => s.axis !== "VIS")); // dormant seam stays invisible
    setChanges(p.changeLog.length);
    const lastPackaged = (p.runs ?? []).filter((x) => x.triad).pop();
    if (lastPackaged) setRun(lastPackaged);
  }, [projectId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs, building]);

  const startBuild = useCallback(async () => {
    if (building) return;
    setBuilding(true);
    setBuildError("");
    setStages([]);
    try {
      const r = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!r.ok || !r.body) {
        const err = await r.json().catch(() => ({ error: "the factory hit a fault" }));
        setBuildError(String(err.error ?? "the factory hit a fault"));
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let e: Record<string, unknown>;
          try {
            e = JSON.parse(line);
          } catch {
            continue;
          }
          if (e.type === "stage") {
            setStages((s) => {
              const copy = [...s];
              const i = copy.findIndex((x) => x.name === e.name);
              if (i >= 0) copy[i] = { name: String(e.name), status: String(e.status) };
              else copy.push({ name: String(e.name), status: String(e.status) });
              return copy;
            });
          } else if (e.type === "done") {
            setRun({
              id: String(e.runId),
              triad: e.triad as Triad,
              reviewNotes: [],
              defended: (e.defended as { address: string; why: string }[]) ?? [],
              accepted: false,
              hash: (e.hash as string) ?? null,
            });
          } else if (e.type === "error") {
            setBuildError(String(e.message));
          }
        }
      }
    } finally {
      setBuilding(false);
      loadState();
    }
  }, [building, projectId, loadState]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    setMsgs((m) => [...m, { role: "artist", text }, { role: "maestro", text: "" }]);
    let buildSignal = false;

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message: text }),
      });
      buildSignal = r.headers.get("X-Build-Signal") === "1";
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
      setTimeout(loadState, 1200);
      if (buildSignal) startBuild();
    }
  }

  async function acceptAndLock() {
    if (!run || locking) return;
    setLocking(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id }),
      });
      if (r.ok) {
        setRun({ ...run, accepted: true });
        loadState();
      }
    } finally {
      setLocking(false);
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
                    <VU />
                    <span className="vu-note">In the booth…</span>
                  </p>
                ) : (
                  <p className="body" style={{ color: m.role === "artist" ? "var(--muted)" : "var(--cream)" }}>
                    {m.text}
                  </p>
                )}
              </div>
            ))}

            {(building || stages.length > 0 || run?.triad || buildError) && (
              <div className="faceplate" style={{ padding: "1.5rem", margin: "2rem auto 0", maxWidth: "56rem" }}>
                <p className="label">
                  The factory {building ? "· rolling" : run?.accepted ? "· accepted & locked" : run?.triad ? "· proposal on the desk" : ""}
                </p>

                {stages.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", marginTop: "1rem" }}>
                    {stages.map((s) => (
                      <span
                        key={s.name}
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: ".6rem",
                          letterSpacing: ".12em",
                          textTransform: "uppercase",
                          padding: ".35rem .55rem",
                          border: `1px solid ${s.status === "failed" ? "#a33" : "var(--seam)"}`,
                          color:
                            s.status === "done"
                              ? "var(--brass)"
                              : s.status === "failed"
                              ? "#e08585"
                              : "var(--amber)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: ".45rem",
                        }}
                      >
                        {s.status === "running" && <VU />}
                        {stageLabel(s.name)}
                        {s.status === "done" ? " ✓" : ""}
                      </span>
                    ))}
                  </div>
                )}

                {buildError && (
                  <p style={{ marginTop: "1rem", color: "#e08585", fontFamily: "var(--mono)", fontSize: ".75rem" }}>
                    [factory: {buildError} — ask for the build again and it picks up from the song&apos;s memory.]
                  </p>
                )}

                {run && run.defended.length > 0 && (
                  <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--seam)", paddingTop: "1rem" }}>
                    <p className="label">Your call — left open on purpose</p>
                    {run.defended.map((d, i) => (
                      <p key={i} style={{ fontFamily: "var(--mono)", fontSize: ".7rem", color: "var(--amber)", marginTop: ".4rem" }}>
                        {d.address} — <span style={{ color: "var(--muted)" }}>{d.why}</span>
                      </p>
                    ))}
                  </div>
                )}

                {run && run.reviewNotes.length > 0 && (
                  <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--seam)", paddingTop: "1rem" }}>
                    <p className="label">Review notes — kept visible, not smoothed</p>
                    {run.reviewNotes.map((n, i) => (
                      <p key={i} style={{ fontSize: ".8rem", color: "var(--muted)", marginTop: ".4rem" }}>
                        <span style={{ color: "var(--brass)", fontFamily: "var(--mono)", fontSize: ".68rem" }}>
                          {n.who} · {n.severity}
                        </span>{" "}
                        {n.note}
                      </p>
                    ))}
                  </div>
                )}

                {run?.triad && (
                  <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--seam)", paddingTop: "1.25rem" }}>
                    {(
                      [
                        ["creativeUst", "Creative UST → Suno lyrics"],
                        ["showSummary", "Show Summary → Suno style"],
                        ["personaProfile", "A/R Profile → Suno persona"],
                        ["personaStyleLine", "Persona style line"],
                      ] as [keyof Triad, string][]
                    ).map(([k, label]) => {
                      const text = run.triad![k];
                      const over = text.length > BUDGETS[k];
                      return (
                        <details key={k} open={k === "creativeUst"} style={{ marginBottom: "1rem" }}>
                          <summary
                            style={{
                              cursor: "pointer",
                              fontFamily: "var(--mono)",
                              fontSize: ".7rem",
                              letterSpacing: ".16em",
                              textTransform: "uppercase",
                              color: "var(--brass)",
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "1rem",
                            }}
                          >
                            <span>{label}</span>
                            <span style={{ color: over ? "#e08585" : "var(--muted)" }}>
                              {text.length} / {BUDGETS[k]}
                              <button
                                className="btn"
                                style={{ marginLeft: ".8rem", padding: ".2rem .6rem", fontSize: ".58rem" }}
                                onClick={(ev) => {
                                  ev.preventDefault();
                                  navigator.clipboard?.writeText(text);
                                }}
                              >
                                Copy
                              </button>
                            </span>
                          </summary>
                          <pre
                            style={{
                              whiteSpace: "pre-wrap",
                              fontFamily: "var(--mono)",
                              fontSize: ".74rem",
                              lineHeight: 1.55,
                              color: "var(--cream)",
                              background: "var(--panel-2)",
                              border: "1px solid var(--seam)",
                              padding: "1rem",
                              marginTop: ".6rem",
                              maxHeight: "22rem",
                              overflowY: "auto",
                            }}
                          >
                            {text}
                          </pre>
                        </details>
                      );
                    })}
                    <div style={{ display: "flex", gap: ".8rem", alignItems: "center", flexWrap: "wrap" }}>
                      {!run.accepted ? (
                        <>
                          <button className="btn solid" onClick={acceptAndLock} disabled={locking}>
                            {locking ? <VU /> : "Accept & lock"}
                          </button>
                          <span style={{ fontFamily: "var(--mono)", fontSize: ".62rem", color: "var(--muted)", letterSpacing: ".12em" }}>
                            PROPOSAL · nothing locks without your say-so
                          </span>
                        </>
                      ) : (
                        <span style={{ fontFamily: "var(--mono)", fontSize: ".65rem", color: "var(--brass)", letterSpacing: ".14em" }}>
                          LOCKED · {run.hash ?? ""} — say the word to open it back up
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
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
                        className={`grid-cell ${
                          s.value == null ? "null" : s.status === "LOCKED" ? "locked" : s.status === "PROPOSED" ? "proposed" : ""
                        }`}
                        title={s.provenance || undefined}
                      >
                        <span className="addr">
                          {s.address}
                          {s.status === "LOCKED" ? " · locked" : ""}
                        </span>
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
