'use strict';

/**
 * Retired HuffSherpa website-lead retry.
 *
 * Website leads now go to the Vercel bridge. This handler stays deployed as a
 * no-op so leftover schedules or accidental invokes do not POST to Apps Script.
 */

const { createRetryHandler } = require('./submission-created.js');

exports.handler = createRetryHandler();
