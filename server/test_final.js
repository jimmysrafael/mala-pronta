require('dotenv').config();
const axios = require('axios');

async function testFullFlow() {
    console.log('--- TESTE DE FLUXO COMPLETO: MAO -> FLN ---');
    
    // Simular objetos que viriam do autocomplete (com IDs possivelmente antigos)
    const origin = { skyId: 'MAO', entityId: '95673639', cityName: 'Manaus' };
    const destination = { skyId: 'FLN', entityId: '95673806', cityName: 'Florianópolis' };
    
    const payload = {
        origin,
        destination,
        days: 3,
        budget: 5000,
        travelers: 1,
        startDate: '2026-05-27',
        interests: 'Natureza, Gastronomia'
    };

    try {
        console.log('Enviando requisição para /api/trips/generate...');
        // Como o servidor pode não estar rodando no terminal agora, 
        // mas as funções foram atualizadas, este teste deve ser feito via API real
        // ou eu posso simular a chamada interna se necessário.
        // Vou assumir que o usuário quer que eu valide via logs do servidor ao rodar o app.
        
        // Se eu quiser testar as funções DIRETAMENTE sem o servidor:
        const { searchFlights } = require('./services/flightService');
        const res = await searchFlights({ origin, destination, days: 3, travelers: 1, startDate: '2026-05-27' });
        
        console.log('Resultado da busca de voos:', res.available ? '✅ Sucesso' : '❌ Falha');
        console.log('Motivo:', res.reason);
        if (res.needsRefresh) {
            console.log('♻️  Detectou necessidade de atualização de IDs!');
        }

    } catch (err) {
        console.error('Erro no teste:', err.message);
    }
}

testFullFlow();
