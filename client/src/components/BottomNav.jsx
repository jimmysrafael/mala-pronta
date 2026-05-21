import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const tabs = [
  { path: '/', icon: 'home', label: 'Início' },
  { path: '/my-trips', icon: 'luggage', label: 'Minhas Viagens' },
  { path: '/profile', icon: 'person', label: 'Perfil' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-4 py-2 pb-[env(safe-area-inset-bottom,8px)]"
      style={{
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '32px 32px 0 0',
      }}
    >
      {tabs.map((tab) => {
        const active = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className="flex flex-col items-center gap-0.5 py-1.5 px-5 rounded-2xl transition-all duration-200"
            style={active ? { background: '#d1fae5' } : {}}
          >
            <span
              className={`material-symbols-rounded ${active ? 'filled' : ''} text-[24px] transition-colors`}
              style={{ color: active ? '#064e3b' : '#404943' }}
            >
              {tab.icon}
            </span>
            <span
              className="text-[11px] font-medium font-body transition-colors"
              style={{ color: active ? '#064e3b' : '#404943' }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
