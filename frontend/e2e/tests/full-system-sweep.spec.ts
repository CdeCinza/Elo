import { test as base, expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import type { User } from '../../src/lib/auth';
import type { CatalogProduct } from '../../src/lib/catalog';
import type { TableSession } from '../../src/hooks/useCustomerSession';
import { normalizeTableNumber } from '../../src/lib/tablet';
import { TabletPage } from '../pages/tablet.page';
import { KitchenPage } from '../pages/kitchen.page';

const managerEmail = process.env.ELO_E2E_MANAGER_EMAIL;
const managerPassword = process.env.ELO_E2E_MANAGER_PASSWORD;
const configuredTable = process.env.ELO_E2E_TABLE;

interface SweepSession {
  api: APIRequestContext;
  headers: Record<string, string>;
  accessToken: string;
  user: User;
  tableNumber: string;
  tablePath: string;
  products: CatalogProduct[];
}

async function expectSuccessfulResponse(response: APIResponse): Promise<void> {
  expect(response.ok(), `${response.url()}: ${response.status()}`).toBe(true);
}

async function readTable(session: SweepSession): Promise<TableSession> {
  const response = await session.api.get(`/api/v1/customer/table/${session.tablePath}`, { headers: session.headers });
  await expectSuccessfulResponse(response);
  return (await response.json()).table;
}

async function placeOrder(session: SweepSession, quantity = 1): Promise<void> {
  const response = await session.api.post(`/api/v1/customer/table/${session.tablePath}/order`, {
    headers: session.headers,
    data: { items: [{ product_id: session.products[0].id, quantity, notes: 'Sem sal e molho à parte' }] },
  });
  await expectSuccessfulResponse(response);
}

async function authenticateOperator(page: Page, session: SweepSession): Promise<void> {
  await page.addInitScript(({ user, token }) => {
    localStorage.setItem('elo_auth_user', JSON.stringify(user));
    localStorage.setItem('elo_auth_token', token);
  }, { user: session.user, token: session.accessToken });
}

const test = base.extend<{ sweep: SweepSession }, { session: SweepSession }>({
  session: [async ({ playwright }, provideSession, workerInfo) => {
    const api = await playwright.request.newContext({ baseURL: workerInfo.project.use.baseURL });
    try {
      const login = await api.post('/api/v1/auth/login', {
        data: { email: managerEmail, password: managerPassword },
      });
      await expectSuccessfulResponse(login);
      const { access_token: accessToken, user } = await login.json();
      expect(user.restaurant_id, 'Use a conta de um gerente do restaurante exclusivo de testes.').toBeGreaterThan(0);
      const headers = { Authorization: `Bearer ${accessToken}`, 'X-Restaurant-Id': String(user.restaurant_id) };

      try {
        const productsResponse = await api.get('/api/v1/products?per_page=200', { headers });
        await expectSuccessfulResponse(productsResponse);
        const products: CatalogProduct[] = (await productsResponse.json()).data.filter((product: CatalogProduct) => product.available);
        expect(products.length, 'O restaurante de testes precisa de pelo menos dois pratos disponíveis.').toBeGreaterThanOrEqual(2);
        const tableNumber = normalizeTableNumber(configuredTable!);
        await provideSession({ api, headers, accessToken, user, tableNumber, tablePath: encodeURIComponent(tableNumber), products });
      } finally {
        await expectSuccessfulResponse(await api.post('/api/v1/auth/logout', { headers }));
      }
    } finally {
      await api.dispose();
    }
  }, { scope: 'worker' }],

  sweep: async ({ page, session }, provideSweep) => {
    const initialTable = await readTable(session);
    expect(initialTable.status, 'Reserve uma mesa livre no ambiente exclusivo de testes.').toBe('free');
    expect(initialTable.active_order, 'A suíte não apaga comandas que já existiam na mesa.').toBeNull();
    await page.addInitScript((restaurant) => {
      localStorage.setItem('elo_active_restaurant', JSON.stringify(restaurant));
    }, session.user.restaurant);

    try {
      await provideSweep(session);
    } finally {
      await expectSuccessfulResponse(await session.api.post(`/api/v1/pos/tables/${session.tablePath}/reset`, { headers: session.headers }));
      expect((await readTable(session)).status).toBe('free');
    }
  },
});

test.describe('Varredura integrada do ELO em ambiente exclusivo', () => {
  test.skip(!managerEmail || !managerPassword || !configuredTable, 'Configure ELO_E2E_MANAGER_EMAIL, ELO_E2E_MANAGER_PASSWORD e ELO_E2E_TABLE em um ambiente exclusivo de testes.');

  test.afterEach(async ({ page }, testInfo) => {
    if (process.env.ELO_E2E_CAPTURE_SCREENSHOTS === '1' && page.url() !== 'about:blank') {
      await page.screenshot({ path: testInfo.outputPath('visual.png'), fullPage: true });
    }
  });

  test('tablet vincula a mesa e inicia o atendimento pelo cardápio', async ({ page, sweep }) => {
    const tablet = new TabletPage(page);
    await tablet.gotoSetup();
    await tablet.setupTablet(sweep.tableNumber, managerEmail!, managerPassword!);
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/table/${sweep.tablePath}`);
    await tablet.startAttendanceButton.click();
    await expect(page.getByRole('dialog', { name: 'Preferências de atendimento', exact: true })).toBeVisible();
    await tablet.chooseTabletButton.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/table/${sweep.tablePath}/menu`);
    await expect(page.getByRole('button', { name: `Personalizar e pedir ${sweep.products[0].name}`, exact: true })).toBeVisible();
    expect((await readTable(sweep)).status).toBe('occupied');
  });

  test('cardápio filtra, personaliza e envia o pedido com quantidade e observações', async ({ page, sweep }) => {
    await expectSuccessfulResponse(await sweep.api.post(`/api/v1/customer/table/${sweep.tablePath}/check-in`, { headers: sweep.headers }));
    const product = sweep.products[0];
    await page.goto(`/table/${sweep.tablePath}/menu`);
    await page.getByRole('link', { name: product.category_name, exact: true }).click();
    await page.getByRole('textbox', { name: 'Buscar no cardápio' }).fill(product.name);
    await page.getByRole('button', { name: `Personalizar e pedir ${product.name}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `Personalizar ${product.name}`, exact: true });
    await dialog.getByLabel('Quantidade', { exact: true }).fill('2');
    await dialog.getByLabel('Observações para a cozinha').fill('Sem cebola e molho à parte');
    await dialog.getByRole('button', { name: /Enviar à cozinha/ }).click();
    await expect(page.getByText(`${product.name} enviado para a cozinha!`, { exact: true })).toBeVisible();
    expect((await readTable(sweep)).active_order?.items).toEqual([
      expect.objectContaining({ product_id: product.id, quantity: 2, notes: 'Obs: Sem cebola e molho à parte' }),
    ]);
    await page.getByRole('link', { name: 'Ver comanda', exact: true }).click();
    await expect(page.getByRole('heading', { name: product.name, exact: true })).toBeVisible();
  });

  test('cozinha recebe as observações e avança do preparo até a entrega', async ({ page, sweep }) => {
    await placeOrder(sweep, 2);
    await authenticateOperator(page, sweep);
    const kitchen = new KitchenPage(page);
    await kitchen.goto();
    await kitchen.expectTableOrderVisible(sweep.tableNumber);
    await expect(page.getByText('• Sem sal e molho à parte', { exact: true })).toBeVisible();
    await kitchen.advanceOrderForTable(sweep.tableNumber, 'Iniciar preparo');
    await kitchen.advanceOrderForTable(sweep.tableNumber, 'Concluir prato e chamar garçom');
    await kitchen.advanceOrderForTable(sweep.tableNumber, 'Entregue ao salão (baixar)');
    await expect(page.getByText(`Mesa ${sweep.tableNumber}`, { exact: true })).toHaveCount(0);
    expect((await readTable(sweep)).active_order?.items).toEqual([
      expect.objectContaining({ quantity: 2, status: 'delivered' }),
    ]);
  });

  test('caixa recebe e atende o chamado de garçom', async ({ page, sweep }) => {
    await expectSuccessfulResponse(await sweep.api.post(`/api/v1/customer/table/${sweep.tablePath}/call-waiter`, { headers: sweep.headers }));
    await authenticateOperator(page, sweep);
    await page.goto('/counter');
    const waiterAlert = page.getByRole('button', { name: 'Garçom!', exact: true });
    await expect(waiterAlert).toBeVisible();
    await waiterAlert.click();
    await expect(waiterAlert).toHaveCount(0);
    const tablesResponse = await sweep.api.get('/api/v1/pos/tables', { headers: sweep.headers });
    await expectSuccessfulResponse(tablesResponse);
    const table = (await tablesResponse.json()).tables.find((item: { number: string }) => item.number === sweep.tableNumber);
    expect(table.waiter_called).toBe(false);
  });

  test('caixa lança um item, confirma o fechamento e libera a mesa', async ({ page, sweep }) => {
    await expectSuccessfulResponse(await sweep.api.post(`/api/v1/pos/tables/${sweep.tablePath}/open`, { headers: sweep.headers }));
    await authenticateOperator(page, sweep);
    await page.goto('/counter');
    await page.getByRole('button', { name: `Mesa ${sweep.tableNumber}, ocupada`, exact: true }).click();
    await page.getByRole('button', { name: 'Lançar item', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `Lançar item na Mesa ${sweep.tableNumber}`, exact: true });
    await dialog.getByLabel('Selecione o produto').selectOption(String(sweep.products[0].id));
    await dialog.getByRole('button', { name: 'Confirmar lançamento', exact: true }).click();
    await expect(page.getByText('Item lançado na comanda com sucesso!', { exact: true })).toBeVisible();
    await expect(page.getByText('Itens consumidos (1)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'PIX', exact: true }).click();
    await page.getByRole('button', { name: 'Fechar mesa', exact: true }).click();
    await page.getByRole('dialog', { name: 'Ainda há pratos na cozinha', exact: true })
      .getByRole('button', { name: 'Fechar conta mesmo assim', exact: true }).click();
    await expect(page.getByText(`Mesa ${sweep.tableNumber} finalizada com sucesso! Baixa realizada.`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Mesa ${sweep.tableNumber}, livre`, exact: true })).toBeVisible();
    const table = await readTable(sweep);
    expect(table.status).toBe('free');
    expect(table.active_order).toBeNull();
  });

  test('cliente divide a conta e solicita o recebimento pela equipe', async ({ page, sweep }) => {
    await placeOrder(sweep, 2);
    await page.goto(`/table/${sweep.tablePath}/order`);
    await expect(page.getByRole('heading', { name: sweep.products[0].name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Aumentar número de pessoas', exact: true }).click();
    await expect(page.getByText('3 pessoas', { exact: true })).toBeVisible();
    await expect(page.getByText('Por pessoa (3x)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Pedir conta/ }).click();
    const dialog = page.getByRole('dialog', { name: `Pagamento da Mesa ${sweep.tableNumber}`, exact: true });
    await expect(dialog.getByRole('button', { name: 'Pagar com a equipe (PIX, maquininha ou dinheiro)', exact: true })).toBeVisible();
    expect((await readTable(sweep)).status).toBe('bill_requested');
  });

  test('API rejeita a exclusão de mesa ocupada e o cadastro de uma mesa duplicada', async ({ sweep }) => {
    await expectSuccessfulResponse(await sweep.api.post(`/api/v1/pos/tables/${sweep.tablePath}/open`, { headers: sweep.headers }));
    const deletion = await sweep.api.delete(`/api/v1/pos/tables/${sweep.tablePath}`, { headers: sweep.headers });
    expect(deletion.status()).toBe(422);
    expect((await deletion.json()).message).toContain('Não é possível excluir');
    const duplicate = await sweep.api.post('/api/v1/pos/tables', {
      headers: sweep.headers,
      data: { number: sweep.tableNumber, capacity: 4 },
    });
    expect(duplicate.status()).toBe(422);
    expect((await duplicate.json()).message).toContain('Já existe uma mesa cadastrada');
  });
});
