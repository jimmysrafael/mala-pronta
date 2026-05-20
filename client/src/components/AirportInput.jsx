import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AirportInput({ label, icon, placeholder, value, onChange, onSelect }) {
  const [query, setQuery] = useState(value?.airportName || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const abortControllerRef = useRef(null);
  const wrapperRef = useRef(null);
  const { token } = useAuth();

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sincronizar valor externo
  useEffect(() => {
    if (value?.airportName) {
      setQuery(value.airportName);
    }
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(null); // limpa seleção anterior

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    if (val.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(`/api/airports/search?q=${encodeURIComponent(val)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        const data = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        if (abortControllerRef.current === controller) {
          setLoading(false);
        }
      }
    }, 500);
  };

  const handleSelect = (airport) => {
    setQuery(airport.airportName || airport.cityName);
    setSuggestions([]);
    setOpen(false);
    onSelect(airport);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    onChange(null);
  };

  return (
    <div className="mb-6" ref={wrapperRef}>
      <label className="block font-body text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
        {label}
      </label>
      <div className="relative">
        {/* Ícone esquerdo */}
        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-rounded text-primary text-[20px] z-10">
          {icon}
        </span>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full py-3.5 pl-11 pr-10 rounded-2xl bg-surface-container-high text-on-surface font-body text-sm placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none"
        />

        {/* Loading / Clear */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : query ? (
            <button onClick={handleClear} className="text-on-surface-variant/50 hover:text-on-surface transition-colors">
              <span className="material-symbols-rounded text-[18px]">close</span>
            </button>
          ) : null}
        </div>

        {/* Dropdown */}
        {open && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-2xl overflow-hidden z-50 max-h-[280px] overflow-y-auto"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
            {suggestions.map((airport, i) => (
              <button
                key={`${airport.skyId}-${i}`}
                onClick={() => handleSelect(airport)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-container-high transition-colors text-left"
              >
                {/* Ícone */}
                <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-rounded text-primary text-[18px]">flight</span>
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-sm text-on-surface truncate">
                      {airport.cityName}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded font-body text-[10px] font-bold flex-shrink-0"
                      style={{ background: '#b1f0ce', color: '#002114' }}
                    >
                      {airport.iataCode}
                    </span>
                  </div>
                  {airport.airportName && airport.airportName !== airport.cityName && (
                    <p className="font-body text-xs text-on-surface-variant truncate mt-0.5">
                      {airport.airportName}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Sem resultados */}
        {open && suggestions.length === 0 && !loading && query.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-2xl p-4 z-50"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
            <p className="font-body text-sm text-on-surface-variant text-center">
              Nenhum aeroporto encontrado para "{query}"
            </p>
          </div>
        )}
      </div>

      {/* Badge de aeroporto selecionado */}
      {value?.iataCode && (
        <div className="flex items-center gap-2 mt-2 px-1">
          <span className="material-symbols-rounded text-primary text-[14px]">check_circle</span>
          <span className="font-body text-xs text-primary font-medium">
            {value.cityName} ({value.iataCode}) selecionado
          </span>
        </div>
      )}
    </div>
  );
}
