import { test, expect } from '@playwright/test';

const SWEEP_TABLE = '02';

test.describe('Varredura Completa do Sistema ELO (Tablet, Menu, KDS Kanban, POS Balcão e Caixa)', () => {

  test.beforeEach(async ({ request }) => {
    // Garante mesa limpa antes de cada fluxo
    try {
      await request.post(`http://localhost:8000/api/v1/pos/tables/${SWEEP_TABLE}/reset`);
    } catch {}
  });

  test.afterAll(async ({ request }) => {
    try {
      await request.post(`http://localhost:8000/api/v1/pos/tables/${SWEEP_TABLE}/reset`);
    } catch {}
  });

  test('Fluxo 1: Tablet Mesa 02 - Chegada, Check-in "Estou na mesa", Escolha de Atendimento', async ({ page }) => {
    await page.goto(`/table/${SWEEP_TABLE}`);

    // Verifica que a mesa livre mostra a tela de boas-vindas com botão "Estou na mesa"
    const startAttendanceBtn = page.getByRole('button', { name: /Iniciar atendimento • Estou na mesa/i });
    await expect(startAttendanceBtn).toBeVisible({ timeout: 5000 });

    // Inicia atendimento
    await startAttendanceBtn.click();

    // Modal de preferência deve aparecer: "Como prefere ser atendido hoje?"
    await expect(page.getByText(/Como prefere ser atendido hoje\?/i)).toBeVisible();
    await expect(page.getByText(/Chamar um garçom/i)).toBeVisible();
    await expect(page.getByText(/Pedir pelo tablet/i)).toBeVisible();

    // Escolhe pedir pelo tablet
    await page.getByRole('button', { name: /Pedir pelo tablet/i }).click();

    // Modal fecha e tela de experiência ativa com cardápio e favoritos aparece
    await expect(page.getByText(/Categorias do Cardápio/i)).toBeVisible();
    await expect(page.getByText(/Mais Pedidos da Casa/i)).toBeVisible();
  });

  test('Fluxo 2: Cardápio com Busca, Filtro, Customização com Extras e Envio à Cozinha', async ({ page, request }) => {
    // Check-in inicial
    await request.post(`http://localhost:8000/api/v1/customer/table/${SWEEP_TABLE}/check-in`);

    await page.goto(`/table/${SWEEP_TABLE}/menu`);

    // Testa filtro de categoria "Burgers"
    const burgersCategoryBtn = page.getByRole('button', { name: 'Burgers' });
    await expect(burgersCategoryBtn).toBeVisible();
    await burgersCategoryBtn.click();

    // Testa busca por produto
    const searchInput = page.getByPlaceholder(/Buscar por nome ou ingrediente/i);
    await searchInput.fill('Smash');

    // Abre o produto encontrado
    const productCard = page.getByText(/Smash ELO Bacon Duplo/i).first();
    await expect(productCard).toBeVisible();
    await productCard.click();

    // Modal de customização
    await expect(page.getByRole('heading', { name: /Smash ELO Bacon Duplo/i, level: 2 })).toBeVisible();

    // Seleciona ponto da carne
    const meatOption = page.getByRole('button', { name: /Ao Ponto para Bem/i });
    if (await meatOption.isVisible()) {
      await meatOption.click();
    }

    // Adiciona Bacon Extra
    const extraOption = page.getByText(/Bacon Extra/i).first();
    if (await extraOption.isVisible()) {
      await extraOption.click();
    }

    // Preenche observações
    const obsTextarea = page.getByPlaceholder(/Ex: sem cebola/i);
    await obsTextarea.fill('Sem cebola e molho à parte');

    // Envia à cozinha
    const submitBtn = page.getByRole('button', { name: /Enviar à cozinha/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Toast de sucesso
    await expect(page.getByText(/enviado para a cozinha/i)).toBeVisible();

    // Verifica contador na barra inferior da comanda
    await expect(page.getByText(/1 item ativo/i)).toBeVisible();
  });

  test('Fluxo 3: Cozinha KDS - Recepção em Tempo Real, Visualização das Notas e Avanço de Status', async ({ page, request }) => {
    // Cria pedido na mesa com observações
    await request.post(`http://localhost:8000/api/v1/customer/table/${SWEEP_TABLE}/order`, {
      data: {
        items: [
          {
            product_id: 1,
            quantity: 2,
            notes: 'Ponto: Bem Passado • Obs: sem sal',
          },
        ],
      },
    });

    await page.goto('/kitchen');

    // Verifica que o pedido da Mesa 02 está visível
    const tableHeader = page.getByText(new RegExp(`Mesa ${SWEEP_TABLE}`, 'i')).first();
    await expect(tableHeader).toBeVisible({ timeout: 5000 });

    // Verifica que o item e a observação aparecem
    await expect(page.getByText(/Smash ELO Bacon Duplo/i).first()).toBeVisible();
    await expect(page.getByText(/Ponto: Bem Passado/i).first()).toBeVisible();

    // Avança status: Iniciar Preparo
    const startBtn = page.getByRole('button', { name: /Iniciar Preparo/i }).first();
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Avança status: Concluir Prato • Chamar Garçom
    const readyBtn = page.getByRole('button', { name: /Concluir Prato/i }).first();
    await expect(readyBtn).toBeVisible({ timeout: 5000 });
    await readyBtn.click();

    // O status deve avançar para pronto para servir com botão de baixar entrega
    const deliverBtn = page.getByRole('button', { name: /Entregue ao Garçom \(Baixar\)/i }).first();
    await expect(deliverBtn).toBeVisible({ timeout: 5000 });
  });

  test('Fluxo 4: Chamado de Garçom e Notificação no Caixa / Balcão POS', async ({ page, request }) => {
    // Ocupa a mesa e aciona garçom
    await request.post(`http://localhost:8000/api/v1/customer/table/${SWEEP_TABLE}/call-waiter`);

    // Acessa o balcão
    await page.goto('/counter');

    // No balcão, a Mesa 02 deve exibir o alerta "Garçom chamado!"
    const waiterAlert = page.getByRole('button', { name: /Garçom chamado/i }).first();
    await expect(waiterAlert).toBeVisible({ timeout: 5000 });

    // Clica no alerta para atender o chamado
    await waiterAlert.click();

    // Alerta é removido
    await expect(waiterAlert).not.toBeVisible({ timeout: 5000 });
  });

  test('Fluxo 5: Balcão POS - Lançamento Manual de Item na Comanda e Fechamento', async ({ page, request }) => {
    // Abre a mesa
    await request.post(`http://localhost:8000/api/v1/pos/tables/${SWEEP_TABLE}/open`);

    await page.goto('/counter');

    // Seleciona a Mesa 02 no mapa
    const tableCard = page.getByRole('button', { name: new RegExp(`Mesa ${SWEEP_TABLE}`, 'i') });
    await tableCard.click();

    // Drawer da comanda deve abrir à direita
    await expect(page.getByRole('heading', { name: new RegExp(`Mesa ${SWEEP_TABLE}`, 'i') })).toBeVisible();

    // Clica em "Lançar item"
    const addItemBtn = page.getByRole('button', { name: /Lançar item/i });
    await expect(addItemBtn).toBeVisible();
    await addItemBtn.click();

    // Modal de lançamento aparece
    await expect(page.getByText(/Lançar item na Mesa/i)).toBeVisible();

    // Seleciona o primeiro produto do select
    const productSelect = page.locator('select');
    await productSelect.selectOption({ index: 1 });

    // Confirma lançamento
    const confirmLaunchBtn = page.getByRole('button', { name: /Confirmar lançamento/i });
    await confirmLaunchBtn.click();

    // Toast de sucesso e item listado
    await expect(page.getByText(/Item lançado na comanda com sucesso/i)).toBeVisible();
    await expect(page.getByText(/Itens consumidos \(1\)/i)).toBeVisible();

    // Seleciona pagamento PIX e fecha a mesa
    const pixBtn = page.getByRole('button', { name: 'PIX' });
    await pixBtn.click();

    const closeBtn = page.getByRole('button', { name: /Fechar mesa/i });
    await closeBtn.click();

    // Confirmação de baixa
    await expect(page.getByText(/finalizada com sucesso/i)).toBeVisible();
  });

  test('Fluxo 6: Divisão de Conta e Solicitação de Pagamento pelo Tablet (/table/02/order)', async ({ page, request }) => {
    // Cria pedido com 2 itens
    await request.post(`http://localhost:8000/api/v1/customer/table/${SWEEP_TABLE}/order`, {
      data: {
        items: [
          { product_id: 1, quantity: 1 },
          { product_id: 2, quantity: 1 },
        ],
      },
    });

    await page.goto(`/table/${SWEEP_TABLE}/order`);

    // Verifica que os itens aparecem na comanda
    await expect(page.getByText(/Itens na comanda/i)).toBeVisible();
    await expect(page.getByText(/Smash ELO Bacon Duplo/i)).toBeVisible();

    // Testa divisão da conta: aumenta para 3 pessoas
    const plusSplitBtn = page.getByRole('button', { name: '+' });
    await plusSplitBtn.click();
    await expect(page.getByText(/3 pessoas/i)).toBeVisible();
    await expect(page.getByText(/Por pessoa \(3x\)/i)).toBeVisible();

    // Clica no botão de pedir conta
    const requestBillBtn = page.getByRole('button', { name: /Pedir conta/i });
    await expect(requestBillBtn).toBeVisible();
    await requestBillBtn.click();

    // Modal de PIX abre com QR code
    await expect(page.getByText(new RegExp(`Pagamento da Mesa ${SWEEP_TABLE}`, 'i'))).toBeVisible();
    await expect(page.getByRole('button', { name: /Copiar código PIX/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pagar com Cartão \(Stripe Online\)/i })).toBeVisible();
  });

  test('Fluxo 7: Validações de Borda do POS (Exclusão bloqueada de mesa ocupada e Criação de duplicata)', async ({ request }) => {
    // 1. Ocupa a mesa 02
    await request.post(`http://localhost:8000/api/v1/pos/tables/${SWEEP_TABLE}/open`);

    // Tentar excluir mesa ocupada deve retornar 422
    const deleteRes = await request.delete(`http://localhost:8000/api/v1/pos/tables/${SWEEP_TABLE}`);
    expect(deleteRes.status()).toBe(422);
    const deleteJson = await deleteRes.json();
    expect(deleteJson.message).toContain('Não é possível excluir');

    // 2. Tentar cadastrar mesa com número já existente deve retornar 422
    const duplicateRes = await request.post('http://localhost:8000/api/v1/pos/tables', {
      data: {
        number: SWEEP_TABLE,
        capacity: 4,
      },
    });
    expect(duplicateRes.status()).toBe(422);
    const dupJson = await duplicateRes.json();
    expect(dupJson.message).toContain('Já existe uma mesa cadastrada');
  });

});
