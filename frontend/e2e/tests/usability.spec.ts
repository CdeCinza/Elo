import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const product = { id: 1, category_id: 1, name: 'Prato da casa', description: 'Especial da casa', price: 25, available: true, image_url: null };

async function mockCustomer(page: Page): Promise<void> {
  await page.route('**/api/v1/categories*', (route) => route.fulfill({ json: { data: [{ id: 1, name: 'Pratos' }] } }));
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: { data: [product] } }));
  await page.route('**/api/v1/customer/table/01', (route) => route.fulfill({ json: { table: { id: 1, number: '01', status: 'occupied', active_order: null } } }));
}

test('cliente envia várias unidades e o modal mantém e devolve o foco', async ({ page }, testInfo) => {
  await mockCustomer(page);
  let submitted: unknown;
  await page.route('**/api/v1/customer/table/01/order', (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/table/01/menu');
  const trigger = page.getByRole('button', { name: 'Personalizar e pedir Prato da casa' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Personalizar Prato da casa' });
  await expect(dialog).toBeVisible();
  await page.getByLabel('Quantidade', { exact: true }).fill('3');
  await expect(dialog.getByRole('button', { name: /Enviar à cozinha.*75,00/ })).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(scan.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('pedido-cliente.png') });
  await dialog.getByRole('button', { name: /Enviar à cozinha/ }).press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await page.getByLabel('Quantidade', { exact: true }).fill('3');
  await page.getByRole('button', { name: /Enviar à cozinha.*75,00/ }).click();
  await expect.poll(() => submitted).toEqual({ items: [{ product_id: 1, quantity: 3 }] });
});

test('cliente consegue tentar carregar o cardápio novamente', async ({ page }) => {
  await mockCustomer(page);
  let unavailable = true;
  await page.route('**/api/v1/products*', (route) => route.fulfill(unavailable
    ? { status: 503, json: { message: 'Indisponível' } }
    : { json: { data: [product] } }));
  await page.goto('/table/01/menu');
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('button', { name: 'Personalizar e pedir Prato da casa' })).toBeVisible();
});

test('cozinha filtra e avança somente os itens da praça em todas as etapas', async ({ page }, testInfo) => {
  const order = { id: 10, tableNumber: '01', openedAt: '12:00', minutesAgo: 22, status: 'pending', items: [
    { id: 101, name: 'Bife', station: 'grill', quantity: 2, status: 'pending', notes: 'Sem sal' },
    { id: 102, name: 'Batata', station: 'fryer', quantity: 1, status: 'pending' },
  ] };
  await page.route('**/api/v1/kds/orders', (route) => route.fulfill({ json: { orders: [order] } }));
  const changes: unknown[] = [];
  await page.route('**/api/v1/kds/orders/10/status', (route) => {
    const change = route.request().postDataJSON();
    changes.push(change);
    order.items[0].status = change.status;
    return route.fulfill({ json: {} });
  });
  await page.goto('/kitchen');
  await page.getByRole('button', { name: 'Chapa & Grelha' }).click();
  await expect(page.getByText('Bife', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Batata', { exact: false })).toHaveCount(0);
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(scan.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('cozinha-desktop.png') });
  for (const [button, from, status] of [
    ['Iniciar preparo', 'pending', 'preparing'],
    ['Concluir prato e chamar garçom', 'preparing', 'ready'],
    ['Entregue ao salão (baixar)', 'ready', 'delivered'],
  ]) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect.poll(() => changes.at(-1)).toEqual({ status, from, item_ids: [101] });
  }
  expect(order.items[1].status).toBe('pending');
});

test('cozinha móvel permite trocar de etapa sem percorrer todas as colunas', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/kds/orders', (route) => route.fulfill({ json: { orders: [{
    id: 1, tableNumber: '01', openedAt: '12:00', minutesAgo: 3, status: 'ready',
    items: [{ id: 1, name: 'Prato da casa', station: 'grill', quantity: 2, status: 'ready' }],
  }] } }));
  await page.goto('/kitchen');
  const stages = page.getByRole('navigation', { name: 'Etapas da cozinha' });
  await stages.getByRole('button', { name: 'Pronto (1)' }).click();
  await expect(page.getByRole('heading', { name: 'Pronto para servir' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fila de entrada' })).not.toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('cozinha-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('falha de conexão não apresenta filas ou totais como confirmados', async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/kitchen');
  await expect(page.getByText('Sem conexão com o servidor')).toBeVisible();
  await expect(page.getByText('Sem atrasos críticos')).toHaveCount(0);
  await expect(page.getByText('Nenhum pedido pendente nesta praça.')).toHaveCount(0);
  await page.goto('/counter');
  await expect(page.getByRole('heading', { name: 'Não foi possível carregar o salão' })).toBeVisible();
  await expect(page.getByText(/R\$\s*0,00/)).toHaveCount(0);
});

test('modais do caixa têm rótulos, foco e acessibilidade com mesas carregadas', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('elo_auth_user', JSON.stringify({
    id: 1, name: 'Gerente de teste', restaurant_id: 1, role: { name: 'manager' }, is_super_admin: false,
  })));
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: { data: [product] } }));
  await page.route('**/api/v1/pos/tables', (route) => route.fulfill({ json: { tables: [
    { id: 1, number: '01', status: 'free', capacity: 4 },
    { id: 2, number: '02', status: 'bill_requested', subtotal: 50, total: 50, items: [{ id: 1, name: 'Prato da casa', quantity: 2, price: 25, subtotal: 50, status: 'ready' }] },
  ] } }));
  await page.goto('/counter');
  await expect(page.getByRole('button', { name: /^Mesa 02,/ })).toBeVisible();
  const loadedScan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(loadedScan.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('balcao-desktop.png') });
  await page.getByRole('button', { name: 'Cadastrar nova mesa', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cadastrar Nova Mesa' });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Número ou identificação da mesa')).toBeFocused();
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(scan.violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Salvar Mesa' }).press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Cadastrar nova mesa', exact: true })).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Mesa 02,/ }).click();
  await expect(page.getByRole('button', { name: 'Lançar item', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lançar item', exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('balcao-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Lançar item', exact: true }).click();
  const itemDialog = page.getByRole('dialog', { name: 'Lançar item na Mesa 02' });
  await expect(itemDialog.getByLabel('Selecione o produto')).toBeVisible();
  await expect(itemDialog.getByLabel('Quantidade', { exact: true })).toBeVisible();
  const itemScan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(itemScan.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Lançar item', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Editar mesa', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Editar Mesa 01' });
  await expect(editDialog.getByLabel('Identificação / Número')).toBeVisible();
  const editScan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(editScan.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(editDialog).not.toBeVisible();
});
