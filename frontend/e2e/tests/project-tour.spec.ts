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
