import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useState } from 'react';
import { hashStr, formatCurrency, formatDate } from '../utils/helpers';
import { apiFetch } from '../lib/api';

const BANNER_GRADIENTS = [
  'linear-gradient(135deg, #0f5238 0%, #1a7a54 50%, #2d6a4f 100%)',
  'linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #1d4ed8 100%)',
  'linear-gradient(135deg, #5b2c6f 0%, #7c3aed 50%, #6d28d9 100%)',
  'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #c2410c 100%)',
  'linear-gradient(135deg, #155e75 0%, #0891b2 50%, #0e7490 100%)',
  'linear-gradient(135deg, #831843 0%, #db2777 50%, #be185d 100%)',
];



export default function ItineraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showBRL, setShowBRL] = useState(true);

  const { itinerary, destination, days, budget, startDate, returnDate, isNew } = location.state || {};
  const itineraryBudget = Number(
    itinerary?.budgetBreakdown?.total ?? itinerary?.totalBudget ?? budget ?? 0
  );
  const originalBudget = Number(budget ?? 0);
  const isBudgetAdjusted = itineraryBudget > 0 && originalBudget > 0 && itineraryBudget !== originalBudget;
  const tripStartDate = itinerary?.startDate || startDate || '';
  const tripReturnDate = itinerary?.returnDate || returnDate || '';

  if (!itinerary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-on-surface-variant font-body">Nenhum roteiro encontrado.</p>
      </div>
    );
  }

  const gradientIndex = hashStr(itinerary.destination || destination || '') % BANNER_GRADIENTS.length;
  const bannerGradient = BANNER_GRADIENTS[gradientIndex];

  const handleSave = async () => {
    if (saved || saving) return;
    setSaving(true);
    try {
      const itineraryToSave = {
        ...itinerary,
        startDate: tripStartDate,
        returnDate: tripReturnDate,
      };

      const res = await apiFetch('/api/trips/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          destination: itinerary.destination || destination,
          days: itinerary.totalDays || days,
          budget: itineraryBudget || itinerary.totalBudget || budget,
          itinerary: itineraryToSave,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar');
      }

      setSaved(true);
      toast('Viagem salva com sucesso!');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header title="MalaPronta" showBack onBack={() => navigate(-1)} />

      <main className="pb-28">
        {/* Banner */}
        <div
          className="relative w-full overflow-hidden"
          style={{ height: '400px' }}
        >
          <div className="absolute inset-0" style={{ background: bannerGradient }} />
          {/* Decorative wave pattern */}
          <svg
            className="absolute bottom-0 left-0 right-0 opacity-[0.08]"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
            style={{ height: '120px', width: '100%' }}
          >
            <path
              fill="white"
              d="M0,224L48,208C96,192,192,160,288,170.7C384,181,480,235,576,245.3C672,256,768,224,864,192C960,160,1056,128,1152,122.7C1248,117,1344,139,1392,149.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            />
          </svg>
          {/* Big subtle icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-rounded text-white opacity-[0.12]" style={{ fontSize: '120px' }}>
              travel_explore
            </span>
          </div>
          {/* Overlay gradient */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, #f8f9f9 0%, transparent 40%, rgba(0,0,0,0.15) 100%)',
            }}
          />
          {/* Text overlay */}
          <div className="absolute bottom-8 left-5 right-5 max-w-[672px] mx-auto">
            <h1 className="font-display font-extrabold text-[36px] leading-tight text-white drop-shadow-lg">
              {itinerary.destination || destination}
            </h1>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="material-symbols-rounded filled text-[18px]" style={{ color: '#ffd167' }}>
                location_on
              </span>
              <span className="font-body text-sm text-white/90 font-medium">
                {itinerary.country || ''}
              </span>
            </div>
            {(tripStartDate || tripReturnDate) && (
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-md">
                  <span className="material-symbols-rounded text-[18px] text-white/90">flight_takeoff</span>
                  <div className="leading-tight">
                    <p className="font-body text-[10px] font-semibold uppercase tracking-wider text-white/70">
                      Ida
                    </p>
                    <p className="font-display text-sm font-bold text-white">
                      {tripStartDate ? formatDate(tripStartDate) : 'Não informada'}
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-md">
                  <span className="material-symbols-rounded text-[18px] text-white/90">flight_land</span>
                  <div className="leading-tight">
                    <p className="font-body text-[10px] font-semibold uppercase tracking-wider text-white/70">
                      Volta
                    </p>
                    <p className="font-display text-sm font-bold text-white">
                      {tripReturnDate ? formatDate(tripReturnDate) : 'Não informada'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 max-w-[672px] mx-auto -mt-4">
          {/* Summary Cards */}
          <div
            className="bg-surface-container-lowest rounded-3xl p-5 grid grid-cols-3 gap-4 mb-8"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}
          >
            <div className="flex flex-col items-center gap-1.5">
              <span className="material-symbols-rounded text-on-surface-variant text-[24px]">calendar_today</span>
              <span className="font-body text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Duração</span>
              <span className="font-display font-bold text-base text-on-surface">
                {itinerary.totalDays || days} dias
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="material-symbols-rounded text-on-surface-variant text-[24px]">payments</span>
              <span className="font-body text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Orçamento</span>
              <span className="font-display font-bold text-base text-on-surface">
                {formatCurrency(itineraryBudget)}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="material-symbols-rounded text-on-surface-variant text-[24px]">explore</span>
              <span className="font-body text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Atividades</span>
              <span className="font-display font-bold text-base text-on-surface">
                {itinerary.totalActivities || '—'} itens
              </span>
            </div>
          </div>

          {/* Flight Summary */}
          {itinerary.flightSummary?.found && (
            <div className="bg-surface-container-lowest rounded-2xl p-4 mb-3" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-primary text-[20px]">flight</span>
                  <span className="font-display font-bold text-sm text-on-surface">Passagem Aérea</span>
                </div>
                {/* Currency Toggle */}
                <div 
                  className="flex items-center gap-2 bg-surface-container-high p-1 rounded-full cursor-pointer"
                  onClick={() => setShowBRL(!showBRL)}
                >
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${showBRL ? 'bg-primary text-white' : 'text-on-surface-variant'}`}>R$</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${!showBRL ? 'bg-primary text-white' : 'text-on-surface-variant'}`}>US$</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col">
                  <span className="font-display font-bold text-lg text-primary">
                    {showBRL ? (itinerary.flightSummary?.formattedBRL || '') : (itinerary.flightSummary?.formattedUSD || '')}
                  </span>
                  <span className="font-body text-[10px] text-on-surface-variant">
                    {itinerary.flightSummary?.airline || 'Companhia'} • {itinerary.flightSummary?.stops === 0 ? 'Direto' : `${itinerary.flightSummary?.stops} paradas`}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-body text-[10px] text-on-surface-variant italic">
                    {itinerary.flightSummary?.isExchangeFallback ? 'Cotação estimada' : `Cotação usada: US$ 1 = R$ ${itinerary.flightSummary?.exchangeRate?.toFixed(2)}`}
                  </p>
                </div>
              </div>
              <p className="font-body text-xs text-on-surface-variant border-t border-surface-container-high pt-2 mt-1">{itinerary.flightSummary?.note}</p>
            </div>
          )}

          {/* Hotel Summary */}
          {itinerary.hotelSummary?.found && (
            <div className="bg-surface-container-lowest rounded-2xl p-4 mb-3" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-rounded filled text-primary text-[20px]">hotel</span>
                <span className="font-display font-bold text-sm text-on-surface">{itinerary.hotelSummary.name}</span>
                <span className="ml-auto font-display font-bold text-sm text-primary">
                  {formatCurrency(itinerary.hotelSummary.totalPrice)}
                </span>
              </div>
              <p className="font-body text-xs text-on-surface-variant">{itinerary.hotelSummary.note}</p>
            </div>
          )}

          {/* Season Insights */}
          {itinerary.seasonInsights && (
            <div className="bg-surface-container-lowest rounded-2xl p-4 mb-6" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-rounded filled text-primary text-[20px]">wb_sunny</span>
                <span className="font-display font-bold text-sm text-on-surface">Clima & Melhor Época</span>
              </div>
              <p className="font-body text-xs text-on-surface-variant mb-1">{itinerary.seasonInsights.recommendation}</p>
              <p className="font-body text-xs text-on-surface-variant">
                Melhores meses: <span className="font-semibold text-on-surface">{itinerary.seasonInsights.bestMonths?.join(', ')}</span>
              </p>
            </div>
          )}

          {/* Budget Breakdown */}
          {itinerary.budgetBreakdown && (
            <div className="bg-surface-container-lowest rounded-3xl p-5 mb-6" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-rounded filled text-primary text-[20px]">account_balance_wallet</span>
                <span className="font-display font-bold text-base text-on-surface">Distribuição do Orçamento</span>
              </div>
              {isBudgetAdjusted && (
                <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3">
                  <p className="font-body text-xs text-emerald-900">
                    Orçamento adaptado com base nos valores reais encontrados. O roteiro passou a considerar {formatCurrency(itineraryBudget)}.
                  </p>
                </div>
              )}
              {[
                { label: 'Passagem', key: 'flight', icon: 'flight' },
                { label: 'Hospedagem', key: 'hotel', icon: 'hotel' },
                { label: 'Alimentação', key: 'food', icon: 'restaurant' },
                { label: 'Transporte local', key: 'localTransport', icon: 'directions_bus' },
                { label: 'Atrações', key: 'activities', icon: 'local_activity' },
                { label: 'Reserva', key: 'buffer', icon: 'savings' },
              ].map(({ label, key, icon }) => (
                <div key={key} className="flex items-center gap-3 py-2">
                  <span className="material-symbols-rounded text-on-surface-variant text-[16px]">{icon}</span>
                  <span className="font-body text-sm text-on-surface-variant flex-1">{label}</span>
                  <span className="font-body text-sm font-semibold text-on-surface">
                    {formatCurrency(itinerary.budgetBreakdown[key] || 0)}
                  </span>
                </div>
              ))}
              <div className="border-t border-surface-container-high mt-2 pt-3 flex justify-between">
                <span className="font-display font-bold text-sm text-on-surface">Total</span>
                <span className="font-display font-bold text-sm text-primary">
                  {formatCurrency(itineraryBudget)}
                </span>
              </div>
            </div>
          )}

          {/* Warnings */}
          {itinerary.warnings?.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-rounded text-amber-600 text-[18px]">warning</span>
                <span className="font-display font-bold text-sm text-amber-900">Avisos</span>
              </div>
              {itinerary.warnings.map((w, i) => (
                <p key={i} className="font-body text-xs text-amber-800 mb-1">• {w}</p>
              ))}
            </div>
          )}

          {/* Itinerary */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-rounded filled text-primary text-[24px]">auto_awesome</span>
              <h2 className="font-display font-bold text-xl text-on-surface">Seu Roteiro Personalizado</h2>
            </div>

            {itinerary.days?.map((day, dayIndex) => {
              const VALID_ICONS = new Set([
                'restaurant', 'museum', 'park', 'attractions', 'hotel', 'flight', 
                'directions_walk', 'directions_bus', 'local_cafe', 'church', 
                'account_balance', 'shopping_bag', 'event', 'local_activity', 
                'local_bar', 'directions_car', 'train', 'subway', 'tram', 
                'directions_boat', 'map', 'tour', 'beach_access', 'landscape'
              ]);
              const calculatedDayTotal = day.periods?.reduce((sum, p) => sum + (Number(p.estimatedCost) || 0), 0) || 0;

              return (
              <div key={day.dayNumber} className="mb-6 animate-fade-in-up" style={{ animationDelay: `${dayIndex * 0.1}s` }}>
                {/* Day header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-base text-on-surface"
                    style={dayIndex > 0 ? { opacity: 1 } : {}}
                  >
                    Dia {day.dayNumber}: {day.title}
                  </h3>
                  {dayIndex === 0 && (
                    <span
                      className="px-3 py-1 rounded-full font-body text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: '#b1f0ce', color: '#002114' }}
                    >
                      Ativo
                    </span>
                  )}
                </div>

                {/* Periods */}
                <div className="flex flex-col gap-3">
                  {day.periods?.map((period, pIndex) => {
                    const safeIcon = VALID_ICONS.has(period.icon) ? period.icon : 'event';
                    return (
                    <div
                      key={pIndex}
                      className="bg-surface-container-lowest rounded-2xl p-4"
                      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-rounded text-primary text-[20px]">
                            {safeIcon}
                          </span>
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-body text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                              {period.period} • {period.time}
                            </span>
                            <span className="font-display font-bold text-sm text-primary">
                              {formatCurrency(period.estimatedCost)}
                            </span>
                          </div>
                          <h4 className="font-display font-bold text-sm text-on-surface mb-1">
                            {period.activity}
                          </h4>
                          <p className="font-body text-xs text-on-surface-variant leading-relaxed">
                            {period.description}
                          </p>
                          {period.travelTimePrevious && (
                            <p className="font-body text-[10px] text-primary/70 mt-1 flex items-center gap-1">
                              <span className="material-symbols-rounded text-[12px]">directions_walk</span>
                              {period.travelTimePrevious}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>

                {/* Day total */}
                {(calculatedDayTotal > 0 || day.dayTotal != null) && (
                  <div className="flex justify-end mt-3 pr-1">
                    <span className="font-display font-extrabold text-sm text-primary">
                      Total do dia: {formatCurrency(calculatedDayTotal > 0 ? calculatedDayTotal : day.dayTotal)}
                    </span>
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      </main>

      {/* FAB Save */}
      {isNew && token && (
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="fixed bottom-24 right-5 z-40 flex items-center gap-2 px-6 py-3.5 rounded-3xl font-display font-bold text-sm transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-60"
          style={{
            background: saved ? '#b1f0ce' : '#ffd167',
            color: saved ? '#002114' : '#765900',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}
        >
          <span className="material-symbols-rounded filled text-[20px]">
            {saved ? 'check' : 'bookmark'}
          </span>
          {saved ? 'Salva!' : 'Salvar Viagem'}
        </button>
      )}

      <BottomNav />
    </>
  );
}
