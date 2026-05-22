import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import LoadingOverlay from '../components/LoadingOverlay';
import MonetizationGate from '../components/MonetizationGate';
import { useToast } from '../components/Toast';
import { formatCurrency } from '../utils/helpers';
import AirportInput from '../components/AirportInput';
import { apiFetch } from '../lib/api';

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
  const [budgetDecisionPrompt, setBudgetDecisionPrompt] = useState(null);
  const [budgetDecisionLoading, setBudgetDecisionLoading] = useState(false);
  const [monetizationPrompt, setMonetizationPrompt] = useState(null);
  const [monetizationLoading, setMonetizationLoading] = useState(false);
  const [walletStatus, setWalletStatus] = useState(null);
  const [walletStatusLoading, setWalletStatusLoading] = useState(false);
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

  useEffect(() => {
    let cancelled = false;

    const loadWalletStatus = async () => {
      setWalletStatusLoading(true);
      try {
        const res = await apiFetch('/api/monetization/status');
        const data = await res.json();
        if (res.ok && !cancelled) {
          setWalletStatus(data);
        }
      } catch (_err) {
        if (!cancelled) {
          setWalletStatus(null);
        }
      } finally {
        if (!cancelled) {
          setWalletStatusLoading(false);
        }
      }
    };

    loadWalletStatus();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const getGeneratePayload = () => {
    let finalDays = days;
    let finalDate = null;
    let finalReturnDate = '';

    if (mode === 'period') {
      if (!startDate || !endDate) {
        return { error: 'Selecione as datas de início e fim' };
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays <= 0 || diffDays > 30) {
        return { error: 'O período deve ser entre 1 e 30 dias' };
      }

      finalDays = diffDays;
      finalDate = startDate;
      finalReturnDate = endDate;
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      finalDate = d.toISOString().split('T')[0];
    }

    return {
      payload: {
        origin: originAirport,
        destination: destAirport,
        days: finalDays,
        budget,
        startDate: finalDate,
        returnDate: finalReturnDate,
      },
      finalDays,
    };
  };

  const submitGenerateRequest = async (requestBody) => {
    const res = await apiFetch('/api/trips/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json();
    if (res.status === 402) {
      const error = new Error(data.error || 'Limite de consultas atingido');
      error.paymentRequired = true;
      error.monetization = data.monetization || null;
      throw error;
    }

    if (!res.ok) throw new Error(data.error || 'Erro ao gerar roteiro');
    return data;
  };

  const handleGenerate = async () => {
    if (!destAirport) {
      toast('Selecione o aeroporto de destino', 'error');
      return;
    }
    if (!originAirport) {
      toast('Selecione o aeroporto de origem', 'error');
      return;
    }

    const generateData = getGeneratePayload();
    if (generateData.error) {
      toast(generateData.error, 'error');
      return;
    }

    setLoading(true);
    try {
      const data = await submitGenerateRequest(generateData.payload);

      if (data?.needsBudgetDecision) {
        setBudgetDecisionPrompt({
          previewToken: data.previewToken,
          budgetUsage: data.budgetUsage,
          decisionOptions: data.decisionOptions || [],
          preview: data.preview || null,
          message: data.message || 'O orçamento está apertado. Escolha como deseja continuar.',
          requestBody: generateData.payload,
          finalDays: generateData.finalDays,
        });
        return;
      }

      navigate('/itinerary', {
        state: {
          itinerary: data,
          destination: destAirport.cityName,
          days: generateData.finalDays,
          budget: data.totalBudget || data.budgetBreakdown?.total || budget,
          startDate: generateData.payload.startDate || '',
          returnDate: generateData.payload.returnDate || '',
          isNew: true,
        },
      });
    } catch (err) {
      if (err.paymentRequired) {
        setMonetizationPrompt({
          ...err.monetization,
          requestBody: generateData.payload,
          finalDays: generateData.finalDays,
        });
        return;
      }
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBudgetDecision = async (modeChoice) => {
    if (!budgetDecisionPrompt) return;

    setBudgetDecisionLoading(true);
    setLoading(true);

    try {
      const data = await submitGenerateRequest({
        ...budgetDecisionPrompt.requestBody,
        budgetDecision: modeChoice,
        previewToken: budgetDecisionPrompt.previewToken,
      });

      setBudgetDecisionPrompt(null);
      navigate('/itinerary', {
        state: {
          itinerary: data,
          destination: destAirport.cityName,
          days: budgetDecisionPrompt.finalDays,
          budget: data.totalBudget || data.budgetBreakdown?.total || budget,
          startDate: budgetDecisionPrompt.requestBody.startDate || '',
          returnDate: budgetDecisionPrompt.requestBody.returnDate || '',
          isNew: true,
        },
      });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBudgetDecisionLoading(false);
      setLoading(false);
    }
  };

  const refreshWalletStatus = async () => {
    try {
      const res = await apiFetch('/api/monetization/status');
      const data = await res.json();
      if (res.ok) {
        setWalletStatus(data);
      }
    } catch (_err) {
      // Mantem o saldo anterior se a consulta falhar.
    }
  };

  const handleWatchReward = async () => {
    if (!monetizationPrompt) return;

    setMonetizationLoading(true);
    setLoading(true);

    try {
      const sessionRes = await apiFetch('/api/monetization/reward-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          unlockCredits: 2,
          provider: 'mock',
        }),
      });

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) {
        throw new Error(sessionData.error || 'Nao foi possivel iniciar a recompensa');
      }

      await new Promise((resolve) => setTimeout(resolve, 1800));

      const claimRes = await apiFetch('/api/monetization/reward-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          provider: sessionData.provider,
        }),
      });

      const claimData = await claimRes.json();
      if (!claimRes.ok) {
        throw new Error(claimData.error || 'Nao foi possivel liberar as consultas');
      }

      toast(claimData.message || 'Consultas liberadas com sucesso!');
      await refreshWalletStatus();

      const retryData = await submitGenerateRequest(monetizationPrompt.requestBody);
      setMonetizationPrompt(null);

      if (retryData?.needsBudgetDecision) {
        setBudgetDecisionPrompt({
          previewToken: retryData.previewToken,
          budgetUsage: retryData.budgetUsage,
          decisionOptions: retryData.decisionOptions || [],
          preview: retryData.preview || null,
          message: retryData.message || 'O orÃ§amento estÃ¡ apertado. Escolha como deseja continuar.',
          requestBody: monetizationPrompt.requestBody,
          finalDays: monetizationPrompt.finalDays,
        });
        return;
      }

      navigate('/itinerary', {
        state: {
          itinerary: retryData,
          destination: destAirport.cityName,
          days: monetizationPrompt.finalDays,
          budget: retryData.totalBudget || retryData.budgetBreakdown?.total || budget,
          startDate: monetizationPrompt.requestBody.startDate || '',
          returnDate: monetizationPrompt.requestBody.returnDate || '',
          isNew: true,
        },
      });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setMonetizationLoading(false);
      setLoading(false);
    }
  };

  const handleOpenOffer = (offer) => {
    if (!offer) return;

    if (offer.enabled && offer.url) {
      window.open(offer.url, '_blank', 'noopener,noreferrer');
      return;
    }

    toast('Este plano ainda nao foi configurado.', 'error');
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
              Planeje sua próxima viagem com mais praticidade
            </h1>
            <p className="font-body text-sm text-on-surface-variant leading-relaxed">
              Roteiros personalizados para o seu próximo destino, montados em poucos segundos.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { to: '/sobre', label: 'Sobre' },
                { to: '/contato', label: 'Contato' },
                { to: '/termos', label: 'Termos' },
                { to: '/privacidade', label: 'Privacidade' },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-primary"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </section>

          <section
            className="mb-8 grid gap-3 rounded-3xl bg-surface-container-lowest/88 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-[10px] animate-fade-in-up"
            style={{ animationDelay: '0.05s' }}
          >
            <div>
              <p className="mb-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                Como funciona
              </p>
              <h2 className="font-display text-lg font-bold text-on-surface">
                Um jeito mais simples de planejar sua viagem.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                '1 consulta gratuita para cada visitante',
                'Recompensa por anúncio para liberar mais consultas',
                'Planos e pacotes opcionais por checkout Pix',
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-surface-container-low p-4">
                  <p className="font-body text-sm leading-relaxed text-on-surface-variant">{item}</p>
                </div>
              ))}
            </div>
            <p className="rounded-2xl bg-[#f3f6f5] px-4 py-3 font-body text-xs leading-relaxed text-on-surface-variant">
              As estimativas podem variar conforme disponibilidade real de voos, hotéis e atrações. O serviço é informativo e depende de integrações de terceiros para montar o roteiro final.
            </p>
          </section>

          <section
            className="rounded-3xl p-6 mb-10 animate-fade-in-up bg-surface-container-lowest/88 backdrop-blur-[10px]"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.04)', animationDelay: '0.1s' }}
          >
            <div className="mb-5 rounded-2xl border border-surface-container-high bg-[#f3f6f5] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    Consultas disponiveis
                  </p>
                  <p className="font-display text-sm font-bold text-on-surface">
                    {walletStatusLoading ? 'Carregando...' : `${walletStatus?.availableConsultations ?? 1} consultas`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-body text-[10px] text-on-surface-variant">
                    1 consulta gratis, depois desbloqueio por anuncio ou plano.
                  </p>
                </div>
              </div>
            </div>

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
                      const val = parseInt(e.target.value, 10);
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
              Montar Meu Roteiro
            </button>
          </section>
        </div>
      </main>

      {budgetDecisionPrompt && (
        <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 py-6 sm:items-center">
          <div className="w-full max-w-[560px] rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] animate-fade-in-up">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 font-display text-xl font-bold text-on-surface">
                  O orçamento ficou apertado
                </p>
                <p className="font-body text-sm leading-relaxed text-on-surface-variant">
                  {budgetDecisionPrompt.message}
                </p>
              </div>
              <button
                onClick={() => setBudgetDecisionPrompt(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"
                aria-label="Fechar"
                disabled={budgetDecisionLoading}
              >
                <span className="material-symbols-rounded text-[20px]">close</span>
              </button>
            </div>

            {budgetDecisionLoading && (
              <div className="mb-5 rounded-2xl bg-[#f3f6f5] p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <span className="material-symbols-rounded text-primary text-[22px] animate-spin">progress_activity</span>
                </div>
                <div>
                  <p className="font-display font-bold text-sm text-on-surface">
                    Processando sua escolha
                  </p>
                  <p className="font-body text-xs text-on-surface-variant">
                    Estamos montando a viagem com a opção selecionada. Isso pode levar alguns segundos.
                  </p>
                </div>
              </div>
            )}

            {budgetDecisionPrompt.budgetUsage && (
              <div className="mb-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-surface-container-low p-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-on-surface-variant">Passagem</p>
                  <p className="font-display text-sm font-bold text-on-surface">
                    {formatCurrency(budgetDecisionPrompt.budgetUsage.flightCost || 0)}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-container-low p-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-on-surface-variant">Hotel</p>
                  <p className="font-display text-sm font-bold text-on-surface">
                    {formatCurrency(budgetDecisionPrompt.budgetUsage.hotelCost || 0)}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-container-low p-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-on-surface-variant">Orçamento usado</p>
                  <p className="font-display text-sm font-bold text-on-surface">
                    {budgetDecisionPrompt.budgetUsage.usagePercent || 0}%
                  </p>
                </div>
              </div>
            )}

            {budgetDecisionPrompt.preview?.warnings?.length > 0 && (
              <div className="mb-5 rounded-2xl bg-[#fff7e6] p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#765900]">
                  Avisos
                </p>
                <ul className="space-y-2">
                  {budgetDecisionPrompt.preview.warnings.slice(0, 3).map((warning) => (
                    <li key={warning} className="font-body text-sm leading-relaxed text-[#5f4900]">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => handleBudgetDecision('adapt_without_api')}
                disabled={budgetDecisionLoading}
                className="rounded-2xl border border-surface-container-high px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
              >
                <p className="mb-1 font-display text-sm font-bold text-on-surface">
                  {budgetDecisionLoading ? 'Processando...' : 'Adaptar sem valores reais'}
                </p>
                <p className="font-body text-xs leading-relaxed text-on-surface-variant">
                  {budgetDecisionLoading
                    ? 'Aguarde a montagem do roteiro.'
                    : 'Mantém a experiência rápida e monta o roteiro usando estimativas para caber no orçamento.'}
                </p>
              </button>

              <button
                onClick={() => handleBudgetDecision('use_real_values')}
                disabled={budgetDecisionLoading}
                className="rounded-2xl px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
                style={{ background: '#0f5238', color: '#ffffff' }}
              >
                <p className="mb-1 font-display text-sm font-bold">
                  {budgetDecisionLoading ? 'Processando...' : 'Usar valores reais encontrados'}
                </p>
                <p className="font-body text-xs leading-relaxed text-white/85">
                  {budgetDecisionLoading
                    ? 'Aguarde a montagem do roteiro.'
                    : 'Reaproveita os valores reais já encontrados e ajusta o roteiro com base neles.'}
                </p>
              </button>
            </div>
          </div>
        </div>
      )} 

      <MonetizationGate
        open={Boolean(monetizationPrompt)}
        status={monetizationPrompt}
        loading={monetizationLoading}
        onClose={() => setMonetizationPrompt(null)}
        onWatchReward={handleWatchReward}
        onOpenOffer={handleOpenOffer}
      />

      {user && <BottomNav />}
    </>
  );
}
