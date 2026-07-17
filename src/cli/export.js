// Export CEDT-1 rules as plain markdown, compatible with any agent.

import { loadAll, resolveConflicts } from '../store/index.js';

export function exportMarkdown({ minConfidence = 0.3 } = {}) {
  const all = loadAll();
  if (!all.length) return '# CEDT-1 Tuning Profile\n\nNo rules yet.';

  const { rules } = resolveConflicts(all);
  const live = rules
    .filter((r) => !r.superseded_by)
    .filter((r) => r.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);

  const byCat = live.reduce((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  const now = new Date().toISOString();
  const sections = Object.entries(byCat).map(([cat, rs]) => {
    const header = `## ${cat}`;
    const items = rs
      .map((r) => {
        const bindLevel = r.confidence >= 0.85 ? '[BINDING]'
          : r.confidence >= 0.55 ? '[PREFERRED]'
          : '[SUGGESTION]';
        return `- ${r.text} ${bindLevel} (confidence: ${r.confidence.toFixed(2)})`;
      })
      .join('\n');
    return `${header}\n${items}`;
  });

  return `# CEDT-1 Tuning Profile

> Auto-generated ${now}. Updated continuously.
> Binding (>=0.85): must follow. Preferred (0.55-0.84): strong preference. Suggestion (0.30-0.54): consider.
> This file is written by \`cedt1 export\` and loaded by opencode.

${sections.join('\n\n')}
`;
}

export default exportMarkdown;
