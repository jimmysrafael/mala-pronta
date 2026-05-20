import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import LoadingOverlay from '../components/LoadingOverlay';
import { useToast } from '../components/Toast';
import { formatCurrency } from '../utils/helpers';
import AirportInput from '../components/AirportInput';

const suggestions = [
  { city: 'Rio de Janeiro', country: 'Brasil', gradient: 'linear-gradient(135deg, #0f5238, #2d6a4f)' },
  { city: 'Lisboa', country: 'Portugal', gradient: 'linear-gradient(135deg, #1e3a5f, #2d8a9f)' },
  { city: 'Tóquio', country: 'Japão', gradient: 'linear-gradient(135deg, #5b2c6f, #8e44ad)' },
  { city: 'Buenos Aires', country: 'Argentina', gradient: 'linear-gradient(135deg, #b45309, #d97706)' },
];

export default function HomePage() {
  const [originAirport, setOriginAirport] = useState(null);
  const [destAirport, setDestAirport] = useState(null);
  const [days, setDays] = useState(3);
  const [budget, setBudget] = useState(3000);
  const [mode, setMode] = useState('days'); // 'days' or 'period'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleGenerate = async () => {
    if (!destAirport) {
      toast('Selecione o aeroporto de destino', 'error');
      return;
    }
    if (!originAirport) {
      toast('Selecione o aeroporto de origem', 'error');
      return;
    }

    let finalDays = days;
    let finalDate = null;

    if (mode === 'period') {
      if (!startDate || !endDate) {
        toast('Selecione as datas de início e fim', 'error');
        return;
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      if (diffDays <= 0 || diffDays > 30) {
        toast('O período deve ser entre 1 e 30 dias', 'error');
        return;
      }
      finalDays = diffDays;
      finalDate = startDate;
    } else {
      // Default: 30 dias a partir de hoje
      const d = new Date();
      d.setDate(d.getDate() + 30);
      finalDate = d.toISOString().split('T')[0];
    }

    setLoading(true);
    try {
      const res = await fetch('/api/trips/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          origin: originAirport,
          destination: destAirport,
          days: finalDays,
          budget,
          startDate: finalDate, // Passamos a data selecionada ou padrão
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar roteiro');

      navigate('/itinerary', {
        state: {
          itinerary: data,
          destination: destAirport.cityName,
          days: finalDays,
          budget,
          isNew: true,
        },
      });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTION_AIRPORTS = {
    'Rio de Janeiro': { skyId: 'GIG', entityId: '95673636', cityName: 'Rio de Janeiro', airportName: 'Aeroporto Internacional Tom Jobim', iataCode: 'GIG' },
    'Lisboa': { skyId: 'LIS', entityId: '95565052', cityName: 'Lisboa', airportName: 'Aeroporto Humberto Delgado', iataCode: 'LIS' },
    'Tóquio': { skyId: 'NRT', entityId: '95565034', cityName: 'Tóquio', airportName: 'Aeroporto Internacional Narita', iataCode: 'NRT' },
    'Buenos Aires': { skyId: 'EZE', entityId: '95565040', cityName: 'Buenos Aires', airportName: 'Aeroporto Internacional Ezeiza', iataCode: 'EZE' },
  };

  const handleSuggestionClick = (city) => {
    const airport = SUGGESTION_AIRPORTS[city];
    if (airport) {
      setDestAirport(airport);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {loading && <LoadingOverlay />}
      <Header />
      <main className="pt-16 pb-24 px-5 max-w-[672px] mx-auto">
        {/* Hero */}
        <section className="mt-6 mb-8 animate-fade-in-up">
          <h1 className="font-display font-extrabold text-[28px] leading-tight text-on-surface mb-2">
            Planeje sua viagem perfeita com IA
          </h1>
          <p className="font-body text-sm text-on-surface-variant leading-relaxed">
            Roteiros personalizados e inteligentes criados em segundos para o seu próximo destino.
          </p>
        </section>

        {/* Form Card */}
        <section
          className="bg-surface-container-lowest rounded-3xl p-6 mb-10 animate-fade-in-up"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.04)', animationDelay: '0.1s' }}
        >
          {/* Origin */}
          <AirportInput
            label="Cidade de origem"
            icon="flight_takeoff"
            placeholder="Ex: São Paulo, Manaus, Lisboa..."
            value={originAirport}
            onChange={setOriginAirport}
            onSelect={setOriginAirport}
          />

          {/* Destination */}
          <AirportInput
            label="Para onde vamos?"
            icon="location_on"
            placeholder="Ex: Rio de Janeiro, Paris, Miami..."
            value={destAirport}
            onChange={setDestAirport}
            onSelect={setDestAirport}
          />

          {/* Mode Toggle */}
          <div className="mb-6">
            <label className="block font-body text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
              Formato do Roteiro
            </label>
            <div className="bg-surface-container-high p-1 rounded-2xl flex gap-1">
              <button
                onClick={() => setMode('days')}
                className={`flex-1 py-2.5 rounded-xl font-display font-bold text-xs transition-all duration-200 ${
                  mode === 'days' ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                Dias
              </button>
              <button
                onClick={() => setMode('period')}
                className={`flex-1 py-2.5 rounded-xl font-display font-bold text-xs transition-all duration-200 ${
                  mode === 'period' ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                Período
              </button>
            </div>
          </div>

          {/* Days Selection */}
          {mode === 'days' && (
            <div className="mb-6 animate-fade-in">
              <label className="block font-body text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                Quantos dias?
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                  const active = days === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className="w-12 h-12 flex-shrink-0 rounded-2xl font-display font-bold text-sm flex items-center justify-center transition-all duration-200"
                      style={
                        active
                          ? { background: '#0f5238', color: '#ffffff' }
                          : { background: '#e7e8e8', color: '#191c1c' }
                      }
                    >
                      {d}
                    </button>
                  );
                })}
                <input
                  type="number"
                  min={8}
                  max={30}
                  placeholder="8+"
                  className="w-16 h-12 flex-shrink-0 rounded-2xl text-center font-display font-bold text-sm bg-surface-container-high text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 8 && val <= 30) setDays(val);
                  }}
                />
              </div>
            </div>
          )}

          {/* Period Selection */}
          {mode === 'period' && (
            <div className="mb-6 grid grid-cols-2 gap-4 animate-fade-in">
              <div>
                <label className="block font-body text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                  Ida
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-surface-container-high rounded-2xl p-3 font-body text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block font-body text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                  Volta
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-surface-container-high rounded-2xl p-3 font-body text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {/* Budget */}
          <div className="mb-7">
            <div className="flex items-center justify-between mb-3">
              <label className="font-body text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Orçamento estimado
              </label>
              <span
                className="px-3 py-1 rounded-full font-body text-xs font-semibold"
                style={{ background: '#b1f0ce', color: '#002114' }}
              >
                {formatCurrency(budget)}
              </span>
            </div>
            <input
              type="range"
              min={500}
              max={10000}
              step={500}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between mt-2">
              <span className="font-body text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                Econômico
              </span>
              <span className="font-body text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                Luxo
              </span>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-4 rounded-[20px] font-display font-bold text-base flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            style={{ background: '#ffd167', color: '#765900' }}
          >
            <span className="material-symbols-rounded filled text-[20px]">auto_awesome</span>
            Gerar Meu Roteiro
          </button>
        </section>

        {/* Suggestions */}
        <section className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg text-on-surface">Sugestões para você</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map((s) => (
              <button
                key={s.city}
                onClick={() => handleSuggestionClick(s.city)}
                className="relative rounded-3xl overflow-hidden transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{ aspectRatio: '4/5' }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: s.gradient }}
                />
                {/* Decorative icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <span className="material-symbols-rounded text-white text-[80px]">travel_explore</span>
                </div>
                {/* Overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
                  }}
                />
                {/* Text */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="font-display font-bold text-base text-white text-left">
                    {s.city}
                  </p>
                  <p className="font-body text-xs text-white/70 text-left">{s.country}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
