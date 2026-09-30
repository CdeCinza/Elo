import { Page, Locator, expect } from '@playwright/test';

export class KitchenPage {
  readonly page: Page;
  readonly headerTitle: Locator;
  readonly filterAll: Locator;
  readonly filterGrill: Locator;
  readonly filterFryer: Locator;
  readonly filterDessert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.headerTitle = page.getByText(/KDS • Linha de Produção & Cozinha/i);
    this.filterAll = page.getByRole('button', { name: /Todas/i });
    this.filterGrill = page.getByRole('button', { name: /Chapa & Grelha/i });
    this.filterFryer = page.getByRole('button', { name: /Frituras & Entradas/i });
    this.filterDessert = page.getByRole('button', { name: /Sobremesas/i });
  }

  async goto() {
    await this.page.goto('/kitchen');
  }

  async expectLoaded() {
    await expect(this.headerTitle).toBeVisible();
  }

  async expectTableOrderVisible(tableNumber: string) {
    const tableBadge = this.page.getByText(new RegExp(`Mesa ${tableNumber}`, 'i')).first();
    await expect(tableBadge).toBeVisible();
  }

  async advanceOrderForTable(tableNumber: string) {
    const card = this.page.locator('div').filter({ hasText: new RegExp(`Mesa ${tableNumber}`, 'i') }).first();
    const advanceButton = card.getByRole('button', { name: /Iniciar preparo|Concluir Prato|Pronto/i }).first();
    if (await advanceButton.isVisible()) {
      await advanceButton.click();
    }
  }
}
