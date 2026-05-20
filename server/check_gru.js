require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'sky-scrapper.p.rapidapi.com';

async function checkGRU() {
    try {
        const res = await axios.get(`https://${HOST}/api/v1/flights/searchAirport`, {
            headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': HOST },
            params: { query: 'GRU', locale: 'pt-BR' }
        });
        console.log('GRU Data:', res.data?.data?.[0]);
    } catch (err) {
        console.error(err.message);
    }
}

checkGRU();
