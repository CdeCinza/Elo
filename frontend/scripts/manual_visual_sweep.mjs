import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const requiredVariables = ['ELO_E2E_MANAGER_EMAIL', 'ELO_E2E_MANAGER_PASSWORD', 'ELO_E2E_TABLE'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  console.error(`Configure ${missingVariables.join(', ')} com uma mesa livre e um gerente de um ambiente exclusivo de testes.`);
  process.exitCode = 1;
} else {
  const require = createRequire(import.meta.url);
  const frontendDirectory = fileURLToPath(new URL('../', import.meta.url));
  const runner = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', 'e2e/tests/full-system-sweep.spec.ts', '--reporter=list', ...process.argv.slice(2)], {
    cwd: frontendDirectory,
    stdio: 'inherit',
    env: { ...process.env, ELO_E2E_CAPTURE_SCREENSHOTS: '1' },
  });
  runner.on('error', (error) => {
    console.error(`Não foi possível iniciar a varredura: ${error.message}`);
    process.exitCode = 1;
  });
  runner.on('exit', (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 1);
    if (process.exitCode === 0) {
      console.log('Varredura concluída. As capturas estão nos diretórios de saída dos testes.');
    }
  });
}
