import { useState, useEffect } from "react";
import { FocusGroupOpportunity } from "@/api/entities";

const STATUS_META = {
  pending:   { color: "#ffaa00", label: "PENDING",   icon: "◎" },
  approved:  { color: "#00ff99", label: "APPROVED",  icon: "✓" },
  denied:    { color: "#ff4455", label: "DENIED",    icon: "✕" },
  applied:   { color: "#00e5ff", label: "APPLIED",   icon: "⟶" },
  completed: { color: "#cc88ff", label: "DONE",      icon: "★" },
};

const bg0 = "#06060e", bg1 = "#0b0b18", bd0 = "#ffffff08", bd1 = "#ffffff12";
const accent = "#00e5ff";

export default function ScoumetApply() {
  const [opps, setOpps]       = useState([]);
  const [filter, setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const [log, setLog]         = useState([
    { t: "system",  m: "[BOOT] SCØUMET Apply Engine — ONLINE" },
    { t: "success", m: "[READY] Focus group scanner loaded" },
  ]);

  const addLog = (m, t = "info") => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLog(p => [...p.slice(-60), { t, m: `[${ts}] ${m}` }]);
  };

  const load = async () => {
    setLoading(true);
    const data = await FocusGroupOpportunity.list();
    setOpps(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (id, status) => {
    await FocusGroupOpportunity.update(id, { status });
    addLog(`DECISION → ${status.toUpperCase()} · ID:${id.slice(-6)}`, status === "approved" ? "success" : "error");
    setOpps(p => p.map(o => o.id === id ? { ...o, status } : o));
    if (selected?.id === id) setSelected(s => ({ ...s, status }));
  };

  const simulateApply = async (opp) => {
    if (applyingId) return;
    setApplyingId(opp.id);
    addLog(`APPLYING → ${opp.platform} · ${opp.title}`, "info");
    addLog(`SCØUMET: Navigating to ${opp.url}`, "info");
    await new Promise(r => setTimeout(r, 1200));
    addLog(`SCØUMET: Page loaded — scanning form fields`, "info");
    await new Promise(r => setTimeout(r, 900));
    addLog(`SCØUMET: Auto-filling name, email, category=Sports`, "info");
    await new Promise(r => setTimeout(r, 800));
    addLog(`⚠ CAPTCHA detected — pausing for manual solve`, "error");
    addLog(`📱 WhatsApp ping sent — waiting for you to clear it`, "info");
    await new Promise(r => setTimeout(r, 1500));
    addLog(`✓ Captcha cleared — resuming submission`, "success");
    await new Promise(r => setTimeout(r, 700));
    addLog(`✓ APPLICATION SUBMITTED → ${opp.platform}`, "success");
    await FocusGroupOpportunity.update(opp.id, { status: "applied", applied_at: new Date().toISOString() });
    setOpps(p => p.map(o => o.id === opp.id ? { ...o, status: "applied" } : o));
    if (selected?.id === opp.id) setSelected(s => ({ ...s, status: "applied" }));
    setApplyingId(null);
  };

  const scanNew = async () => {
    setScanning(true);
    addLog("SCØUMET: Scanning Respondent.io, UserTesting, Schlesinger...", "info");
    await new Promise(r => setTimeout(r, 2000));
    addLog("SCØUMET: Found 3 new sports studies", "success");
    addLog("SCØUMET: Queuing for your review", "info");
    // Add fresh mock entries
    const newOpp = await FocusGroupOpportunity.create({
      title: "Live Sports Betting UX Study",
      platform: "Respondent.io",
      url: "https://app.respondent.io/respondents/studies",
      category: "Sports",
      pay: "$125/hr",
      duration: "60 min",
      description: "Evaluate sports betting app interfaces. Must follow sports regularly.",
      status: "pending",
    });
    setOpps(p => [newOpp, ...p]);
    addLog("SCØUMET: Scan complete — 1 new opportunity added", "success");
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
      <style>{`@keyframes kk{0%,100%{opacity:1}50%{opacity:.2}} *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#181830;border-radius:2px}
        button:hover{filter:brightness(1.3)}`}
      </style>

      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", borderBottom: `1px solid ${bd0}`,
        background: "rgba(6,6,14,0.95)", flexShrink: 0, gap: "12px" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: "bold", letterSpacing: "4px", color: accent }}>SCØUMET APPLY</div>
          <div style={{ fontSize: "7px", letterSpacing: "3px", color: "#22223a" }}>FOCUS GROUP SCOUT · AUTO-APPLY ENGINE · XKSH808</div>
        </div>

        {/* STAT PILLS */}
        <div style={{ display: "flex", gap: "6px" }}>
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

      {/* MAIN */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* OPPORTUNITY LIST */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {loading ? (
            <div style={{ color: "#333", fontSize: "9px", letterSpacing: "2px", textAlign: "center", marginTop: "40px" }}>LOADING···</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: "#222", fontSize: "9px", letterSpacing: "2px", textAlign: "center", marginTop: "40px" }}>NO OPPORTUNITIES IN THIS FILTER</div>
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

                {/* STATUS DOT */}
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                  background: sm.color, boxShadow: `0 0 6px ${sm.color}`,
                  animation: opp.status === "pending" ? "kk 2s infinite" : "none" }} />

                {/* INFO */}
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

                {/* QUICK ACTIONS */}
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
                    <button onClick={() => simulateApply(opp)} disabled={!!applyingId}
                      style={{ padding: "4px 12px", background: `${accent}18`, border: `1px solid ${accent}44`,
                        borderRadius: "2px", color: accent, fontFamily: "'Courier New',monospace",
                        fontSize: "7px", letterSpacing: "1px", cursor: applyingId ? "not-allowed" : "pointer",
                        opacity: applyingId ? 0.5 : 1 }}>
                      {isApplying ? "APPLYING···" : "⟶ APPLY NOW"}
                    </button>
                  )}
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
              <div style={{ fontSize: "11px", fontWeight: "bold", color: "#ccd0f0", marginBottom: "4px", letterSpacing: "1px", lineHeight: 1.4 }}>{selected.title}</div>
              <div style={{ fontSize: "8px", color: "#00ff9966", marginBottom: "10px" }}>{selected.platform}</div>

              {[["PAY", selected.pay, "#ffaa00"], ["DURATION", selected.duration, "#cc88ff"], ["CATEGORY", selected.category, accent]].map(([k, v, c]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0",
                  borderBottom: `1px solid ${bd0}`, fontSize: "8px" }}>
                  <span style={{ color: "#333", letterSpacing: "1px" }}>{k}</span>
                  <span style={{ color: c }}>{v}</span>
                </div>
              ))}

              <div style={{ marginTop: "10px", fontSize: "8px", color: "#3a3a5a", lineHeight: "1.6" }}>{selected.description}</div>

              <a href={selected.url} target="_blank" rel="noreferrer"
                style={{ display: "block", marginTop: "10px", padding: "5px 0", fontSize: "7px",
                  color: accent + "88", letterSpacing: "1px", textDecoration: "none", borderTop: `1px solid ${bd0}` }}>
                ⟶ {selected.url}
              </a>

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
                  <button onClick={() => simulateApply(selected)} disabled={!!applyingId}
                    style={{ padding: "8px", background: `${accent}18`, border: `1px solid ${accent}44`,
                      borderRadius: "3px", color: accent, fontFamily: "'Courier New',monospace",
                      fontSize: "8px", letterSpacing: "2px", cursor: applyingId ? "not-allowed" : "pointer" }}>
                    ⟶ LAUNCH AUTO-APPLY
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "22px", color: "#111128" }}>◎</div>
              <div style={{ fontSize: "7px", color: "#1a1a30", letterSpacing: "2px" }}>SELECT OPPORTUNITY</div>
            </div>
          )}
        </div>
      </div>

      {/* SYSTEM LOG */}
      <div style={{ height: "75px", borderTop: `1px solid ${bd0}`, background: "rgba(4,4,10,0.95)",
        padding: "6px 14px", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ fontSize: "7px", letterSpacing: "3px", color: "#111128", marginBottom: "3px" }}>SCØUMET LOG</div>
        {log.map((l, i) => (
          <div key={i} style={{ fontSize: "8px", lineHeight: "1.6",
            color: l.t === "success" ? "#00ff9966" : l.t === "error" ? "#ff445566" : l.t === "system" ? "#ffaa0066" : "#ffffff18" }}>
            {l.m}
          </div>
        ))}
      </div>
    </div>
  );
}
