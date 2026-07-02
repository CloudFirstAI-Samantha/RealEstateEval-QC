import { useState, useRef } from "react";
import {
  Search, FileText, Upload, Download, RotateCcw, TrendingDown, TrendingUp,
  Minus, AlertTriangle, CheckCircle2, XCircle, Landmark, Scale, Loader2,
  ChevronRight, MapPin, Stamp, ScrollText
} from "lucide-react";

/* ---------- design tokens ---------- */
const T = {
  paper: "#F4F6F1",
  panel: "#FFFFFF",
  ink: "#1C2B33",
  sub: "#5B6B72",
  line: "#D9DFDA",
  blue: "#1E5AA8",
  blueSoft: "#EBF1F9",
  go: "#1F7A4D",
  cond: "#A8720A",
  nogo: "#AE3B2C",
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');`;

/* ---------- bilingual strings ---------- */
const STR = {
  fr: {
    tag: "Analyse d'achat immobilier — Québec",
    sub: "Entrez une adresse, un lien Centris ou un numéro MLS. L'agent IA recherche le marché, les évaluations, l'historique et les comparables, puis rend un verdict d'achat défendable.",
    addrLabel: "Propriété",
    addrPh: "31 Rue Monsadel, Kirkland — ou lien Centris / no MLS",
    askLabel: "Prix demandé (optionnel)",
    askPh: "1 249 000",
    notesLabel: "Contexte (optionnel)",
    notesPh: "Collez ici le texte de la fiche Centris + tout contexte: prix refusés, prétentions du vendeur, nuisances",
    regLabel: "Registre foncier / index aux immeubles (optionnel)",
    regHint: "Le registre ne peut pas être consulté automatiquement. Téléversez une capture d'écran (PNG/JPG) de l'index aux immeubles — pour un PDF, faites-en une capture d'écran pour débloquer l'analyse des hypothèques et de l'historique des ventes.",
    regBtn: "Téléverser le document",
    regLoaded: "Document chargé",
    run: "Lancer l'analyse",
    running: "Analyse en cours…",
    steps: ["Recherche du marché et de l'inscription", "Analyse du registre foncier", "Synthèse et verdict"],
    stepSkip: "Aucun document — étape sautée",
    verdictT: { GO: "ACHETER", CONDITIONAL: "CONDITIONNEL", NO_GO: "NE PAS ACHETER" },
    fairBand: "Fourchette de juste valeur",
    offer: "Offre recommandée",
    walk: "Prix plafond",
    asking: "Prix demandé",
    munEval: "Évaluation municipale",
    market: "Marché local",
    dom: "jours sur le marché (médiane)",
    findings: "Constats clés",
    comps: "Comparables",
    registry: "Registre foncier",
    levers: "Leviers de négociation",
    risks: "Risques",
    summary: "Raisonnement",
    confidence: "Confiance",
    conf: { low: "faible", med: "moyenne", high: "élevée" },
    download: "Télécharger le rapport",
    newRun: "Nouvelle analyse",
    disclaimer: "Analyse générée par IA à partir de données publiques. Ne remplace ni une évaluation agréée, ni un avis juridique ou financier. Vérifiez les comparables vendus via Centris avant toute offre.",
    errNoAddr: "Entrez une adresse, un lien ou un numéro MLS pour lancer l'analyse.",
    errApi: "L'analyse a échoué à cette étape. Vérifiez la connexion et relancez.",
    errParse: "La réponse n'a pas pu être structurée. Relancez l'analyse — ajouter le prix demandé et du contexte aide.",
    sources: "Basé sur les données fournies et, si configurée, la recherche web en direct au moment de l'analyse.",
  },
  en: {
    tag: "Property purchase analysis — Quebec",
    sub: "Enter an address, a Centris link, or an MLS number. The AI agent researches the market, assessments, listing history and comparables, then renders a defensible purchase verdict.",
    addrLabel: "Property",
    addrPh: "31 Rue Monsadel, Kirkland — or Centris link / MLS #",
    askLabel: "Asking price (optional)",
    askPh: "1,249,000",
    notesLabel: "Context (optional)",
    notesPh: "Paste the Centris listing text here + any context: rejected prices, seller claims, nuisances",
    regLabel: "Land registry / index aux immeubles (optional)",
    regHint: "The registry can't be pulled automatically. Upload a screenshot (PNG/JPG) of the index aux immeubles — for a PDF, take a screenshot of it to unlock hypothec and sale-history analysis.",
    regBtn: "Upload document",
    regLoaded: "Document loaded",
    run: "Run analysis",
    running: "Analyzing…",
    steps: ["Researching market & listing", "Reading land registry", "Synthesis & verdict"],
    stepSkip: "No document — step skipped",
    verdictT: { GO: "BUY", CONDITIONAL: "CONDITIONAL", NO_GO: "DO NOT BUY" },
    fairBand: "Fair value band",
    offer: "Recommended offer",
    walk: "Walk-away price",
    asking: "Asking price",
    munEval: "Municipal assessment",
    market: "Local market",
    dom: "median days on market",
    findings: "Key findings",
    comps: "Comparables",
    registry: "Land registry",
    levers: "Negotiation levers",
    risks: "Risks",
    summary: "Reasoning",
    confidence: "Confidence",
    conf: { low: "low", med: "medium", high: "high" },
    download: "Download report",
    newRun: "New analysis",
    disclaimer: "AI-generated analysis from public data. Not a substitute for a certified appraisal or legal/financial advice. Verify sold comparables through Centris before any offer.",
    errNoAddr: "Enter an address, link, or MLS number to run the analysis.",
    errApi: "The analysis failed at this step. Check your connection and retry.",
    errParse: "The response couldn't be structured. Retry — adding the asking price and context helps.",
    sources: "Based on the data provided and, when configured, live web research at the time of analysis.",
  },
};

/* ---------- helpers ---------- */
const money = (n, lang) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "currency", currency: "CAD", maximumFractionDigits: 0,
  }).format(n);
};

const ACCESS_CODE = new URLSearchParams(window.location.search).get("k") || "";

async function runStage(stage, payload) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-access-code": ACCESS_CODE },
    body: JSON.stringify({ stage, ...payload }),
  });
  let data;
  try { data = await res.json(); } catch { throw new Error("bad response"); }
  if (!res.ok || data.error) throw new Error(data.error || "api error");
  return data.data;
}

/* ---------- report download ---------- */
function buildReport(input, research, registry, result, lang) {
  const s = STR[lang];
  const vColor = { GO: T.go, CONDITIONAL: T.cond, NO_GO: T.nogo }[result.verdict];
  const row = (l, v) => `<tr><td style="padding:6px 14px 6px 0;color:#5B6B72">${l}</td><td style="padding:6px 0;font-family:'IBM Plex Mono',monospace;font-weight:600">${v}</td></tr>`;
  const li = (arr) => arr.map((x) => `<li style="margin:6px 0">${x}</li>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Verdict Immo — ${research.address || input}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&family=IBM+Plex+Mono:wght@400;600&display=swap');
body{font-family:Archivo,sans-serif;color:#1C2B33;background:#F4F6F1;margin:0;padding:40px}
.wrap{max-width:760px;margin:0 auto;background:#fff;border:1px solid #D9DFDA;padding:48px}
h1{font-size:15px;letter-spacing:.18em;text-transform:uppercase;color:#1E5AA8;margin:0 0 4px}
h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;border-top:1px solid #D9DFDA;padding-top:18px;margin-top:28px}
.stamp{display:inline-block;border:3px double ${vColor};color:${vColor};font-family:'IBM Plex Mono',monospace;font-weight:600;letter-spacing:.2em;padding:10px 22px;transform:rotate(-2deg);margin:18px 0}
.band{font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:600}
small{color:#5B6B72}</style></head><body><div class="wrap">
<h1>VERDICT IMMO</h1><div style="font-size:22px;font-weight:800">${research.address || input}</div>
<small>${new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA")} — ${s.sources}</small>
<div><span class="stamp">${s.verdictT[result.verdict]}</span></div>
<div class="band">${money(result.fairLow, lang)} – ${money(result.fairHigh, lang)}</div><small>${s.fairBand}</small>
<table style="margin-top:16px;border-collapse:collapse">${row(s.asking, money(research.asking, lang))}${row(s.offer, money(result.offer, lang))}${row(s.walk, money(result.walkAway, lang))}${row(s.munEval, `${money(research.munEval, lang)} ${research.evalYear ? "(" + research.evalYear + ")" : ""}`)}${row(s.market, `${money(research.market?.median, lang)} · ${research.market?.trend || ""}`)}</table>
<h2>${s.summary}</h2><p>${result.summary}</p>
<h2>${s.findings}</h2><ul>${li(result.findings.map((f) => `<b>${f.t}.</b> ${f.d}`))}</ul>
<h2>${s.comps}</h2><ul>${li((research.comps || []).map((c) => `${c.addr} — <b>${money(c.price, lang)}</b> · ${c.note}`))}</ul>
${registry ? `<h2>${s.registry}</h2><ul>${li([...(registry.purchase ? [`${lang === "fr" ? "Achat" : "Purchase"} ${registry.purchase.year}: ${money(registry.purchase.price, lang)}`] : []), ...(registry.hypothecs || []).map((h) => `${h.year} — ${h.lender}: ${money(h.amount, lang)}`), ...(registry.insights || [])])}</ul>` : ""}
<h2>${s.levers}</h2><ul>${li(result.levers)}</ul>
<h2>${s.risks}</h2><ul>${li(result.risks)}</ul>
<p style="margin-top:32px;font-size:12px;color:#5B6B72;border-top:1px solid #D9DFDA;padding-top:14px">${s.disclaimer}</p>
</div></body></html>`;
}

/* ---------- component ---------- */
export default function VerdictImmo() {
  const [lang, setLang] = useState("fr");
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | running | done | error
  const [stepStates, setStepStates] = useState(["wait", "wait", "wait"]);
  const [error, setError] = useState("");
  const [research, setResearch] = useState(null);
  const [registry, setRegistry] = useState(null);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const s = STR[lang];

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () =>
      setFile({ name: f.name, type: f.type, data: reader.result.split(",")[1] });
    reader.onerror = () => setError(s.errApi);
    reader.readAsDataURL(f);
  };

  const setStep = (i, st) =>
    setStepStates((prev) => prev.map((x, j) => (j === i ? st : x)));

  const run = async () => {
    if (!input.trim()) { setError(s.errNoAddr); return; }
    setError(""); setResult(null); setResearch(null); setRegistry(null);
    setPhase("running");
    setStepStates(["run", "wait", "wait"]);
    try {
      /* 1 — research with web search */
      let res;
      try {
        res = await runStage("research", { input: input.trim(), asking: asking.trim(), notes: notes.trim(), lang });
      } catch (e) {
        setStep(0, "fail"); setPhase("error");
        setError(e.message && e.message !== "api error" ? e.message : s.errApi); return;
      }
      setResearch(res); setStep(0, "ok");

      /* 2 — registry (optional) */
      let reg = null;
      if (file) {
        setStep(1, "run");
        try {
          reg = await runStage("registry", { lang, fileType: file.type, fileData: file.data });
          setRegistry(reg); setStep(1, "ok");
        } catch (e) {
          setStep(1, "fail"); // non-fatal: continue without registry
        }
      } else {
        setStep(1, "skip");
      }

      /* 3 — synthesis */
      setStep(2, "run");
      try {
        const fin = await runStage("synthesis", { research: res, registry: reg, asking: asking.trim(), notes: notes.trim(), lang });
        setResult(fin); setStep(2, "ok"); setPhase("done");
      } catch (e) {
        setStep(2, "fail"); setPhase("error");
        setError(e.message && e.message !== "api error" ? e.message : s.errApi);
      }
    } catch (e) {
      setPhase("error"); setError(s.errApi);
    }
  };

  const download = () => {
    if (!result || !research) return;
    const html = buildReport(input, research, registry, result, lang);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verdict-immo-${(research.address || input).replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setPhase("idle"); setResult(null); setResearch(null); setRegistry(null);
    setStepStates(["wait", "wait", "wait"]); setError("");
  };

  const vColor = result ? { GO: T.go, CONDITIONAL: T.cond, NO_GO: T.nogo }[result.verdict] : T.blue;
  const impactIcon = (i) =>
    i === "pos" ? <TrendingUp size={15} style={{ color: T.go }} /> :
    i === "neg" ? <TrendingDown size={15} style={{ color: T.nogo }} /> :
    <Minus size={15} style={{ color: T.sub }} />;

  const stepIcon = (st) =>
    st === "ok" ? <CheckCircle2 size={16} style={{ color: T.go }} /> :
    st === "run" ? <Loader2 size={16} className="animate-spin" style={{ color: T.blue }} /> :
    st === "fail" ? <XCircle size={16} style={{ color: T.nogo }} /> :
    st === "skip" ? <Minus size={16} style={{ color: T.sub }} /> :
    <div style={{ width: 16, height: 16, borderRadius: 99, border: `1.5px solid ${T.line}` }} />;

  const label = (txt) => (
    <div style={{
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.18em",
      textTransform: "uppercase", color: T.blue, marginBottom: 10, display: "flex",
      alignItems: "center", gap: 8,
    }}>
      <span style={{ width: 18, height: 1, background: T.blue, display: "inline-block" }} />
      {txt}
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: "Archivo, sans-serif",
      backgroundImage: `linear-gradient(${"rgba(30,90,168,0.05)"} 1px, transparent 1px), linear-gradient(90deg, ${"rgba(30,90,168,0.05)"} 1px, transparent 1px)`,
      backgroundSize: "44px 44px",
    }}>
      <style>{FONTS}</style>

      {/* header */}
      <header style={{ maxWidth: 880, margin: "0 auto", padding: "36px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ background: T.ink, color: T.paper, padding: "6px 8px", display: "flex", alignItems: "center" }}>
                <Stamp size={18} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: "-0.01em" }}>
                VERDICT<span style={{ color: T.blue }}> IMMO</span>
              </div>
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.16em",
              textTransform: "uppercase", color: T.sub, marginTop: 8,
            }}>{s.tag}</div>
          </div>
          <div style={{ display: "flex", border: `1px solid ${T.line}`, background: T.panel }}>
            {["fr", "en"].map((l) => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: "7px 14px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                fontWeight: 600, letterSpacing: "0.1em", cursor: "pointer", border: "none",
                background: lang === l ? T.ink : "transparent", color: lang === l ? T.paper : T.sub,
              }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <p style={{ maxWidth: 620, color: T.sub, fontSize: 14.5, lineHeight: 1.55, marginTop: 14 }}>{s.sub}</p>
      </header>

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "22px 20px 80px" }}>

        {/* intake */}
        <section style={{ background: T.panel, border: `1px solid ${T.line}`, padding: "26px 26px 28px" }}>
          {label(s.addrLabel)}
          <div style={{ display: "flex", gap: 10, alignItems: "center", border: `1.5px solid ${T.ink}`, padding: "12px 14px", background: T.paper }}>
            <MapPin size={17} style={{ color: T.blue, flexShrink: 0 }} />
            <input
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={s.addrPh}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, fontFamily: "Archivo, sans-serif", color: T.ink, minWidth: 0 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, marginTop: 22 }}>
            <div>
              {label(s.askLabel)}
              <input
                value={asking} onChange={(e) => setAsking(e.target.value)}
                placeholder={s.askPh}
                style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${T.line}`, padding: "10px 12px", background: T.paper, fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, outline: "none", color: T.ink }}
              />
            </div>
            <div>
              {label(s.regLabel)}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} style={{ display: "none" }} />
              <button onClick={() => fileRef.current?.click()} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 9, justifyContent: "center",
                padding: "10px 12px", cursor: "pointer", fontSize: 13.5, fontWeight: 600,
                border: `1px dashed ${file ? T.go : T.blue}`, color: file ? T.go : T.blue,
                background: file ? "#EFF7F1" : T.blueSoft, fontFamily: "Archivo, sans-serif",
              }}>
                {file ? <CheckCircle2 size={15} /> : <Upload size={15} />}
                {file ? `${s.regLoaded} — ${file.name.slice(0, 26)}` : s.regBtn}
              </button>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: T.sub, marginTop: 8, lineHeight: 1.5 }}>{s.regHint}</p>

          <div style={{ marginTop: 16 }}>
            {label(s.notesLabel)}
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder={s.notesPh}
              style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${T.line}`, padding: "10px 12px", background: T.paper, fontSize: 14, fontFamily: "Archivo, sans-serif", resize: "vertical", outline: "none", color: T.ink }}
            />
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 20, flexWrap: "wrap" }}>
            <button onClick={phase === "running" ? undefined : run} disabled={phase === "running"} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "13px 26px",
              background: phase === "running" ? T.sub : T.ink, color: T.paper, border: "none",
              cursor: phase === "running" ? "default" : "pointer", fontWeight: 700, fontSize: 15,
              fontFamily: "Archivo, sans-serif", letterSpacing: "0.02em",
            }}>
              {phase === "running" ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
              {phase === "running" ? s.running : s.run}
            </button>
            {(phase === "done" || phase === "error") && (
              <button onClick={reset} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "12px 18px",
                background: "transparent", border: `1px solid ${T.line}`, color: T.sub,
                cursor: "pointer", fontSize: 14, fontFamily: "Archivo, sans-serif",
              }}>
                <RotateCcw size={15} /> {s.newRun}
              </button>
            )}
          </div>

          {error && (
            <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "flex-start", background: "#FBF1EF", border: `1px solid ${T.nogo}`, padding: "12px 14px", fontSize: 13.5, color: T.nogo }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}
        </section>

        {/* pipeline */}
        {phase !== "idle" && (
          <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderTop: "none", padding: "18px 26px" }}>
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
              {s.steps.map((st, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: stepStates[i] === "wait" ? T.sub : T.ink, fontWeight: stepStates[i] === "run" ? 600 : 400 }}>
                  {stepIcon(stepStates[i])}
                  <span>{st}{stepStates[i] === "skip" ? ` · ${s.stepSkip}` : ""}</span>
                  {i < 2 && <ChevronRight size={14} style={{ color: T.line }} />}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* results */}
        {phase === "done" && result && research && (
          <>
            {/* verdict + band */}
            <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderTop: `4px solid ${vColor}`, marginTop: 22, padding: "30px 26px", position: "relative", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 260, flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 21 }}>{research.address || input}</div>
                  {research.listingStatus && (
                    <div style={{ fontSize: 13, color: T.sub, marginTop: 4 }}>{research.listingStatus}</div>
                  )}
                  <div style={{ marginTop: 22 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "clamp(26px, 5vw, 38px)", fontWeight: 700, letterSpacing: "-0.01em" }}>
                      {money(result.fairLow, lang)} <span style={{ color: T.sub, fontWeight: 400 }}>–</span> {money(result.fairHigh, lang)}
                    </div>
                    <div style={{ fontSize: 12.5, color: T.sub, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>
                      {s.fairBand} · {s.confidence}: {s.conf[result.confidence] || result.confidence}
                    </div>
                  </div>
                </div>
                <div style={{
                  border: `3px double ${vColor}`, color: vColor, padding: "14px 26px",
                  fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 19,
                  letterSpacing: "0.22em", transform: "rotate(-2.5deg)", background: T.panel,
                  boxShadow: `0 0 0 3px ${T.panel}`, whiteSpace: "nowrap", alignSelf: "center",
                }}>
                  {s.verdictT[result.verdict] || result.verdict}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 1, background: T.line, border: `1px solid ${T.line}`, marginTop: 26 }}>
                {[
                  [s.asking, money(research.asking, lang)],
                  [s.offer, money(result.offer, lang)],
                  [s.walk, money(result.walkAway, lang)],
                  [s.munEval, `${money(research.munEval, lang)}${research.evalYear ? ` · ${research.evalYear}` : ""}`],
                ].map(([l, v], i) => (
                  <div key={i} style={{ background: T.paper, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: T.sub, fontFamily: "'IBM Plex Mono', monospace" }}>{l}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 17, marginTop: 5 }}>{v}</div>
                  </div>
                ))}
              </div>
              {research.evalNote && <p style={{ fontSize: 12.5, color: T.sub, marginTop: 10 }}>{research.evalNote}</p>}
            </section>

            {/* summary + market */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, marginTop: 22 }}>
              <div style={{ background: T.panel, border: `1px solid ${T.line}`, padding: "24px 26px" }}>
                {label(s.summary)}
                <p style={{ fontSize: 14.5, lineHeight: 1.65, margin: 0 }}>{result.summary}</p>
              </div>
              <div style={{ background: T.panel, border: `1px solid ${T.line}`, padding: "24px 26px" }}>
                {label(s.market)}
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 700 }}>
                  {money(research.market?.median, lang)}
                </div>
                <div style={{ fontSize: 13.5, color: T.sub, marginTop: 6 }}>
                  {research.market?.trend}{research.market?.dom ? ` · ${research.market.dom} ${s.dom}` : ""}
                </div>
                {research.market?.note && <p style={{ fontSize: 13, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>{research.market.note}</p>}
                {research.history && (
                  <p style={{ fontSize: 13, marginTop: 12, lineHeight: 1.55, borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
                    <ScrollText size={13} style={{ display: "inline", marginRight: 6, color: T.blue }} />{research.history}
                  </p>
                )}
              </div>
            </section>

            {/* findings */}
            <section style={{ background: T.panel, border: `1px solid ${T.line}`, padding: "24px 26px", marginTop: 22 }}>
              {label(s.findings)}
              <div style={{ display: "grid", gap: 0 }}>
                {(result.findings || []).map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: i ? `1px solid ${T.line}` : "none", alignItems: "flex-start" }}>
                    <div style={{ marginTop: 2 }}>{impactIcon(f.i)}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.55 }}>
                      <span style={{ fontWeight: 700 }}>{f.t}.</span> {f.d}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* comps + registry */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, marginTop: 22 }}>
              <div style={{ background: T.panel, border: `1px solid ${T.line}`, padding: "24px 26px" }}>
                {label(s.comps)}
                {(research.comps || []).map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${T.line}` : "none", fontSize: 13.5 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.addr}</div>
                      <div style={{ color: T.sub, fontSize: 12.5 }}>{c.note}</div>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, whiteSpace: "nowrap" }}>{money(c.price, lang)}</div>
                  </div>
                ))}
                {(research.nuisances || []).length > 0 && (
                  <div style={{ marginTop: 14, fontSize: 12.5, color: T.nogo, display: "flex", gap: 7, alignItems: "flex-start" }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{research.nuisances.join(" · ")}</span>
                  </div>
                )}
              </div>

              <div style={{ background: T.panel, border: `1px solid ${T.line}`, padding: "24px 26px" }}>
                {label(s.registry)}
                {registry ? (
                  <>
                    {registry.purchase && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "8px 0", fontWeight: 600 }}>
                        <span><Landmark size={13} style={{ display: "inline", marginRight: 6, color: T.blue }} />{lang === "fr" ? "Achat" : "Purchase"} {registry.purchase.year}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{money(registry.purchase.price, lang)}</span>
                      </div>
                    )}
                    {(registry.hypothecs || []).map((h, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "7px 0", borderTop: `1px solid ${T.line}`, color: T.sub }}>
                        <span>{h.year} — {h.lender}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{money(h.amount, lang)}</span>
                      </div>
                    ))}
                    {(registry.insights || []).map((x, i) => (
                      <div key={i} style={{ fontSize: 13, lineHeight: 1.5, marginTop: 10, paddingLeft: 12, borderLeft: `2px solid ${T.blue}` }}>{x}</div>
                    ))}
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.55 }}>
                    <Scale size={13} style={{ display: "inline", marginRight: 6 }} />
                    {s.regHint}
                  </p>
                )}
              </div>
            </section>

            {/* levers + risks */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, marginTop: 22 }}>
              <div style={{ background: T.panel, border: `1px solid ${T.line}`, padding: "24px 26px" }}>
                {label(s.levers)}
                {(result.levers || []).map((x, i) => (
                  <div key={i} style={{ display: "flex", gap: 9, fontSize: 13.5, lineHeight: 1.55, padding: "7px 0" }}>
                    <ChevronRight size={15} style={{ color: T.go, flexShrink: 0, marginTop: 2 }} />{x}
                  </div>
                ))}
              </div>
              <div style={{ background: T.panel, border: `1px solid ${T.line}`, padding: "24px 26px" }}>
                {label(s.risks)}
                {(result.risks || []).map((x, i) => (
                  <div key={i} style={{ display: "flex", gap: 9, fontSize: 13.5, lineHeight: 1.55, padding: "7px 0" }}>
                    <AlertTriangle size={15} style={{ color: T.cond, flexShrink: 0, marginTop: 2 }} />{x}
                  </div>
                ))}
              </div>
            </section>

            {/* actions */}
            <section style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
              <button onClick={download} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "13px 26px",
                background: T.blue, color: "#fff", border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 15, fontFamily: "Archivo, sans-serif",
              }}>
                <Download size={17} /> {s.download}
              </button>
              <button onClick={reset} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
                background: "transparent", border: `1px solid ${T.line}`, color: T.sub,
                cursor: "pointer", fontSize: 14, fontFamily: "Archivo, sans-serif",
              }}>
                <RotateCcw size={15} /> {s.newRun}
              </button>
            </section>

            <p style={{ fontSize: 12, color: T.sub, marginTop: 26, lineHeight: 1.55, borderTop: `1px solid ${T.line}`, paddingTop: 14 }}>
              <FileText size={12} style={{ display: "inline", marginRight: 5 }} />
              {s.sources} {s.disclaimer}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
