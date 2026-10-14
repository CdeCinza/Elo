import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const advisoryUrl = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const exceptionExpiresAt = new Date('2026-11-14T00:00:00Z');
const affectedDevelopmentPackages = new Set([
  'braces',
  'micromatch',
  'fast-glob',
  '@next/eslint-plugin-next',
  'eslint-config-next',
]);

/**
 * The unpatched braces advisory affects ESLint's repository glob configuration.
 * It does not process application requests. Accept only this advisory, only for
 * development dependencies, and only until the exception expires.
 */
export function evaluateAuditReport(report, lockfile, now = new Date()) {
  if (report?.auditReportVersion !== 2 || report.error || !report.vulnerabilities
      || typeof report.vulnerabilities !== 'object' || Array.isArray(report.vulnerabilities)
      || !lockfile?.packages) {
    throw new Error('Relatório de auditoria ou lockfile inválido.');
  }

  const isAcceptedDevelopmentAdvisory = (name, visited = new Set()) => {
    const vulnerability = report.vulnerabilities[name];
    if (now >= exceptionExpiresAt || !affectedDevelopmentPackages.has(name)
        || visited.has(name) || !vulnerability || vulnerability.name !== name
        || !Array.isArray(vulnerability.nodes) || vulnerability.nodes.length === 0
        || !vulnerability.nodes.every((node) => lockfile.packages[node]?.dev === true)
        || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
      return false;
    }

    const nextVisited = new Set([...visited, name]);
    return vulnerability.via.every((cause) => {
      if (typeof cause === 'string') {
        return isAcceptedDevelopmentAdvisory(cause, nextVisited);
      }

      return cause?.name === 'braces' && cause.url === advisoryUrl
        && cause.severity === 'high'
        && vulnerability.nodes.every((node) => lockfile.packages[node].version === '3.0.3');
    });
  };

  const accepted = [];
  const blocked = [];
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (!['info', 'low', 'moderate', 'high', 'critical'].includes(vulnerability.severity)) {
      throw new Error(`Severidade inválida para ${name}.`);
    }
    if (!['high', 'critical'].includes(vulnerability.severity)) {
      continue;
    }

    if (vulnerability.severity === 'high' && isAcceptedDevelopmentAdvisory(name)) {
      accepted.push(name);
    } else {
      blocked.push(name);
    }
  }

  return { accepted, blocked };
}

function runAudit() {
  if (!process.env.npm_execpath) {
    throw new Error('Execute a auditoria com npm run audit:ci.');
  }

  const frontendDirectory = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'audit', '--json'], {
    cwd: frontendDirectory,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw new Error(result.error?.message || result.stderr || 'Não foi possível concluir npm audit.');
  }

  const report = JSON.parse(result.stdout);
  const lockfile = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const { accepted, blocked } = evaluateAuditReport(report, lockfile);

  if (accepted.length > 0) {
    console.warn(`Exceção temporária até 2026-11-14: ${advisoryUrl} (somente ESLint/dev: ${accepted.join(', ')}).`);
  }
  if (blocked.length > 0) {
    console.error(JSON.stringify(report, null, 2));
    console.error(`Auditoria bloqueada: ${blocked.join(', ')}.`);
    process.exitCode = 1;
  } else {
    console.log('Nenhuma vulnerabilidade alta ou crítica fora da exceção temporária.');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runAudit();
  } catch (error) {
    console.error(`Auditoria falhou: ${error.message}`);
    process.exitCode = 1;
  }
}
