# Elo — uma operação de restaurante conectada de ponta a ponta

O Elo é um projeto de software para restaurantes que conecta, em um mesmo fluxo, a experiência do cliente na mesa, o preparo na cozinha, o acompanhamento da comanda no caixa e a gestão do cardápio e do estoque.

Ele nasceu da minha vontade de expandir meus conhecimentos em desenvolvimento full stack. Eu queria ir além de telas isoladas e construir um sistema em que uma ação tivesse consequências reais em outras partes da aplicação: um pedido feito na mesa aparece na cozinha, muda de estado durante o preparo, compõe a comanda e se relaciona com os ingredientes usados. O desafio era exercitar tanto a construção das interfaces quanto as regras de negócio, a modelagem de dados, as permissões e os testes.

## A ideia na prática

O cliente pode iniciar o atendimento em uma mesa, consultar o cardápio no tablet, personalizar e enviar pedidos, chamar um garçom e solicitar a conta. A cozinha visualiza os pedidos recebidos e acompanha as etapas de preparo. No caixa, a equipe vê as mesas, as comandas e os chamados, pode lançar itens e encerrar o atendimento. A gerência administra produtos, categorias, ingredientes e fichas técnicas; a plataforma também possui uma área de administração de restaurantes.

O sistema contempla diferentes papéis — como gerente, garçom, cozinheiro e caixa — e separa os dados de cada restaurante. No backend, os pedidos seguem uma máquina de estados e o estoque se relaciona aos itens por meio das fichas técnicas. Há ainda uma integração opcional com Stripe, pensada para testes de pagamento com cartão.

## Tecnologias utilizadas

| Camada | Tecnologias | Papel no projeto |
| --- | --- | --- |
| Backend | PHP 8.5, Laravel 13, Laravel Sanctum | API REST, autenticação, autorização e regras de negócio. |
| Dados | MySQL, Eloquent ORM | Persistência de restaurantes, mesas, pedidos, cardápio e estoque. |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | Interfaces do cliente e das equipes de operação e gestão. |
| Qualidade | PHPUnit, Playwright, axe-core | Testes de API, fluxos de interface e verificações automatizadas de acessibilidade. |
| Integração opcional | Stripe | Fluxo de cartão com PaymentIntent e webhook assinado em ambiente de teste. |

## O que busquei aprender

O Elo me permitiu trabalhar em problemas que aparecem quando várias partes de um produto precisam funcionar juntas: definir limites de acesso por papel e por restaurante, manter o estado da mesa e do pedido coerente, refletir mudanças nas interfaces, evitar ações duplicadas e testar caminhos que atravessam backend e frontend. Também foi uma oportunidade de praticar uma experiência mais clara para quem usa o sistema — do cliente na mesa à equipe que precisa agir rapidamente durante o serviço.

## Estado atual

O Elo é um **protótipo funcional em evolução**, criado para estudo e demonstração técnica. O fluxo principal está implementado, mas o projeto ainda não deve ser tratado como uma solução pronta para operar um restaurante real ou processar pagamentos de produção. Antes disso, seriam necessários novos ciclos de validação operacional, implantação, observabilidade e revisão de configurações e credenciais. A regra de devolução ao estoque para itens já baixados em pedidos cancelados também depende de uma decisão de negócio.

Para conhecer o fluxo, instalar o projeto e executar os testes, consulte o [README principal](../README.md).
