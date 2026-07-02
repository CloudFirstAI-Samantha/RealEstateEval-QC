const { app } = require("@azure/functions");

/* =========================================================================
   POST /api/analyze  — Verdict Immo backend (Azure-native)
   Calls YOUR Azure AI Foundry / Azure OpenAI deployment. Keys live in
   SWA Application Settings, never in the browser.

   Required settings:
     AZURE_OPENAI_ENDPOINT     Azure OpenAI: https://<res>.openai.azure.com
                               Claude in Foundry: https://<res>.services.ai.azure.com
     AZURE_OPENAI_KEY          resource key
     AZURE_OPENAI_DEPLOYMENT   deployment name (claude-sonnet-4-5, gpt-4o, ...)
     MODEL_PROVIDER            "claude" | "openai" (auto-detected from endpoint if unset)
   Recommended:
     ACCESS_CODE               gate — link must carry ?k=<code>
   Optional (live web research; free tier at tavily.com):
     TAVILY_API_KEY
     AZURE_OPENAI_API_VERSION  default 2024-06-01
   ========================================================================= */

const extractJSON = (text) => {
  const clean = String(text).replace(/```json|```/g, "").trim();
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("Model did not return structured JSON");
  return JSON.parse(clean.slice(a, b + 1));
};

/* ---------- provider layer ----------
   MODEL_PROVIDER = "claude" (Claude in Foundry, Anthropic Messages API)
                  | "openai" (Azure OpenAI chat completions)  [default]
   Auto-detects "claude" when the endpoint is *.services.ai.azure.com. */

function provider() {
  const p = (process.env.MODEL_PROVIDER || "").toLowerCase();
  if (p === "claude" || p === "openai") return p;
  return (process.env.AZURE_OPENAI_ENDPOINT || "").includes("services.ai.azure.com") ? "claude" : "openai";
}

/* parts: { text, imageType?, imageData? } */
async function chat(parts, maxTokens = 1500) {
  const ep = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
  const dep = process.env.AZURE_OPENAI_DEPLOYMENT;
  const key = process.env.AZURE_OPENAI_KEY;
  if (!ep || !dep || !key) throw new Error("Server missing AZURE_OPENAI_* settings");

  if (provider() === "claude") {
    // Claude in Microsoft Foundry — native Anthropic Messages API
    const content = [];
    if (parts.imageData) {
      content.push({ type: "image", source: { type: "base64", media_type: parts.imageType || "image/png", data: parts.imageData } });
    }
    content.push({ type: "text", text: parts.text });
    const r = await fetch(`${ep}/anthropic/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: dep, max_tokens: maxTokens, messages: [{ role: "user", content }] }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message || "Model error");
    return (d.content || []).map((c) => (c.type === "text" ? c.text : "")).filter(Boolean).join("\n");
  }

  // Azure OpenAI chat completions (gpt-4o / gpt-4.1 …)
  const ver = process.env.AZURE_OPENAI_API_VERSION || "2024-06-01";
  const content = parts.imageData
    ? [
        { type: "image_url", image_url: { url: `data:${parts.imageType || "image/png"};base64,${parts.imageData}` } },
        { type: "text", text: parts.text },
      ]
    : parts.text;
  const r = await fetch(`${ep}/openai/deployments/${dep}/chat/completions?api-version=${ver}`, {
    method: "POST",
    headers: { "content-type": "application/json", "api-key": key },
    body: JSON.stringify({ messages: [{ role: "user", content }], max_tokens: maxTokens, temperature: 0.2 }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Model error");
  return d.choices?.[0]?.message?.content || "";
}

async function tavilySearch(query) {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query, max_results: 5, search_depth: "basic", include_answer: false,
    }),
  });
  const d = await r.json();
  return (d.results || [])
    .map((x) => `- ${x.title} (${x.url}): ${String(x.content).slice(0, 400)}`)
    .join("\n");
}

/* ---------- prompts ---------- */
const langName = (lang) => (lang === "fr" ? "French" : "English");

const researchPrompt = (input, asking, notes, lang, webContext) => `You are a Quebec real-estate valuation researcher. Property: "${input}". ${asking ? `Asking price: ${asking}.` : ""} ${notes ? `Agent-provided context (treat as primary evidence — agents often paste the Centris listing here): ${notes}` : ""}
${webContext ? `LIVE WEB SEARCH RESULTS (use as your main source, cite nothing, extract facts):\n${webContext}` : "No live web access: rely on the agent-provided context and your general knowledge of the municipality. Be conservative; mark unknowns as null and flag uncertainty in 'notes'."}
Determine: listing details and price history; municipal assessment (note the roll year — Quebec triennial rolls reflect market values 18 months before taking effect, e.g. a 2023-2025 roll = July 2021 values, a 2026-2028 roll = July 2024 values); municipal median single-family price and trend; days on market; 2-4 comparables; nuisance factors (highway, rail, power lines).
Respond ONLY with compact JSON, no markdown. Free-text values in ${langName(lang)}, terse. Schema:
{"found":bool,"address":"","asking":number|null,"listingStatus":"","munEval":number|null,"evalYear":"","evalNote":"","market":{"median":number|null,"trend":"","dom":number|null,"note":""},"history":"","comps":[{"addr":"","price":number,"note":""}],"nuisances":[""],"notes":""}`;

const registryPrompt = (lang) => `This image is a Quebec land registry document (index aux immeubles) for the property under analysis. Extract: original purchase (year, price) by the current owner; all hypothecs (year, lender, registered amount); recent transfers between co-owners; then infer 2-4 short insights (e.g. refinance-driven price floor, equity pressure, priority-ranking risk for a buyer). Quebec lenders often register collateral charges up to 125% of value — a registered amount is NOT an appraisal.
Respond ONLY with compact JSON, no markdown. Free text in ${langName(lang)}, terse. Schema:
{"purchase":{"year":"","price":number}|null,"hypothecs":[{"year":"","lender":"","amount":number}],"transfers":[""],"insights":[""]}`;

const synthesisPrompt = (research, registry, asking, notes, lang) => `You are a senior Quebec property valuation analyst producing a purchase go/no-go for a buyer's agent.
RESEARCH: ${JSON.stringify(research)}
REGISTRY: ${registry ? JSON.stringify(registry) : "none provided"}
${asking ? `ASKING: ${asking}` : ""} ${notes ? `CONTEXT: ${notes}` : ""}
Triangulate fair value using: comparables adjusted for condition/size; the assessment roll adjusted for its reference date vs the current trend; listing/price history (a failed prior listing caps value); documented nuisance discounts (highway-adjacent: 8-11% per published research). Registry debt/motivation feeds negotiation levers, NOT fair value. Verdict: GO if asking <= fairHigh; CONDITIONAL if asking within ~7% above fairHigh (bridgeable via terms/credits); NO_GO if materially above defensible value. If data is thin, widen the band and set confidence "low".
Respond ONLY with compact JSON, no markdown. Free text in ${langName(lang)}. Schema:
{"verdict":"GO"|"CONDITIONAL"|"NO_GO","fairLow":number,"fairHigh":number,"offer":number,"walkAway":number,"confidence":"low"|"med"|"high","findings":[{"t":"","d":"","i":"pos"|"neg"|"neu"}],"levers":[""],"risks":[""],"summary":"max 110 words"}`;

/* ---------- handler ---------- */
app.http("analyze", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const json = (status, body) => ({ status, jsonBody: body });
    let body;
    try { body = await request.json(); } catch { return json(400, { error: "Bad request" }); }

    const required = process.env.ACCESS_CODE;
    if (required && request.headers.get("x-access-code") !== required) {
      return json(401, { error: "Invalid or missing access code — open the app with the full link you were sent (…?k=code)." });
    }

    const { stage, input, asking, notes, lang = "fr", research, registry, fileType, fileData } = body;

    try {
      if (stage === "research") {
        if (!input) return json(400, { error: "Missing property input" });
        let webContext = "";
        if (process.env.TAVILY_API_KEY) {
          const tail = input.split(/[,\s]+/).slice(-2).join(" ");
          const queries = [
            `${input} Centris`,
            `${input} évaluation municipale prix`,
            `marché immobilier ${tail} prix médian maison`,
          ];
          const chunks = await Promise.allSettled(queries.map(tavilySearch));
          webContext = chunks.filter((c) => c.status === "fulfilled" && c.value).map((c) => c.value).join("\n");
        }
        const txt = await chat({ text: researchPrompt(input, asking, notes, lang, webContext) }, 1500);
        return json(200, { data: extractJSON(txt) });
      }

      if (stage === "registry") {
        if (!fileData) return json(400, { error: "Missing document" });
        const txt = await chat({ text: registryPrompt(lang), imageType: fileType, imageData: fileData }, 1200);
        return json(200, { data: extractJSON(txt) });
      }

      if (stage === "synthesis") {
        if (!research) return json(400, { error: "Missing research data" });
        const txt = await chat({ text: synthesisPrompt(research, registry, asking, notes, lang) }, 1500);
        return json(200, { data: extractJSON(txt) });
      }

      return json(400, { error: "Unknown stage" });
    } catch (e) {
      context.error(e);
      return json(502, { error: e.message || "Analysis failed" });
    }
  },
});
