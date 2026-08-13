function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function normalizeText(value) {
  return decodeEntities(value)
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function visibleText(html) {
  return normalizeText(html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<template\b[\s\S]*?<\/template>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function collectFaqPages(value, out = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectFaqPages(item, out));
  } else if (value && typeof value === 'object') {
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.includes('FAQPage')) out.push(value);
    Object.values(value).forEach((item) => collectFaqPages(item, out));
  }
  return out;
}

export function faqParityIssues(html) {
  const issues = [];
  const visible = visibleText(html);
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  blocks.forEach((match, blockIndex) => {
    let data;
    try {
      data = JSON.parse(match[1]);
    } catch {
      return;
    }

    for (const faq of collectFaqPages(data)) {
      const questions = Array.isArray(faq.mainEntity) ? faq.mainEntity : [];
      if (questions.length === 0) {
        issues.push(`JSON-LD block ${blockIndex + 1} has FAQPage without mainEntity questions`);
        continue;
      }

      for (const question of questions) {
        const name = normalizeText(question?.name || '');
        const answer = normalizeText(question?.acceptedAnswer?.text || '');
        if (!name) {
          issues.push(`JSON-LD block ${blockIndex + 1} has FAQ question without a name`);
        } else if (!visible.includes(name)) {
          issues.push(`FAQ schema question is not visible: "${question.name}"`);
        }
        if (!answer) {
          issues.push(`FAQ schema question "${question?.name || 'unnamed'}" has no acceptedAnswer text`);
        } else if (!visible.includes(answer)) {
          issues.push(`FAQ schema answer is not visible for: "${question?.name || 'unnamed'}"`);
        }
      }
    }
  });

  return issues;
}
