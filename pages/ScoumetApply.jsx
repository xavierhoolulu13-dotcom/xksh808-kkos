import { useState, useEffect } from "react";
import { FocusGroupOpportunity } from "@/api/entities";

const STATUS_META = {
  pending:   { color: "#ffaa00", label: "PENDING",   icon: "◎" },
  approved:  { color: "#00ff99", label: "APPROVED",  icon: "✓" },
  denied:    { color: "#ff4455", label: "DENIED",    icon: "✕" },
  applied:   { color: "#00e5ff", label: "APPLIED",   icon: "⟶" },
  completed: { color: "#cc88ff", label: "DONE",      icon: "★" },
};

const bg0 = "#06060e", bg1 = "#0b0b18", bd0 = "#ffffff08";
const accent = "#00e5ff";

const callBackend = async (action, payload = {}) => {
  const res = await fetch("/functions/scoumetApply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
};

export default function ScoumetApply() {
  const [opps, setOpps]         = useState([]);
  const [filter, setFilter]     = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [scanning, setScanning] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const [liveSession, setLiveSession] = useState(null); // { live_url, task_id, opp }
  const [log, setLog] = useState([
    { t: "system",  m: "[BOOT] SCØUMET Apply Engine — ONLINE" },
    { t: "success", m: "[READY] Browser Use agent layer loaded" },
    { t: "success", m: "[READY] Human-in-the-loop mode active" },
  ]);

  const addLog = (m, t = "info") => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLog(p => [...p.slice(-80), { t, m: `[${ts}] ${m}` }]);
  };

  const load = async () => {
    setLoading(true);
    const data = await FocusGroupOpportunity.list();
    setOpps(data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (id, status) => {
    await FocusGroupOpportunity.update(id, { status });
    addLog(`DECISION → ${status.toUpperCase()} · ID:${id.slice(-6)}`, status === "approved" ? "success" : "error");
    setOpps(p => p.map(o => o.id === id ? { ...o, status } : o));
    if (selected?.id === id) setSelected(s => ({ ...s, status }));
  };

  const launchApply = async (opp) => {
    if (applyingId) return;
    setApplyingId(opp.id);
    addLog(`SCØUMET: Launching Browser Use agent → ${opp.platform}`, "info");
    addLog(`SCØUMET: Creating persistent browser session...`, "info");

    const result = await callBackend("apply", { opportunityId: opp.id });

    if (result.error) {
      addLog(`ERROR: ${result.error}`, "error");
      setApplyingId(null);
      return;
    }

    addLog(`✓ Session created → task_id: ${result.task_id?.slice(0,12)}...`, "success");
    addLog(`🌐 Live browser: ${result.live_url}`, "info");
    addLog(`⟶ Agent navigating to ${opp.url}`, "info");

    setLiveSession({ live_url: result.live_url, task_id: result.task_id, opp });
    setOpps(p => p.map(o => o.id === opp.id ? { ...o, status: "applied" } : o));
    if (selected?.id === opp.id) setSelected(s => ({ ...s, status: "applied" }));
    setApplyingId(null);
  };

  const scanNew = async () => {
    setScanning(true);
    addLog("SCØUMET: Launching Browser Use scan — Respondent · UserTesting · FocusGroup.com", "info");

    const result = await callBackend("scan");

    if (result.error) {
      addLog(`SCAN ERROR: ${result.error}`, "error");
    } else {
      addLog(`✓ Scan task launched → ID: ${result.task_id?.slice(0,12)}...`, "success");
      if (result.live_url) addLog(`🌐 Live: ${result.live_url}`, "info");
      addLog("SCØUMET: Scan running — results will populate when complete", "info");
    }
    setScanning(false);
  };

  const filtered = filter === "all" ? opps : opps.filter(o => o.status === filter);
  const counts = Object.fromEntries(
    Object.keys(STATUS_META).map(s => [s, opps.filter(o => o.status === s).length])
  );

  return (
    <div style={{ background: bg0, minHeight: "100vh", maxHeight: "100vh", color: "#b0b0cc",
      fontFamily: "'Courier New',monospace", display: "flex", flexDirection: "column", overflow: "hidden",
      backgroundImage: `radial-gradient(ellipse at 10% 10%,${accent}10 0%,transparent 40%),
        linear-gradient(${bd0} 1px,transparent 1px), linear-gradient(90deg,${bd0} 1px,transparent 1px)`,
      backgroundSize: "100% 100%,28px 28px,28px 28px" }}>
      <style>{`@keyframes kk{0%,100%{opacity:1}50%{opacity:.2}} @keyframes pulse{0%{opacity:.4}100%{opacity:1}}
        *{box-sizing:border-box} ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#181830;border-radius:2px}
        button:hover{filter:brightness(1.3)}`}
      </style>

      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", borderBottom: `1px solid ${bd0}`,
        background: "rgba(6,6,14,0.95)", flexShrink: 0, gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: "bold", letterSpacing: "4px", color: accent }}>SCØUMET APPLY</div>
          <div style={{ fontSize: "7px", letterSpacing: "3px", color: "#22223a" }}>BROWSER USE · HUMAN-IN-LOOP · XKSH808 FOCUS GROUP ENGINE</div>
        </div>

        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          <button onClick={() => setFilter("all")}
            style={{ padding: "4px 10px", background: filter === "all" ? `${accent}18` : "transparent",
              border: `1px solid ${filter === "all" ? accent + "44" : bd0}`,
              borderRadius: "3px", color: filter === "all" ? accent : "#333",
              fontFamily: "'Courier New',monospace", fontSize: "7px", letterSpacing: "1px", cursor: "pointer" }}>
            ◈ ALL {opps.length}
          </button>
          {Object.entries(STATUS_META).map(([s, m]) => (
            <button key={s} onClick={() => setFilter(filter === s ? "all" : s)}
              style={{ padding: "4px 10px", background: filter === s ? `${m.color}18` : "transparent",
                border: `1px solid ${filter === s ? m.color + "44" : bd0}`,
                borderRadius: "3px", color: filter === s ? m.color : "#333",
                fontFamily: "'Courier New',monospace", fontSize: "7px", letterSpacing: "1px", cursor: "pointer" }}>
              {m.icon} {m.label} {counts[s] || 0}
            </button>
          ))}
        </div>

        <button onClick={scanNew} disabled={scanning}
          style={{ padding: "7px 16px", background: `${accent}14`, border: `1px solid ${accent}44`,
            borderRadius: "3px", color: accent, fontFamily: "'Courier New',monospace",
            fontSize: "9px", letterSpacing: "2px", cursor: scanning ? "not-allowed" : "pointer", opacity: scanning ? 0.5 : 1 }}>
          {scanning ? "SCANNING···" : "⟳ SCAN NEW"}
        </button>
      </div>

      {/* LIVE SESSION BANNER */}
      {liveSession && (
        <div style={{ padding: "8px 16px", background: "#00e5ff08", borderBottom: `1px solid ${accent}22`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: accent,
              boxShadow: `0 0 8px ${accent}`, animation: "kk 1s infinite", flexShrink: 0 }} />
            <span style={{ fontSize: "8px", color: accent, letterSpacing: "1px" }}>
              BROWSER USE ACTIVE — {liveSession.opp.title}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <a href={liveSession.live_url} target="_blank" rel="noreferrer"
              style={{ fontSize: "8px", color: "#00ff99", letterSpacing: "1px", textDecoration: "none",
                padding: "4px 10px", background: "#00ff9912", border: "1px solid #00ff9933", borderRadius: "2px" }}>
              🌐 WATCH LIVE
            </a>
            <button onClick={() => setLiveSession(null)}
              style={{ fontSize: "7px", color: "#ff4455", background: "transparent", border: "none", cursor: "pointer", letterSpacing: "1px" }}>
              ✕ DISMISS
            </button>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* OPPORTUNITY LIST */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {loading ? (
            <div style={{ color: "#333", fontSize: "9px", letterSpacing: "2px", textAlign: "center", marginTop: "40px" }}>LOADING···</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: "#222", fontSize: "9px", letterSpacing: "2px", textAlign: "center", marginTop: "40px" }}>
              NO OPPORTUNITIES — HIT ⟳ SCAN NEW TO SCOUT
            </div>
          ) : filtered.map(opp => {
            const sm = STATUS_META[opp.status] || STATUS_META.pending;
            const isSel = selected?.id === opp.id;
            const isApplying = applyingId === opp.id;
            return (
              <div key={opp.id} onClick={() => setSelected(isSel ? null : opp)}
                style={{ background: isSel ? `${sm.color}0a` : bg1,
                  border: `1px solid ${isSel ? sm.color + "44" : sm.color + "18"}`,
                  borderRadius: "4px", padding: "10px 12px", cursor: "pointer",
                  transition: "all .15s", display: "flex", alignItems: "center", gap: "12px" }}>

                <span style={{ width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                  background: sm.color, boxShadow: `0 0 6px ${sm.color}`,
                  animation: opp.status === "pending" ? "kk 2s infinite" : "none" }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                    <span style={{ fontSize: "10px", color: "#ccd0f0", fontWeight: "bold", letterSpacing: "1px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opp.title}</span>
                    <span style={{ fontSize: "7px", color: sm.color, letterSpacing: "1px",
                      padding: "1px 6px", background: `${sm.color}12`, border: `1px solid ${sm.color}22`,
                      borderRadius: "2px", flexShrink: 0, marginLeft: "8px" }}>{sm.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px", fontSize: "8px", color: "#333" }}>
                    <span style={{ color: "#00ff9966" }}>{opp.platform}</span>
                    <span style={{ color: "#ffaa0066" }}>{opp.pay}</span>
                    <span>{opp.duration}</span>
                    <span style={{ color: accent + "66" }}>{opp.category}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {opp.status === "pending" && (
                    <>
                      <button onClick={() => decide(opp.id, "approved")}
                        style={{ padding: "4px 10px", background: "#00ff9912", border: "1px solid #00ff9933",
                          borderRadius: "2px", color: "#00ff99", fontFamily: "'Courier New',monospace",
                          fontSize: "7px", letterSpacing: "1px", cursor: "pointer" }}>✓ APPROVE</button>
                      <button onClick={() => decide(opp.id, "denied")}
                        style={{ padding: "4px 10px", background: "#ff445512", border: "1px solid #ff445533",
                          borderRadius: "2px", color: "#ff4455", fontFamily: "'Courier New',monospace",
                          fontSize: "7px", letterSpacing: "1px", cursor: "pointer" }}>✕ DENY</button>
                    </>
                  )}
                  {opp.status === "approved" && (
                    <button onClick={() => launchApply(opp)} disabled={!!applyingId}
                      style={{ padding: "4px 12px", background: `${accent}18`, border: `1px solid ${accent}44`,
                        borderRadius: "2px", color: accent, fontFamily: "'Courier New',monospace",
                        fontSize: "7px", letterSpacing: "1px", cursor: applyingId ? "not-allowed" : "pointer",
                        opacity: applyingId ? 0.5 : 1, animation: "pulse 1.5s infinite alternate" }}>
                      {isApplying ? "LAUNCHING···" : "⟶ AUTO-APPLY"}
                    </button>
                  )}
                  {opp.status === "applied" && opp.notes && (() => {
                    try {
                      const n = JSON.parse(opp.notes);
                      return n.live_url ? (
                        <a href={n.live_url} target="_blank" rel="noreferrer"
                          style={{ padding: "4px 10px", background: "#cc88ff12", border: "1px solid #cc88ff33",
                            borderRadius: "2px", color: "#cc88ff", fontFamily: "'Courier New',monospace",
                            fontSize: "7px", letterSpacing: "1px", textDecoration: "none" }}>🌐 LIVE</a>
                      ) : null;
                    } catch { return null; }
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {/* DETAIL PANEL */}
        <div style={{ width: "260px", borderLeft: `1px solid ${bd0}`, background: "rgba(8,8,14,0.88)",
          display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {selected ? (
            <div style={{ padding: "14px", overflowY: "auto", flex: 1 }}>
              <div style={{ fontSize: "7px", letterSpacing: "3px", color: accent, marginBottom: "10px",
                borderBottom: `1px solid ${accent}22`, paddingBottom: "6px" }}>OPPORTUNITY DETAIL</div>
              
              <div style={{ fontSize: "11px", fontWeight: "bold", color: "#ccd0f0", marginBottom: "4px",
                letterSpacing: "1px", lineHeight: 1.4 }}>{selected.title}</div>
              <div style={{ fontSize: "8px", color: "#00ff9966", marginBottom: "10px" }}>{selected.platform}</div>

              {[
                ["PAY", selected.pay, "#ffaa00"],
                ["DURATION", selected.duration, "#cc88ff"],
                ["CATEGORY", selected.category, accent],
                ["STATUS", STATUS_META[selected.status]?.label, STATUS_META[selected.status]?.color],
              ].map(([k, v, c]) => v && (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0",
                  borderBottom: `1px solid ${bd0}`, fontSize: "8px" }}>
                  <span style={{ color: "#333", letterSpacing: "1px" }}>{k}</span>
                  <span style={{ color: c }}>{v}</span>
                </div>
              ))}

              <div style={{ marginTop: "10px", fontSize: "8px", color: "#3a3a5a", lineHeight: "1.6" }}>{selected.description}</div>

              <a href={selected.url} target="_blank" rel="noreferrer"
                style={{ display: "block", marginTop: "10px", padding: "5px 0", fontSize: "7px",
                  color: accent + "88", letterSpacing: "1px", textDecoration: "none", borderTop: `1px solid ${bd0}`,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ⟶ {selected.url}
              </a>

              {/* SESSION INFO */}
              {selected.notes && (() => {
                try {
                  const n = JSON.parse(selected.notes);
                  return (
                    <div style={{ marginTop: "10px", padding: "8px", background: "#080816",
                      border: `1px solid ${accent}18`, borderRadius: "3px" }}>
                      <div style={{ fontSize: "7px", color: accent, letterSpacing: "2px", marginBottom: "6px" }}>BROWSER USE SESSION</div>
                      {n.task_id && <div style={{ fontSize: "7px", color: "#333" }}>task: {n.task_id?.slice(0,16)}...</div>}
                      {n.started_at && <div style={{ fontSize: "7px", color: "#333" }}>started: {new Date(n.started_at).toLocaleTimeString()}</div>}
                      {n.live_url && (
                        <a href={n.live_url} target="_blank" rel="noreferrer"
                          style={{ display: "block", marginTop: "6px", fontSize: "8px", color: "#00ff99",
                            textDecoration: "none", padding: "4px 8px", background: "#00ff9910",
                            border: "1px solid #00ff9922", borderRadius: "2px" }}>
                          🌐 Watch Live Session
                        </a>
                      )}
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* ACTION BUTTONS */}
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {selected.status === "pending" && (
                  <>
                    <button onClick={() => decide(selected.id, "approved")}
                      style={{ padding: "8px", background: "#00ff9912", border: "1px solid #00ff9933",
                        borderRadius: "3px", color: "#00ff99", fontFamily: "'Courier New',monospace",
                        fontSize: "8px", letterSpacing: "2px", cursor: "pointer" }}>✓ APPROVE & QUEUE</button>
                    <button onClick={() => decide(selected.id, "denied")}
                      style={{ padding: "8px", background: "#ff445512", border: "1px solid #ff445533",
                        borderRadius: "3px", color: "#ff4455", fontFamily: "'Courier New',monospace",
                        fontSize: "8px", letterSpacing: "2px", cursor: "pointer" }}>✕ DENY</button>
                  </>
                )}
                {selected.status === "approved" && (
                  <button onClick={() => launchApply(selected)} disabled={!!applyingId}
                    style={{ padding: "8px", background: `${accent}18`, border: `1px solid ${accent}44`,
                      borderRadius: "3px", color: accent, fontFamily: "'Courier New',monospace",
                      fontSize: "8px", letterSpacing: "2px", cursor: applyingId ? "not-allowed" : "pointer" }}>
                    ⟶ LAUNCH BROWSER USE
                  </button>
                )}
                {selected.status !== "pending" && (
                  <button onClick={() => decide(selected.id, "pending")}
                    style={{ padding: "6px", background: "#ffffff04", border: `1px solid ${bd0}`,
                      borderRadius: "3px", color: "#444", fontFamily: "'Courier New',monospace",
                      fontSize: "7px", letterSpacing: "2px", cursor: "pointer" }}>↺ RESET TO PENDING</button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: "8px", padding: "20px" }}>
              <div style={{ fontSize: "22px", color: "#111128" }}>◎</div>
              <div style={{ fontSize: "7px", color: "#1a1a30", letterSpacing: "2px", textAlign: "center" }}>SELECT OPPORTUNITY</div>
              <div style={{ fontSize: "7px", color: "#111128", letterSpacing: "1px", textAlign: "center", lineHeight: 1.8 }}>
                APPROVE → queue for auto-apply{"\n"}
                AUTO-APPLY → Browser Use handles forms{"\n"}
                CAPTCHA/LOGIN → you take over live
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SYSTEM LOG */}
      <div style={{ height: "80px", borderTop: `1px solid ${bd0}`, background: "rgba(4,4,10,0.95)",
        padding: "6px 14px", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ fontSize: "7px", letterSpacing: "3px", color: "#111128", marginBottom: "3px" }}>SCØUMET LOG</div>
        {log.map((l, i) => (
          <div key={i} style={{ fontSize: "8px", lineHeight: "1.65",
            color: l.t === "success" ? "#00ff9966" : l.t === "error" ? "#ff445566" : l.t === "system" ? "#ffaa0066" : "#ffffff18" }}>
            {l.m}
          </div>
        ))}
      </div>
    </div>
  );
}
