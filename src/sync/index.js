// Git-backed sync layer. ~/.cedt1 is a git repo. `cedt1 sync` does:
//   1. commit any local changes with an auto message
//   2. pull --rebase (fast-forward only)
//   3. push (no-op if no remote configured)

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { paths, ensureStore } from '../store/index.js';

function git(args, opts = {}) {
  return execSync(`git ${args}`, {
    cwd: paths.ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).trim();
}

export function ensureRepo({ remote = null } = {}) {
  ensureStore();
  if (!fs.existsSync(path.join(paths.ROOT, '.git'))) {
    git('init -b main');
    git('config user.email "cedt1@local"');
    git('config user.name "cedt1"');
    git('add .');
    git('commit -m "cedt1: initial commit" --allow-empty');
  }
  if (remote) {
    const existing = git('remote').split('\n').filter(Boolean);
    if (!existing.includes('origin')) {
      git(`remote add origin ${remote}`);
    }
  }
}

export function sync({ push = true } = {}) {
  ensureRepo();
  const status = git('status --porcelain');
  if (status) {
    git('add .');
    const summary = summarizeStatus(status);
    git(`commit -m "cedt1: ${summary}"`);
  }
  let pulled = '';
  try {
    pulled = git('pull --rebase --autostash');
  } catch {
    // No remote yet — fine.
  }
  let pushed = '';
  if (push) {
    try {
      pushed = git('push');
    } catch {
      // No remote or offline — fine.
    }
  }
  return { status: status || 'clean', pulled, pushed };
}

function summarizeStatus(status) {
  const files = status.split('\n').filter(Boolean).length;
  const sample = status.split('\n').filter(Boolean).slice(0, 3).join(', ');
  return `${files} change${files === 1 ? '' : 's'} (${sample}${files > 3 ? '...' : ''})`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(sync(), null, 2));
}
