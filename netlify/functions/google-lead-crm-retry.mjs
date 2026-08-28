import { createRetryHandler } from "./lib/google-ads-crm-relay.mjs";

function getEnv(key) {
  try {
    const value = globalThis.Netlify?.env?.get?.(key);
    if (value !== undefined && value !== null && value !== "") return String(value);
  } catch {
    // process.env is the supported fallback for local scheduled invocations.
  }
  return String(process.env[key] || "");
}

function logger(entry) {
  const line = JSON.stringify(entry);
  if (["FAILED", "QUARANTINED", "ATTENTION_REQUIRED"].includes(entry.outcome)) console.error(line);
  else console.info(line);
}

// A metadata-only ATTENTION_REQUIRED summary is followed by a controlled throw
// so Netlify records a failed scheduled invocation and can notify operators.
export default createRetryHandler({ env: getEnv, logger, failOnAttention: true });
