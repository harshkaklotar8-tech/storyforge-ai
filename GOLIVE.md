# StoryForge AI — Go Live Guide
## No terminal needed. Everything done in a browser.

---

## STEP 1 — Upload to GitHub (2 minutes)

1. Go to **github.com** → sign in → click **"New repository"**
2. Name it `storyforge-ai` → click **Create repository**
3. On the next page, click **"uploading an existing file"**
4. Unzip the downloaded ZIP on your computer
5. Drag ALL files and folders into the GitHub upload area
6. Click **"Commit changes"**

---

## STEP 2 — Deploy to Netlify (2 minutes)

1. Go to **netlify.com** → sign up free (use GitHub to sign in)
2. Click **"Add new site"** → **"Import an existing project"**
3. Click **GitHub** → select your `storyforge-ai` repo
4. Build settings — leave everything blank, Netlify reads `netlify.toml` automatically
5. Click **"Deploy site"**
6. Wait ~60 seconds → your site is live at something like `https://rainbow-stardust-123.netlify.app`

---

## STEP 3 — Add your keys (5 minutes)

Go to: **Netlify Dashboard → your site → Site Configuration → Environment Variables → Add variable**

Add these one by one:

### Must add NOW (site won't work without this):
| Key | Value | Where to get it |
|-----|-------|-----------------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | console.anthropic.com → API Keys |

### Add for PayPal (sandbox = test mode, fake money):
| Key | Value | Where to get it |
|-----|-------|-----------------|
| `PAYPAL_CLIENT_ID` | your sandbox client ID | developer.paypal.com → My Apps & Credentials → Sandbox tab → Create App |
| `PAYPAL_CLIENT_SECRET` | your sandbox secret | same page as above |
| `PAYPAL_ENV` | `sandbox` | just type this exactly |
| `PAYPAL_WEBHOOK_ID` | your webhook ID | see Step 4 below |

### Add for Printify:
| Key | Value | Where to get it |
|-----|-------|-----------------|
| `PRINTIFY_API_KEY` | your API key | printify.com → top-right avatar → Connections → API |
| `PRINTIFY_SHOP_ID` | your shop ID | visible in your Printify dashboard URL after `/shop/` |
| `PRINTIFY_PROVIDER_ID` | `26` | 26 = Printify Express US (change if you use a different provider) |
| `PRINTIFY_BLUEPRINT_SOFTCOVER` | blueprint ID | see Step 5 below |
| `PRINTIFY_BLUEPRINT_HARDCOVER` | blueprint ID | see Step 5 below |
| `PRINTIFY_VARIANT_SOFTCOVER` | variant ID | see Step 5 below |
| `PRINTIFY_VARIANT_HARDCOVER` | variant ID | see Step 5 below |

### Add for Email:
| Key | Value | Where to get it |
|-----|-------|-----------------|
| `SMTP2GO_API_KEY` | your API key | smtp2go.com → free signup → Settings → API Keys |
| `EMAIL_FROM` | `StoryForge AI <you@gmail.com>` | your Gmail (verify it in smtp2go first) |

**After adding all variables → click "Trigger deploy" → Deploys tab → Trigger deploy**

---

## STEP 4 — Set up PayPal Webhook (3 minutes)

The webhook tells your site when someone has paid, so it triggers printing.

1. Go to **developer.paypal.com** → log in
2. Click **"My Apps & Credentials"** → **Sandbox** tab → click your app
3. Scroll down to **"Webhooks"** → click **"Add Webhook"**
4. Webhook URL: `https://YOUR-SITE.netlify.app/api/paypal-webhook`
   *(replace YOUR-SITE with your actual Netlify site name)*
5. Under "Event types" → select **CHECKOUT.ORDER.APPROVED**
6. Click **Save**
7. Click on the webhook you just created → copy the **Webhook ID**
8. Go back to Netlify → add `PAYPAL_WEBHOOK_ID` = that ID → trigger redeploy

---

## STEP 5 — Set up Printify Products (10 minutes)

You need to create actual products in Printify so they know what to print.

1. Go to **printify.com** → **My products** → **Add new product**
2. Search for **"photo book"** or **"layflat photo book"** → choose one
3. Select a print provider (Printify Express if in US, or whichever covers your market)
4. Upload a sample cover image for now (you'll replace with real PDFs later)
5. Set title → Save as draft (don't publish to a store)
6. **Get the Blueprint ID:** look at the URL — `printify.com/app/product/BLUEPRINT_ID/...`
7. **Get the Variant ID:** in the product editor, right-click → Inspect → find `variant_id` in the network tab, OR email Printify support and ask for the variant ID for your chosen size
8. Repeat for softcover and hardcover
9. Add all 4 IDs to Netlify env vars

---

## STEP 6 — Test the full flow

1. Open your Netlify site
2. Fill in the form → click Generate → story + illustrations appear ✓
3. Click **Softcover $29** → PayPal sandbox checkout opens ✓
4. Log in with a **PayPal sandbox buyer account** (get one from developer.paypal.com → Sandbox → Accounts)
5. Complete the payment with fake money
6. You get redirected to `/success` page ✓
7. Check Netlify logs (Netlify → Functions → paypal-webhook → logs) → should show Printify order created ✓
8. Check your Gmail → confirmation email received ✓

---

## STEP 7 — Go live with real money

When testing works perfectly:

1. **PayPal:** Go to developer.paypal.com → switch to **Live** tab → create a Live app → get Live credentials
2. In Netlify env vars: replace `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` with Live values
3. Change `PAYPAL_ENV` from `sandbox` to `live`
4. Create a new Live webhook (same as Step 4, but in Live tab) → update `PAYPAL_WEBHOOK_ID`
5. Trigger redeploy → you're live and accepting real payments

---

## STEP 8 — Custom domain (optional, $10/year)

1. Buy domain at **namecheap.com** (e.g. `storyforgeai.com`)
2. Netlify → your site → **Domain management** → **Add custom domain**
3. Type your domain → follow the DNS instructions Netlify shows
4. SSL certificate added automatically and free
5. Done — your site is now at `storyforgeai.com`

---

## Health check

Once live, visit: `https://your-site.netlify.app/api/health`

You'll see which services are configured vs still in stub mode:
```json
{
  "services": {
    "claude": "✓ configured",
    "paypal": "✓ configured",
    "printify": "✓ configured",
    "illustrations": "pollinations.ai (free, always on)"
  }
}
```

---

## Cost summary (per order)

| Item | Cost |
|------|------|
| Netlify hosting | Free |
| Claude API (story) | ~$0.015 |
| Pollinations.ai (illustrations) | $0.00 |
| smtp2go (email) | $0.00 |
| PayPal fees | 3.49% + $0.49 |
| Printify softcover print + ship | ~$12.00 |
| **Total per $29 order** | **~$13.50** |
| **Profit per order** | **~$15.50** |

---

## Full status checklist

- [x] Marketing website
- [x] Claude story generation
- [x] Pollinations.ai illustrations (free)
- [x] PayPal checkout
- [x] PayPal webhook → Printify auto-fulfilment
- [x] Confirmation email (smtp2go + Gmail)
- [x] Success page
- [ ] Add your API keys to Netlify
- [ ] Set up PayPal webhook URL
- [ ] Set up Printify products + get blueprint/variant IDs
- [ ] Test full flow with sandbox
- [ ] Switch to PayPal live → take real money
