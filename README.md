# ✦ StoryForge AI — Netlify Edition

Everything on one platform. Frontend + backend serverless functions, deployed free on Netlify.

---

## Project structure

```
storyforge-netlify/
├── netlify.toml                          ← Tells Netlify where everything lives
├── package.json
├── .env.example                          ← Copy → .env for local dev
├── .gitignore
│
├── netlify/functions/
│   ├── generate-story.js                 ← POST /api/generate-story (Claude API)
│   ├── create-order.js                   ← POST /api/create-order (PayPal)
│   └── health.js                         ← GET /api/health
│
└── public/
    ├── index.html                        ← Marketing site + order form (connected to backend)
    └── success.html                      ← Post-payment confirmation page
```

---

## How it works

```
Customer fills form → clicks Generate
        ↓
/.netlify/functions/generate-story  →  Claude API  →  story JSON + Pollinations.ai image URLs
        ↓
Preview modal opens (chapters + AI illustrations loading live from Pollinations.ai — FREE)
        ↓
Customer clicks Buy ($29 or $39)
        ↓
/.netlify/functions/create-order  →  PayPal API  →  returns approval URL
        ↓
Customer pays on PayPal's hosted page
        ↓
PayPal redirects back to /success.html
        ↓
(Future: PayPal webhook → trigger Printify print order)
```

---

## Local development

### 1. Install dependencies

```bash
cd storyforge-netlify
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` — add your Anthropic API key (only required key to start):

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run locally with Netlify Dev

Netlify Dev runs your functions AND serves your static files together,
exactly like production — same ports, same routing.

```bash
npm run dev
# or: npx netlify dev
```

Open http://localhost:8888

- Fill the form → click Generate → Claude writes a real story
- Illustrations load from Pollinations.ai (first load ~5-8s, then cached)
- PayPal will show a stub message until you add credentials

Check http://localhost:8888/api/health to see which services are active.

---

## Deploy to Netlify (step by step)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "StoryForge AI initial commit"
```

Create a new repo on github.com, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/storyforge-ai.git
git push -u origin main
```

### Step 2 — Connect to Netlify

1. Go to [netlify.com](https://netlify.com) → Log in (free account)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** → select your `storyforge-ai` repo
4. Build settings (Netlify auto-detects from `netlify.toml`):
   - **Build command:** *(leave blank)*
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
5. Click **"Deploy site"**

Your site will be live in ~60 seconds at a URL like `https://amazing-name-123.netlify.app`

### Step 3 — Add environment variables

In Netlify dashboard → your site → **Site Configuration** → **Environment Variables**:

| Key | Value | When |
|-----|-------|------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | **Now — required** |
| `PAYPAL_CLIENT_ID` | From PayPal dashboard | When ready to charge |
| `PAYPAL_CLIENT_SECRET` | From PayPal dashboard | When ready to charge |
| `PAYPAL_ENV` | `sandbox` (testing) or `live` | When adding PayPal |

After adding variables → **Trigger deploy** → Deploys → **Trigger deploy** button.

### Step 4 — Set a custom domain (optional)

Netlify dashboard → your site → **Domain management** → **Add custom domain**

Type your domain (e.g. `storyforgeai.com`) → follow the DNS instructions.
SSL certificate is added automatically and free.

---

## Activating PayPal (when ready)

### Sandbox testing (free, fake money)

1. Go to [developer.paypal.com](https://developer.paypal.com)
2. Log in with your PayPal account → **My Apps & Credentials**
3. Make sure you're on **Sandbox** tab → click **Create App**
4. Name it "StoryForge AI" → click Create
5. Copy **Client ID** and **Secret**
6. Add to Netlify env vars:
   ```
   PAYPAL_CLIENT_ID=AaBb... (sandbox)
   PAYPAL_CLIENT_SECRET=EeFf... (sandbox)
   PAYPAL_ENV=sandbox
   ```
7. PayPal provides test buyer accounts at developer.paypal.com → Sandbox → Accounts
8. Test the full checkout flow with those test accounts — no real money moves

### Going live (real money)

1. Switch to **Live** tab on developer.paypal.com → create Live app
2. Replace env vars with Live credentials
3. Change `PAYPAL_ENV=live`
4. Trigger a redeploy

---

## Adding Printify auto-fulfilment (future step)

When a customer pays, PayPal sends a webhook to a URL you configure.
You'll add a new Netlify function `netlify/functions/paypal-webhook.js` that:

1. Verifies the webhook came from PayPal
2. Creates a Printify print order via their API
3. Sends a confirmation email

This is already architecturally planned — the `storyId`, `productType`, and `childName`
are passed through PayPal's `custom_id` field so the webhook can retrieve them.

---

## Illustrations — how Pollinations.ai works

No API key. No signup. No cost. No rate limits for normal use.

Each illustration is just a URL:
```
https://image.pollinations.ai/prompt/ENCODED_PROMPT?width=768&height=512&seed=12345
```

- First time a URL is requested: ~5–8 seconds to generate
- After that: cached and instant
- Each chapter gets a unique `seed` so all 4 illustrations are different
- The prompt comes directly from Claude's `illustrationPrompt` field

If an image fails to load, the UI shows a 🎨 placeholder gracefully.

---

## Cost breakdown

| Item | Cost |
|---|---|
| Netlify hosting | Free (125k function calls/month) |
| Claude API (per story) | ~$0.015 |
| Pollinations.ai illustrations | $0.00 (free forever) |
| Printify print + ship softcover | ~$12.00 |
| PayPal fees | 3.49% + $0.49 per transaction |
| **Total cost per $29 softcover order** | **~$13.51** |
| **Gross profit per softcover order** | **~$15.49 (~53% margin)** |

---

## Activation ladder

| Stage | What to add | What unlocks |
|---|---|---|
| ✅ Now | `ANTHROPIC_API_KEY` | Real story generation + Pollinations illustrations |
| Ready to charge | `PAYPAL_CLIENT_ID` + `SECRET` | Real PayPal checkout |
| Ready to ship | Printify webhook function | Auto print + fulfilment |
| Scale | Custom domain + email | Professional brand |
