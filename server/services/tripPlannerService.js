function resolveCost(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function estimateHotelCost(days, flightCost) {
  const nights = Math.max(days - 1, 1);
  const nightlyFloor = Math.max(180, Math.round((flightCost || 0) * 0.08));
  return nightlyFloor * nights;
}

function buildBudgetBreakdown({ budget, days, flightTotal, hotelTotal, mode = 'estimate' }) {
  const flightCost = resolveCost(flightTotal, Math.round(budget * 0.3));
  const hotelCost = mode === 'real_values'
    ? resolveCost(hotelTotal, estimateHotelCost(days, flightCost))
    : resolveCost(hotelTotal, Math.round(budget * 0.35));

  const livingBase = mode === 'real_values'
    ? Math.max(Math.round((flightCost + hotelCost) * 0.38), days * 160)
    : Math.max(budget - flightCost - hotelCost, 0);

  const food = mode === 'real_values'
    ? Math.max(Math.round(livingBase * 0.42), days * 70)
    : Math.round(livingBase * 0.4);
  const localTransport = mode === 'real_values'
    ? Math.max(Math.round(livingBase * 0.18), days * 25)
    : Math.round(livingBase * 0.2);
  const activities = mode === 'real_values'
    ? Math.max(Math.round(livingBase * 0.28), days * 45)
    : Math.round(livingBase * 0.3);
  const buffer = Math.max(
    livingBase - food - localTransport - activities,
    mode === 'real_values' ? Math.max(80, Math.round(livingBase * 0.12)) : Math.round(livingBase * 0.1)
  );

  const total = flightCost + hotelCost + food + localTransport + activities + buffer;

  return {
    flight: flightCost,
    hotel: hotelCost,
    food,
    localTransport,
    activities,
    buffer,
    total,
  };
}

function buildHotelSummary(chosenHotel, hotelCost, days, mode) {
  if (chosenHotel) {
    return {
      found: true,
      name: chosenHotel.name || 'Hotel',
      totalPrice: hotelCost,
      nightlyRate: Math.round(hotelCost / Math.max(days, 1)),
      note: chosenHotel.note || 'Hospedagem real encontrada em tempo real.',
      estimated: false,
    };
  }

  if (mode === 'real_values' && hotelCost > 0) {
    return {
      found: true,
      name: 'Hospedagem estimada',
      totalPrice: hotelCost,
      nightlyRate: Math.round(hotelCost / Math.max(days, 1)),
      note: 'Hospedagem estimada com base no destino e na duracao da viagem.',
      estimated: true,
    };
  }

  return {
    found: false,
    name: null,
    totalPrice: null,
    nightlyRate: null,
    note: 'Nao foi possivel consultar hospedagem em tempo real.',
    estimated: false,
  };
}

function buildFlightSummary(chosenFlight) {
  if (!chosenFlight) {
    return {
      found: false,
      airline: null,
      priceUSD: null,
      priceBRL: null,
      formattedUSD: null,
      formattedBRL: null,
      exchangeRate: null,
      isExchangeFallback: false,
      stops: null,
      note: 'Nenhum voo real foi retornado para esta busca.',
    };
  }

  return {
    found: true,
    airline: chosenFlight.airline || null,
    priceUSD: chosenFlight.priceUSD ?? null,
    priceBRL: chosenFlight.priceBRL ?? null,
    formattedUSD: chosenFlight.formattedUSD || null,
    formattedBRL: chosenFlight.formattedBRL || null,
    exchangeRate: chosenFlight.exchangeRate ?? null,
    isExchangeFallback: Boolean(chosenFlight.isExchangeFallback),
    stops: chosenFlight.stops ?? null,
    note: `Voo com ${chosenFlight.stops === 0 ? 'trecho direto' : `${chosenFlight.stops} parada(s)`}.`,
  };
}

function buildBudgetWarnings({ budget, flightCost, hotelCost, days, budgetMode }) {
  const warnings = [];
  const totalRealCost = flightCost + hotelCost;

  if (budgetMode === 'real_values') {
    warnings.push('Roteiro ajustado com base nos valores reais encontrados ou estimados para passagem e hospedagem.');
  }

  if (totalRealCost > budget * 0.6) {
    warnings.push('Voo e hospedagem já comprometem mais de 60% do orçamento.');
  }

  if (days >= 7 && hotelCost < days * 150) {
    warnings.push('Hospedagem esta abaixo de uma faixa confortavel para uma viagem longa; revise se quiser mais folga.');
  }

  return warnings;
}

function buildFeasiblePlan({
  destination,
  days,
  budget,
  flights,
  hotels,
  attractions,
  weather,
  budgetMode = 'estimate',
}) {
  const warnings = [];

  const chosenFlight = flights.available && flights.data.length > 0 ? flights.data[0] : null;
  const chosenHotel = hotels.available && hotels.data.length > 0 ? hotels.data[0] : null;

  const flightCost = chosenFlight?.priceBRL || null;
  const hotelCost = chosenHotel?.totalPrice || null;

  const budgetBreakdown = buildBudgetBreakdown({
    budget,
    days,
    flightTotal: flightCost,
    hotelTotal: hotelCost,
    mode: budgetMode,
  });

  if (!chosenFlight) {
    warnings.push(flights.reason || 'Voos não encontrados para estas datas. A estimativa de custo de passagem foi calculada com base no orçamento.');
  }
  if (!chosenHotel) {
    warnings.push(hotels.reason || 'Nenhum hotel encontrado para as datas selecionadas. As sugestoes de hospedagem foram baseadas no destino e na duracao da viagem.');
  }
  if (!attractions.available || attractions.data.length === 0) {
    warnings.push('Nao foi possivel carregar as atracoes. O roteiro foi baseado no conhecimento geral sobre o destino.');
  }

  warnings.push(
    ...buildBudgetWarnings({
      budget,
      flightCost: budgetBreakdown.flight,
      hotelCost: budgetBreakdown.hotel,
      days,
      budgetMode,
    })
  );

  const availableAttractions = attractions.data || [];
  const daysFramework = [];
  let attrIndex = 0;

  for (let i = 1; i <= days; i++) {
    const dayAttractions = [];
    const count = i === 1 || i === days ? 2 : 3;
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
    budgetMode,
    chosenFlight,
    chosenHotel,
    flightSummary: buildFlightSummary(chosenFlight),
    hotelSummary: buildHotelSummary(chosenHotel, budgetBreakdown.hotel, days, budgetMode),
    budgetBreakdown,
    daysFramework,
    weatherInsights: weather.data || null,
    warnings,
    flightOptions: flights.data || [],
    hotelOptions: hotels.data || [],
  };
}

module.exports = { buildFeasiblePlan, buildBudgetBreakdown };
