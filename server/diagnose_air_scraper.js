require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function runDiagnosis() {
  console.log('\n🔍 INICIANDO DIAGNÓSTICO: MalaPronta IA - Air Scraper\n');

  // 1. Verificar Variável de Ambiente
  const key = process.env.RAPIDAPI_KEY || '';
  const last4 = key.slice(-4);
  console.log(`[ENV] RAPIDAPI_KEY encontrada: ****${last4 || 'NÃO DEFINIDA'}`);

  // 2. Analisar Código Fonte
  const filesToCheck = [
    'services/airportService.js',
    'services/flightService.js',
    'services/hotelService.js'
  ];

  let usingSky3 = false;
  let usingCorrectHost = false;

  console.log('\n[ARQUIVOS] Verificando configurações no código:');
  
  filesToCheck.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      const hasSky3 = content.includes('sky-scrapper3.p.rapidapi.com');
      const hasCorrect = content.includes('sky-scrapper.p.rapidapi.com');
      
      if (hasSky3) {
        console.log(`❌ ${file}: Detectado uso de sky-scrapper3!`);
        usingSky3 = true;
      } else if (hasCorrect) {
        console.log(`✅ ${file}: Usando host correto (sky-scrapper)`);
        usingCorrectHost = true;
      } else if (file.includes('hotel')) {
        console.log(`ℹ️  ${file}: Host Booking.com detectado`);
      } else {
        console.log(`⚠️  ${file}: Nenhum host conhecido detectado`);
      }
    } else {
      console.log(`⚠️  Arquivo não encontrado: ${file}`);
    }
  });

  // 3. Teste Real de API (Leve)
  console.log('\n[API] Fazendo teste de conexão com Air Scraper...');
  const host = 'sky-scrapper.p.rapidapi.com';
  const endpoint = `https://${host}/api/v1/flights/searchAirport`;
  
  try {
    const res = await axios.get(endpoint, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': host
      },
      params: { query: 'FLN', locale: 'pt-BR' }
    });

    console.log(`✅ Status HTTP: ${res.status}`);
    console.log(`✅ Host Usado: ${host}`);
    console.log(`✅ Endpoint: /api/v1/flights/searchAirport`);
    
    const apiItems = res.data?.data || [];
    console.log(`📊 Resultados retornados: ~${apiItems.length}`);
    if (apiItems.length > 0) {
      console.log('Primeiro resultado:', JSON.stringify(apiItems[0], null, 2));
    }

    if (apiItems.length > 0) {
      console.log('\n⭐ DIAGNÓSTICO FINAL: OK! Aplicação está usando Air Scraper correto e plano ativo.');
    } else {
      console.log('\n⚠️ DIAGNÓSTICO FINAL: API respondeu, mas não retornou dados. Verifique os parâmetros.');
    }

  } catch (err) {
    const status = err.response?.status;
    const message = JSON.stringify(err.response?.data || err.message);
    
    console.log(`❌ Status HTTP: ${status}`);
    console.log(`❌ Resposta: ${message}`);

    const isQuota = message.toLowerCase().includes('quota') || message.toLowerCase().includes('exceeded') || status === 429;
    const isBasic = message.toUpperCase().includes('BASIC');

    if (usingSky3) {
      console.log('\n⭐ DIAGNÓSTICO FINAL: ERRO! Aplicação está configurada para sky-scrapper3.');
    } else if (isQuota || isBasic) {
      console.log(`\n⭐ DIAGNÓSTICO FINAL: ERRO! Chave/Plano no ${isBasic ? 'BASIC' : 'Limite'} (Sem cota no Air Scraper).`);
    } else {
      console.log('\n⭐ DIAGNÓSTICO FINAL: ERRO desconhecido na conexão.');
    }
  }
}

runDiagnosis();
