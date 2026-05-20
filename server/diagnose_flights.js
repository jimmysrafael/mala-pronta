require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'sky-scrapper.p.rapidapi.com';

async function diagnoseFlights() {
    console.log('--- DIAGNÓSTICO DE VOOS (MAO -> FLN) - DATA FUTURA ---');
    
    // Usando datas em Outubro de 2026
    const departureDate = '2026-10-01';
    const returnDate = '2026-10-10';

    try {
        const url = `https://${HOST}/api/v1/flights/searchFlights`;
        const res = await axios.get(url, {
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': HOST
            },
            params: {
                originSkyId: 'MAO',
                destinationSkyId: 'FLN',
                originEntityId: '95673639',
                destinationEntityId: '95673806',
                date: departureDate,
                returnDate,
                adults: 1,
                currency: 'BRL',
                market: 'pt-BR',
                countryCode: 'BR'
            }
        });

        console.log(`Status HTTP: ${res.status}`);
        const itineraries = res.data?.data?.itineraries || [];
        console.log(`Itinerários encontrados: ${itineraries.length}`);
        
        if (itineraries.length > 0) {
            const first = itineraries[0];
            console.log('\nExemplo de itinerário:');
            console.log('Preço:', first.price);
        } else {
            console.log('\nNenhum itinerário retornado pela API.');
            console.log('Mensagem da API:', res.data?.message);
        }

    } catch (err) {
        console.error('Erro na API:', err.response?.status, err.response?.data || err.message);
    }
}

diagnoseFlights();
