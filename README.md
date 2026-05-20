# MalaPronta IA ✈️

Planejador de viagens inteligente com IA. Gere roteiros personalizados usando GPT-4o-mini com dados reais de voos, hotéis, atrações e clima.

## Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Banco de Dados:** SQLite (better-sqlite3)
- **IA:** OpenAI API (gpt-4o-mini)
- **Autenticação:** JWT + bcrypt
- **APIs Externas:** Amadeus (voos/hotéis), OpenTripMap (atrações), Open-Meteo (clima)

## Configuração

1. Clone o repositório e instale as dependências:

```bash
npm install
```

2. Crie um arquivo `.env` na raiz baseado no `.env.example`:

```bash
cp .env.example .env
```

3. Preencha as variáveis de ambiente:

```
OPENAI_API_KEY=sua_chave_da_openai_aqui
JWT_SECRET=um_segredo_forte_para_jwt
PORT=3001
AMADEUS_CLIENT_ID=seu_client_id_aqui
AMADEUS_CLIENT_SECRET=seu_client_secret_aqui
OPENTRIPMAP_API_KEY=sua_chave_aqui
```

## APIs externas

### Amadeus (voos e hotéis) — gratuito
1. Acesse https://developers.amadeus.com
2. Crie uma conta Self-Service (gratuito, sem cartão)
3. Crie um app no painel → copie Client ID e Client Secret
4. Adicione ao .env:
   AMADEUS_CLIENT_ID=...
   AMADEUS_CLIENT_SECRET=...
> O sandbox Amadeus usa dados de teste, não preços ao vivo. Para produção, solicite acesso ao ambiente live.

### OpenTripMap (atrações) — gratuito
1. Acesse https://opentripmap.io/product
2. Cadastre-se no plano gratuito
3. Copie sua API Key
4. Adicione ao .env:
   OPENTRIPMAP_API_KEY=...

### Open-Meteo (clima) — sem cadastro
Nenhuma chave necessária. Funciona automaticamente.

## Desenvolvimento

```bash
npm run dev
```

Isso inicia o servidor Express (porta 3001) e o Vite dev server (porta 5173) simultaneamente.

## Produção

```bash
npm run build
npm start
```

O `build` instala as dependências do client e gera o bundle de produção. O `start` sobe o Express servindo o build estático + API REST na porta configurada.
