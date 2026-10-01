'use strict';

/**
 * Scheduled drain for the website-to-Vercel lead-bridge outbox.
 * Does not text or email a lead. Missing LEAD_BRIDGE_* is logged as an
 * error and leaves queued records untouched for a later retry.
 */

const { createBridgeRetryHandler } = require('./lib/lead-bridge');

exports.handler = createBridgeRetryHandler();
