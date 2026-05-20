require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'sky-scrapper.p.rapidapi.com';

async function checkEntityIds() {
    try {
        const resMAO = await axios.get(`https://${HOST}/api/v1/flights/searchAirport`, {
            headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': HOST },
            params: { query: 'Manaus', locale: 'pt-BR' }
        });
        console.log('Manaus (MAO) Data:', resMAO.data?.data?.[0]);

        const resFLN = await axios.get(`https://${HOST}/api/v1/flights/searchAirport`, {
            headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': HOST },
            params: { query: 'Florianópolis', locale: 'pt-BR' }
        });
        console.log('Florianópolis (FLN) Data:', resFLN.data?.data?.[0]);

    } catch (err) {
        console.error(err.message);
    }
}

checkEntityIds();
