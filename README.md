# Verdict Immo — Azure deployment (Static Web Apps + Azure AI Foundry)

Your friend opens ONE link — `https://<app>.azurestaticapps.net/?k=<code>` — and it works.
No account for him, no install. Everything runs on YOUR Azure subscription.

## Architecture
- **Frontend**: Vite/React static build, hosted on Azure Static Web Apps (Free tier)
- **Backend**: SWA managed Azure Function at `/api/analyze` — holds all keys in
  Application Settings, enforces the `?k=` access code, runs the 3-stage pipeline
  (research → registry vision → synthesis)
- **Model**: dual-provider — **Claude in Foundry** (`claude-sonnet-4-5`, Anthropic
  Messages API, auto-detected from a `services.ai.azure.com` endpoint) or **Azure
  OpenAI** (`gpt-4o`). Switch anytime via app settings; `MODEL_PROVIDER` forces it.
- **Live web research (optional but recommended)**: Tavily search API (free tier,
  ~1,000 searches/month). Without it, the app relies on what the agent pastes into
  the context box + the model's knowledge, and flags lower confidence.

## Step 1 — Deploy a model (5 min)
1. Go to **ai.azure.com** (Azure AI Foundry) → your project (or create one)
2. **Deployments → Deploy model → gpt-4o** (Global Standard is fine)
3. Note three values:
   - Endpoint: `https://<resource>.openai.azure.com`
   - Key: from the resource's Keys page
   - Deployment name: whatever you named it (e.g. `gpt-4o`)

## Step 2 — (Optional) Tavily key (2 min)
Create a free account at **tavily.com** → copy the API key.
This is what lets the app pull live Centris/market data like the original.

## Step 3 — Create the Static Web App (5 min)
Easiest path — GitHub:
1. Push this folder to a new GitHub repo (private is fine)
2. Azure Portal → **Create resource → Static Web App** (Free plan)
3. Connect the repo. Build settings:
   - App location: `/`
   - Api location: `api`
   - Output location: `dist`
4. Create. The generated GitHub Action builds and deploys automatically (~3 min).

No GitHub? Use the SWA CLI instead:
```bash
npm install && npm run build
npm install -g @azure/static-web-apps-cli
swa deploy ./dist --api-location ./api --env production
```

## Step 4 — Application settings
Static Web App → **Settings → Environment variables** (or Configuration) → add:

| Name | Value |
|---|---|
| AZURE_OPENAI_ENDPOINT | https://<resource>.openai.azure.com |
| AZURE_OPENAI_KEY | your key |
| AZURE_OPENAI_DEPLOYMENT | gpt-4o |
| ACCESS_CODE | e.g. `monsadel2026` |
| TAVILY_API_KEY | (optional) your Tavily key |

Save — settings apply within a minute, no redeploy needed.

## Step 5 — Send the link
```
https://<your-app>.azurestaticapps.net/?k=monsadel2026
```
He bookmarks it. Done. Without the `?k=` code the backend refuses to spend your tokens.

## Testing checklist (do this before sending)
1. Open the link WITH the code → paste a Centris address + asking price + listing text
   in the context box → upload a registry screenshot (PNG/JPG — for a PDF, screenshot it)
2. Verify all 3 pipeline steps go green and the verdict renders
3. Click "Télécharger le rapport" → confirm the HTML report downloads
4. Open the link WITHOUT `?k=` → confirm the analysis is refused (guard works)

## Costs
- SWA Free tier: $0
- gpt-4o: roughly $0.02–0.06 per analysis (3 calls) on standard pricing
- Tavily: free tier covers ~300 analyses/month
Set a budget alert on the resource group if you want a hard ceiling.

## Notes & upgrades
- Model swap = change the endpoint/deployment app settings. The backend speaks BOTH
  protocols: Anthropic Messages API for Claude-in-Foundry deployments and Azure
  OpenAI chat completions for GPT-family deployments.
- Registry uploads are images only (Azure OpenAI vision doesn't ingest PDFs).
- The `noindex` header keeps the app out of search engines; still treat link+code
  as semi-private.
- If analyses feel thin without Tavily, tell agents to paste the full Centris
  listing text into the context box — the research prompt treats it as primary
  evidence.
