'use strict';

/**
 * Scheduled drain for the website-to-Vercel lead-bridge outbox.
 * Does not text or email a lead. Missing LEAD_BRIDGE_* env vars skip.
 */

const { createBridgeRetryHandler } = require('./lib/lead-bridge');

exports.handler = createBridgeRetryHandler();
