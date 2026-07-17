// CEDT-1 main entry — re-exports all public modules.

export { newRule, validateRule, cryptoId, SOURCES, SCOPES } from './store/schema.js';
export {
  paths, ensureStore, loadAll, loadCategory, saveCategory,
  addRule, reinforce, supersede, resolveConflicts, recordEvidence,
} from './store/index.js';
export { extract, heuristicExtract, inferCategory, llmRefine } from './extract/index.js';
export { decay } from './decay/index.js';
export { migrateAll, migrateFromTaste1, migrateFromTaste2, migrateFromLessons } from './migrate/index.js';
export { sync, ensureRepo } from './sync/index.js';
export { injectContext, writeProfile } from './opencode/inject.js';
