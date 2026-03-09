import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

declare global {
  // eslint-disable-next-line no-var
  var __imapplepie_env_loaded: boolean | undefined;
}

interface LoadProjectEnvOptions {
  mode?: string;
  override?: boolean;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function parseAndApplyEnvFile(filePath: string, override: boolean) {
  const source = readFileSync(filePath, 'utf8');
  const lines = source.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const sepIndex = normalized.indexOf('=');
    if (sepIndex <= 0) continue;

    const key = normalized.slice(0, sepIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = normalized.slice(sepIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }

    if (!override && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

function loadSingleEnvFile(filePath: string, override: boolean) {
  if (!existsSync(filePath)) return;

  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(filePath);
      return;
    } catch {
      // Fallback to manual parsing when runtime does not support process.loadEnvFile fully.
    }
  }

  parseAndApplyEnvFile(filePath, override);
}

export function loadProjectEnv(options: LoadProjectEnvOptions = {}) {
  if (globalThis.__imapplepie_env_loaded) return;

  const mode = options.mode ?? process.env.NODE_ENV ?? 'development';
  const override = options.override ?? false;
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const projectRootFromModule = resolve(moduleDir, '../../../');
  const envSearchRoots = unique([process.cwd(), projectRootFromModule]);

  const filesInPriority = unique([
    `.env.${mode}.local`,
    '.env.local',
    `.env.${mode}`,
    '.env',
  ]);

  for (const rootDir of envSearchRoots) {
    for (const relativePath of filesInPriority) {
      const absolutePath = resolve(rootDir, relativePath);
      loadSingleEnvFile(absolutePath, override);
    }
  }

  globalThis.__imapplepie_env_loaded = true;
}
