// The typed rule model for CEDT-1.
//
// A rule is the atomic unit of taste. Key fields:
// - id: stable identifier for updates and supersession references
// - text: imperative constraint (e.g. "Never use em dashes.")
// - category: free-form grouping (communication, content, code, git, general, etc.)
// - scope: global = anywhere; domain = only when current task touches `domain`
// - confidence: 0..1, calibrated over time via decay and reinforcement
// - source: how this rule entered the system
// - evidence: audit trail — the single biggest upgrade over markdown constraints
// - supersedes / superseded_by: linked list. Newest rule wins during resolution
// - conflicts_with: bidirectional list of contradictory rule ids
// - ttl_days: optional soft expiry for decay worker
// - last_reinforced: timestamp of most recent reinforcement
// - created_at: first entry timestamp

export const SOURCES = ['learned', 'explicit', 'migrated', 'inferred'];

export const SCOPES = ['global', 'domain'];

export function newRule(partial) {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? cryptoId(),
    text: partial.text?.trim() ?? '',
    category: partial.category ?? 'general',
    scope: partial.scope ?? 'global',
    domain: partial.domain ?? null,
    confidence: clamp(partial.confidence ?? 0.5, 0, 1),
    source: SOURCES.includes(partial.source) ? partial.source : 'learned',
    evidence: partial.evidence ?? [],
    supersedes: partial.supersedes ?? [],
    superseded_by: partial.superseded_by ?? null,
    conflicts_with: partial.conflicts_with ?? [],
    tags: partial.tags ?? [],
    ttl_days: partial.ttl_days ?? null,
    created_at: partial.created_at ?? now,
    last_reinforced: partial.last_reinforced ?? now,
    notes: partial.notes ?? null,
  };
}

export function validateRule(rule) {
  const errors = [];
  if (!rule.text) errors.push('text is required');
  if (typeof rule.confidence !== 'number' || rule.confidence < 0 || rule.confidence > 1) {
    errors.push('confidence must be 0..1');
  }
  if (!SOURCES.includes(rule.source)) errors.push(`source must be one of ${SOURCES.join(',')}`);
  if (!SCOPES.includes(rule.scope)) errors.push(`scope must be one of ${SCOPES.join(',')}`);
  if (rule.scope === 'domain' && !rule.domain) {
    errors.push('domain scope requires domain field');
  }
  return errors;
}

export function cryptoId() {
  return Math.random().toString(36).slice(2, 12);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
