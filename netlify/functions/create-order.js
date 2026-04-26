/**
 * Netlify Function: create-order
 * POST /api/create-order
 *
 * Creates a PayPal order and returns the approval URL.
 * Customer is redirected to PayPal → pays → returns to /success page.
 *
 * STUB MODE: If PAYPAL_CLIENT_ID is not set, returns a mock response
 * so you can test the full flow without a PayPal account.
 *
 * To activate: add PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET to Netlify env vars.
 * Use sandbox credentials first: developer.paypal.com
 */

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const PRICES = {
  softcover: { amount: '29.00', label: 'Softcover Storybook (24 pages)' },
  hardcover: { amount: '39.00', label: 'Hardcover Gift Edition (24 pages)' },
  digital:   { amount: '9.99',  label: 'Story Club — Monthly Digital Stories' },
};

// ── Get PayPal access token ───────────────────────────────────────────────────
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
  if (!data.access_token) throw new Error('Failed to get PayPal token. Check your credentials.');
  return data.access_token;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { storyId, productType, childName } = JSON.parse(event.body || '{}');

    if (!storyId || !productType) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'storyId and productType are required.' }) };
    }

    const product = PRICES[productType];
    if (!product) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid product type.' }) };
    }

    const siteUrl = process.env.URL || 'http://localhost:8888';

    // ── STUB MODE (no PayPal credentials yet) ─────────────────────────────────
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      console.log(`[create-order] STUB — would create PayPal order: ${productType} $${product.amount} for ${childName}`);
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          success: true,
          stub: true,
          message: `PayPal not yet configured. Would charge $${product.amount} for ${product.label}.`,
          approvalUrl: null,
        }),
      };
    }

    // ── LIVE PAYPAL ───────────────────────────────────────────────────────────
    // Use sandbox for testing, live for production.
    const isSandbox = process.env.PAYPAL_ENV !== 'live';
    const baseUrl   = isSandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const token = await getPayPalToken(baseUrl);

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: storyId,
        description: `${product.label} — starring ${childName}`,
        amount: {
          currency_code: 'USD',
          value: product.amount,
        },
        custom_id: JSON.stringify({ storyId, productType, childName }),
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'StoryForge AI',
            locale: 'en-US',
            landing_page: 'LOGIN',
            shipping_preference: 'GET_FROM_FILE',  // Use address saved in PayPal
            user_action: 'PAY_NOW',
            return_url: `${siteUrl}/success?storyId=${storyId}&product=${productType}&child=${encodeURIComponent(childName)}`,
            cancel_url: `${siteUrl}/#create`,
          },
        },
      },
    };

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': storyId, // idempotency key
      },
      body: JSON.stringify(orderPayload),
    });

    const order = await orderRes.json();

    if (!orderRes.ok) {
      console.error('[create-order] PayPal error:', order);
      throw new Error(order.message || 'PayPal order creation failed.');
    }

    // Find the approval URL (where we redirect the customer)
    const approvalUrl = order.links?.find(l => l.rel === 'payer-action')?.href;

    if (!approvalUrl) {
      throw new Error('No PayPal approval URL returned.');
    }

    console.log(`[create-order] ✓ PayPal order created: ${order.id}`);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ success: true, orderId: order.id, approvalUrl }),
    };

  } catch (err) {
    console.error('[create-order] Error:', err.message);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
