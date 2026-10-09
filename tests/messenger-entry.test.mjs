import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY_SRC = readFileSync(join(ROOT, 'js/messenger-entry.js'), 'utf8');
const CHAT_WIDGET_SRC = readFileSync(join(ROOT, 'js/chat-widget.js'), 'utf8');
const SITE_TEMPLATE_SRC = readFileSync(join(ROOT, 'js/site-template.js'), 'utf8');
const HOME = readFileSync(join(ROOT, 'index.html'), 'utf8');
const BOOK = readFileSync(join(ROOT, 'book/index.html'), 'utf8');
const MEDICARE = readFileSync(join(ROOT, 'medicare/index.html'), 'utf8');
const BLOG = readFileSync(join(ROOT, 'blog/index.html'), 'utf8');
const ENTRY_HREF = '/js/messenger-entry.js?v=20261006-messenger';
const PAGE_ID = '1068037236387352';
const GREETING = 'Hi, this is David Huff, a licensed health insurance agent here in Lakeland. What can I help you with?';
const SKIP_DIRS = new Set([
  '.ai-worker-local',
  '.claude',
  '.git',
  '.netlify',
  '.playwright-cli',
  'audit',
  'docs',
  'netlify',
  'node_modules',
  'output',
  'scripts',
  'search-engine-from-zip',
  'tests'
]);

function walkHtml(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkHtml(full, out);
    else if (extname(name) === '.html') out.push(full);
  }
  return out;
}

function makeNode(tagName) {
  const attrs = new Map();
  const node = {
    tagName: String(tagName).toUpperCase(),
    className: '',
    href: '',
    target: '',
    rel: '',
    innerHTML: '',
    parentNode: null,
    children: [],
    listeners: {},
    classList: {
      contains(name) {
        return String(node.className || '').split(/\s+/).includes(name);
      }
    },
    setAttribute(name, value) {
      attrs.set(String(name), String(value));
      if (name === 'class') node.className = String(value);
      if (name === 'href') node.href = String(value);
    },
    getAttribute(name) {
      if (name === 'class') return node.className;
      if (name === 'href') return node.href;
      return attrs.has(String(name)) ? attrs.get(String(name)) : null;
    },
    hasAttribute(name) {
      return attrs.has(String(name)) || (name === 'class' && Boolean(node.className));
    },
    appendChild(child) {
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    remove() {
      if (!node.parentNode) return;
      node.parentNode.children = node.parentNode.children.filter((child) => child !== node);
      node.parentNode = null;
    },
    addEventListener(type, handler) {
      node.listeners[type] = node.listeners[type] || [];
      node.listeners[type].push(handler);
    },
    matches(selector) {
      return matchSelector(node, selector);
    },
    querySelector(selector) {
      return queryAll(node, selector)[0] || null;
    },
    querySelectorAll(selector) {
      return queryAll(node, selector);
    }
  };
  return node;
}

function matchSelector(node, selector) {
  const parts = String(selector).split(',').map((part) => part.trim()).filter(Boolean);
  return parts.some((part) => matchSimple(node, part));
}

function matchSimple(node, selector) {
  if (selector === 'body') return node.tagName === 'BODY';
  if (selector.startsWith('#')) return node.getAttribute('id') === selector.slice(1);
  const attr = selector.match(/^([a-z0-9-]*)\.([a-z0-9_-]+)(?:\[([a-z0-9_-]+)\])?$/i);
  if (attr) {
    const [, tag, className, attribute] = attr;
    if (tag && node.tagName !== tag.toUpperCase()) return false;
    if (!String(node.className || '').split(/\s+/).includes(className)) return false;
    if (attribute && !node.hasAttribute(attribute)) return false;
    return true;
  }
  const classOnly = selector.match(/^\.([a-z0-9_-]+)$/i);
  if (classOnly) return String(node.className || '').split(/\s+/).includes(classOnly[1]);
  return false;
}

function queryAll(root, selector) {
  const found = [];
  const walk = (node) => {
    if (matchSelector(node, selector)) found.push(node);
    for (const child of node.children || []) walk(child);
  };
  for (const child of root.children || []) walk(child);
  if (root.tagName === 'BODY' && matchSelector(root, selector)) found.unshift(root);
  return found;
}

function loadEntry({
  pathname = '/',
  readyState = 'complete',
  withFloatingActions = false,
  trackMessengerClick,
  lhiTrack,
  gtag
} = {}) {
  const body = makeNode('body');
  body.tagName = 'BODY';
  let floating = null;
  if (withFloatingActions) {
    floating = makeNode('div');
    floating.className = 'floating-actions';
    body.appendChild(floating);
  }
  const document = {
    readyState,
    body,
    listeners: {},
    createElement: makeNode,
    querySelector(selector) {
      if (selector === 'body') return body;
      return body.querySelector(selector);
    },
    querySelectorAll(selector) {
      return body.querySelectorAll(selector);
    },
    addEventListener(type, handler) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(handler);
    }
  };
  const timeouts = [];
  const sandbox = {
    __LHI_TEST: true,
    __LHI_MESSENGER_ENTRY_LOADED__: false,
    document,
    location: { pathname },
    window: null,
    MutationObserver: undefined,
    setTimeout(fn) {
      timeouts.push(fn);
      return timeouts.length;
    },
    trackMessengerClick,
    gtag,
    LHI: lhiTrack ? { track: lhiTrack } : undefined
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(ENTRY_SRC, sandbox, { filename: 'messenger-entry.js' });
  return { sandbox, document, body, floating, timeouts };
}

test('messenger helper is scoped to the three Facey-approved routes', () => {
  const { sandbox } = loadEntry({ pathname: '/about/' });
  const api = sandbox.LHIMessengerEntry;
  assert.equal(api.ALLOWED_PATHS.join(','), '/,/book/,/medicare/');
  assert.equal(api.PAGE_ID, PAGE_ID);
  assert.equal(api.GREETING, GREETING);
  assert.equal(api.normalizePath('/index.html'), '/');
  assert.equal(api.normalizePath('/book/index.html'), '/book/');
  assert.equal(api.normalizePath('/medicare'), '/medicare/');
  assert.equal(api.isAllowedPath('/'), true);
  assert.equal(api.isAllowedPath('/book/'), true);
  assert.equal(api.isAllowedPath('/medicare/'), true);
  assert.equal(api.isAllowedPath('/medicare/east-polk/'), false);
  assert.equal(api.isAllowedPath('/blog/'), false);
  assert.equal(api.isAllowedPath('/about/'), false);
});

test('m.me href uses Page 1068037236387352 and the licensed-agent greeting', () => {
  const { sandbox } = loadEntry({ pathname: '/about/' });
  const href = sandbox.LHIMessengerEntry.buildHref();
  assert.equal(href, `https://m.me/${PAGE_ID}?text=${encodeURIComponent(GREETING)}`);
  assert.ok(href.includes(PAGE_ID));
  assert.match(href, /licensed%20health%20insurance%20agent/);
  assert.doesNotMatch(href, /HealthMarkets|customer_chat|fb-customer-chat/i);
});

test('homepage injects one body-level messenger button after chrome is present', () => {
  const { sandbox, body, floating } = loadEntry({
    pathname: '/',
    withFloatingActions: true
  });
  const button = sandbox.LHIMessengerEntry.mount('/');
  assert.ok(button);
  assert.equal(button.parentNode, body);
  assert.notEqual(button.parentNode, floating);
  assert.equal(button.getAttribute('data-lhi-page-inbox'), PAGE_ID);
  assert.equal(button.getAttribute('aria-label'), GREETING);
  assert.equal(button.getAttribute('title'), GREETING);
  assert.match(button.href, new RegExp(`m\\.me/${PAGE_ID}`));
  assert.match(button.innerHTML, /Message us/);
  assert.equal(body.querySelectorAll('.messenger-button[data-lhi-page-inbox]').length, 1);
  assert.equal(sandbox.LHIMessengerEntry.mount('/'), button);
});

test('book and medicare host the button inside existing floating-actions', () => {
  for (const pathname of ['/book/', '/medicare/']) {
    const { sandbox, floating } = loadEntry({
      pathname,
      withFloatingActions: true
    });
    const button = sandbox.LHIMessengerEntry.mount(pathname);
    assert.equal(button.parentNode, floating);
    assert.equal(floating.getAttribute('aria-label'), 'Call or message David Huff');
    assert.match(button.href, new RegExp(`m\\.me/${PAGE_ID}\\?text=`));
  }
});

test('off-allowlist paths do not inject a floating messenger button', () => {
  for (const pathname of ['/blog/', '/medicare/east-polk/', '/about/', '/contact/']) {
    const { sandbox, body } = loadEntry({ pathname, withFloatingActions: true });
    assert.equal(sandbox.LHIMessengerEntry.mount(pathname), null);
    assert.equal(body.querySelector('.messenger-button'), null);
  }
});

test('clicks reuse homepage trackMessengerClick or funnel messenger_click', () => {
  const homeCalls = [];
  const { sandbox: homeSandbox } = loadEntry({
    pathname: '/',
    trackMessengerClick() { homeCalls.push('home'); }
  });
  const homeButton = homeSandbox.LHIMessengerEntry.mount('/');
  homeButton.listeners.click[0]();
  assert.equal(homeCalls.join(','), 'home');

  const funnelCalls = [];
  const { sandbox: bookSandbox } = loadEntry({
    pathname: '/book/',
    withFloatingActions: true,
    lhiTrack(name, payload) { funnelCalls.push([name, payload.content_name]); }
  });
  const bookButton = bookSandbox.LHIMessengerEntry.mount('/book/');
  bookButton.listeners.click[0]();
  assert.equal(funnelCalls.length, 1);
  assert.equal(funnelCalls[0][0], 'messenger_click');
  assert.equal(funnelCalls[0][1], 'book_messenger_click');
});

test('chat-widget leaves the marked page-inbox button in place', () => {
  const marked = makeNode('a');
  marked.className = 'messenger-button';
  marked.setAttribute('data-lhi-page-inbox', PAGE_ID);
  const stray = makeNode('a');
  stray.className = 'messenger-button';
  const chat = makeNode('button');
  chat.className = 'chat-widget-button';
  const removed = [];
  marked.remove = () => { removed.push('marked'); };
  stray.remove = () => { removed.push('stray'); };
  chat.remove = () => { removed.push('chat'); };

  const sandbox = {
    __LHI_CHAT_WIDGET_LOADED__: false,
    document: {
      head: { appendChild() {} },
      body: { appendChild() {} },
      createElement() { return { textContent: '', className: '', href: '', setAttribute() {}, innerHTML: '', addEventListener() {} }; },
      querySelector() { return { innerHTML: '', href: '', addEventListener() {}, setAttribute() {} }; },
      querySelectorAll(selector) {
        if (selector.includes('messenger-button')) return [marked, stray, chat];
        return [];
      }
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CHAT_WIDGET_SRC, sandbox, { filename: 'chat-widget.js' });
  assert.deepEqual(removed, ['stray', 'chat']);
});

test('only homepage, /book/, and /medicare/ load the messenger helper', () => {
  const allowed = new Set(['index.html', 'book/index.html', 'medicare/index.html']);
  const loaded = [];
  for (const file of walkHtml()) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    const html = readFileSync(file, 'utf8');
    if (html.includes('/js/messenger-entry.js')) loaded.push(rel);
  }
  assert.deepEqual(loaded.sort(), [...allowed].sort());
  assert.match(HOME, new RegExp(`site-template\\.js\\?v=20261009-hero-header-offset" defer></script>\\s*<script src="${ENTRY_HREF.replace(/[.?/]/g, '\\$&')}"`));
  assert.match(BOOK, new RegExp(`site-template\\.js\\?v=20261009-hero-header-offset"></script>\\s*<script defer src="${ENTRY_HREF.replace(/[.?/]/g, '\\$&')}"`));
  assert.match(MEDICARE, new RegExp(`site-template\\.js\\?v=20261009-hero-header-offset" defer></script>\\s*<script src="${ENTRY_HREF.replace(/[.?/]/g, '\\$&')}"`));
  assert.doesNotMatch(BLOG, /messenger-entry\.js/);
  assert.doesNotMatch(readFileSync(join(ROOT, 'medicare/east-polk/index.html'), 'utf8'), /messenger-entry\.js/);
});

test('draft does not revive the retired customer_chat plugin', () => {
  assert.doesNotMatch(ENTRY_SRC, /FB\.init|connect\.facebook\.net|sdk\.js|fbevents\.js/);
  assert.doesNotMatch(ENTRY_SRC, /<div class=["']fb-customer-chat["']/);
  assert.doesNotMatch(HOME, /fb-customer-chat|customer_chat/);
  assert.doesNotMatch(BOOK, /fb-customer-chat|customer_chat/);
  assert.doesNotMatch(MEDICARE, /fb-customer-chat|customer_chat/);
  assert.match(HOME, /home-page \.click-to-call,\s*\.home-page \.floating-actions \{\s*display: none !important;/);
  assert.doesNotMatch(HOME, /home-page \.click-to-call,\s*\.home-page \.messenger-button,\s*\.home-page \.floating-actions/);
  assert.match(HOME, /home-page \.messenger-button \{[^}]*box-sizing:\s*border-box;[^}]*max-width:\s*calc\(100vw - 24px\);/s);
  assert.match(CHAT_WIDGET_SRC, /data-lhi-page-inbox/);
});

test('footer and static m.me links use the Facey-confirmed Page Inbox without a greeting', () => {
  assert.match(SITE_TEMPLATE_SRC, new RegExp(`messengerHref = 'https://m\\.me/${PAGE_ID}'`));
  assert.doesNotMatch(SITE_TEMPLATE_SRC, /messengerHref = '[^']*\?text=/);
  const pageInbox = new RegExp(`^https://m\\.me/${PAGE_ID}(?:\\?|$)`);
  for (const file of [join(ROOT, 'js/site-template.js'), ...walkHtml()]) {
    const source = readFileSync(file, 'utf8');
    const hrefs = [...source.matchAll(/https:\/\/m\.me\/[^\s"'<>]+/g)].map((match) => match[0]);
    for (const href of hrefs) {
      assert.match(href, pageInbox, `${relative(ROOT, file)} uses the Page Inbox`);
      assert.equal(href, `https://m.me/${PAGE_ID}`, `${relative(ROOT, file)} footer href stays greeting-free`);
    }
  }
});
