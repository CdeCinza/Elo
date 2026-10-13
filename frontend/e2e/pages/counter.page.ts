import { Page, Locator, expect } from '@playwright/test';

export class CounterPage {
  readonly page: Page;
  readonly closeTableButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.closeTableButton = page.getByRole('button', { name: /Fechar mesa|Baixando/i });
  }

  async goto() {
    await this.page.goto('/counter');
  }

  async expectLoaded() {
    await expect(this.page.getByText(/Visão do Salão|Frente de Caixa/i).first()).toBeVisible();
  }

  async selectTable(tableNumber: string) {
    const escapedNumber = tableNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tableButton = this.page.getByRole('button', { name: new RegExp(`^Mesa ${escapedNumber},`) });
    await expect(tableButton).toBeVisible();
    await tableButton.click();
  }

  async expectTableCardStatus(tableNumber: string, statusText: string | RegExp) {
    const tableCard = this.page.locator('div').filter({ hasText: new RegExp(`Mesa ${tableNumber}`, 'i') }).first();
    await expect(tableCard.getByText(statusText).first()).toBeVisible();
  }

  async closeSelectedTable() {
    await expect(this.closeTableButton).toBeVisible();
    await this.closeTableButton.click();
    await expect(this.page.getByText(/finalizada com sucesso|liberada/i)).toBeVisible();
  }
}
