import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function mockCatalogAndTable(page: Page): Promise<void> {
  await page.route('**/api/v1/categories*', (route) => route.fulfill({
    json: { data: [{ id: 1, name: 'Pratos', description: '' }] },
  }));
  await page.route('**/api/v1/products*', (route) => route.fulfill({
    json: { data: [{ id: 1, category_id: 1, name: 'Prato de teste', description: 'Especial da casa', price: 25, available: true, image_url: null }] },
  }));
  await page.route('**/api/v1/customer/table/01', (route) => route.fulfill({
    json: { table: { id: 1, number: '01', capacity: 4, status: 'free', active_order: null } },
  }));
}

const targetPages = [
  {
    name: 'Home Hub', path: '/',
    ready: (page: Page) => expect(page.getByRole('heading', { name: 'Uma comanda, três pontos de vista' })).toBeVisible(),
  },
  {
    name: 'Tablet Kiosk Setup', path: '/table',
    ready: (page: Page) => expect(page.getByRole('heading', { name: 'Vincular Tablet à Mesa' })).toBeVisible(),
  },
  {
    name: 'Mesa Livre', path: '/table/01',
    ready: (page: Page) => expect(page.getByRole('heading', { name: 'Bem-vindo à Mesa 01' })).toBeVisible(),
  },
  {
    name: 'Cardápio', path: '/table/01/menu',
    ready: (page: Page) => expect(page.getByRole('button', { name: 'Personalizar e pedir Prato de teste' })).toBeVisible(),
  },
  {
    name: 'Cozinha KDS', path: '/kitchen',
    ready: (page: Page) => expect(page.getByText('Fila de produção em dia (0 pedidos)')).toBeVisible(),
  },
  {
    name: 'Balcão POS', path: '/counter',
    ready: (page: Page) => expect(page.getByText('Nenhuma mesa cadastrada no salão')).toBeVisible(),
  },
  {
    name: 'Login', path: '/login',
    ready: (page: Page) => expect(page.getByRole('button', { name: 'Entrar no Sistema' })).toBeVisible(),
  },
];

test.describe('Auditoria de acessibilidade WCAG 2.2 AA (axe-core)', () => {
  for (const { name, path, ready } of targetPages) {
    test(`Acessibilidade na página: ${name} (${path})`, async ({ page }) => {
      await mockCatalogAndTable(page);
      await page.route('**/api/v1/customer/tables', (route) => route.fulfill({
        json: { tables: [{ id: 1, number: '01', status: 'free' }] },
      }));
      await page.route('**/api/v1/kds/orders', (route) => route.fulfill({ json: { orders: [] } }));
      await page.route('**/api/v1/pos/tables', (route) => route.fulfill({ json: { tables: [] } }));

      await page.goto(path);
      await ready(page);

      const scanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();

      expect(scanResults.violations, JSON.stringify(scanResults.violations.map(({ id, impact, nodes }) => ({
        id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      })), null, 2)).toEqual([]);
    });
  }
});
