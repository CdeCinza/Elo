import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Auditoria de Acessibilidade WCAG 2.2 AA (axe-core)', () => {
  const targetPages = [
    { name: 'Home Hub', path: '/' },
    { name: 'Tablet Kiosk Setup', path: '/table' },
    { name: 'Mesa Ativa', path: '/table/01' },
    { name: 'Cozinha KDS', path: '/kitchen' },
    { name: 'Balcao POS', path: '/counter' },
    { name: 'Login', path: '/login' },
  ];

  for (const { name, path } of targetPages) {
    test(`Acessibilidade WCAG na página: ${name} (${path})`, async ({ page }) => {
      await page.goto(path);
      // Aguarda estabilização do DOM
      await page.waitForLoadState('domcontentloaded');

      const scanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();

      if (scanResults.violations.length > 0) {
        console.log(`[A11y Violations in ${name}]:`, JSON.stringify(scanResults.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length
        })), null, 2));
      }

      expect(scanResults.violations).toEqual([]);
    });
  }
});
