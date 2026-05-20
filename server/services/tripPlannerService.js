function buildBudgetBreakdown(budget, flightTotal, hotelTotal) {
  const flightCost = flightTotal || Math.round(budget * 0.30);
  const hotelCost = hotelTotal || Math.round(budget * 0.35);
  const remaining = budget - flightCost - hotelCost;

  return {
    flight: flightCost,
    hotel: hotelCost,
    food: Math.round(remaining * 0.40),
    localTransport: Math.round(remaining * 0.20),
    activities: Math.round(remaining * 0.30),
    buffer: Math.round(remaining * 0.10),
    total: budget,
  };
}

function buildFeasiblePlan({ destination, days, budget, flights, hotels, attractions, weather }) {
  const warnings = [];

  const chosenFlight = flights.available && flights.data.length > 0 ? flights.data[0] : null;
  const chosenHotel = hotels.available && hotels.data.length > 0 ? hotels.data[0] : null;

  const flightCost = chosenFlight?.priceBRL || null;
  const hotelCost = chosenHotel?.totalPrice || null;

  const budgetBreakdown = buildBudgetBreakdown(budget, flightCost, hotelCost);

  if (!chosenFlight) {
    warnings.push('Voos não encontrados para estas datas. A estimativa de custo de passagem foi calculada com base no orçamento.');
  }
  if (!chosenHotel) {
    warnings.push('Nenhum hotel encontrado para as datas selecionadas. As sugestões de hospedagem foram baseadas no seu orçamento.');
  }
  if (!attractions.available || attractions.data.length === 0) {
    warnings.push('Não foi possível carregar as atrações. O roteiro foi baseado no conhecimento geral sobre o destino.');
  }

  const totalRealCost = (flightCost || 0) + (hotelCost || 0);
  if (totalRealCost > budget * 0.8) {
    warnings.push('Voo e hospedagem já comprometem mais de 80% do orçamento. Considere aumentar o orçamento ou reduzir os dias.');
  }

  // Distribuir atrações pelos dias (máx 3 por dia)
  const availableAttractions = attractions.data || [];
  const daysFramework = [];
  let attrIndex = 0;

  for (let i = 1; i <= days; i++) {
    const dayAttractions = [];
    const count = i === 1 || i === days ? 2 : 3; // primeiro e último dia têm menos atividades
    for (let j = 0; j < count && attrIndex < availableAttractions.length; j++) {
      dayAttractions.push(availableAttractions[attrIndex++]);
    }
    daysFramework.push({
      day: i,
      isArrivalDay: i === 1,
      isDepartureDay: i === days,
      suggestedAttractions: dayAttractions,
    });
  }

  return {
    destination,
    days,
    budget,
    chosenFlight,
    chosenHotel,
    budgetBreakdown,
    daysFramework,
    weatherInsights: weather.data || null,
    warnings,
    flightOptions: flights.data || [],
    hotelOptions: hotels.data || [],
  };
}

module.exports = { buildFeasiblePlan };
