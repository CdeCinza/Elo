# Estratégia de qualidade — Elo

> Estado: estratégia para um protótipo funcional, revisada em 30/09/2026. Responsável: mantenedor do projeto. Este documento distingue verificações existentes de próximos passos; não representa uma certificação para uso em produção.

### 1. Resumo

O Elo conecta mesa, cozinha, caixa e gestão. A prioridade de qualidade é manter pedidos, pagamentos, permissões entre restaurantes e baixa de estoque coerentes ao longo desse fluxo. Os testes automatizados ajudam a detectar regressões, mas uma instância pública ainda exige autorização própria para a sessão da mesa e validação operacional adicional.

### 2. Escopo e objetivos

Estão no escopo a API Laravel, o frontend Next.js, o banco MySQL, as permissões por papel e restaurante, a integração opcional com Stripe em ambiente de teste e a acessibilidade das telas principais. Pagamentos reais, operação em restaurante, dispositivos físicos, disponibilidade e monitoramento de produção não foram validados.

Objetivos para a próxima revisão: manter a CI verde em cada pull request; executar a jornada integrada em um ambiente exclusivo antes de uma demonstração pública; acrescentar testes para as regras de autorização da sessão da mesa quando elas forem implementadas; e registrar duração e falhas intermitentes da CI antes de definir metas numéricas.

### 3. Níveis e tipos de teste

| Nível | O que cobre hoje | Execução |
| --- | --- | --- |
| PHPUnit unitário e feature | Regras de pedidos, estoque, pagamentos, autenticação, papéis e isolamento por restaurante. A maior parte da suíte está em `tests/Feature`. | Suíte PHP na CI em push e pull request. |
| Playwright com respostas simuladas | Página inicial, uso do cardápio pelo teclado e verificações automatizadas de acessibilidade em telas selecionadas. | CI em pull requests. |
| Playwright integrado | Pedido iniciado na mesa e conferido na cozinha e no caixa com API real. | Manualmente, com banco e mesa exclusivos; o teste é ignorado sem as variáveis exigidas. |
| Verificações estáticas | Lint e build do frontend, auditoria de dependências PHP e JavaScript. | CI em push e pull request. |

O axe-core identifica parte dos problemas automatizáveis de WCAG 2.2 AA. Seu resultado não substitui testes de teclado completos, leitor de tela e avaliação humana.

### 4. Distribuição dos testes

A suíte é concentrada em testes de integração/feature do Laravel, com poucos testes unitários isolados e poucos cenários de navegador. Não há medição de cobertura de linhas, duração histórica ou taxa de flakiness registrada neste repositório; portanto, uma proporção como 70/20/10 não descreve o estado atual.

Ao ampliar a suíte, priorizar testes de feature para regras entre API e banco, testes unitários para cálculos e transições isoladas e Playwright apenas para jornadas que precisam do navegador. Contar os cenários por nível e medir o tempo da CI antes de estabelecer uma meta de proporção.

### 5. Riscos que orientam a cobertura

| Risco | Impacto | Evidência e próximo teste |
| --- | --- | --- |
| Uma sessão pública de mesa operar outra mesa | Alto | O README registra a ausência de credencial individual da sessão; definir a autorização e testar tentativa de acesso cruzado. |
| Acesso a dados de outro restaurante | Alto | Há testes de escopo na API; manter cenários cruzados para cada novo recurso. |
| Pagamento ou fechamento deixar estado inconsistente | Alto | Há testes PHP para Stripe e caixa; manter casos de webhook repetido, pedido alterado e valor divergente. |
| Estoque baixado não ser estornado | Médio | A regra após cancelamento ainda depende de decisão operacional; testá-la quando for definida. |
| Tela exibir estado diferente da API | Médio | Manter a jornada integrada e casos de erro de rede, permissão e resposta atrasada. |

### 6. Ambientes

| Ambiente | Uso atual | Limite |
| --- | --- | --- |
| Local | Desenvolvimento e testes pontuais. | Dados de demonstração não devem ser confundidos com dados de teste. |
| CI | MySQL de serviço para PHPUnit; frontend compilado e testes de navegador com respostas simuladas nos pull requests. | Não executa a jornada integrada com API real. |
| Ambiente exclusivo de E2E | Configuração documentada em `frontend/README.md`. | Precisa de gerente, banco e mesa reservada; não há job automático correspondente na CI. |

Não há staging ou produção configurados como ambientes de validação neste repositório.

### 7. Escolha das ferramentas

PHPUnit acompanha as convenções de testes do Laravel e permite verificar regras de negócio com banco de teste. Playwright permite testar a interação da mesa e observar o pedido nas telas operacionais. Axe-core acrescenta uma verificação automatizada de acessibilidade. Essas escolhas correspondem às ferramentas presentes no projeto; não há comparação medida de custo, velocidade ou manutenção com alternativas.

### 8. Critérios de entrada e saída

- PHP: usar `elo_testing` isolado; a saída é a suíte PHPUnit passando sem testes ignorados inesperados.
- Frontend: dependências instaladas; a saída é lint e build passando.
- Navegador com respostas simuladas: build disponível; a saída é a suíte de apresentação e acessibilidade passando.
- Jornada integrada: API, frontend e banco exclusivos disponíveis, com gerente e mesa reservada; a saída é pedido visível na cozinha e no caixa e limpeza da mesa de teste.
- Demonstração pública: revisar autorização da sessão da mesa, credenciais de exemplo, integração de pagamentos e configuração de e-mail antes de expor uma instância.

### 9. Portões de qualidade

A CI atual exige PHPUnit, auditoria de dependências, lint e build em push e pull request. Em pull request, também exige os testes Playwright `project-tour.spec.ts` e `accessibility.spec.ts`. Ela não executa Pint, a jornada Playwright com API real, testes de carga ou revisão humana como portões automáticos.

Para mudanças em PHP, a convenção local exige executar Pint antes de finalizar. Para alterações no fluxo principal, executar também a jornada integrada em ambiente exclusivo antes de divulgá-la como validada.

### 10. Métricas

| Métrica | Situação atual | Próxima meta verificável | Frequência |
| --- | --- | --- | --- |
| Resultado da CI | Jobs configurados no workflow. | Todos os jobs obrigatórios verdes no pull request. | Por PR. |
| Jornada integrada | Teste existe, mas é ignorado sem configuração. | Registrar uma execução completa antes de cada demonstração pública. | Por demonstração. |
| Duração da CI | Sem histórico consolidado neste documento. | Registrar uma linha de base antes de fixar limite. | Mensal. |
| Falhas intermitentes | Sem linha de base. | Classificar falhas repetidas antes de fixar percentual. | Mensal. |
| Cobertura de código | Não medida aqui. | Medir cobertura das regras de maior risco antes de definir porcentagem. | Na próxima revisão. |

Taxa de defeitos em produção não se aplica enquanto o Elo não operar em produção.

### 11. Próximos marcos

1. Corrigir a autorização da sessão pública de mesa e adicionar testes de acesso entre mesas.
2. Automatizar a jornada integrada em ambiente isolado, com preparação e limpeza previsíveis.
3. Medir cobertura e duração da CI para escolher metas realistas; considerar Pint na CI se o custo de execução for aceitável.
4. Definir a regra de estorno ou desperdício de ingredientes após cancelamento e cobri-la com testes.

### 12. Riscos da própria estratégia

Testes com respostas simuladas podem passar mesmo quando o contrato real da API mudou. O teste integrado pode ser esquecido porque depende de configuração externa. Uma verificação axe sem teste manual pode deixar problemas de acessibilidade sem identificação. Revisar estes pontos após mudanças nas rotas, nos estados do pedido ou nas telas de operação.

### 13. Histórico

| Data | Alteração |
| --- | --- |
| 13/09/2026 | Estratégia inicial. |
| 30/09/2026 | Revisão para distinguir cobertura executada, teste integrado condicionado e próximos passos do protótipo. |
