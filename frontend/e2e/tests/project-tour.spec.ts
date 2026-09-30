import { test, expect } from '@playwright/test';

test('página inicial explica o fluxo e os requisitos de acesso @smoke', async ({ page }) => {
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: { data: [] } }));
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('salão, do caixa e da cozinha');
  await expect(page.getByRole('heading', { name: 'Uma comanda, três pontos de vista' })).toBeVisible();
  await expect(page.getByText('O tablet precisa ser vinculado a uma mesa por um gerente.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Cardápio digital na mesa/ })).toHaveAttribute('href', '/table');
  await expect(page.getByRole('link', { name: /Balcão e mesas ativas/ })).toHaveAttribute('href', '/counter');
  await expect(page.getByRole('link', { name: /Produção da cozinha/ })).toHaveAttribute('href', '/kitchen');
});

test('cardápio permite abrir um prato pelo teclado', async ({ page }) => {
  await page.route('**/api/v1/categories*', (route) => route.fulfill({
    json: { data: [{ id: 1, name: 'Pratos', description: '', is_active: true }] },
  }));
  await page.route('**/api/v1/products*', (route) => route.fulfill({
    json: { data: [{ id: 1, category_id: 1, category_name: 'Pratos', name: 'Prato de teste', description: '', price: 25, available: true, image_url: null }] },
  }));
  await page.route('**/api/v1/customer/table/01', (route) => route.fulfill({
    json: { table: { id: 1, number: '01', status: 'occupied', active_order: null } },
  }));

  await page.goto('/table/01/menu');
  const product = page.getByRole('button', { name: 'Personalizar e pedir Prato de teste' });
  await expect(product).toBeVisible();
  await product.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Personalizar Prato de teste' })).toBeVisible();
});

test('cardápio mostra fallback quando a foto do prato falha', async ({ page }) => {
  await page.route('**/api/v1/categories*', (route) => route.fulfill({
    json: { data: [{ id: 1, name: 'Pratos', description: '', is_active: true }] },
  }));
  await page.route('**/api/v1/products*', (route) => route.fulfill({
    json: { data: [{ id: 1, category_id: 1, category_name: 'Pratos', name: 'Prato sem foto', description: '', price: 25, available: true, image_url: 'https://images.example.test/broken-product.jpg' }] },
  }));
  await page.route('**/api/v1/customer/table/01', (route) => route.fulfill({
    json: { table: { id: 1, number: '01', status: 'occupied', active_order: null } },
  }));
  await page.route('**/broken-product.jpg', (route) => route.abort());

  await page.goto('/table/01/menu');
  const product = page.getByRole('button', { name: 'Personalizar e pedir Prato sem foto' });
  await expect(product).toBeVisible();
  await expect(product.getByRole('img', { name: 'Foto indisponível' })).toBeVisible();
});

test('tablet atualiza a mesa sem recarregar o cardápio a cada consulta', async ({ page }) => {
  let categoryRequests = 0;
  let productRequests = 0;
  let tableRequests = 0;

  await page.route('**/api/v1/categories*', (route) => {
    categoryRequests += 1;
    return route.fulfill({ json: { data: [{ id: 1, name: 'Pratos', description: '', is_active: true }] } });
  });
  await page.route('**/api/v1/products*', (route) => {
    productRequests += 1;
    return route.fulfill({
      json: { data: [{ id: 1, category_id: 1, category_name: 'Pratos', name: 'Prato de teste', description: '', price: 25, available: true, image_url: null }] },
    });
  });
  await page.route('**/api/v1/customer/table/01', (route) => {
    tableRequests += 1;
    return route.fulfill({ json: { table: { id: 1, number: '01', status: 'occupied', active_order: null } } });
  });

  await page.goto('/table/01/menu');
  await expect(page.getByRole('button', { name: 'Personalizar e pedir Prato de teste' })).toBeVisible();
  await expect.poll(() => tableRequests, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  expect(categoryRequests).toBe(1);
  expect(productRequests).toBe(1);
});
