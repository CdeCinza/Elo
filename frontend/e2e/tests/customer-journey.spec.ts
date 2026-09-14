import { test, expect } from '@playwright/test';
import { TabletPage } from '../pages/tablet.page';
import { KitchenPage } from '../pages/kitchen.page';
import { CounterPage } from '../pages/counter.page';

const TEST_TABLE = '99';

test.describe('Jornada do Cliente e Fluxo Integrado do Salão ELO', () => {

  test.afterAll(async ({ request }) => {
    try {
      await request.post(`http://localhost:8000/api/v1/pos/tables/${TEST_TABLE}/reset`);
    } catch {}
  });

  test('Configuração Kiosk do Tablet (/table -> vinculação com PIN)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('elo_tablet_table');
    });

    const tablet = new TabletPage(page);
    await tablet.gotoSetup();

    await expect(page.getByText(/Vincular Tablet à Mesa/i)).toBeVisible();
    await tablet.setupTablet(TEST_TABLE, '1234');

    await expect(page).toHaveURL(new RegExp(`.*\\/table\\/${TEST_TABLE}`));
  });

  test('Atendimento na Mesa, Pedido e Recepção na Cozinha (KDS)', async ({ page }) => {
    const tablet = new TabletPage(page);
    const kitchen = new KitchenPage(page);
    const counter = new CounterPage(page);

    // 1. Cliente acessa a mesa de testes
    await tablet.gotoTable(TEST_TABLE);
    await tablet.startAttendanceIfFree();

    // 2. Cliente pede um item dos favoritos
    await tablet.orderFirstFavoriteItem();

    // 3. Cozinha (KDS) visualiza o pedido em tempo real
    await kitchen.goto();
    await kitchen.expectLoaded();
    await kitchen.expectTableOrderVisible(TEST_TABLE);

    // 4. Balcão (POS) visualiza a mesa ocupada com comanda ativa
    await counter.goto();
    await counter.expectLoaded();
    await counter.selectTable(TEST_TABLE);
    await expect(page.getByText(/Itens consumidos|Comanda ativa/i).first()).toBeVisible();
  });

  test('Cliente solicita garçom pelo tablet (/table/99)', async ({ page }) => {
    const tablet = new TabletPage(page);
    await tablet.gotoTable(TEST_TABLE);
    await tablet.startAttendanceIfFree();

    // Aciona chamado de garçom
    await tablet.callWaiter();
    await expect(page.getByText(/Garçom chamado com sucesso/i)).toBeVisible();
  });

  test('Acesso e conferência de comandas no Caixa/Balcão (/counter)', async ({ page }) => {
    const counter = new CounterPage(page);
    await counter.goto();
    await counter.expectLoaded();

    // Seleciona a Mesa de testes e valida resumo da comanda e itens consumidos
    await counter.selectTable(TEST_TABLE);
    await expect(page.getByText(/Itens consumidos|Comanda ativa/i).first()).toBeVisible();
  });

  test('Personalização no Cardápio Digital com Cálculo Dinâmico de Extras (/table/99/menu)', async ({ page }) => {
    await page.goto(`/table/${TEST_TABLE}/menu`);

    // Abre o primeiro prato que tiver opções de customização
    const productCard = page.getByText(/Smash ELO Bacon Duplo/i).first();
    await expect(productCard).toBeVisible();
    await productCard.click();

    // Modal aberto (h2 no modal de personalização)
    await expect(page.getByRole('heading', { name: /Smash ELO Bacon Duplo/i, level: 2 })).toBeVisible();

    // Adiciona Bacon Extra (+4 fatias) (+R$ 6,00)
    const extraItem = page.getByText(/Bacon Extra/i).first();
    if (await extraItem.isVisible()) {
      await extraItem.click();
      // Total deve calcular dinamicamente R$ 36,90 + R$ 6,00 = R$ 42,90
      await expect(page.getByRole('button', { name: /42,90/ })).toBeVisible();
    }

    // Envia à cozinha
    const submitBtn = page.getByRole('button', { name: /Enviar à cozinha/i });
    await submitBtn.click();
    await expect(page.getByText(/enviado para a cozinha/i)).toBeVisible();
  });

  test('Check de itens na cozinha (KDS) permanece marcado e persiste (/kitchen)', async ({ page }) => {
    const tablet = new TabletPage(page);
    await tablet.gotoTable(TEST_TABLE);
    await tablet.startAttendanceIfFree();
    await tablet.orderFirstFavoriteItem();

    const kitchen = new KitchenPage(page);
    await kitchen.goto();
    await kitchen.expectLoaded();

    // Localiza o primeiro item com checkbox na tela do KDS
    const firstCheckboxItem = page.getByRole('checkbox').first();
    await expect(firstCheckboxItem).toBeVisible();

    // Clica para marcar como concluído
    await firstCheckboxItem.click();
    await expect(firstCheckboxItem).toHaveAttribute('aria-checked', 'true');

    // Recarrega a página para simular polling e persistência
    await page.reload();
    await kitchen.expectLoaded();

    // O item deve continuar marcado como concluído!
    const reloadedCheckbox = page.getByRole('checkbox').first();
    await expect(reloadedCheckbox).toHaveAttribute('aria-checked', 'true');
  });

});
