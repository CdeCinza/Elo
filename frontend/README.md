# Interface do ELO

Aplicação Next.js do [ELO Gastronomia](../README.md). A página inicial apresenta o caminho da comanda. As rotas `/table`, `/kitchen`, `/counter`, `/menu` e `/superadmin` atendem aos respectivos papéis no restaurante.

## Desenvolvimento

Com a API Laravel em execução na porta `8001`, crie `frontend/.env.local`:

```dotenv
ELO_API_ORIGIN=http://127.0.0.1:8001
```

Depois, neste diretório:

```bash
npm ci
npm run dev
```

Abra `http://localhost:3000`. O Next.js encaminha `/api/v1/*` à API definida em `ELO_API_ORIGIN`. Se essa variável não estiver configurada, o destino padrão é `http://127.0.0.1:8000`.

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` habilita a opção de cartão quando o backend também tem chaves Stripe de teste. `NEXT_PUBLIC_WIFI_NAME` e `NEXT_PUBLIC_WIFI_PASSWORD` exibem os dados de Wi-Fi no tablet.

## Verificação

```bash
npm run lint
npm run build
npx playwright test --list
npx playwright test
```

O teste da página inicial não precisa de dados de restaurante. O teste integrado de mesa, cozinha e caixa precisa de API e banco **exclusivos para testes**, um gerente e uma mesa livre reservada para essa suíte. Defina as variáveis abaixo antes de executá-lo:

```dotenv
ELO_E2E_MANAGER_EMAIL=gerente-do-ambiente-de-teste
ELO_E2E_MANAGER_PASSWORD=senha-do-ambiente-de-teste
ELO_E2E_TABLE=numero-da-mesa-exclusiva
```

Sem elas, o teste integrado é ignorado. Ele cria um pedido e reseta apenas a mesa indicada no fim; não o execute contra uma instância compartilhada. Para usar uma instância de frontend já em execução, defina `PLAYWRIGHT_TEST_BASE_URL`. Caso contrário, o Playwright inicia o Next.js localmente. Instale um navegador Playwright compatível ou defina `PLAYWRIGHT_BROWSER_CHANNEL=msedge` para usar o Microsoft Edge instalado na máquina.
