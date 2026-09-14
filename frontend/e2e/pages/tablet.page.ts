import { Page, Locator, expect } from '@playwright/test';

export class TabletPage {
  readonly page: Page;
  readonly pinInput: Locator;
  readonly fixTabletButton: Locator;
  readonly startAttendanceButton: Locator;
  readonly chooseWaiterButton: Locator;
  readonly chooseTabletButton: Locator;
  readonly callWaiterBarButton: Locator;
  readonly waiterAlertBanner: Locator;
  readonly viewComandaLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pinInput = page.getByPlaceholder('••••');
    this.fixTabletButton = page.getByRole('button', { name: /Fixar neste Tablet e Iniciar/i });
    this.startAttendanceButton = page.getByRole('button', { name: /Iniciar atendimento/i });
    this.chooseWaiterButton = page.getByRole('button', { name: /Chamar um garçom/i });
    this.chooseTabletButton = page.getByRole('button', { name: /Pedir pelo tablet/i });
    this.callWaiterBarButton = page.getByRole('button', { name: /Chamar garçom/i });
    this.waiterAlertBanner = page.getByText(/Garçom chamado com sucesso/i);
    this.viewComandaLink = page.getByRole('link', { name: /Ver comanda/i });
  }

  async gotoSetup() {
    await this.page.goto('/table');
  }

  async gotoTable(tableNumber: string) {
    await this.page.goto(`/table/${tableNumber}`);
  }

  async setupTablet(tableNumber: string, pin = '1234') {
    const manualBtn = this.page.getByRole('button', { name: /Digitar número manual/i });
    if (await manualBtn.isVisible()) {
      await manualBtn.click();
      await this.page.getByPlaceholder('Ex: 01, 15, Varanda 2...').fill(tableNumber);
    }
    await this.pinInput.fill(pin);
    await this.fixTabletButton.click();
  }

  async startAttendanceIfFree() {
    if (await this.startAttendanceButton.isVisible()) {
      await this.startAttendanceButton.click();
      if (await this.chooseTabletButton.isVisible()) {
        await this.chooseTabletButton.click();
      }
    }
  }

  async callWaiter() {
    await this.callWaiterBarButton.click();
    await expect(this.waiterAlertBanner).toBeVisible();
  }

  async orderFirstFavoriteItem() {
    const orderBtn = this.page.getByRole('button', { name: 'Pedir' }).first();
    await expect(orderBtn).toBeVisible();
    await orderBtn.click();
    await expect(this.page.getByText(/adicionado e enviado para a cozinha/i)).toBeVisible();
  }

  async expectTableStatus(statusText: string | RegExp) {
    await expect(this.page.getByText(statusText).first()).toBeVisible();
  }
}
