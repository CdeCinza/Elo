import { type Page } from '@playwright/test';

export class TabletPage {
  readonly startAttendanceButton;
  readonly chooseTabletButton;

  constructor(private readonly page: Page) {
    this.startAttendanceButton = page.getByRole('button', { name: /Iniciar atendimento/ });
    this.chooseTabletButton = page.getByRole('button', { name: /Pedir pelo tablet/ });
  }

  async gotoSetup(): Promise<void> {
    await this.page.goto('/table');
  }

  async setupTablet(tableNumber: string, managerEmail: string, managerPassword: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Digitar número manual' }).click();
    await this.page.getByRole('textbox', { name: 'Número da mesa' }).fill(tableNumber);
    await this.page.getByRole('textbox', { name: 'E-mail do gerente' }).fill(managerEmail);
    await this.page.getByLabel('Senha do gerente').fill(managerPassword);
    await this.page.getByRole('button', { name: 'Fixar neste Tablet e Iniciar' }).click();
  }
}
