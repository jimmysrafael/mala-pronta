import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import LoadingOverlay from '../components/LoadingOverlay';
import { useToast } from '../components/Toast';
import { formatCurrency } from '../utils/helpers';
import AirportInput from '../components/AirportInput';

export default function HomePage() {
  const [originAirport, setOriginAirport] = useState(null);
  const [destAirport, setDestAirport] = useState(null);
  const [days, setDays] = useState(3);
  const [budget, setBudget] = useState(3000);
  const [mode, setMode] = useState('days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVideoBackground, setShowVideoBackground] = useState(false);
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const updatePreference = () => {
      const shouldReduceMotion = reduceMotionQuery.matches || connection?.saveData;
      setShowVideoBackground(!shouldReduceMotion);
    };

    updatePreference();

    reduceMotionQuery.addEventListener?.('change', updatePreference);
    connection?.addEventListener?.('change', updatePreference);

    return () => {
      reduceMotionQuery.removeEventListener?.('change', updatePreference);
      connection?.removeEventListener?.('change', updatePreference);
    };
  }, []);

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
          startDate: finalDate,
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

  return (
    <>
      {loading && <LoadingOverlay />}
      <Header />
      <main className={`relative isolate min-h-screen overflow-hidden pt-16 ${user ? 'pb-24' : 'pb-6'}`}>
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(177,240,206,0.45),transparent_36%),linear-gradient(180deg,#f8f9f9_0%,#f3f6f5_100%)]" />
        {showVideoBackground && (
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <video
              className="h-full w-full object-cover scale-[1.03] opacity-45"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              onError={() => setShowVideoBackground(false)}
            >
              <source src="/background-mala-pronta.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-b from-[#f8f9f9]/55 via-[#f8f9f9]/78 to-[#f8f9f9]/96" />
          </div>
        )}

        <div className="relative z-10 mx-auto max-w-[672px] px-5">
          <section className="mt-6 mb-8 animate-fade-in-up">
            <h1 className="font-display font-extrabold text-[28px] leading-tight text-on-surface mb-2">
              Planeje sua viagem perfeita com IA
            </h1>
            <p className="font-body text-sm text-on-surface-variant leading-relaxed">
              Roteiros personalizados e inteligentes criados em segundos para o seu próximo destino.
            </p>
          </section>

          <section
            className="rounded-3xl p-6 mb-10 animate-fade-in-up bg-surface-container-lowest/88 backdrop-blur-[10px]"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.04)', animationDelay: '0.1s' }}
          >
            <AirportInput
              label="Cidade de origem"
              icon="flight_takeoff"
              placeholder="Ex: São Paulo, Manaus, Lisboa..."
              value={originAirport}
              onChange={setOriginAirport}
              onSelect={setOriginAirport}
            />

            <AirportInput
              label="Para onde vamos?"
              icon="location_on"
              placeholder="Ex: Rio de Janeiro, Paris, Miami..."
              value={destAirport}
              onChange={setDestAirport}
              onSelect={setDestAirport}
            />

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
        </div>
      </main>
      {user && <BottomNav />}
    </>
  );
}
