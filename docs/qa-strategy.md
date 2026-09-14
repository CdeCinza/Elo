# 🛡️ Estratégia de Qualidade de Software (QA Strategy) - ELO Gastronomia

> **Versão:** 1.0  
> **Autor / Owner:** Lead QA & Engenharia Elo  
> **Status:** Ativo  
> **Última Atualização:** Setembro / 2026  

---

### 1. Scope & Objectives

#### 1.1 Escopo Coberto (In-Scope)
- **Frente de Salão & Totem Tablet (`/table`)**: Check-in do cliente, chamado de garçom, seleção de mesa, navegação de cardápio, personalização de pratos e envio de pedidos.
- **Linha de Produção & Cozinha (`/kitchen` - KDS)**: Fila cronológica FIFO de comandas, separação de praças (Chapa, Fritura, Sobremesas), transições de estado (`pending` ➔ `preparing` ➔ `ready` ➔ `delivered`).
- **Frente de Caixa & Balcão (`/counter` - POS)**: Monitoramento de mesas ativas, lançamentos manuais, recebimento de pagamentos (PIX, Cartão, Dinheiro), fechamento e liberação de mesas.
- **Painel Administrativo & Multi-Tenancy (`/superadmin`)**: Gestão de filiais, isolamento de inquilinos (tenants), métricas consolidadas e provisionamento de usuários.
- **Backend API (Laravel 12 / PHP 8.5)**: Máquina de estados de pedidos, regras de negócio de estoque com ficha técnica de ingredientes e autenticação Sanctum.

#### 1.2 Fora de Escopo (Out-of-Scope)
- Gateways de pagamento externos em modo real (testados exclusivamente via PSP Sandboxes e stubs).
- Infraestrutura física de impressoras fiscais térmicas (validadas por emuladores ESC/POS).

#### 1.3 Objetivos Mensuráveis
1. Manter a taxa de escape de defeitos para produção (*Defect Escape Rate*) abaixo de **3%**.
2. Garantir que o pipeline de validação contínua (CI) retorne feedback em menos de **10 minutos**.
3. Garantir **100% de cobertura E2E nos 4 fluxos críticos** (Check-in, Pedido, KDS e Fechamento de Conta).

---

### 2. Test Levels & Types

| Nível | O que Valida | Responsável | Ferramenta | Proporção Alvo | Frequência |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Unitário** | Lógica de modelos, cálculo de taxas, regras de estoque | Dev | PHPUnit | 70% | A cada commit |
| **Integração / Feature** | Ciclo de vida de endpoints da API, autenticação, transações DB | Dev / QA | PHPUnit / Sanctum | 20% | A cada PR |
| **E2E (End-to-End)** | Fluxos reais de salão no navegador (Tablet ➔ KDS ➔ POS) | QA / SDET | Playwright (TS) | 10% | Pré-merge / Deploy |
| **Regressão Visual** | Fidelidade editorial do design system, quebras de layout | QA | Playwright Screenshots | Amostragem | Diário / Nightly |
| **Segurança & Políticas** | Isolamento multi-tenancy e autorização baseada em papéis (RBAC) | Sec / QA | PHPUnit Policies | 100% dos controllers | A cada PR |

---

### 3. Test Pyramid Analysis

```text
       ▲
      / \        E2E (10%) - Playwright (Jornada do Cliente, KDS e Balcão)
     /   \       
    /=====\      Integração (20%) - Feature Tests Laravel & API Contracts
   /       \     
  /=========\    Unitários (70%) - Cálculo de comanda, Fichas Técnicas, Enums
```

- **Diagnóstico da Pirâmide**: Pirâmide saudável e equilibrada. O sistema evita o anti-padrão de *Ice Cream Cone* (excesso de E2E lentos) delegando a validação pesada de regras e combinações aos testes de Feature e Unit do Laravel, enquanto o Playwright atesta a usabilidade e sincronismo real do navegador.

---

### 4. Risk Assessment Matrix (Matriz de Risco 5x5)

| Área / Funcionalidade | Impacto (1-5) | Probabilidade (1-5) | Risco (I x P) | Nível | Estratégia de Teste |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Processamento de Pagamentos & Fechamento de Comanda** | 5 | 3 | **15** | **CRÍTICO** | E2E Playwright + Feature Test + Validação de Saldo |
| **Isolamento de Dados Multi-Tenancy** | 5 | 2 | **10** | **ALTO** | Feature Tests cruzados de restaurantes diferentes |
| **Fila em Tempo Real da Cozinha (KDS FIFO)** | 4 | 3 | **12** | **ALTO** | E2E Playwright sincronizado (ordem de chegada) |
| **Cardápio Digital & Adição de Itens com Notas** | 4 | 2 | **8** | **MÉDIO** | E2E Playwright + Testes de Componentes |
| **Controle de Insumos / Baixa Automática de Estoque** | 3 | 2 | **6** | **MÉDIO** | Feature Tests (StockRecipeTest) |
| **Customização de Tema / Cores do Restaurante** | 2 | 2 | **4** | **BAIXO** | Teste visual pontual |

---

### 5. Environment Strategy

| Ambiente | Propósito | Tipos de Teste Executados | Base de Dados |
| :--- | :--- | :--- | :--- |
| **Local (Dev)** | Desenvolvimento ágil e TDD | Unitários, Feature Tests pontuais | MySQL Local / SQLite in-memory |
| **CI (GitHub Actions)** | Verificação automática de integridade de PR | PHPUnit completo, Pint (linting), Playwright Headless | Ephemeral MySQL / SQLite |
| **Staging / Homologação** | Validação pré-produção com a equipe | E2E Completo, Testes Exploratórios com Tablets físicos | Dados espelhados higienizados |
| **Produção** | Operação real dos restaurantes | Healthcheck contínuo, monitoramento sintético | Produção (Isolamento total) |

---

### 6. Tool Selection Rationale

| Critério (Peso) | Playwright | Cypress | Selenium |
| :--- | :---: | :---: | :---: |
| **Suporte Nativo a Múltiplas Abas/Contextos (POS + KDS + Tablet)** (25%) | **5** | 2 | 3 |
| **Velocidade & Auto-Waiting Nativo (sem `waitForTimeout`)** (20%) | **5** | 4 | 2 |
| **Integração com TypeScript & Next.js** (20%) | **5** | 4 | 3 |
| **Gravação de Traces e Vídeos em Falhas** (15%) | **5** | 4 | 2 |
| **Custo de Manutenção / Estabilidade** (20%) | **5** | 3 | 2 |
| **Pontuação Ponderada** | **5.0** | 3.3 | 2.5 |

**Decisão**: **Playwright** foi escolhido como a ferramenta padrão por permitir orquestrar facilmente múltiplos navegadores e páginas simultâneas (essencial para testar um pedido saindo do Tablet e caindo em tempo real no KDS e no Balcão).

---

### 7. CI Scaling Levers

1. **Paralelização e Sharding**: Execução paralela por praças e suítes isoladas (`fullyParallel: true`).
2. **Fail Fast**: Interrupção em caso de regressões críticas de compilação ou banco de dados.
3. **Artifacts de Diagnóstico**: Retenção automática de Screenshots e Traces `.zip` apenas em caso de falha (`retain-on-failure`).

---

### 8. Entry / Exit Criteria

#### Testes de Unidade / Feature
- **Entrada**: Código compila sem erros, migrations aplicadas.
- **Saída**: 100% de aprovação na suíte PHPUnit, 0 erros no Laravel Pint.

#### Testes E2E (Playwright)
- **Entrada**: Backend e Frontend disponíveis em localhost/staging.
- **Saída**: Todos os cenários de jornada do cliente passam sem flakiness (`0 retries`).

#### Critério de Release (Go/No-Go)
- **Zero** defeitos de severidade P0 (bloqueantes) ou P1 (altos).
- Fila de pedidos e fechamento de mesas validados de ponta a ponta.

---

### 9. Quality Gates & Definition of Done (DoD)

- **Gate de PR (Pull Request)**:
  - Análise estática com Pint aprovada (`vendor/bin/pint --test`).
  - Suíte PHPUnit verde (`php artisan test`).
  - Build do Next.js aprovado (`npm run build`).
  - Pelo menos 1 aprovação de code review.
- **Gate de Deploy**:
  - Bateria Playwright E2E executada com sucesso.
  - Teste de isolamento de restaurante validado.

---

### 10. Metrics & KPIs

| Métrica | Definição | Alvo | Acompanhamento |
| :--- | :--- | :--- | :--- |
| **Taxa de Sucesso dos Testes** | Percentual de testes com resultado verde | 100% | Por PR |
| **Taxa de Instabilidade (Flakiness Rate)** | Testes que falham de forma intermitente | < 1% | Semanal |
| **Defect Escape Rate** | Bugs identificados em produção vs total | < 3% | Mensal |
| **Tempo de Execução do Pipeline** | Duração completa da bateria no CI | < 8 min | Por PR |
| **Cobertura de Fluxos Críticos** | Jornadas de venda e produção cobertas por E2E | 100% | Por Release |

---

### 11. Timeline & Fases de Evolução

- **Fase 1 (Atual - Concluída)**: Cobertura completa de Feature tests no Laravel e Setup do Playwright com Page Objects.
- **Fase 2 (Próxima)**: Testes de estresse com volume de pedidos simultâneos no KDS e geração automática de relatórios visuais.

---

### 12. Anti-Patterns Banidos

1. 🚫 **`waitForTimeout()`**: Estritamente proibido esperar por tempo fixo. Todas as asserções devem usar auto-waiting (`expect(locator).toBeVisible()`).
2. 🚫 **Seletores CSS / XPaths Frágeis**: Proibido usar classes geradas ou aninhamento profundo. Obrigatório uso de `getByRole`, `getByText`, `getByLabel` ou `getByTestId`.
3. 🚫 **Testes que Dependem de Outros Testes**: Cada teste deve ser idempotente e autônomo.

---

### 13. Revision History

| Versão | Data | Autor | Descrição das Mudanças |
| :--- | :--- | :--- | :--- |
| **1.0** | 13/09/2026 | Equipe de Engenharia Elo | Criação inicial da estratégia de QA e arquitetura Playwright |
