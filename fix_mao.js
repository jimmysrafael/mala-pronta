const db = require('./server/db');
const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const mao = {
  skyId: 'MAO',
  entityId: '95674366',
  cityName: 'Manaus',
  airportName: 'Aeroporto Internacional Eduardo Gomes',
  iataCode: 'MAO',
  subtitle: 'Brazil',
  flightPlaceType: 'AIRPORT',
  hotelEntityId: '27544857'
};
db.prepare("INSERT OR REPLACE INTO airports (skyId, entityId, cityName, airportName, iataCode, subtitle, cityNameNormalized, flightPlaceType, hotelEntityId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
  mao.skyId, mao.entityId, mao.cityName, mao.airportName, mao.iataCode, mao.subtitle, normalize(mao.cityName), mao.flightPlaceType, mao.hotelEntityId
);
console.log('✅ MAO (Manaus) garantido no banco.');
process.exit(0);
