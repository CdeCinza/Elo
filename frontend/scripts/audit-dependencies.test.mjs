import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateAuditReport } from './audit-dependencies.mjs';

const auditDate = new Date('2026-10-14T12:00:00Z');
const advisory = {
  name: 'braces',
  severity: 'high',
  url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
};

function developmentAudit() {
  const report = { auditReportVersion: 2, vulnerabilities: {} };
  const lockfile = { packages: {} };
  const packages = ['braces', 'micromatch', 'fast-glob', '@next/eslint-plugin-next', 'eslint-config-next'];
  for (const [index, name] of packages.entries()) {
    const node = `node_modules/${name}`;
    report.vulnerabilities[name] = {
      name,
      severity: 'high',
      nodes: [node],
      via: index === 0 ? [structuredClone(advisory)] : [packages[index - 1]],
    };
    lockfile.packages[node] = { dev: true, version: index === 0 ? '3.0.3' : '1.0.0' };
  }
  return { report, lockfile, packages };
}

test('aceita apenas o alerta conhecido na cadeia de desenvolvimento do ESLint', () => {
  const { report, lockfile, packages } = developmentAudit();
  assert.deepEqual(evaluateAuditReport(report, lockfile, auditDate), { accepted: packages, blocked: [] });
});

test('bloqueia o alerta conhecido se braces também for dependência de produção', () => {
  const { report, lockfile, packages } = developmentAudit();
  lockfile.packages['node_modules/braces'].dev = false;
  assert.deepEqual(evaluateAuditReport(report, lockfile, auditDate), { accepted: [], blocked: packages });
});

test('bloqueia novos alertas no mesmo pacote e em todos os dependentes', () => {
  const { report, lockfile, packages } = developmentAudit();
  report.vulnerabilities.braces.via.push({ ...advisory, url: 'https://github.com/advisories/GHSA-new' });
  assert.deepEqual(evaluateAuditReport(report, lockfile, auditDate), { accepted: [], blocked: packages });
});

test('bloqueia vulnerabilidades críticas mesmo com o identificador conhecido', () => {
  const { report, lockfile, packages } = developmentAudit();
  report.vulnerabilities.braces.via[0].severity = 'critical';
  report.vulnerabilities.braces.severity = 'critical';
  assert.deepEqual(evaluateAuditReport(report, lockfile, auditDate), { accepted: [], blocked: packages });
});

test('bloqueia outras vulnerabilidades altas e críticas', () => {
  const { report, lockfile, packages } = developmentAudit();
  report.vulnerabilities.next = { name: 'next', severity: 'critical', via: [{ name: 'next' }] };
  report.vulnerabilities.sharp = { name: 'sharp', severity: 'high', via: [{ name: 'sharp' }] };
  assert.deepEqual(evaluateAuditReport(report, lockfile, auditDate), {
    accepted: packages,
    blocked: ['next', 'sharp'],
  });
});

test('a exceção expira automaticamente no prazo definido', () => {
  const { report, lockfile, packages } = developmentAudit();
  assert.deepEqual(evaluateAuditReport(report, lockfile, new Date('2026-11-14T00:00:00Z')), {
    accepted: [], blocked: packages,
  });
});

test('bloqueia versões diferentes da versão revisada e entradas ausentes no lockfile', () => {
  const { report, lockfile, packages } = developmentAudit();
  lockfile.packages['node_modules/braces'].version = '3.0.2';
  assert.deepEqual(evaluateAuditReport(report, lockfile, auditDate), { accepted: [], blocked: packages });
  delete lockfile.packages['node_modules/braces'];
  assert.deepEqual(evaluateAuditReport(report, lockfile, auditDate), { accepted: [], blocked: packages });
});

test('bloqueia causas ausentes ou cíclicas em vez de aceitar um relatório incompleto', () => {
  const { report, lockfile, packages } = developmentAudit();
  report.vulnerabilities.braces.via = ['eslint-config-next'];
  assert.deepEqual(evaluateAuditReport(report, lockfile, auditDate), { accepted: [], blocked: packages });
  report.vulnerabilities.braces.via = ['missing-package'];
  assert.deepEqual(evaluateAuditReport(report, lockfile, auditDate), { accepted: [], blocked: packages });
});

test('falha quando a auditoria retorna erro ou uma estrutura inesperada', () => {
  const { report, lockfile } = developmentAudit();
  for (const invalidReport of [null, {}, { ...report, error: { code: 'ENETWORK' } }, { ...report, vulnerabilities: [] }]) {
    assert.throws(() => evaluateAuditReport(invalidReport, lockfile, auditDate));
  }
  report.vulnerabilities.braces.severity = 'unknown';
  assert.throws(() => evaluateAuditReport(report, lockfile, auditDate));
});

test('passa auditorias limpas e mantém o limiar existente para alertas baixos e moderados', () => {
  const lockfile = { packages: {} };
  assert.deepEqual(evaluateAuditReport({ auditReportVersion: 2, vulnerabilities: {} }, lockfile, auditDate), {
    accepted: [], blocked: [],
  });
  assert.deepEqual(evaluateAuditReport({ auditReportVersion: 2, vulnerabilities: {
    example: { severity: 'moderate' },
  } }, lockfile, auditDate), { accepted: [], blocked: [] });
});
