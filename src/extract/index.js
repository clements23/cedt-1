// Turn a free-form user correction into a structured CEDT-1 rule.
// Strategy:
//   1. Heuristic extraction first (fast, free, no model needed).
//   2. If CEDT1_EXTRACTOR_URL is set, hand the correction to an LLM for refinement.
//   3. Return a candidate rule object the caller can persist.

import { newRule } from '../store/schema.js';

const HEURISTICS = [
  {
    name: 'capitalization',
    re: /(?:always\s+)?(?:capitalize|capital|uppercase)\s+(\w+)/i,
    build: (m) => ({ text: `Always write "${m[1]}" (not lowercased).`, tags: ['capitalization'] }),
  },
  {
    name: 'never-do',
    re: /(?:never|don't|do not|stop)\s+(?:use\s+)?(.+?)(?:\.|$)/i,
    build: (m, _text) => ({
      text: `Never ${normalize(m[1])}.`,
      tags: ['negation'],
    }),
  },
  {
    name: 'always-do',
    re: /(?:always|make sure to|remember to)\s+(.+?)(?:\.|$)/i,
    build: (m) => ({ text: `Always ${normalize(m[1])}.`, tags: ['affirmation'] }),
  },
  {
    name: 'prefer-over',
    re: /(?:use|prefer)\s+(\w+)\s+(?:over|instead of|not)\s+(\w+)/i,
    build: (m) => ({
      text: `Use "${m[1]}" instead of "${m[2]}".`,
      tags: ['preference', 'pair'],
    }),
  },
];

function normalize(s) {
  return s.replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toLowerCase());
}

export function inferCategory(text) {
  const t = text.toLowerCase();
  // Order matters: more specific categories checked first, then broader ones.
  const map = [
    // Specific tool/domain categories
    { pattern: '\\bcommit\\b|\\bgit\\b|\\bpr\\b|pull request|merge|rebase|squash', cat: 'git' },
    { pattern: 'cloudflare|wrangler|\\bd1\\b|\\bworker\\b|\\bkv\\b|\\br2\\b', cat: 'cloudflare' },
    { pattern: 'vercel|deploy|build|npm run|tsc|vite build|ci/cd', cat: 'deploy' },
    { pattern: 'ydn|lifted|izzy|babylon|client report|weekly report|data methodology|whello|meta ads', cat: 'client-work' },
    // Topic categories
    { pattern: 'linkedin|aisift|the ai sift|blog post|blog draft|publish|article', cat: 'content' },
    { pattern: 'capitalize|capital|sentence case|em dash|nvidia|em-dash|hashtag|emoji|writing voice', cat: 'content' },
    { pattern: 'typescript|javascript|rust|python|react\\b|function|class|module|import|export|code|component', cat: 'code' },
    // Communication (broader, checked late)
    { pattern: 'terminal|\\bcli\\b|step-by-step|command line|absolute path|file location', cat: 'communication' },
    { pattern: 'whatsapp|mom|message|client comm|tone|voice|be brief|concise|language', cat: 'communication' },
  ];
  for (const { pattern, cat } of map) {
    if (new RegExp(pattern).test(t)) return cat;
  }
  return 'general';
}

export function heuristicExtract(correction) {
  for (const h of HEURISTICS) {
    const m = correction.match(h.re);
    if (m) return h.build(m, correction);
  }
  return null;
}

export async function llmRefine({ correction, heuristic }) {
  const url = process.env.CEDT1_EXTRACTOR_URL;
  if (!url) return null;
  const model = process.env.CEDT1_EXTRACTOR_MODEL ?? 'deepseek/deepseek-v4-pro';

  const sys = `You convert a user correction into a single imperative rule.
Reply with strict JSON: {"text":"...","category":"...","confidence":0..1,"tags":[...]}.
- text must be a clean imperative, no quotes.
- category is one of: communication, content, code, git, cloudflare, deploy, client-work, general.
- confidence reflects how unambiguous the correction is (0..1).`;

  const body = {
    model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: `Correction: """${correction}"""\nHeuristic draft: ${JSON.stringify(heuristic)}` },
    ],
    response_format: { type: 'json_object' },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function extract(correction) {
  const heur = heuristicExtract(correction);
  const refined = await llmRefine({ correction, heuristic: heur });

  const text = refined?.text ?? heur?.text ?? normalize(correction);
  const category = refined?.category ?? inferCategory(text);
  const confidence = refined?.confidence ?? (heur ? 0.7 : 0.5);
  const tags = [...(heur?.tags ?? []), ...(refined?.tags ?? [])];

  return newRule({
    text,
    category,
    confidence,
    source: 'learned',
    evidence: [{ kind: 'user-correction', raw: correction }],
    tags,
  });
}
