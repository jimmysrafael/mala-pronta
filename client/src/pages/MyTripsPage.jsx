import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { hashStr, formatCurrency, formatDate } from '../utils/helpers';

const THUMB_GRADIENTS = [
  'linear-gradient(135deg, #0f5238, #2d6a4f)',
  'linear-gradient(135deg, #1e3a5f, #2563eb)',
  'linear-gradient(135deg, #5b2c6f, #7c3aed)',
  'linear-gradient(135deg, #7c2d12, #ea580c)',
  'linear-gradient(135deg, #155e75, #0891b2)',
  'linear-gradient(135deg, #831843, #db2777)',
  'linear-gradient(135deg, #065f46, #10b981)',
  'linear-gradient(135deg, #1e40af, #3b82f6)',
];



export default function MyTripsPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const res = await fetch('/api/trips', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTrips(data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/trips/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setTrips((prev) => prev.filter((t) => t.id !== id));
      toast('Viagem deletada com sucesso');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleTripClick = (trip) => {
    navigate('/itinerary', {
      state: {
        itinerary: trip.itinerary,
        destination: trip.destination,
        days: trip.days,
        budget: trip.budget,
        isNew: false,
      },
    });
  };

  return (
    <>
      <Header />
      <main className="pt-16 pb-24 px-5 max-w-[672px] mx-auto">
        {/* Title */}
        <div className="mt-6 mb-6 animate-fade-in-up">
          <h1 className="font-display font-extrabold text-[28px] text-on-surface mb-1">
            Minhas Viagens
          </h1>
          <p className="font-body text-sm text-on-surface-variant">
            {trips.length > 0
              ? `Você tem ${trips.length} destino${trips.length > 1 ? 's' : ''} planejado${trips.length > 1 ? 's' : ''}`
              : ''}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-primary loading-dot" />
              <div className="w-3 h-3 rounded-full bg-primary loading-dot" />
              <div className="w-3 h-3 rounded-full bg-primary loading-dot" />
            </div>
          </div>
        ) : trips.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in-up">
            <span className="material-symbols-rounded text-primary/30 mb-4" style={{ fontSize: '80px' }}>
              map
            </span>
            <h2 className="font-display font-bold text-xl text-on-surface mb-2">
              Nenhuma viagem salva ainda
            </h2>
            <p className="font-body text-sm text-on-surface-variant text-center mb-6 max-w-[280px]">
              Explore destinos incríveis e salve seus roteiros favoritos
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3.5 rounded-[20px] bg-primary text-on-primary font-display font-bold text-sm flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="material-symbols-rounded text-[18px]">explore</span>
              Começar Exploração
            </button>
          </div>
        ) : (
          /* Trip list */
          <div className="flex flex-col gap-3">
            {trips.map((trip, index) => {
              const grad = THUMB_GRADIENTS[hashStr(trip.destination) % THUMB_GRADIENTS.length];
              return (
                <button
                  key={trip.id}
                  onClick={() => handleTripClick(trip)}
                  className="w-full bg-surface-container-lowest rounded-3xl p-4 flex items-center gap-4 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] animate-fade-in-up"
                  style={{
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                    animationDelay: `${index * 0.05}s`,
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: grad }}
                  >
                    <span className="material-symbols-rounded filled text-white text-[28px] opacity-80">
                      flight_takeoff
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-base text-on-surface mb-0.5 truncate">
                      {trip.destination}
                    </h3>
                    <p className="font-body text-xs text-on-surface-variant mb-2">
                      Salvo em {formatDate(trip.created_at)}
                    </p>
                    <div className="flex gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low font-body text-[11px] font-medium text-on-surface-variant">
                        <span className="material-symbols-rounded text-[14px]">calendar_today</span>
                        {trip.days} dias
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low font-body text-[11px] font-medium text-on-surface-variant">
                        <span className="material-symbols-rounded text-[14px]">payments</span>
                        {formatCurrency(trip.budget)}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => handleDelete(e, trip.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-error/60 hover:text-error hover:bg-red-50 transition-all flex-shrink-0"
                  >
                    <span className="material-symbols-rounded text-[20px]">delete</span>
                  </button>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* FAB to home */}
      {trips.length > 0 && (
        <button
          onClick={() => navigate('/')}
          className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
          style={{
            background: '#ffd167',
            color: '#765900',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}
        >
          <span className="material-symbols-rounded filled text-[24px]">add</span>
        </button>
      )}

      <BottomNav />
    </>
  );
}
