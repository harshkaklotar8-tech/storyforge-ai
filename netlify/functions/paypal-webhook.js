/**
 * Netlify Function: paypal-webhook
 * POST /api/paypal-webhook
 *
 * PayPal calls this URL after a payment is completed.
 * This function:
 *   1. Verifies the event is genuinely from PayPal
 *   2. Extracts order details (storyId, productType, childName, shipping address)
 *   3. Creates a Printify print order → book gets printed and shipped automatically
 *   4. Sends a confirmation email to the customer
 *
 * STUB MODE: Works without any credentials — logs what would happen.
 * Activate each step by adding env vars to Netlify (see README).
 */

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

// ─── PayPal webhook signature verification ────────────────────────────────────
// PayPal sends a set of headers with every webhook. We call PayPal's API
// to verify the signature before trusting the payload.
async function verifyPayPalWebhook({ headers, rawBody, baseUrl, accessToken }) {
  const verifyPayload = {
    auth_algo:         headers['paypal-auth-algo'],
    cert_url:          headers['paypal-cert-url'],
    transmission_id:   headers['paypal-transmission-id'],
    transmission_sig:  headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id:        process.env.PAYPAL_WEBHOOK_ID,
    webhook_event:     JSON.parse(rawBody),
  };

  const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verifyPayload),
  });

  const data = await res.json();
  // PayPal returns { "verification_status": "SUCCESS" } if valid
  return data.verification_status === 'SUCCESS';
}

// ─── Get PayPal access token ──────────────────────────────────────────────────
async function getPayPalToken(baseUrl) {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get PayPal token.');
  return data.access_token;
}

// ─── Printify: create print order ────────────────────────────────────────────
async function createPrintifyOrder({ storyId, productType, childName, shippingAddress, customerEmail }) {
  // ── STUB ──────────────────────────────────────────────────────────────────
  if (!process.env.PRINTIFY_API_KEY || !process.env.PRINTIFY_SHOP_ID) {
    console.log('[printify] STUB — would create print order:');
    console.log(`  storyId:      ${storyId}`);
    console.log(`  product:      ${productType}`);
    console.log(`  child:        ${childName}`);
    console.log(`  ship to:      ${JSON.stringify(shippingAddress)}`);
    console.log('  To activate: add PRINTIFY_API_KEY + PRINTIFY_SHOP_ID + PRINTIFY_BLUEPRINT_* to Netlify env vars');
    return { stub: true, message: 'Printify not yet configured.' };
  }

  // ── LIVE ──────────────────────────────────────────────────────────────────
  // Blueprint IDs come from your Printify product catalogue.
  // Set them up in Printify first, then add the IDs to Netlify env vars.
  // How to find them: Printify dashboard → My products → click a product → URL contains blueprint ID
  //
  // The PDF URL is where your generated storybook PDF is hosted.
  // You'll need to generate the PDF (e.g. with Puppeteer) and store it
  // somewhere public (e.g. Netlify Blobs, Cloudflare R2, AWS S3).
  // For now we use a placeholder URL — replace with your actual PDF storage URL.

  const BLUEPRINTS = {
    softcover: {
      blueprint_id:      process.env.PRINTIFY_BLUEPRINT_SOFTCOVER,
      print_provider_id: parseInt(process.env.PRINTIFY_PROVIDER_ID || '0'),
      variant_id:        parseInt(process.env.PRINTIFY_VARIANT_SOFTCOVER || '0'),
    },
    hardcover: {
      blueprint_id:      process.env.PRINTIFY_BLUEPRINT_HARDCOVER,
      print_provider_id: parseInt(process.env.PRINTIFY_PROVIDER_ID || '0'),
      variant_id:        parseInt(process.env.PRINTIFY_VARIANT_HARDCOVER || '0'),
    },
  };

  const blueprint = BLUEPRINTS[productType] || BLUEPRINTS.softcover;

  // PDF URL — your generated book PDF must be publicly accessible.
  // Replace PDF_STORAGE_URL with wherever you store generated PDFs.
  const pdfUrl = process.env.PDF_STORAGE_URL
    ? `${process.env.PDF_STORAGE_URL}/${storyId}.pdf`
    : `https://placeholder.storyforgeai.com/books/${storyId}.pdf`;

  const orderPayload = {
    label: `StoryForge — ${childName} (${storyId})`,
    line_items: [
      {
        blueprint_id:      blueprint.blueprint_id,
        print_provider_id: blueprint.print_provider_id,
        variant_id:        blueprint.variant_id,
        print_areas: {
          // Printify expects print file URLs per print area.
          // For a book, this is typically 'front' (cover) and 'back' (interior).
          // Adjust these keys based on your Printify product's print areas.
          front: pdfUrl,
        },
        quantity: 1,
      },
    ],
    shipping_method: 1,          // Standard shipping (1 = cheapest available)
    send_shipping_notification: true,  // Printify emails tracking to customer
    address_to: {
      first_name: shippingAddress.firstName || 'Customer',
      last_name:  shippingAddress.lastName  || '',
      email:      customerEmail             || '',
      phone:      shippingAddress.phone     || '',
      address1:   shippingAddress.line1     || '',
      address2:   shippingAddress.line2     || '',
      city:       shippingAddress.city      || '',
      state:      shippingAddress.state     || '',
      zip:        shippingAddress.postalCode || '',
      country:    shippingAddress.country   || 'US',
    },
  };

  console.log('[printify] Creating order:', JSON.stringify(orderPayload, null, 2));

  const res = await fetch(
    `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/orders.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    }
  );

  const result = await res.json();

  if (!res.ok) {
    console.error('[printify] Order failed:', result);
    throw new Error(result.message || 'Printify order creation failed.');
  }

  console.log(`[printify] ✓ Order created: ${result.id}`);
  return result;
}

// ─── Send confirmation email via Gmail SMTP (using smtp2go as relay) ─────────
// Netlify Functions can't use nodemailer directly (no persistent connections).
// We use smtp2go.com free tier (1,000 emails/month free) which accepts plain
// HTTPS API calls — no npm package needed, works perfectly in serverless.
//
// HOW TO SET UP (5 minutes):
//   1. Go to smtp2go.com → sign up free
//   2. Add your Gmail as a sender address → verify it
//   3. Go to Settings → API Keys → create one
//   4. Add SMTP2GO_API_KEY and EMAIL_FROM to Netlify env vars
async function sendConfirmationEmail({ customerEmail, childName, productType, storyId }) {
  // ── STUB ──────────────────────────────────────────────────────────────────
  if (!process.env.SMTP2GO_API_KEY || !customerEmail) {
    console.log(`[email] STUB — would send confirmation to: ${customerEmail}`);
    console.log('  To activate: sign up at smtp2go.com (free), add SMTP2GO_API_KEY + EMAIL_FROM to Netlify env vars');
    return;
  }

  const productNames = {
    softcover: 'Softcover Storybook',
    hardcover: 'Hardcover Gift Edition',
    digital:   'Story Club Membership',
  };

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:540px;margin:0 auto;color:#1A1208;">
      <div style="background:#2D5A27;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="font-family:Georgia,serif;color:#FAF7F2;margin:0;font-size:1.5rem;">✦ StoryForge AI</h1>
      </div>
      <div style="background:#FAF7F2;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d0;border-top:none;">
        <h2 style="font-family:Georgia,serif;color:#2C1F0E;margin:0 0 12px;">🎉 ${childName}'s book is being printed!</h2>
        <p style="color:#7A6845;line-height:1.75;margin-bottom:20px;">
          Thank you for your order. We've sent <strong>${childName}'s</strong>
          <strong>${productNames[productType] || 'storybook'}</strong> to our print partner.
          Once it ships, you'll get a tracking number automatically.
        </p>
        <div style="background:#E8F4E6;border-radius:10px;padding:18px 22px;margin-bottom:24px;">
          <table style="width:100%;font-size:0.875rem;color:#2D5A27;border-collapse:collapse;">
            <tr><td style="padding:4px 0;"><strong style="color:#2C1F0E;">Order ref</strong></td><td style="text-align:right;">${storyId}</td></tr>
            <tr><td style="padding:4px 0;"><strong style="color:#2C1F0E;">Product</strong></td><td style="text-align:right;">${productNames[productType] || productType}</td></tr>
            <tr><td style="padding:4px 0;"><strong style="color:#2C1F0E;">Est. delivery</strong></td><td style="text-align:right;">3–7 business days</td></tr>
          </table>
        </div>
        <p style="color:#AE9870;font-size:0.8rem;border-top:1px solid #e8e0d0;padding-top:16px;margin:0;">
          Questions? Reply to this email. © 2026 StoryForge AI
        </p>
      </div>
    </div>`;

  // ── LIVE — smtp2go API call ────────────────────────────────────────────────
  const res = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:  process.env.SMTP2GO_API_KEY,
      to:       [`${customerEmail}`],
      sender:   process.env.EMAIL_FROM || 'StoryForge AI <hello@storyforgeai.com>',
      subject:  `🎉 ${childName}'s storybook is on its way!`,
      html_body: html,
    }),
  });

  const result = await res.json();
  if (result.data?.succeeded) {
    console.log(`[email] ✓ Confirmation sent to: ${customerEmail}`);
  } else {
    console.error('[email] Failed:', JSON.stringify(result));
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const rawBody = event.body;
    let webhookEvent;

    try {
      webhookEvent = JSON.parse(rawBody);
    } catch {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    // ── Verify PayPal signature (skip in stub mode) ───────────────────────────
    if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_WEBHOOK_ID) {
      const isSandbox  = process.env.PAYPAL_ENV !== 'live';
      const baseUrl    = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
      const token      = await getPayPalToken(baseUrl);
      const isValid    = await verifyPayPalWebhook({
        headers:  event.headers,
        rawBody,
        baseUrl,
        accessToken: token,
      });

      if (!isValid) {
        console.error('[webhook] PayPal signature verification FAILED');
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid webhook signature' }) };
      }

      console.log('[webhook] ✓ PayPal signature verified');
    } else {
      console.log('[webhook] STUB — skipping PayPal signature verification (no credentials set)');
    }

    // ── Handle CHECKOUT.ORDER.APPROVED — payment completed ────────────────────
    // PayPal event types: https://developer.paypal.com/api/rest/webhooks/event-names/
    const eventType = webhookEvent.event_type;
    console.log(`[webhook] Event type: ${eventType}`);

    if (eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource     = webhookEvent.resource || {};

      // Extract custom_id — we passed storyId, productType, childName as JSON string
      // PayPal stores it in purchase_units[0].custom_id
      const purchaseUnit = resource.purchase_units?.[0] || {};
      let storyId, productType, childName;

      try {
        const custom = JSON.parse(purchaseUnit.custom_id || '{}');
        storyId     = custom.storyId;
        productType = custom.productType;
        childName   = custom.childName;
      } catch {
        // Fallback: try reading from reference_id
        storyId = purchaseUnit.reference_id;
        console.warn('[webhook] Could not parse custom_id — using reference_id as storyId');
      }

      // Extract shipping address from PayPal payload
      const shipping = purchaseUnit.shipping || {};
      const addr     = shipping.address || {};
      const nameParts = (shipping.name?.full_name || '').split(' ');

      const shippingAddress = {
        firstName:  nameParts[0]          || '',
        lastName:   nameParts.slice(1).join(' ') || '',
        line1:      addr.address_line_1   || '',
        line2:      addr.address_line_2   || '',
        city:       addr.admin_area_2     || '',
        state:      addr.admin_area_1     || '',
        postalCode: addr.postal_code      || '',
        country:    addr.country_code     || 'US',
        phone:      '',
      };

      // Extract customer email
      const customerEmail = resource.payer?.email_address || '';

      console.log(`[webhook] Processing: storyId=${storyId}, product=${productType}, child=${childName}`);
      console.log(`[webhook] Ship to: ${shippingAddress.firstName} ${shippingAddress.lastName}, ${shippingAddress.city}, ${shippingAddress.country}`);

      // ── Step 1: Printify print order ────────────────────────────────────────
      await createPrintifyOrder({ storyId, productType, childName, shippingAddress, customerEmail });

      // ── Step 2: Confirmation email ───────────────────────────────────────────
      await sendConfirmationEmail({ customerEmail, childName, productType, storyId });

      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ received: true, processed: eventType }),
      };
    }

    // All other event types — acknowledge receipt but take no action
    console.log(`[webhook] Ignoring event type: ${eventType}`);
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ received: true, processed: false }),
    };

  } catch (err) {
    console.error('[webhook] Fatal error:', err.message);
    // Always return 200 to PayPal — otherwise it retries repeatedly.
    // Log the error internally but don't expose it.
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ received: true, error: 'Internal error — check logs' }),
    };
  }
};
