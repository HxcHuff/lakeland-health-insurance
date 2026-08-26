const VOICE_RULES = [
  ['plain English or plain-language framing', /\bplain[\s-]+(?:english|language)\b/i],
  ['straight-talk or real-talk framing', /\b(?:straight|real)[\s-]+talk\b/i],
  ['no-BS framing', /\bno[\s-]+b\.?\s*s\.?\b/i],
  ['no-nonsense framing', /\bno[\s-]+nonsense\b/i],
  ['real-answers framing', /\breal[\s-]+answers?\b/i],
  ['that-is-it framing', /\bthat'?s\s+it\b/i],
  ['no-sales-pitch framing', /\bno[\s-]+sales[\s-]+pitch\b/i],
  ['for-dummies framing', /\bfor[\s-]+dummies\b/i],
  ['no-offense framing', /\bno[\s-]+offen[cs]e\b/i],
  ['going-broke framing', /\bgoing[\s-]+broke\b/i],
  ['confrontational screwed framing', /\bstop[\s-]+getting[\s-]+screwed\b/i],
  ['brutal-truth framing', /\bbrutal[\s-]+truth\b/i],
  ['cut-through-BS framing', /\b(?:cut(?:ting)?\s+through|skip)\s+(?:the\s+)?b\.?\s*s\.?\b/i],
  ['marketing-fluff framing', /\bmarketing\s+fluff\b/i],
  ['financially-destroyed framing', /\bfinancially\s+destroyed\b/i],
  ['screwed framing', /\bscrew(?:ed|ing)?\s+(?:you|yourself)\b/i],
  ['scam-promotion framing', /\bhow\s+the\s+scam\s+works\b/i]
];

const PROMOTIONAL_VOICE_RULES = [
  ['honest-advice slogan', /\bhonest[\s-]+(?:broker|advice|breakdown)\b/i],
  ['scam-promotion framing', /\b(?:avoid|beat|escape|expose|outsmart|stop)\s+(?:the\s+)?scam\b/i],
  ['reality-check framing', /\breality[\s-]+check\b/i],
  ['pro-tip framing', /\bpro[\s-]+tip\b/i]
];

const PROMOTIONAL_CLAIM_RULES = [
  ['promotional no-cost language', /(?:\b(?:no[\s-]+fees?|no[\s-]+cost(?![\s-]+sharing\b)|zero[\s-]+fees?|costs?\s+(?:you\s+)?(?:absolutely\s+)?nothing)\b|\$0[\s-]+fees?\b)/i],
  ['promotional zero-dollar service language', /(?:\$0\s*(?:\/|[-–—])?\s*(?:(?:client|broker|customer)[\s-]+)?(?:service|consultation|review|help)[\s-]+fees?\b|\b(?:broker[\s-]+help|plan[\s-]+review|client[\s-]+service|consultation)\b[^.!?]{0,35}\bcosts?\s+(?:you\s+)?\$0\b)/i],
  ['promotional frictionless claim', /\bno[\s-]+extra[\s-]+(?:cost(?![\s-]+sharing\b)|hassle|paperwork)\b/i],
  ['call-center comparison', /\b(?:not|rather\s+than)\s+(?:a\s+)?(?:1[\s-]?800\s+(?:number|line)|call[\s-]+center)\b|\b(?:national\s+)?call[\s-]+centers?\s+(?:miss|cannot|can't|do\s+not|don't)\b/i],
  ['guesswork slogan', /\b(?:less|no)\s+guesswork\b/i],
  ['universal eligibility or carrier-scope claim', /(?:^|[.!?]\s+)you\s+(?:do\s+)?qualify\b|\b(?:see\s+what\s+you\s+qualify\s+for|available\s+to\s+everyone|(?:work(?:s|ing)?\s+with|compare|shop|review|represent|access|offer|show)\s+(?:every\s+major|all\s+available)\s+carriers?|(?:broker|agent)\s+(?:can|will)\s+(?:determine|calculate)\s+(?:your\s+)?eligibility)\b/i],
  ['overbroad plan recommendation', /\balmost\s+always\b[^.!?]{0,60}\b(?:best|better)\b|\bbetter\s+than\s+gold\b/i],
  ['unsupported savings promise', /\b(?:save|saving)\s+(?:you\s+)?(?:hundreds|thousands)\b|\b(?:(?:i|we)\s+(?:(?:can|will)\s+)?|(?:this|our|a\s+(?:\d+|five|fifteen|thirty)[\s-]+minute)\s+(?:check|review|service|approach)\s+)guarantee(?:d|s)?\b[^.!?]{0,60}\b(?:save|savings)\b/i],
  ['no-pressure framing', /\bno[\s-]+pressure\b/i],
  ['nobody-tells-you framing', /\bnobody\s+tells\s+you\b/i],
  ['honest-advice slogan', /\bhonest[\s-]+(?:broker|advice|breakdown)\b/i]
];

const PROMOTIONAL_BENEFIT_RULES = [
  ['promotional zero-premium language', /\b(?:get|claim|unlock|secure|find|choose|enroll(?:\s+in)?)\b[^.!?]{0,50}\$0(?:\.0+)?[\s-]+(?:monthly[\s-]+)?premiums?\b/i],
  ['promotional zero-premium range', /\bqualif(?:y|ies)\b[^.!?]{0,60}\b(?:as\s+low\s+as|to)\s*\$0(?:\.0+)?\b|\$0(?:\.0+)?\s*[-–—]\s*\$?\d+(?:\.\d+)?\s*(?:\/\s*month|monthly|per\s+month|premium)/i],
  ['promotional no-cost-sharing language', /\b(?:get|claim|unlock|secure|find|choose|enroll(?:\s+in)?)\b[^.!?]{0,50}\bno[\s-]+cost[\s-]+sharing\b/i]
];

const PROMOTIONAL_NOUN = '(?:help|quotes?|consultations?|services?|reviews?|checks?|comparisons?|guidance|advice|calls?|calculators?|tools?|guides?|downloads?|tips?|brokers?|insurance|coverage|benefits?|money|assessments?|evaluations?|support)';
const PROMOTIONAL_MODIFIER = '[a-z0-9%]+(?:-[a-z0-9%]+)*';

const PROMOTIONAL_FREE = [
  /\b(?:completely|absolutely|totally|always|100%)\s+free\b/i,
  new RegExp(`\\bfree(?:(?:[\\s,–—-]+)${PROMOTIONAL_MODIFIER}){0,5}(?:[\\s,–—-]+)${PROMOTIONAL_NOUN}\\b`, 'i'),
  new RegExp(`\\b${PROMOTIONAL_NOUN}\\s+(?:is|are|remain|remains)\\s+(?:completely\\s+|absolutely\\s+|totally\\s+)?free\\b`, 'i')
];

const JSON_LD_URL_KEYS = new Set([
  '@id', 'url', 'contentUrl', 'embedUrl', 'sameAs', 'item', 'image', 'logo',
  'thumbnailUrl', 'uploadDateUrl'
]);
const JSON_LD_PROMOTIONAL_KEYS = new Set([
  'name', 'headline', 'alternativeHeadline', 'description', 'text', 'caption'
]);
const JSON_LD_PRICE_KEYS = new Set(['price', 'lowPrice', 'highPrice', 'minPrice', 'maxPrice']);

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#x2011;|&#8209;/gi, '-')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function normalize(value) {
  return decodeEntities(value)
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/\b[^\s"'<>/\\]+\.[a-z][a-z0-9]{1,7}\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeUrl(value) {
  const candidate = String(value).trim();
  return /^(?:https?:\/\/|\.{0,2}\/|#|mailto:|tel:|data:|javascript:)/i.test(candidate)
    || /^[^\s]+\.[a-z0-9]{2,8}(?:[?#].*)?$/i.test(candidate);
}

function stripMarkup(value) {
  return String(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normalizedSurfaces(values) {
  return [...new Set(values.map((value) => normalize(stripMarkup(value))).filter(Boolean))];
}

function jsonLdStrings(value, key = '', out = []) {
  if (typeof value === 'string') {
    if (!JSON_LD_URL_KEYS.has(key) && !looksLikeUrl(value)) out.push({ key, value });
  } else if (Array.isArray(value)) {
    value.forEach((item) => jsonLdStrings(item, key, out));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, child]) => jsonLdStrings(child, childKey, out));
  }
  return out;
}

function schemaTypes(value) {
  const types = value?.['@type'];
  if (Array.isArray(types)) return types;
  return types ? [types] : [];
}

function isZeroPriceClaim(value) {
  if (typeof value === 'number') return value === 0;
  if (typeof value !== 'string') return false;
  const claim = normalize(value).trim();
  if (/^(?:free|no[\s-]*(?:fees?|cost))$/i.test(claim)) return true;
  return /^(?:from\s+)?(?:usd\s*)?\$?\s*0(?:\.0+)?(?:\s*(?:usd|dollars?))?\s*$/i.test(claim)
    || /^(?:from\s+)?(?:usd\s*)?\$?\s*0(?:\.0+)?\s*(?:-|to)\s*/i.test(claim);
}

function hasZeroOfferPrice(value) {
  if (Array.isArray(value)) return value.some(hasZeroOfferPrice);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) =>
    (JSON_LD_PRICE_KEYS.has(key) && isZeroPriceClaim(child)) || hasZeroOfferPrice(child)
  );
}

function jsonLdStructuralIssues(value, out = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => jsonLdStructuralIssues(item, out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;

  const offerType = schemaTypes(value).some((type) => ['Offer', 'AggregateOffer', 'OfferCatalog'].includes(type));
  if (offerType && hasZeroOfferPrice(value)) out.add('zero-price JSON-LD Offer claim');
  if (Object.hasOwn(value, 'priceRange') && isZeroPriceClaim(value.priceRange)) {
    out.add('zero-fee JSON-LD priceRange claim');
  }
  Object.values(value).forEach((child) => jsonLdStructuralIssues(child, out));
  return out;
}

function javascriptStringLiterals(source) {
  const strings = [];
  let index = 0;
  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];
    if (current === '/' && next === '/') {
      index = source.indexOf('\n', index + 2);
      if (index === -1) break;
      continue;
    }
    if (current === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (current !== '"' && current !== "'" && current !== '`') {
      index += 1;
      continue;
    }

    const quote = current;
    let value = '';
    index += 1;
    while (index < source.length) {
      const char = source[index];
      if (char === '\\') {
        const escaped = source[index + 1];
        value += escaped === 'n' || escaped === 'r' || escaped === 't' ? ' ' : (escaped || '');
        index += 2;
        continue;
      }
      if (char === quote) {
        index += 1;
        break;
      }
      value += char;
      index += 1;
    }
    if (value && !looksLikeUrl(value)) strings.push(value);
  }
  return strings;
}

export function extractHtmlCopy(html) {
  const source = html.replace(/<!--[\s\S]*?-->/g, ' ');
  const surfaces = [];
  const promotional = [];
  const claims = [];
  const structural = new Set();
  for (const match of source.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)) {
    surfaces.push(match[1]);
    promotional.push(match[1]);
  }
  for (const match of source.matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = match[1];
    const key = attrs.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = attrs.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content && !looksLikeUrl(content) && ['description', 'og:title', 'og:description', 'twitter:title', 'twitter:description'].includes(key)) {
      surfaces.push(content);
      promotional.push(content);
    }
  }
  for (const match of source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const graph = JSON.parse(match[1]);
      const strings = jsonLdStrings(graph);
      surfaces.push(...strings.map(({ value }) => value));
      promotional.push(...strings.filter(({ key }) => JSON_LD_PROMOTIONAL_KEYS.has(key)).map(({ value }) => value));
      jsonLdStructuralIssues(graph, structural);
    } catch {
      // JSON-LD syntax is reported by validate-pages; avoid duplicate noise here.
    }
  }
  for (const match of source.matchAll(/\b(?:alt|title|aria-label|value)\s*=\s*["']([^"']+)["']/gi)) {
    if (!looksLikeUrl(match[1])) {
      surfaces.push(match[1]);
      promotional.push(match[1]);
    }
  }
  for (const match of source.matchAll(/<(h[1-6]|a|button|label|summary|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    promotional.push(match[2]);
  }
  for (const match of source.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) claims.push(match[1]);
  for (const match of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = match[1].replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const content of css.matchAll(/\bcontent\s*:\s*(["'])([\s\S]*?)\1\s*;/gi)) {
      surfaces.push(content[2]);
      promotional.push(content[2]);
    }
  }
  for (const match of source.matchAll(/<template\b[^>]*>([\s\S]*?)<\/template>/gi)) {
    surfaces.push(match[1]);
    for (const element of match[1].matchAll(/<(h[1-6]|a|button|label|summary|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      promotional.push(element[2]);
    }
    for (const paragraph of match[1].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) claims.push(paragraph[1]);
  }
  for (const match of source.matchAll(/<script\b(?![^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi)) {
    const strings = javascriptStringLiterals(match[1]);
    surfaces.push(...strings);
    promotional.push(...strings);
  }
  const visible = source
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<template\b[\s\S]*?<\/template>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  surfaces.push(visible);
  return {
    all: normalizedSurfaces(surfaces),
    promotional: normalizedSurfaces(promotional),
    claims: normalizedSurfaces(claims),
    structural: [...structural]
  };
}

export function extractClientCopy(source) {
  const strings = normalizedSurfaces(javascriptStringLiterals(source));
  return { all: strings, promotional: strings, claims: [], structural: [] };
}

function maskAllowedFree(copy) {
  return copy
    .replace(/\b(?:premium[\s-]+free\s+(?:(?:medicare\s+)?part\s+a)|(?:medicare\s+)?part\s+a[^.!?]{0,30}premium[\s-]+free|(?:tax|toll|phi|tobacco)[\s-]+free|free[\s-]+text|free[\s-]+look(?:\s+period)?)\b/gi, '[allowed-term]')
    .replace(/\b(?:isn't|is not|aren't|are not|not)\s+free\b/gi, '[negated-term]')
    .replace(/\bno\s+["']?free["']?\s+language\b/gi, '[prohibition]')
    .replace(/\bnever\s+say\s+["']?free[^.!?]*/gi, '[prohibition]');
}

const CAUTIONARY_CLAIM_TARGET = /\b(?:no[\s-]+fees?|no[\s-]+cost(?![\s-]+sharing\b)|(?:\$0|zero)[\s-]+fees?|costs?\s+(?:you\s+)?(?:absolutely\s+)?nothing|no[\s-]+pressure|nobody\s+tells\s+you|honest[\s-]+(?:broker|advice|breakdown))\b/gi;

function maskCautionaryClaims(copy) {
  const caution = /\b(?:(?:do not|don't|never)\s+(?:assume|believe|treat|repeat|use|say|promise|claim)|before\s+(?:(?:you|someone)\s+)?assuming|(?:does not|doesn't|do not|don't)\s+mean|(?:is not|isn't|are not|aren't)\s+(?:proof|a\s+(?:guarantee|promise))|be\s+(?:wary|cautious)|beware|misleading|clich[eé]\s+to\s+avoid)\b/i;
  return caution.test(copy) ? copy.replace(CAUTIONARY_CLAIM_TARGET, '[cautioned-claim]') : copy;
}

function maskNeutralCompensation(copy) {
  const compensation = /\b(?:(?:brokers?|agents?)\s+(?:are|may be|can be)\s+(?:typically\s+)?compensated\s+by\s+(?:insurance\s+)?carriers?|(?:insurance\s+)?carriers?\s+(?:may\s+)?(?:pay|compensate)\s+(?:the\s+)?(?:broker|agent)|broker\s+compensation\s+(?:is|may be)\s+paid\s+by\s+(?:insurance\s+)?carriers?)\b/i;
  if (!compensation.test(copy)) return copy;
  return copy
    .replace(/\bno[\s-]+fees?\s+(?:(?:is|are)\s+)?(?:charged|paid|billed|collected)\s+(?:directly\s+)?(?:to|by|from)\s+(?:the\s+)?(?:consumers?|clients?|customers?|you)\b/gi, '[neutral-compensation]')
    .replace(/\b(?:consumers?|clients?|customers?|you)\s+(?:pay|pays)\s+no\s+fees?\b/gi, '[neutral-compensation]');
}

function maskApprovedDirectContactStatement(copy) {
  return copy.replace(
    /(^|[.!?]\s+)this\s+is\s+not\s+a\s+call[\s-]+center(?=[.!?]?\s*$)/gi,
    '$1[approved-direct-contact-statement]'
  );
}

export function findContentPolicyIssues(copy) {
  const all = typeof copy === 'string' ? [normalize(copy)] : (copy?.all || []).map(normalize);
  const promotional = typeof copy === 'string' ? all : (copy?.promotional || []).map(normalize);
  const claims = typeof copy === 'string' ? all : (copy?.claims || []).map(normalize);
  const issues = new Set(typeof copy === 'string' ? [] : (copy?.structural || []));
  for (const surface of all) {
    for (const [label, pattern] of VOICE_RULES) {
      if (pattern.test(surface)) issues.add(label);
    }
    const freeChecked = maskAllowedFree(surface);
    if (PROMOTIONAL_FREE.some((pattern) => pattern.test(freeChecked))) {
      issues.add('promotional free-language');
    }
  }
  for (const surface of promotional) {
    const checked = maskCautionaryClaims(maskNeutralCompensation(surface));
    for (const [label, pattern] of PROMOTIONAL_VOICE_RULES) {
      if (pattern.test(checked)) issues.add(label);
    }
    const freeChecked = maskAllowedFree(checked);
    if (/\bfree\b/i.test(freeChecked)) issues.add('promotional free-language');
  }
  for (const surface of normalizedSurfaces([...promotional, ...claims])) {
    const checked = maskApprovedDirectContactStatement(maskCautionaryClaims(maskNeutralCompensation(surface)));
    for (const [label, pattern] of PROMOTIONAL_CLAIM_RULES) {
      if (pattern.test(checked)) issues.add(label);
    }
    for (const [label, pattern] of PROMOTIONAL_BENEFIT_RULES) {
      if (pattern.test(checked)) issues.add(label);
    }
  }
  return [...issues];
}
