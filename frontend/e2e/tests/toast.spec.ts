import { test, expect, type Page } from '@playwright/test';

async function prepareLogin(page: Page, messageForAttempt: (attempt: number) => string): Promise<void> {
  let attempts = 0;
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({
    status: 422,
    json: { message: messageForAttempt(++attempts) },
  }));
  await page.clock.install();
  await page.goto('/login');
  await page.getByLabel('E-mail de acesso').fill('review@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('isolated-review');
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
}

test('notificações que substituem as mais antigas também expiram', async ({ page }) => {
  await prepareLogin(page, (attempt) => `Falha simulada ${attempt}`);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
    await expect(page.getByText(`Falha simulada ${attempt}`, { exact: true })).toBeVisible();
  }

  const notifications = page.getByRole('alert').filter({ hasText: /Falha simulada/ });
  await expect(notifications).toHaveCount(3);
  await expect(page.getByText('Falha simulada 1', { exact: true })).toHaveCount(0);
  await page.clock.runFor(5000);
  await expect(notifications).toHaveCount(0);
});

test('notificações repetidas são agrupadas e renovam o prazo de expiração', async ({ page }) => {
  await prepareLogin(page, () => 'Falha repetida');
  const notifications = page.getByRole('alert').filter({ hasText: 'Falha repetida' });

  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(notifications).toHaveCount(1);
  await page.clock.runFor(3000);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(notifications.getByText('×2', { exact: true })).toBeVisible();
  await expect(notifications).toHaveCount(1);
  await page.clock.runFor(2000);
  await expect(notifications).toHaveCount(1);
  await page.clock.runFor(2501);
  await expect(notifications).toHaveCount(0);
});
