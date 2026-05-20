require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'booking-com15.p.rapidapi.com';

async function diagnoseHotels() {
    console.log('--- DIAGNÓSTICO DE HOTÉIS (Florianópolis) ---');
    
    try {
        console.log('\n1. Testando searchDestination...');
        const destRes = await axios.get(`https://${HOST}/api/v1/hotels/searchDestination`, {
            headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': HOST },
            params: { query: 'Florianópolis' }
        });
        
        const dest = destRes.data?.data?.[0];
        console.log('Destino encontrado:', dest?.name, 'ID:', dest?.dest_id);

        if (dest) {
            console.log('\n2. Testando searchHotels...');
            const hotelRes = await axios.get(`https://${HOST}/api/v1/hotels/searchHotels`, {
                headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': HOST },
                params: {
                    dest_id: dest.dest_id,
                    search_type: dest.search_type || 'city',
                    arrival_date: '2026-06-01',
                    departure_date: '2026-06-05',
                    adults: 1,
                    room_qty: 1,
                    currency_code: 'BRL'
                }
            });
            console.log('Status HTTP:', hotelRes.status);
            console.log('Hotéis encontrados:', hotelRes.data?.data?.hotels?.length || 0);
        }

    } catch (err) {
        console.error('Erro:', err.response?.status, err.response?.data || err.message);
    }
}

diagnoseHotels();
