import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { ROOT, sha256, stableStringify } from './core.mjs';

export function parseEncryptionKey(value) {
  if (!value) throw new Error('Missing required environment variable LHI_AUDIT_ENCRYPTION_KEY');
  let key;
  if (/^[a-f0-9]{64}$/i.test(value)) key = Buffer.from(value, 'hex');
  else {
    key = Buffer.from(value, 'base64');
    if (key.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, '')) throw new Error('LHI_AUDIT_ENCRYPTION_KEY must be 64 hex characters or base64');
  }
  if (key.length !== 32) throw new Error('LHI_AUDIT_ENCRYPTION_KEY must decode to exactly 32 bytes');
  return key;
}

function derivedKey(masterKey, purpose) {
  return Buffer.from(hkdfSync('sha256', masterKey, Buffer.from('lakeland-audit-v1'), Buffer.from(purpose), 32));
}

export function encryptBuffer(plaintext, masterKey, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', derivedKey(masterKey, 'evidence-encryption'), iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function decryptBuffer(ciphertext, masterKey, aad, iv, tag) {
  const decipher = createDecipheriv('aes-256-gcm', derivedKey(masterKey, 'evidence-encryption'), Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function verifyEncryptedManifest(manifest, masterKey) {
  const { manifestHmac, ...unsigned } = manifest;
  if (!/^[a-f0-9]{64}$/.test(manifestHmac || '')) throw new Error('Encrypted evidence manifest HMAC is missing or malformed');
  const expected = createHmac('sha256', derivedKey(masterKey, 'manifest-authentication')).update(stableStringify(unsigned)).digest();
  const actual = Buffer.from(manifestHmac, 'hex');
  if (!timingSafeEqual(expected, actual)) throw new Error('Encrypted evidence manifest HMAC verification failed');
  return true;
}

function filesForRun(config, runId) {
  const storageRoot = resolve(ROOT, config.storage.root);
  const fixed = [
    join(storageRoot, 'findings', `${runId}.json`),
    join(storageRoot, 'normalized', `${runId}.json`),
    join(storageRoot, 'reports', `${runId}.md`)
  ];
  fixed.forEach((path) => { if (!existsSync(path)) throw new Error(`Run evidence missing: ${relative(ROOT, path)}`); });
  const manifest = JSON.parse(readFileSync(fixed[0], 'utf8'));
  const checksums = new Set(Object.values(manifest.sourceChecksums || {}).map((item) => item.checksum));
  const rawRoot = join(storageRoot, 'raw');
  const selectedRaw = [];
  if (existsSync(rawRoot)) {
    for (const source of readdirSync(rawRoot)) {
      const dir = join(rawRoot, source);
      if (!statSync(dir).isDirectory()) continue;
      for (const name of readdirSync(dir).filter((item) => item.endsWith('.json'))) {
        const path = join(dir, name);
        const envelope = JSON.parse(readFileSync(path, 'utf8'));
        if (checksums.has(envelope.integrity?.payloadSha256)) selectedRaw.push(path);
      }
    }
  }
  const screenshots = [];
  for (const path of selectedRaw) {
    const envelope = JSON.parse(readFileSync(path, 'utf8'));
    if (envelope.source !== 'render-observation') continue;
    for (const row of envelope.payload?.rows || []) {
      if (!row.screenshotPath) continue;
      const screenshot = resolve(ROOT, row.screenshotPath);
      if (!screenshot.startsWith(`${storageRoot}/`)) throw new Error('Screenshot path escaped the evidence root');
      if (existsSync(screenshot)) screenshots.push(screenshot);
    }
  }
  const governance = join(storageRoot, 'governance', 'decisions.jsonl');
  return [...new Set([...fixed, ...selectedRaw, ...screenshots, ...(existsSync(governance) ? [governance] : [])])].sort();
}

export function encryptRunEvidence(config, runId, masterKey, { now = new Date() } = {}) {
  const storageRoot = resolve(ROOT, config.storage.root);
  const encryptedRoot = join(storageRoot, 'encrypted');
  const destination = join(encryptedRoot, runId);
  if (existsSync(destination)) throw new Error(`Encrypted evidence bundle already exists: ${runId}`);
  mkdirSync(encryptedRoot, { recursive: true, mode: 0o700 });
  const temporary = join(encryptedRoot, `.pending-${runId}-${process.pid}`);
  mkdirSync(join(temporary, 'files'), { recursive: true, mode: 0o700 });
  try {
    const entries = [];
    for (const path of filesForRun(config, runId)) {
      const relativePath = relative(ROOT, path);
      const plaintext = readFileSync(path);
      const encrypted = encryptBuffer(plaintext, masterKey, relativePath);
      const encryptedFile = `files/${sha256(relativePath)}.enc`;
      writeFileSync(join(temporary, encryptedFile), encrypted.ciphertext, { flag: 'wx', mode: 0o600 });
      entries.push({
        relativePath,
        encryptedFile,
        plaintextBytes: plaintext.length,
        plaintextSha256: sha256(plaintext),
        ciphertextSha256: sha256(encrypted.ciphertext),
        iv: encrypted.iv,
        tag: encrypted.tag
      });
    }
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + config.automation.retentionDays * 86_400_000).toISOString();
    const unsigned = { schemaVersion: 1, runId, createdAt, expiresAt, algorithm: 'AES-256-GCM', keyStored: false, files: entries };
    const manifestHmac = createHmac('sha256', derivedKey(masterKey, 'manifest-authentication')).update(stableStringify(unsigned)).digest('hex');
    writeFileSync(join(temporary, 'manifest.json'), `${JSON.stringify({ ...unsigned, manifestHmac }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    renameSync(temporary, destination);
    return { destination, files: entries.length, expiresAt, manifestHmac };
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

export function retentionPlan(config, { now = new Date() } = {}) {
  const root = resolve(ROOT, config.storage.root, 'encrypted');
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((name) => !name.startsWith('.pending-')).map((name) => {
    const path = join(root, name);
    const manifestPath = join(path, 'manifest.json');
    if (!statSync(path).isDirectory() || !existsSync(manifestPath)) throw new Error(`Encrypted evidence bundle is malformed: ${name}`);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const createdAt = new Date(manifest.createdAt);
    const expiresAt = new Date(manifest.expiresAt);
    if (manifest.runId !== name) throw new Error(`Encrypted evidence bundle runId does not match its directory: ${name}`);
    if (!Number.isFinite(createdAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= createdAt) {
      throw new Error(`Encrypted evidence bundle has invalid retention dates: ${name}`);
    }
    return { runId: manifest.runId, path, manifestPath, expiresAt: expiresAt.toISOString(), expired: expiresAt <= now };
  }).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

export function pruneExpiredEvidence(config, { execute = false, masterKey = null, now = new Date() } = {}) {
  const candidates = retentionPlan(config, { now });
  if (execute) {
    if (!masterKey) throw new Error('Retention deletion requires LHI_AUDIT_ENCRYPTION_KEY to verify each manifest');
    for (const item of candidates) verifyEncryptedManifest(JSON.parse(readFileSync(item.manifestPath, 'utf8')), masterKey);
  }
  const expired = candidates.filter((item) => item.expired);
  if (execute) {
    const root = resolve(ROOT, config.storage.root, 'encrypted');
    for (const item of expired) {
      if (dirname(item.path) !== root || basename(item.path) !== item.runId) throw new Error('Retention target failed boundary validation');
      rmSync(item.path, { recursive: true, force: false });
    }
  }
  return { execute, retentionDays: config.automation.retentionDays, expired: expired.map((item) => ({ runId: item.runId, expiresAt: item.expiresAt })) };
}
