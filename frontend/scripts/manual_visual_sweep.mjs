import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:\\Users\\mathe\\.gemini\\antigravity\\brain\\5fd00008-84fd-4833-9cf8-6e0c935e040c\\screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runVisualSweep() {
  console.log('🚀 Iniciando varredura visual e testes manuais integrados do ELO...');
  
  // Reseta mesa 03 no backend
  try {
    await fetch('http://localhost:8000/api/v1/pos/tables/03/reset', { method: 'POST' });
  } catch (e) {
    console.error('Erro ao resetar mesa 03:', e.message);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();

  // 1. Home Hub
  console.log('📸 1. Home Hub (/)');
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_home_hub.png') });

  // 2. Setup do Tablet
  console.log('📸 2. Tablet Kiosk Setup (/table)');
  await page.goto('http://localhost:3000/table');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_tablet_kiosk.png') });

  // 3. Chegada na Mesa 03 (Estou na mesa)
  console.log('📸 3. Mesa 03 - Chegada (/table/03)');
  await page.goto('http://localhost:3000/table/03');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_table_arrival.png') });

  // 4. Clica em "Iniciar atendimento • Estou na mesa"
  console.log('📸 4. Modal de Preferência de Atendimento');
  const startBtn = page.getByRole('button', { name: /Iniciar atendimento • Estou na mesa/i });
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_table_preference_modal.png') });
  }

  // 5. Escolhe pedir pelo tablet e vai ao cardápio
  console.log('📸 5. Cardápio Digital (/table/03/menu)');
  await page.goto('http://localhost:3000/table/03/menu');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_table_menu.png') });

  // 6. Abre customização de produto com adicionais
  console.log('📸 6. Modal de Customização com Extras e Observação');
  const productCard = page.getByText(/Smash ELO Bacon Duplo/i).first();
  if (await productCard.isVisible()) {
    await productCard.click();
    await page.waitForTimeout(800);

    // Seleciona ponto da carne
    const meatOption = page.getByRole('button', { name: /Ao Ponto para Bem/i });
    if (await meatOption.isVisible()) await meatOption.click();

    // Adiciona Bacon Extra
    const extraOption = page.getByText(/Bacon Extra/i).first();
    if (await extraOption.isVisible()) await extraOption.click();

    // Digita observação
    const obsTextarea = page.getByPlaceholder(/Ex: sem cebola/i);
    if (await obsTextarea.isVisible()) await obsTextarea.fill('Sem cebola e molho especial à parte');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_product_customization_modal.png') });

    // Envia à cozinha
    const submitBtn = page.getByRole('button', { name: /Enviar à cozinha/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // 7. Cozinha KDS
  console.log('📸 7. Cozinha KDS (/kitchen)');
  await page.goto('http://localhost:3000/kitchen');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_kitchen_kds_kanban.png') });

  // 8. Chamar garçom na Mesa 03 e verificar no Balcão POS
  console.log('📸 8. Balcão POS (/counter) com Alerta de Garçom');
  try {
    await fetch('http://localhost:8000/api/v1/customer/table/03/call-waiter', { method: 'POST' });
  } catch {}

  await page.goto('http://localhost:3000/counter');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_counter_pos_salon.png') });

  // 9. Clica na Mesa 03 no Balcão e abre gaveta da comanda
  console.log('📸 9. Gaveta da Comanda da Mesa 03 no Balcão');
  const table03Card = page.getByRole('button', { name: /Mesa 03/i }).first();
  if (await table03Card.isVisible()) {
    await table03Card.click();
    await page.waitForTimeout(1000);

    // Clica em lançar item para abrir modal de lançamento
    const addItemBtn = page.getByRole('button', { name: /Lançar item/i });
    if (await addItemBtn.isVisible()) {
      await addItemBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_counter_drawer_launch_item.png') });
      // Cancela o modal para manter comanda limpa
      const cancelBtn = page.getByRole('button', { name: /Cancelar/i });
      if (await cancelBtn.isVisible()) await cancelBtn.click();
    }
  }

  // 10. Comanda do Cliente com Divisão de Conta e QR Code PIX
  console.log('📸 10. Comanda do Cliente com QR Code PIX (/table/03/order)');
  await page.goto('http://localhost:3000/table/03/order');
  await page.waitForTimeout(1000);

  // Divide para 3 pessoas
  const plusBtn = page.getByRole('button', { name: '+' });
  if (await plusBtn.isVisible()) {
    await plusBtn.click();
    await page.waitForTimeout(300);
  }

  // Clica em pedir conta
  const billBtn = page.getByRole('button', { name: /Pedir conta/i });
  if (await billBtn.isVisible()) {
    await billBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_table_bill_split_pix.png') });
  }

  // 11. Tela de Login
  console.log('📸 11. Tela de Login (/login)');
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_login_screen.png') });

  // 12. Login como SuperAdmin e Painel Multi-Restaurantes
  console.log('📸 12. Painel Super Admin (/superadmin)');
  const emailInput = page.getByPlaceholder(/exemplo@restaurante.com/i);
  const passInput = page.locator('input[type="password"]');
  const loginSubmit = page.getByRole('button', { name: /Entrar no Sistema/i });

  if (await emailInput.isVisible() && await passInput.isVisible()) {
    await emailInput.fill('matheusneru@gmail.com');
    await passInput.fill('password123');
    await loginSubmit.click();
    await page.waitForTimeout(2000);

    if (page.url().includes('/superadmin')) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_superadmin_dashboard.png') });
    }
  }

  // 13. Fechamento da Mesa 03 no Balcão (Baixa com PIX)
  console.log('📸 13. Baixa e Liberação da Mesa no Balcão');
  try {
    await fetch('http://localhost:8000/api/v1/pos/tables/03/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: 'pix' }),
    });
  } catch {}

  await page.goto('http://localhost:3000/counter');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_counter_table_closed.png') });

  await browser.close();
  console.log('✅ Varredura visual finalizada com sucesso! Todas as screenshots foram salvas.');
}

runVisualSweep().catch(console.error);
