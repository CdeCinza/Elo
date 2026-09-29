import { test, expect } from '@playwright/test';
import { TabletPage } from '../pages/tablet.page';
import { KitchenPage } from '../pages/kitchen.page';
import { CounterPage } from '../pages/counter.page';

const managerEmail = process.env.ELO_E2E_MANAGER_EMAIL;
const managerPassword = process.env.ELO_E2E_MANAGER_PASSWORD;
const testTable = process.env.ELO_E2E_TABLE;

test('pedido da mesa aparece na cozinha e no caixa @smoke', async ({ page, request }) => {
  test.skip(!managerEmail || !managerPassword || !testTable, 'Configure credenciais e uma mesa exclusiva no banco de testes.');

  const loginResponse = await request.post('/api/v1/auth/login', {
    data: { email: managerEmail, password: managerPassword },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const { access_token: token, user } = await loginResponse.json();
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Restaurant-Id': String(user.restaurant_id),
  };

  let orderPlaced = false;
  try {
    const initialTableResponse = await request.get(`/api/v1/customer/table/${encodeURIComponent(testTable!)}`, { headers });
    expect(initialTableResponse.ok()).toBeTruthy();
    const initialTable = (await initialTableResponse.json()).table;
    expect(initialTable.status).toBe('free');
    expect(initialTable.active_order).toBeNull();

    const tablet = new TabletPage(page);
    await tablet.gotoSetup();
    await expect(page.getByRole('heading', { name: 'Vincular Tablet à Mesa' })).toBeVisible();
    await tablet.setupTablet(testTable!, managerEmail!, managerPassword!);
    await expect(page).toHaveURL(new RegExp(`/table/${testTable}$`));

    await expect(tablet.startAttendanceButton).toBeVisible();
    await tablet.startAttendanceButton.click();
    await tablet.chooseTabletButton.click();
    await expect(page).toHaveURL(new RegExp(`/table/${testTable}/menu$`));

    await page.getByRole('button', { name: /^Personalizar e pedir / }).first().click();
    await expect(page.getByRole('dialog', { name: /^Personalizar / })).toBeVisible();
    await page.getByRole('button', { name: /Enviar à cozinha/ }).click();
    orderPlaced = true;
    await expect(page.getByText(/enviado para a cozinha/i)).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('E-mail de acesso').fill(managerEmail!);
    await page.getByLabel('Senha', { exact: true }).fill(managerPassword!);
    await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
    await expect(page).toHaveURL(/\/counter$/);

    const kitchen = new KitchenPage(page);
    await kitchen.goto();
    await kitchen.expectTableOrderVisible(testTable!);

    const counter = new CounterPage(page);
    await counter.goto();
    await counter.selectTable(testTable!);
    await expect(page.getByText(/Itens consumidos|Comanda ativa/i).first()).toBeVisible();
  } finally {
    if (orderPlaced) {
      await request.post(`/api/v1/pos/tables/${encodeURIComponent(testTable!)}/reset`, { headers });
    }
    await request.post('/api/v1/auth/logout', { headers });
  }
});
