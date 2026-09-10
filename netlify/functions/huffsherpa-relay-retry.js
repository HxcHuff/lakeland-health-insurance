'use strict';

/**
 * Scheduled reconciliation for the site-scoped HuffSherpa lead relay outbox.
 * The shared implementation keeps retry validation, HMAC signing, bounded
 * Google redirects, PII minimization, and metadata-only logging identical to
 * the submission-created event path.
 */

const { createRetryHandler } = require('./submission-created.js');

exports.handler = createRetryHandler();
