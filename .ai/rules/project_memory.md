# 📌 Regras & Organização do Projeto Elo

Este arquivo faz o gerenciamento interno de regras do projeto para melhor organização e controle das diversas tarefas em andamento.

---

## 🏛️ Diretrizes & Convenções da Aplicação

1. **Stack & Ambiente:**
   - Framework: Laravel 12 / PHP 8.5
   - Banco de dados local: MySQL nativo (Database: `elo`, User: `root`, Pass: `root`).
   - Estilo de código: Laravel Pint (`vendor/bin/pint --dirty --format agent`).

2. **Roadmap de Desenvolvimento (8 Passos Executivos):**
   - **Passo 1 (Concluído):** Setup do Ambiente (PHP local + MySQL + `.env` + migrations base).
   - **Passo 2 (Concluído):** Modelagem do Banco (ERD completo).
   - **Passo 3 (Concluído):** Migrations e Seeders com Factories realistas.
   - **Passo 4 (Concluído):** Autenticação Sanctum & Papéis (Dono, Gerente, Garçom, Cozinheiro, Caixa) + Policies por recurso.
   - **Passo 5 (Concluído):** CRUD do Cardápio (Categorias, Produtos, Variações e Ficha Técnica de Ingredientes).
   - **Passo 6 (Concluído):** Mesas e Abertura de Comanda (Gestão do Salão e Comandas ativas).
   - **Passo 7 (Concluído):** Pedidos & Máquina de Estados (`pending` ➔ `confirmed` ➔ `preparing` ➔ `ready` ➔ `delivered` / `canceled`) com Reverb em tempo real.
   - **Passo 8 (Concluído):** Estoque Vinculado a Receitas (Ficha Técnica & baixa automática por confirmação de pedido).
