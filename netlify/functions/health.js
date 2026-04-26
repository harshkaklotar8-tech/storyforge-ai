/**
 * Netlify Function: health
 * GET /api/health
 * Shows which services are configured vs stub mode.
 */

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        claude:      process.env.ANTHROPIC_API_KEY  ? '✓ configured' : '✗ missing — add ANTHROPIC_API_KEY',
        paypal:      process.env.PAYPAL_CLIENT_ID   ? '✓ configured' : '○ stub mode — add PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET',
        paypalEnv:   process.env.PAYPAL_ENV || 'sandbox',
        illustrations: 'pollinations.ai (free, always on)',
      },
    }),
  };
};
