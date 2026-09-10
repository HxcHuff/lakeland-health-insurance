'use strict';

/**
 * Scheduled reconciliation for the site-scoped HuffSherpa lead relay outbox.
 * The shared implementation keeps retry validation, HMAC signing, bounded
 * Google redirects, PII minimization, and metadata-only logging identical to
 * the submission-created event path.
 *
 * This file is a Lambda-compatibility handler (`exports.handler`). The retry
 * function receives the Lambda event and passes it through so
 * `connectLambda(event)` can run immediately before `getStore`.
 */

const { createRetryHandler } = require('./submission-created.js');

exports.handler = createRetryHandler();
