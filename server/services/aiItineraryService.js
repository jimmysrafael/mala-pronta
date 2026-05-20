const OpenAI = require('openai');
const { logApiUsage } = require('./apiLogger');

const SYSTEM_PROMPT = `Você é um especialista em planejamento de viagens. Sua tarefa é montar um roteiro REALISTA em português brasileiro.

REGRAS OBRIGATÓRIAS:
- Use APENAS os dados fornecidos no JSON de entrada
- NÃO invente preços de voo ou hotel — use os valores reais fornecidos
- NÃO invente atrações — use as da lista fornecida. Se a lista estiver vazia, use conhecimento geral do destino mas sinalize nos warnings
- Respeite rigorosamente o orçamento e a distribuição por categoria
- Máximo de 3 atividades por dia, respeitando tempo de deslocamento
- Dia 1: incluir chegada/check-in. Último dia: incluir check-out e partida
- Inclua refeições realistas nos custos diários
- A propriedade dayTotal DEVE SER EXATAMENTE a soma matemática dos estimatedCost daquele dia
- Se houver warnings nos dados, inclua-os no campo warnings do JSON de saída

Responda APENAS com um JSON válido, sem markdown, sem texto extra, neste formato:

{
  "destination": "string",
  "country": "string",
  "tripStyle": "string",
  "totalDays": number,
  "totalBudget": number,
  "totalActivities": number,
  "budgetBreakdown": {
    "flight": number,
    "hotel": number,
    "food": number,
    "localTransport": number,
    "activities": number,
    "buffer": number,
    "total": number
  },
  "flightSummary": {
    "found": boolean,
    "airline": "string or null",
    "priceUSD": number or null,
    "priceBRL": number or null,
    "formattedUSD": "string or null",
    "formattedBRL": "string or null",
    "exchangeRate": number or null,
    "isExchangeFallback": boolean,
    "stops": number or null,
    "note": "string"
  },
  "hotelSummary": {
    "found": boolean,
    "name": "string or null",
    "totalPrice": number or null,
    "nightlyRate": number or null,
    "note": "string"
  },
  "seasonInsights": {
    "currentMonth": "string",
    "currentTemp": number or null,
    "bestMonths": ["string"],
    "recommendation": "string"
  },
  "warnings": ["string"],
  "days": [
    {
      "dayNumber": number,
      "title": "string",
      "dayTotal": number,
      "periods": [
        {
          "period": "Manhã | Tarde | Noite",
          "time": "HH:MM",
          "activity": "string",
          "description": "string detalhada",
          "estimatedCost": number,
          "travelTimePrevious": "ex: 20 min de metrô",
          "icon": "Use APENAS estes: restaurant, museum, park, attractions, hotel, flight, directions_walk, directions_bus, local_cafe, church, account_balance, event"
        }
      ]
    }
  ]
}`;

async function generateAIItinerary(tripPlan) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userMessage = `Monte o roteiro com base nestes dados reais coletados:

${JSON.stringify(tripPlan, null, 2)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 6000,
    });

    logApiUsage({
      service_name: 'ai_itinerary',
      provider: 'OpenAI',
      endpoint: '/v1/chat/completions',
      cache_hit: 0,
      success: 1
    });

    const content = completion.choices[0].message.content;

    let itinerary;
    try {
      itinerary = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) itinerary = JSON.parse(match[0]);
      else throw new Error('Resposta da IA não é um JSON válido');
    }

    return itinerary;
  } catch (err) {
    logApiUsage({
      service_name: 'ai_itinerary',
      provider: 'OpenAI',
      endpoint: '/v1/chat/completions',
      success: 0,
      error_message: err.message
    });
    throw err;
  }
}

module.exports = { generateAIItinerary };
