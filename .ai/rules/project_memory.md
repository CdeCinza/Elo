# 📌 Regras & Organização do Projeto Elo

Este arquivo faz o gerenciamento interno de regras do projeto para melhor organização e controle das diversas tarefas em andamento.

---

## 👑 Preferências & Regras de Trabalho do Usuário

1. **Controle de Commits:**
   - **Apenas commitar se o usuário pedir explicitamente.** Nunca realizar commits automáticos ou sem solicitação.
   - **Nunca utilizar `Co-authored-by` nos commits.** Todos os commits devem conter estritamente e apenas o nome do usuário.
   - **Convenção de Mensagem de Commit (Conventional Commits):**
     - Sempre usar prefixos limpos em inglês (`feat:`, `fix:`, `style:`, `refactor:`, `docs:`, `test:`, `chore:`).
     - Idioma da mensagem: **Inglês**.
     - Formato: **Título direto**. Se houver necessidade de corpo/descrição, limitar a no máximo 1 frase concisa. Exemplo: `feat: add product state machine logic`.

2. **Gerenciamento de Dependências:**
   - **Evitar ao máximo instalar novas dependências para pequenas mudanças.**
   - Priorizar sempre extrair 100% dos recursos nativos que já temos na stack instalada.
   - **Confirmação Obrigatória:** Se for realmente a única escolha e estritamente necessária, a IA DEVE pausar, perguntar explicitamente no chat se o usuário autoriza a instalação da dependência X, e aguardar a confirmação/negação antes de executar qualquer comando.

---

## 🏛️ Diretrizes & Convenções da Aplicação

1. **Stack & Ambiente:**
   - Framework: Laravel 12 / PHP 8.5
   - Banco de dados local: MySQL nativo (Database: `elo`, User: `root`, Pass: `root`).
   - Estilo de código: Laravel Pint (`vendor/bin/pint --dirty --format agent`).

2. **Roadmap de Desenvolvimento (8 Passos Executivos):**
   - **Passo 1 (Concluído):** Setup do Ambiente (PHP local + MySQL + `.env` + migrations base).
   - **Passo 2:** Modelagem do Banco (ERD completo).
   - **Passo 3:** Migrations e Seeders com Factories realistas.
   - **Passo 4:** Autenticação Sanctum & Papéis (Dono, Gerente, Garçom, Cozinheiro, Caixa) + Policies por loja.
   - **Passo 5:** CRUD do Cardápio (Categorias, Produtos, Variações, Adicionais).
   - **Passo 6:** Mesas e Abertura de Comanda.
   - **Passo 7:** Pedidos & Máquina de Estados (`pendente` ➔ `preparo` ➔ `pronto` ➔ `entregue` ➔ `pago`) com Reverb em tempo real.
   - **Passo 8:** Estoque Vinculado a Receitas (Ficha Técnica & baixa automática).
