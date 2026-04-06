import { useState, useRef, useEffect, useCallback } from "react";

const NODE_TYPES = ["AGENT", "TOOL", "WORKFLOW", "FUNCTION", "PAGE"];

const TYPE_META = {
  AGENT:    { icon: "◈", color: "#cc88ff", desc: "Receives messages · routes intent · returns responses",  badge: "AI" },
  TOOL:     { icon: "⚙", color: "#00e5ff", desc: "Input schema · executes operation · structured output",  badge: "FN" },
  WORKFLOW: { icon: "⟶", color: "#ffaa00", desc: "Step chain · multi-op sequence · state carries forward", badge: "WF" },
  FUNCTION: { icon: "ƒ",  color: "#00ff99", desc: "Pure transform · stateless · in→out · no memory",       badge: "λ"  },
  PAGE:     { icon: "□",  color: "#ff6b00", desc: "Renders UI · public facing · embeddable component",      badge: "UI" },
};

const INIT_MODULES = [
  {
    id:"amanda", name:"AMANDA", color:"#cc88ff", type:"AGENT", docked:true,
    desc:"Brain router — intent classification and dispatch",
    config:{
      AGENT:    { input:"message: string", output:"routed_response: string", trigger:"on_message" },
      TOOL:     { input:"intent: string",  output:"agent_id: string",        trigger:"classify()" },
      WORKFLOW: { steps:["receive","classify","route","respond"],             trigger:"pipeline.run()" },
      FUNCTION: { fn:"(msg) => detectAgent(msg)",                             trigger:"amanda(msg)" },
      PAGE:     { template:"LandingAgent", mode:"public",                     trigger:"render()" },
    },
  },
  {
    id:"rsis808", name:"RSIS808", color:"#00ff99", type:"FUNCTION", docked:true,
    desc:"Error daemon — friction logging and recovery",
    config:{
      AGENT:    { input:"error: object",  output:"recovery_plan: string", trigger:"on_error" },
      TOOL:     { input:"log_entry: str", output:"severity: 0-5",         trigger:"rsis.log()" },
      WORKFLOW: { steps:["detect","log","classify","heal","report"],       trigger:"daemon.run()" },
      FUNCTION: { fn:"(err) => classify(err) + recover(err)",              trigger:"rsis808(err)" },
      PAGE:     { template:"ErrorDashboard", mode:"operator",              trigger:"render()" },
    },
  },
  {
    id:"redis", name:"REDIS", color:"#ff4455", type:"TOOL", docked:true,
    desc:"Cache layer — fast state read/write across modules",
    config:{
      AGENT:    { input:"query: string",      output:"cached_data: any",  trigger:"on_lookup" },
      TOOL:     { input:"key: str, val?: any",output:"cached: boolean",   trigger:"cache.set()" },
      WORKFLOW: { steps:["check","hit_miss","fetch","store","return"],     trigger:"cache.flow()" },
      FUNCTION: { fn:"(key) => store.get(key) ?? fetch(key)",              trigger:"redis(key)" },
      PAGE:     { template:"CacheMonitor", mode:"operator",                trigger:"render()" },
    },
  },
  {
    id:"boomerang", name:"BOOMERANG", color:"#ffaa00", type:"WORKFLOW", docked:true,
    desc:"Feedback loop — 14-day evolution and rebuild cycle",
    config:{
      AGENT:    { input:"cycle_report: obj", output:"evolution_plan: str", trigger:"on_cycle" },
      TOOL:     { input:"metrics: object",   output:"diff: object",        trigger:"boomerang.diff()" },
      WORKFLOW: { steps:["fetch_logs","summarize","plan","rebuild","redeploy"], trigger:"loop.run()" },
      FUNCTION: { fn:"(logs) => summarize(logs) + buildPlan()",            trigger:"boomerang(logs)" },
      PAGE:     { template:"EvolutionTracker", mode:"operator",            trigger:"render()" },
    },
  },
  {
    id:"coolgpt", name:"CoolGPT", color:"#00e5ff", type:"AGENT", docked:true,
    desc:"Inference layer — LLM calls, completions, generation",
    config:{
      AGENT:    { input:"prompt: str, ctx: arr", output:"completion: str", trigger:"on_prompt" },
      TOOL:     { input:"messages: array",        output:"response: str",  trigger:"llm.complete()" },
      WORKFLOW: { steps:["build_prompt","inject_ctx","call_llm","parse","return"], trigger:"inference.run()" },
      FUNCTION: { fn:"(prompt, ctx) => llm.call({prompt, ctx})",           trigger:"coolgpt(prompt)" },
      PAGE:     { template:"InferenceConsole", mode:"operator",            trigger:"render()" },
    },
  },
];

const ROUTING_RULES = [
  { kw:["lead","client","contact","prospect","call","business","owner"], agent:"ANALYST",  color:"#00e5ff" },
  { kw:["build","code","create","develop","website","page","deploy"],    agent:"ENGINEER", color:"#cc88ff" },
  { kw:["error","fix","broken","issue","debug","crash","fail"],          agent:"HEALER",   color:"#ff4455" },
  { kw:["check","verify","secure","audit","review","quality"],           agent:"SENTINEL", color:"#00ff99" },
];
const detectRoute = t => {
  const l = t.toLowerCase();
  return ROUTING_RULES.find(r => r.kw.some(k => l.includes(k))) || { agent:"AMANDA", color:"#ffaa00" };
};

const PUB_SYS  = `You are Amanda, public-facing landing agent for XKSH808 — a Hawaii web & SEO company run by Xavier. Help local Hawaii businesses get a free one-page website. Be warm, concise (2-4 sentences), qualify leads by asking their business type. Sign as Amanda.`;
const OP_SYS   = `You are ARC Operator Co-pilot for XKSH808's Kontrold Khaos — Xavier's 808 Money Printer. Help Xavier manage leads (cleaning, landscaping, handyman, plumbing, masonry), orchestrate agents, manage modules (Redis, CoolGPT, Boomerang, RSIS808), control automations. Be direct and technical. ARC = Frontend (replaceable) + Backend (loyal) + Database (frozen spine).`;

export default function KontrolldKhaos() {
  const [view,     setView]     = useState("chat");
  const [chatMode, setChatMode] = useState("public");
  const [pubMsgs,  setPubMsgs]  = useState([{ role:"assistant", content:"Hey — I'm Amanda. I help Hawaii businesses get found online. What kind of business do you run? 🤙", route:null }]);
  const [opMsgs,   setOpMsgs]   = useState([{ role:"assistant", content:"ARC OPERATOR ONLINE. Dual instance loaded. 808 Money Printer active. All modules nominal. Command?", route:null }]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [modules,  setModules]  = useState(INIT_MODULES);
  const [selected, setSelected] = useState(null);
  const [log,      setLog]      = useState([
    { t:"system",  m:"[BOOT] ARC Modular Node Engine — ONLINE" },
    { t:"success", m:"[READY] 5 nodes registered · all docked" },
    { t:"success", m:"[READY] Dual instance chat engine loaded" },
  ]);
  const [running,  setRunning]  = useState({});
  const msgEnd = useRef(null);
  const logEnd = useRef(null);

  const msgs    = chatMode === "public" ? pubMsgs : opMsgs;
  const setMsgs = chatMode === "public" ? setPubMsgs : setOpMsgs;
  const accent  = chatMode === "public" ? "#00e5ff" : "#ff6b00";
  const sysProm = chatMode === "public" ? PUB_SYS : OP_SYS;

  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);
  useEffect(() => { logEnd.current?.scrollIntoView({ behavior:"smooth" });  }, [log]);

  const addLog = (m, t="info") => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12:false });
    setLog(p => [...p.slice(-80), { t, m:`[${ts}] ${m}` }]);
  };

  const cycleType = useCallback((id, targetType) => {
    setModules(prev => prev.map(m => {
      if (m.id !== id) return m;
      const next = targetType || NODE_TYPES[(NODE_TYPES.indexOf(m.type) + 1) % NODE_TYPES.length];
      addLog(`NODE ${m.name} recycled → ${next}`, "success");
      return { ...m, type: next };
    }));
  }, []);

  const toggleDock = useCallback((id) => {
    setModules(prev => prev.map(m => {
      if (m.id !== id) return m;
      addLog(`NODE ${m.name} → ${m.docked ? "UNDOCKED from ARC" : "DOCKED to ARC"}`, m.docked ? "error" : "success");
      return { ...m, docked: !m.docked };
    }));
  }, []);

  const triggerNode = useCallback(async (id) => {
    const mod = modules.find(m => m.id === id);
    if (!mod || running[id]) return;
    setRunning(p => ({ ...p, [id]: true }));
    addLog(`TRIGGER ${mod.name} as ${mod.type} — executing...`, "info");
    await new Promise(r => setTimeout(r, 700 + Math.random() * 800));
    addLog(`${mod.name}:${mod.type} → complete ✓`, "success");
    setRunning(p => ({ ...p, [id]: false }));
  }, [modules, running]);

  const sendMsg = async () => {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    const route = detectRoute(txt);
    setInput(""); setLoading(true);
    const next = [...msgs, { role:"user", content:txt, route:null }];
    setMsgs(next);
    addLog(`CHAT → ${chatMode.toUpperCase()} · routed to ${route.agent}`, "info");
    try {
      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model:"claude-opus-4-5", max_tokens:1000, system:sysProm,
          messages: next.map(m => ({ role:m.role, content:m.content })) }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "No response.";
      setMsgs([...next, { role:"assistant", content:reply, route }]);
      addLog(`REPLY ← ${route.agent} complete`, "success");
    } catch {
      setMsgs([...next, { role:"assistant", content:"⚠ ARC connection error. HEALER dispatched.", route:{ agent:"HEALER", color:"#ff4455" } }]);
      addLog("ERROR: API failed — HEALER triggered", "error");
    }
    setLoading(false);
  };

  const selMod = modules.find(m => m.id === selected);

  const bg0 = "#06060e", bg1 = "#0b0b18", bg2 = "#0e0e1e";
  const bd0 = "#ffffff08", bd1 = "#ffffff0e";

  return (
    <div style={{ background:bg0, minHeight:"100vh", maxHeight:"100vh", color:"#b0b0cc",
      fontFamily:"'Courier New',monospace", display:"flex", flexDirection:"column", overflow:"hidden",
      backgroundImage:`radial-gradient(ellipse at 12% 12%,${accent}10 0%,transparent 42%),
        radial-gradient(ellipse at 88% 88%,#cc88ff09 0%,transparent 42%),
        linear-gradient(${bd0} 1px,transparent 1px),
        linear-gradient(90deg,${bd0} 1px,transparent 1px)`,
      backgroundSize:"100% 100%,100% 100%,28px 28px,28px 28px" }}>
      <style>{`
        @keyframes kk{0%,100%{opacity:1}50%{opacity:.25}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#181830;border-radius:2px}
        ::-webkit-scrollbar-track{background:transparent}
        button:hover{filter:brightness(1.2)}
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 16px",
        borderBottom:`1px solid ${bd0}`, background:"rgba(6,6,14,0.94)", backdropFilter:"blur(14px)", flexShrink:0, gap:"12px" }}>
        <div style={{ lineHeight:1 }}>
          <div style={{ fontSize:"13px", fontWeight:"bold", letterSpacing:"5px", color:accent }}>KONTROLD KHAOS</div>
          <div style={{ fontSize:"7px", letterSpacing:"3px", color:"#22223a", marginTop:"3px" }}>A.R.C · MODULAR NODE ENGINE · XKSH808 · 808 MONEY PRINTER</div>
        </div>

        <div style={{ display:"flex", gap:"4px" }}>
          {["chat","nodes"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding:"6px 14px",
              background: view===v ? `${accent}18` : "transparent",
              border:`1px solid ${view===v ? accent+"44" : bd0}`,
              borderRadius:"3px", color: view===v ? accent : "#333",
              fontFamily:"'Courier New',monospace", fontSize:"9px", letterSpacing:"2px", cursor:"pointer" }}>
              {v==="chat" ? "◈ CHAT" : "⊞ NODES"}
            </button>
          ))}
        </div>

        {view === "chat" && (
          <div style={{ display:"flex", border:`1px solid ${bd0}`, borderRadius:"3px", overflow:"hidden" }}>
            {["public","operator"].map(m => (
              <button key={m} onClick={() => setChatMode(m)} style={{ padding:"6px 14px",
                background: chatMode===m ? (m==="public"?"#00e5ff18":"#ff6b0018") : "transparent",
                border:"none", color: chatMode===m ? (m==="public"?"#00e5ff":"#ff6b00") : "#333",
                fontFamily:"'Courier New',monospace", fontSize:"9px", letterSpacing:"2px", cursor:"pointer" }}>
                {m==="public" ? "◈ PUBLIC" : "⚙ OPERATOR"}
              </button>
            ))}
          </div>
        )}

        <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
          {[["FE","#00e5ff"],["BE","#00ff99"],["DB","#ffaa00"]].map(([l,c]) => (
            <span key={l} style={{ display:"flex", alignItems:"center", gap:"4px", fontSize:"8px", color:c, letterSpacing:"1px" }}>
              <span style={{ width:"5px", height:"5px", borderRadius:"50%", background:c, boxShadow:`0 0 4px ${c}`, animation:"kk 2s infinite", flexShrink:0 }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════ CHAT VIEW ══════════════════ */}
      {view === "chat" && (
        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ flex:1, overflowY:"auto", padding:"14px", display:"flex", flexDirection:"column", gap:"10px" }}>
              {msgs.map((msg,i) => (
                <div key={i} style={{ display:"flex", flexDirection:"column", alignItems: msg.role==="user"?"flex-end":"flex-start", gap:"3px" }}>
                  {msg.role==="assistant" && msg.route && (
                    <span style={{ fontSize:"7px", letterSpacing:"2px", color:msg.route.color, padding:"2px 6px",
                      background:`${msg.route.color}0f`, border:`1px solid ${msg.route.color}22`, borderRadius:"2px" }}>
                      ⟶ {msg.route.agent}
                    </span>
                  )}
                  <div style={{ maxWidth:"78%", padding:"9px 13px",
                    borderRadius: msg.role==="user" ? "9px 9px 2px 9px" : "9px 9px 9px 2px",
                    background: msg.role==="user" ? `${accent}18` : bg1,
                    border:`1px solid ${msg.role==="user" ? accent+"33" : bd0}`,
                    fontSize:"12px", lineHeight:"1.65",
                    fontFamily: msg.role==="user" ? "'Courier New',monospace" : "'Segoe UI',system-ui,sans-serif",
                    color: msg.role==="user" ? "#ccd0f0" : "#b0b0cc", whiteSpace:"pre-wrap" }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display:"flex", gap:"4px", padding:"9px 13px", background:bg1, border:`1px solid ${bd0}`,
                  borderRadius:"9px 9px 9px 2px", alignSelf:"flex-start", alignItems:"center" }}>
                  {[0,1,2].map(i => <span key={i} style={{ width:"5px", height:"5px", borderRadius:"50%", background:accent, animation:`kk 1s ${i*.22}s infinite` }} />)}
                </div>
              )}
              <div ref={msgEnd} />
            </div>
            <div style={{ padding:"10px 14px", borderTop:`1px solid ${bd0}`, display:"flex", gap:"8px", background:"rgba(6,6,14,0.85)", flexShrink:0 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendMsg()}
                placeholder={chatMode==="public" ? "Talk to Amanda..." : "Operator command..."}
                style={{ flex:1, background:bg1, border:`1px solid ${accent}44`, borderRadius:"3px", padding:"9px 12px",
                  color:"#ccd0f0", fontFamily:"'Courier New',monospace", fontSize:"11px", outline:"none" }} />
              <button onClick={sendMsg} disabled={loading}
                style={{ padding:"9px 16px", background:`${accent}18`, border:`1px solid ${accent}44`,
                  borderRadius:"3px", color:accent, fontFamily:"'Courier New',monospace", fontSize:"9px",
                  letterSpacing:"2px", cursor: loading?"not-allowed":"pointer", opacity: loading?.5:1, flexShrink:0 }}>
                {loading ? "···" : "SEND ⟶"}
              </button>
            </div>
          </div>

          {/* SIDE: NODE DOCK STATUS */}
          <div style={{ width:"155px", borderLeft:`1px solid ${bd0}`, padding:"12px", background:"rgba(8,8,14,0.8)", display:"flex", flexDirection:"column", gap:"12px", overflowY:"auto", flexShrink:0 }}>
            <div>
              <div style={{ fontSize:"7px", letterSpacing:"3px", color:"#22223a", borderBottom:`1px solid ${bd0}`, paddingBottom:"4px", marginBottom:"6px" }}>NODE DOCK</div>
              {modules.map(m => (
                <div key={m.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"5px 6px", marginBottom:"4px",
                  background:`${m.color}08`, border:`1px solid ${m.color}18`, borderRadius:"2px" }}>
                  <div>
                    <div style={{ fontSize:"9px", color:m.color, letterSpacing:"1px" }}>{m.name}</div>
                    <div style={{ fontSize:"7px", color: TYPE_META[m.type].color, letterSpacing:"1px" }}>{m.type}</div>
                  </div>
                  <span style={{ width:"5px", height:"5px", borderRadius:"50%", background: m.docked ? m.color : "#222",
                    boxShadow: m.docked ? `0 0 4px ${m.color}` : "none", animation: m.docked ? "kk 2s infinite" : "none" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ NODES VIEW ══════════════════ */}
      {view === "nodes" && (
        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* NODE GRID */}
          <div style={{ flex:1, padding:"14px", overflowY:"auto",
            display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:"8px", alignContent:"start" }}>
            {modules.map(mod => {
              const tm  = TYPE_META[mod.type];
              const sel = selected === mod.id;
              const run = running[mod.id];
              return (
                <div key={mod.id} onClick={() => setSelected(sel ? null : mod.id)}
                  style={{ background: sel ? `${mod.color}0e` : bg1,
                    border:`1px solid ${sel ? mod.color+"44" : mod.color+"18"}`,
                    borderRadius:"4px", padding:"11px", cursor:"pointer", transition:"all .18s",
                    boxShadow: sel ? `0 0 20px ${mod.color}12` : "none",
                    opacity: mod.docked ? 1 : 0.4 }}>

                  {/* HEADER */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <span style={{ fontSize:"15px", color:mod.color }}>{tm.icon}</span>
                      <span style={{ fontSize:"11px", letterSpacing:"2px", fontWeight:"bold", color:mod.color }}>{mod.name}</span>
                    </div>
                    <span style={{ padding:"2px 7px", background:`${tm.color}18`, border:`1px solid ${tm.color}33`,
                      borderRadius:"2px", fontSize:"7px", letterSpacing:"2px", color:tm.color }}>{mod.type}</span>
                  </div>

                  {/* DESC */}
                  <div style={{ fontSize:"9px", color:"#3a3a5a", lineHeight:"1.5", marginBottom:"8px" }}>{mod.desc}</div>

                  {/* CONFIG PREVIEW */}
                  <div style={{ background:"#080816", border:`1px solid ${bd0}`, borderRadius:"2px", padding:"6px", marginBottom:"8px", minHeight:"32px" }}>
                    {mod.type === "WORKFLOW" ? (
                      <div style={{ display:"flex", gap:"3px", flexWrap:"wrap" }}>
                        {mod.config.WORKFLOW.steps.map((s,i) => (
                          <span key={s} style={{ fontSize:"7px", color:"#ffaa00", padding:"1px 4px",
                            background:"#ffaa0010", border:"1px solid #ffaa0022", borderRadius:"2px" }}>
                            {i+1}.{s}
                          </span>
                        ))}
                      </div>
                    ) : mod.type === "FUNCTION" ? (
                      <div style={{ fontSize:"8px", color:"#00ff99", fontFamily:"monospace" }}>{mod.config.FUNCTION.fn}</div>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
                        {mod.config[mod.type] && Object.entries(mod.config[mod.type]).map(([k,v]) => (
                          <div key={k} style={{ display:"flex", gap:"6px", fontSize:"7px" }}>
                            <span style={{ color:"#333", minWidth:"40px" }}>{k}:</span>
                            <span style={{ color:"#555" }}>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ACTIONS */}
                  <div style={{ display:"flex", gap:"4px" }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => triggerNode(mod.id)}
                      style={{ flex:1, padding:"5px 0", background: run ? `${mod.color}22` : `${mod.color}12`,
                        border:`1px solid ${mod.color}33`, borderRadius:"2px", color:mod.color,
                        fontFamily:"'Courier New',monospace", fontSize:"7px", letterSpacing:"1px", cursor:"pointer" }}>
                      {run ? "···" : "▶ RUN"}
                    </button>
                    <button onClick={() => cycleType(mod.id)}
                      style={{ flex:1, padding:"5px 0", background:"#ffffff04", border:`1px solid ${bd0}`,
                        borderRadius:"2px", color:"#555",
                        fontFamily:"'Courier New',monospace", fontSize:"7px", letterSpacing:"1px", cursor:"pointer" }}>
                      ↻ TYPE
                    </button>
                    <button onClick={() => toggleDock(mod.id)}
                      style={{ flex:1, padding:"5px 0",
                        background: mod.docked ? "#ff445510" : "#00ff9910",
                        border:`1px solid ${mod.docked ? "#ff445533" : "#00ff9933"}`,
                        borderRadius:"2px", color: mod.docked ? "#ff4455" : "#00ff99",
                        fontFamily:"'Courier New',monospace", fontSize:"7px", letterSpacing:"1px", cursor:"pointer" }}>
                      {mod.docked ? "⊖ UNDOCK" : "⊕ DOCK"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DETAIL PANEL */}
          <div style={{ width:"220px", borderLeft:`1px solid ${bd0}`, display:"flex", flexDirection:"column", background:"rgba(8,8,14,0.85)", flexShrink:0 }}>
            {selMod ? (
              <div style={{ padding:"14px", overflowY:"auto", flex:1 }}>
                <div style={{ fontSize:"7px", letterSpacing:"3px", color:selMod.color, marginBottom:"10px", borderBottom:`1px solid ${selMod.color}22`, paddingBottom:"6px" }}>
                  NODE DETAIL
                </div>
                <div style={{ fontSize:"12px", fontWeight:"bold", color:selMod.color, marginBottom:"4px", letterSpacing:"2px" }}>{selMod.name}</div>
                <div style={{ fontSize:"8px", color:"#3a3a5a", marginBottom:"10px", lineHeight:"1.5" }}>{selMod.desc}</div>

                <div style={{ fontSize:"7px", letterSpacing:"2px", color:"#222240", marginBottom:"6px" }}>ALL CONFIGS</div>
                {NODE_TYPES.map(nt => {
                  const cfg = selMod.config[nt];
                  const tm2 = TYPE_META[nt];
                  return (
                    <div key={nt} style={{ marginBottom:"8px", padding:"7px", background:"#080816",
                      border:`1px solid ${nt===selMod.type ? tm2.color+"33" : bd0}`, borderRadius:"2px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                        <span style={{ fontSize:"7px", color:tm2.color, letterSpacing:"1px" }}>{tm2.icon} {nt}</span>
                        {nt===selMod.type && <span style={{ fontSize:"6px", color:tm2.color, background:`${tm2.color}18`, padding:"1px 4px", borderRadius:"2px" }}>ACTIVE</span>}
                      </div>
                      {cfg && Object.entries(cfg).map(([k,v]) => (
                        <div key={k} style={{ fontSize:"7px", color:"#444", marginBottom:"2px" }}>
                          <span style={{ color:"#2a2a4a" }}>{k}: </span>
                          <span>{Array.isArray(v) ? v.join("→") : String(v)}</span>
                        </div>
                      ))}
                      <button onClick={() => cycleType(selMod.id, nt)}
                        style={{ marginTop:"4px", width:"100%", padding:"3px 0", background:`${tm2.color}0c`,
                          border:`1px solid ${tm2.color}22`, borderRadius:"2px", color:tm2.color,
                          fontFamily:"'Courier New',monospace", fontSize:"6px", letterSpacing:"1px", cursor:"pointer" }}>
                        SET AS ACTIVE
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"6px" }}>
                <div style={{ fontSize:"20px", color:"#111128" }}>◈</div>
                <div style={{ fontSize:"7px", color:"#1a1a30", letterSpacing:"2px" }}>SELECT NODE</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SYSTEM LOG ── */}
      <div style={{ height:"80px", borderTop:`1px solid ${bd0}`, background:"rgba(4,4,10,0.95)", padding:"6px 14px", overflowY:"auto", flexShrink:0 }}>
        <div style={{ fontSize:"7px", letterSpacing:"3px", color:"#111128", marginBottom:"4px" }}>SYSTEM LOG</div>
        {log.map((l,i) => (
          <div key={i} style={{ fontSize:"8px", lineHeight:"1.6",
            color: l.t==="success"?"#00ff9966" : l.t==="error"?"#ff445566" : l.t==="system"?"#ffaa0066" : "#ffffff18" }}>
            {l.m}
          </div>
        ))}
        <div ref={logEnd} />
      </div>
    </div>
  );
}
