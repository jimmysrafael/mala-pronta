import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  return (
    <>
      <Header />
      <main className="pt-16 pb-24 px-5 max-w-[672px] mx-auto">
        <div className="mt-10 flex flex-col items-center animate-fade-in-up">
          {/* Avatar */}
          <div
            className="w-24 h-24 rounded-full bg-primary flex items-center justify-center mb-4"
            style={{ boxShadow: '0 8px 32px rgba(15,82,56,0.2)' }}
          >
            <span className="text-3xl font-bold text-on-primary font-display">{initials}</span>
          </div>

          <h1 className="font-display font-bold text-2xl text-on-surface mb-1">{user?.name}</h1>
          <p className="font-body text-sm text-on-surface-variant mb-8">{user?.email}</p>

          {/* Info card */}
          <div
            className="w-full bg-surface-container-lowest rounded-3xl p-6 mb-6"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}
          >
            <h2 className="font-body text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">
              Conta
            </h2>
            <div className="flex items-center gap-3 py-3">
              <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center">
                <span className="material-symbols-rounded text-primary text-[20px]">person</span>
              </div>
              <div className="flex-1">
                <p className="font-body text-xs text-on-surface-variant">Nome</p>
                <p className="font-body text-sm font-medium text-on-surface">{user?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 py-3">
              <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center">
                <span className="material-symbols-rounded text-primary text-[20px]">email</span>
              </div>
              <div className="flex-1">
                <p className="font-body text-xs text-on-surface-variant">Email</p>
                <p className="font-body text-sm font-medium text-on-surface">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full py-4 rounded-[20px] bg-red-50 text-error font-display font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="material-symbols-rounded text-[20px]">logout</span>
            Sair da Conta
          </button>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
