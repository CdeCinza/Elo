# Relatório de QA e Hardening — ELO Gastronomia

> **Data:** 28/09/2026
> **Escopo:** backend Laravel (API), frontend Next.js (tablet, cardápio, comanda, caixa, cozinha, super admin) e banco MySQL local
> **Resultado:** 99 testes de backend passando (eram 65), 493 asserções. Build e lint do frontend sem erros. Nenhuma tela com rolagem lateral em 375px.

Este documento tem três partes:

1. **O que foi feito:** bugs encontrados e corrigidos, com o motivo de cada um.
2. **O que ficou pendente:** decisões de produto que precisam de uma resposta humana.
3. **Como trabalhar neste projeto:** o método usado para testar e construir, escrito como playbook para qualquer agente de IA (ou pessoa) seguir.

---

## 1. Ambiente: armadilhas que custam tempo

| Armadilha | Como resolver |
|---|---|
| O `php` do PATH é o **8.2**, e o projeto exige **8.4 ou mais** | Use sempre `C:\Php8.5.1\php.exe` (no Git Bash: `/c/Php8.5.1/php.exe`) |
| A porta **8000** é de outra aplicação (calendarsonoda) | O backend do ELO roda na **8001**: `C:\Php8.5.1\php.exe artisan serve --port=8001` |
| O frontend precisa saber onde está a API | `frontend/.env.local` define `ELO_API_ORIGIN=http://127.0.0.1:8001` (o `next.config.ts` faz o proxy de `/api/v1`) |
| O frontend roda como **build de produção** (`next start`) | Qualquer mudança no front exige `npm run build` antes de reiniciar o `next start`. Sem isso, você testa código antigo |
| Os testes usam outro banco | `phpunit.xml` aponta para `elo_testing`. Nunca rode `migrate:fresh` no banco `elo` (dados de demo) sem autorização |
| O e-mail (Brevo) está com a chave vencida | Falhas de envio de e-mail **não** são bugs da interface. A senha do Super Admin gerada no seed chega por esse e-mail |
| Não há chaves do Stripe configuradas | O cartão aparece desativado no caixa e escondido no tablet. Para demonstrar, configure chaves de teste (`pk_test_...` / `sk_test_...`) |
| O fuso mudou de UTC para `America/Sao_Paulo` | Registros gravados antes da mudança aparecem 3h deslocados (ex.: "0 min" na cozinha) |

Credenciais de teste (seed): `dono@`, `gerente@`, `garcom@`, `chef@` e `caixa@elo.com`, todas com a senha `password`.

---

## 2. O que foi feito

### 2.1 Backend (API)

**Segurança e multi-tenant**
- O Stripe `create-intent` buscava a mesa **sem filtrar por restaurante**: o restaurante B conseguia cobrar a "Mesa 01" do restaurante A. Agora tudo passa pelo trait `app/Http/Controllers/Concerns/ResolvesRestaurantContext.php`.
- Número da mesa e ID interno eram ambíguos (`orWhere('id', ...)`): excluir a "Mesa 99" podia apagar a mesa de ID 99.
- Mesas inexistentes eram **criadas automaticamente** por requisições públicas. Agora retornam 404.
- Pedidos feitos pelo tablet eram atribuídos ao **primeiro usuário do banco** (até ao super admin), e o código usava `User::factory()` em produção. Agora o pedido do cliente fica com `user_id = null`, e as ações do caixa ficam com o usuário logado.
- Rotas do POS, do KDS e do Super Admin agora exigem autenticação e papel. Criar, editar, excluir e resetar mesa ficou restrito à gerência (garçom e caixa só operam).
- Suspender um restaurante agora tem efeito: o login é bloqueado, os tokens são revogados e os endpoints públicos retornam 403.
- Nomes de categoria e ingrediente passaram a ser únicos **por restaurante**, e não mais globais.

**Dinheiro**
- O caixa mostrava o total **com 10% de serviço**, mas gravava o pagamento **sem** a taxa. Agora o `include_service` vale para PIX e dinheiro, igual ao Stripe.
- Fechar uma mesa sem consumo gravava um pagamento "pago" de R$ 0. Agora só libera a mesa e cancela a comanda vazia.
- Cartão sem Stripe no caixa: o pedido não é mais marcado como pago.

**Cozinha e estoque**
- **Status por item** (`order_items.status`). Antes, uma segunda rodada fazia os pratos já servidos voltarem para a fila. Agora cada prato segue a sua etapa, e o `PATCH /kds/orders/{id}/status` aceita `from` para avançar só uma etapa.
- O tempo de espera passou a contar a partir do prato mais antigo ainda não pronto, e não da abertura da mesa.
- A **baixa de estoque nunca acontecia** no fluxo real, porque o KDS pulava o status `confirmed`. Agora a baixa é feita por item, uma única vez, quando o prato entra em preparo (`app/Services/StockService.php` e `KitchenFlowService.php`).
- Pedir mais itens depois de pedir a conta não apaga mais o aviso de "Pedindo conta". Pedir a conta sem consumo retorna 422.

**Robustez (erros 500 que viraram mensagens claras)**
- Quantidades e preços absurdos (estouro de decimal), `per_page=abc`, IDs não numéricos.
- Exclusão de produto, categoria, restaurante ou mesa com histórico ou pedido aberto.
- Renomear uma mesa para um número já usado.
- `/products` paginava em 15 itens. O front agora pede `per_page=200`.

**Idioma e fuso**
- `lang/pt_BR/*` com as mensagens de validação em português, e `APP_LOCALE=pt_BR`.
- `APP_TIMEZONE=America/Sao_Paulo`.

### 2.2 Frontend

**Tablet do cliente**
- O PIN do tablet era `1234`, **aparecia escrito na tela** e era checado só no navegador. Agora vincular ou desvincular o tablet exige o **e-mail e a senha de um gerente**, validados na API. O token é descartado na hora e o tablet fica preso ao restaurante do gerente (`src/lib/tablet.ts`).
- O tablet volta sozinho para a tela de boas-vindas quando o caixa libera a mesa.
- "Mais pedidos da casa" tinha itens falsos de fallback e enviava para a cozinha com um toque. Agora a seção se chama "Sugestões da casa" e abre o prato no cardápio para o cliente confirmar.
- **Clique duplo** mandava o pedido duas vezes (reproduzido no teste). O hook `useCustomerSession` agora reaproveita a requisição em andamento, e o caixa e a cozinha também têm trava.
- Comanda: o "dividir a conta" perdia 1 centavo (agora arredonda para cima). O status é mostrado por item. Pedir a conta trata erros. Não há mais "PIX" falso (QR de ícone e botão "copiar" que não copiava). O botão de conta fica desativado sem consumo.
- O Wi-Fi vem de `NEXT_PUBLIC_WIFI_NAME` / `NEXT_PUBLIC_WIFI_PASSWORD`. Sem essas variáveis, o botão some.
- Os toasts estavam com título e mensagem invertidos em todas as telas do cliente.

**Caixa (POS)**
- O botão "Sair" era só um link: agora faz logout de verdade (revoga o token).
- O "Operador" editável era falso. Agora mostra o usuário logado.
- As ações de gerência ficam escondidas para garçom e caixa.
- Um 403 ou uma falha de rede aparecia como "Nenhuma mesa cadastrada". Agora há telas de "sem permissão" e "sem conexão", e o polling para quando a resposta é 403.
- Fechar a conta com pratos ainda na cozinha pede confirmação.
- "Imprimir" agora imprime uma pré-conta, e não a tela inteira.
- Em telas menores, selecionar uma mesa rola até o painel de detalhes.

**Cozinha (KDS)**
- Cada coluna mostra só os pratos daquela etapa.
- O alerta sonoro é real (WebAudio) e toca quando chega um pedido novo.
- A "espera média" é calculada; antes o "14 min" era fixo.
- Logout, estado de erro, aviso quando uma ação falha, trava contra clique duplo, e o polling atrasado não sobrescreve mais uma ação recente.

**Geral**
- Um 401 em tela operacional redireciona para `/login?redirect=...`, e o login devolve a pessoa para onde ela estava. O chef cai direto na cozinha.
- Esc fecha todos os modais (`src/hooks/useEscapeKey.ts`).
- Valores monetários usam `formatBRL` (`src/lib/format.ts` → `R$ 1.234,50`).
- Correções de acessibilidade: `aria-label`, `htmlFor`, `role="dialog"`.
- Removidos: componentes mortos, dados mockados, `console.log` e imports sem uso.

### 2.3 Gestão do cardápio (`/menu`), a tela que faltava

Antes não havia tela para o dono cadastrar o cardápio: a API existia, mas um restaurante criado no Super Admin ficava com o tablet vazio. Agora:

- **Acesso:** pelo botão "Cardápio" no cabeçalho do caixa, pelo card "Cardápio & estoque" na página inicial, ou direto em `/menu`. Só dono, admin do restaurante, gerente e super admin editam. Os outros papéis veem "Seu perfil não edita o cardápio". Um super admin sem restaurante selecionado é levado ao painel para escolher um.
- **Primeiros passos:** com o cardápio vazio, a tela mostra um guia de 3 passos (categorias → estoque opcional → pratos). Tentar criar um prato sem categoria abre direto o formulário de categoria.
- **Pratos:**
  - busca e filtro por categoria;
  - foto com prévia e aviso se o link não carregar;
  - preço aceita `34,90` e `1.234,50`;
  - descrição;
  - **ficha técnica** (ingrediente + quantidade) usada na baixa automática de estoque;
  - botão "À venda / Pausado" que tira o prato do tablet na hora.
- **Categorias:** criar, editar, excluir e alternar entre **visível e oculta**. Uma categoria oculta e os pratos dela saem do tablet.
- **Estoque:** ingredientes com quantidade, unidade e nível de alerta. Há um selo de "Estoque baixo" e um contador na aba.
- **Proteções:**
  - trava contra clique duplo em salvar, excluir e alternar (o clique duplo criava o prato duas vezes, reproduzido no teste);
  - confirmação antes de excluir, explicando o efeito em cascata;
  - erros de validação da API aparecem no campo certo, em português;
  - Esc e clique fora fecham os formulários;
  - layout verificado em 375px.
- **Integrações:**
  - o tablet agora esconde categorias ocultas e os pratos delas;
  - o cardápio vazio do tablet mostra "O cardápio está sendo preparado";
  - o "Lançar item" do caixa aponta para o cadastro quando não há pratos.
- **Backend:** para o super admin, `GET /ingredients` passou a respeitar o restaurante selecionado (antes listava os ingredientes de todos). → `IngredientApiTest::test_super_admin_listing_is_scoped_to_the_selected_restaurant`.
- **Arquivos:**
  - `frontend/src/app/menu/page.tsx`
  - `frontend/src/components/catalog/*` (formulários e modal base)
  - `frontend/src/lib/catalog.ts` (tipos, carga do catálogo, conversão de decimais, erros de validação)

---

## 3. Pendências e correções posteriores

1. **Dados antigos com 3h de diferença.** Para uma demo limpa: `C:\Php8.5.1\php.exe artisan migrate:fresh --seed`. Isso **apaga todo o banco `elo`**, e a senha do Super Admin vai por e-mail (Brevo vencido).
2. **Decisão operacional pendente:** cancelar um pedido ou forçar a liberação da mesa não devolve o estoque já baixado. Como a baixa ocorre quando o item entra em preparo, a regra de estorno precisa distinguir ingrediente ainda disponível de consumo ou desperdício real.
3. **Corrigido em 29/09/2026:** listagens e detalhes públicos de produtos e categorias passaram a respeitar o restaurante selecionado; sem cabeçalho, usam apenas o restaurante padrão.
4. **Corrigido em 29/09/2026:** confirmação e webhook do Stripe só liberam a mesa se ela ainda estiver atendendo o pedido pago.
5. **Corrigido em 29/09/2026:** o garçom pode adicionar itens a pedidos de mesa criados pelo cliente, sem receber permissão geral para mudar o status desses pedidos.

---

## 4. Como trabalhar neste projeto (playbook para agentes de IA)

O método abaixo é o que encontrou os bugs deste relatório. Ele não depende de um modelo "mais esperto". Depende de **disciplina de verificação**. Um agente mais simples, seguindo os passos à risca, chega a resultados parecidos.

### 4.1 Princípios

1. **Nunca confie que funciona: prove.** "O código parece certo" não é evidência. Evidência é um teste passando, uma requisição com status e corpo conferidos, ou o texto da tela depois do clique.
2. **Reproduza antes de corrigir.** Cada bug deste relatório foi visto acontecendo antes (ex.: dois cliques geraram "2 itens ativos"). Se você não reproduz, não sabe se corrigiu.
3. **Teste o caminho infeliz.** O caminho feliz quase sempre funciona. Os bugs estão em:
   - clique duplo;
   - usuário sem permissão;
   - servidor fora do ar;
   - lista vazia;
   - valor zero ou absurdo;
   - segunda rodada de pedido;
   - outro restaurante;
   - token expirado.
4. **Desconfie de telas "bonitas demais".** Números fixos ("14 min"), botões que só mostram toast ("PIX copiado!") e fallbacks com dados falsos são bugs para quem vai usar ou avaliar o sistema.
5. **Compare o que a tela mostra com o que o banco grava.** O bug da taxa de serviço só apareceu conferindo `payments.amount` depois de fechar a mesa.
6. **Uma correção sem teste regride.** Todo bug de backend ganhou um teste em `tests/Feature/*`.
7. **Não "corrija" decisão de produto.** Se não está claro se é bug ou regra de negócio, registre como pendência (seção 3) e pergunte.

### 4.2 Ciclo de trabalho (repita para cada fluxo)

```
1. MAPEAR     → rotas (php artisan route:list --path=api) + telas (frontend/src/app/**/page.tsx)
2. ESCOLHER   → um fluxo de ponta a ponta (ex.: tablet → pedido → cozinha → caixa → pagamento)
3. EXECUTAR   → no navegador, como cada papel (cliente, garçom, chef, caixa, gerente, super admin)
4. OBSERVAR   → texto da tela, requisições de rede (status + corpo), console, banco
5. VARIAR     → repetir com o caminho infeliz (lista 4.3)
6. REPRODUZIR → isolar o bug no menor passo possível
7. TESTAR     → escrever o teste que falha (backend: PHPUnit feature test)
8. CORRIGIR   → a menor mudança que resolve, seguindo o estilo dos arquivos vizinhos
9. VERIFICAR  → teste passa + suíte inteira passa + refazer o fluxo no navegador
10. REGISTRAR → anotar o que mudou e por quê
```

### 4.3 Checklist de casos para cada tela ou endpoint

- [ ] Clique duplo ou triplo rápido no botão principal: a ação acontece **uma** vez?
- [ ] Usuário com o papel errado: a API retorna 403 **e** a tela explica isso (e não mostra "lista vazia")?
- [ ] Sem login ou com token expirado: o usuário vai para o login e volta para onde estava?
- [ ] Backend fora do ar: a tela diz "sem conexão" e se recupera sozinha?
- [ ] Lista vazia (restaurante novo): a tela orienta o próximo passo?
- [ ] Valores: 0, negativo, texto, número gigante (`999999999`) → 422 com mensagem em português, nunca 500?
- [ ] Multi-tenant: um usuário do restaurante A enxerga ou altera algo do B (por ID ou pelo header `X-Restaurant-Id`)?
- [ ] Dinheiro: a soma das partes bate com o total? O valor gravado bate com o exibido?
- [ ] Estados em sequência: pedir → pedir de novo → pedir a conta → pedir de novo → fechar. Cada etapa fica consistente em **todas** as telas (tablet, cozinha, caixa)?
- [ ] Polling: uma resposta atrasada sobrescreve uma ação que o usuário acabou de fazer?
- [ ] Celular (375px): alguma rolagem lateral? Mede com `document.documentElement.scrollWidth > clientWidth`.
- [ ] Teclado: Esc fecha o modal? Os campos têm rótulo?
- [ ] Algum texto fixo fingindo ser dado real? Algum botão que não faz nada?

### 4.4 Comandos de verificação

```bash
# Backend: suíte completa (banco elo_testing)
C:\Php8.5.1\php.exe artisan test --compact

# Backend: um arquivo ou um teste
C:\Php8.5.1\php.exe artisan test --compact tests/Feature/PosKdsApiTest.php
C:\Php8.5.1\php.exe artisan test --compact --filter=test_nome_do_teste

# Estilo PHP (obrigatório depois de editar PHP)
C:\Php8.5.1\php.exe vendor/bin/pint --dirty --format agent

# Frontend: tipos, lint e build (obrigatório antes de testar no navegador)
cd frontend && npx tsc --noEmit -p . && npx eslint src && npm run build
```

### 4.5 Técnicas que funcionaram no navegador

- **Ler texto em vez de depender de screenshot:** `document.body.innerText` ou o texto de uma coluna específica mostra exatamente o que o usuário vê.
- **Preencher campos React:** atribuir `input.value = 'x'` não dispara o `onChange`. Use o setter nativo e dispare o evento:
  ```js
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'valor'); input.dispatchEvent(new Event('input', { bubbles: true }));
  ```
- **Simular clique duplo:** `botao.click(); botao.click();` na mesma linha. É mais rápido que um humano, então se passar aqui, passa na mão.
- **Chamar a API direto** (`fetch('/api/v1/...', { headers: { Accept: 'application/json', 'X-Restaurant-Id': '1' } })`) para preparar o cenário (ex.: criar uma segunda rodada) e depois conferir a tela.
- **Varredura de layout:** abrir cada rota num `iframe` de 375px e medir `scrollWidth`.
- **Logar como cada papel** e anotar o que aparece e o que some (garçom não vê "Excluir mesa"; chef no caixa vê "sem permissão").

### 4.6 Como dividir trabalho grande

Para uma auditoria completa, foram usadas três frentes em paralelo, cada uma com escopo fechado para não haver conflito de arquivos:

- **Frente A (backend):** só `app/`, `routes/`, `database/`, `tests/`. Regra: teste que falha → correção → suíte verde.
- **Frente B (revisão do frontend, somente leitura):** ler todas as telas e cruzar com os controllers, procurando contrato quebrado (nome de campo, enum, formato de número), estados que nunca resetam, erros engolidos, dados falsos. Saída: lista priorizada com `arquivo:linha`, cenário e sugestão.
- **Frente C (navegador):** executar os fluxos reais e corrigir o frontend.

Os achados de uma frente viram tarefas para outra (ex.: a revisão do front encontrou o Stripe sem filtro de restaurante, e a frente de backend corrigiu). Se o seu agente não roda tarefas em paralelo, faça as três frentes **em sequência**, na mesma ordem.

### 4.7 Convenções do projeto (resumo)

- PHP: chaves sempre, tipos de retorno explícitos, PHPDoc em vez de comentário inline, mensagens para o usuário em português, `pint` depois de editar.
- Testes: PHPUnit feature tests com factories. Rode o teste mais estreito e depois a suíte completa.
- Frontend: siga o padrão dos arquivos vizinhos. Para dinheiro, use `formatBRL`. Para modais, `useEscapeKey`. Para erros de API, `getApiErrorMessage`. O toast avulso é `toast.x(título, mensagem)`.
- Botões de envio: `disabled={saving}` **não basta** contra clique duplo, porque o estado só muda no próximo render. Use uma trava síncrona (`useRef` no handler, ou uma variável de módulo quando a função é criada no render, como o `withActionLock` do caixa). Esse bug apareceu três vezes neste projeto (tablet, caixa, cadastro do cardápio).
- O Next.js desta versão tem mudanças incompatíveis. Consulte `frontend/node_modules/next/dist/docs/` antes de usar uma API nova (ver `frontend/AGENTS.md`).
- Nunca mude dependências nem crie pastas base sem aprovação. Nunca rode comandos destrutivos no banco `elo`.
