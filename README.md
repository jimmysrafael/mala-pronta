# MalaPronta IA ✈️

Planejador de viagens inteligente com IA. Gere roteiros personalizados usando GPT-4o-mini com dados reais de voos, hotéis, atrações e clima.

## Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Banco de Dados:** Postgres gerenciado
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

O `build` gera apenas o bundle do frontend. O `start` sobe somente a API Express.

## Deploy separado

Para subir o projeto com front, back e banco desacoplados:

### Opção recomendada

- **Frontend**: Vercel
- **Backend**: Cloud Run
- **Banco**: Neon

Variáveis importantes:

#### Vercel

- Root Directory: `client`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables:
  - `VITE_API_URL=https://api.seu-dominio.com`

#### Cloud Run

- Deploy source: `Dockerfile` na raiz
- Port: Cloud Run injeta `PORT`, não defina manualmente
- Environment Variables:
  - `NODE_ENV=production`
  - `CORS_ORIGIN=https://seu-dominio.com,https://*.vercel.app`
  - `CLIENT_URL=https://seu-dominio.com`
  - `DATABASE_URL=postgresql://user:password@host:5432/malapronta?sslmode=require`
  - `PGSSLMODE=require`
  - `OPENAI_API_KEY=...`
  - `RAPIDAPI_KEY=...`
  - `OPENTRIPMAP_API_KEY=...`

#### Neon

- Use a pooled connection string if você esperar mais concorrência.
- Guarde a string em `DATABASE_URL`.

### Alternativa simples

- **Frontend**: Vercel
- **Backend**: Render Web Service
- **Banco**: Neon

#### Render

- Root Directory: repo raiz
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables:
  - `NODE_ENV=production`
  - `CORS_ORIGIN=https://seu-dominio.com,https://*.vercel.app`
  - `CLIENT_URL=https://seu-dominio.com`
  - `DATABASE_URL=postgresql://user:password@host:5432/malapronta?sslmode=require`
  - `PGSSLMODE=require`
  - `OPENAI_API_KEY=...`
  - `RAPIDAPI_KEY=...`
  - `OPENTRIPMAP_API_KEY=...`

#### Render port

- O Render injeta `PORT` automaticamente no web service. Não precisa definir manualmente.
