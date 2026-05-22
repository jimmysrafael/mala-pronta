import { useAuth } from '../context/AuthContext';

const GRADIENTS = [
  'from-emerald-800 to-teal-600',
  'from-sky-800 to-cyan-600',
  'from-purple-800 to-fuchsia-600',
  'from-amber-700 to-orange-500',
  'from-rose-800 to-pink-600',
  'from-indigo-800 to-blue-600',
];

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getGradientClass(name) {
  return GRADIENTS[hashStr(name) % GRADIENTS.length];
}

export default function Header({ title, showBack, onBack }) {
  const { user } = useAuth();

  const initials = user
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
      style={{
        background: 'rgba(248,249,249,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-rounded text-on-surface">arrow_back</span>
          </button>
        )}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="material-symbols-rounded filled text-primary text-[28px]">
            flight_takeoff
          </span>
          <span className="truncate font-display font-bold text-lg text-on-surface tracking-tight">
            {title || 'MalaPronta'}
          </span>
        </div>
      </div>

      {!user && !showBack && (
        <a
          href="/login"
          className="px-4 py-1.5 rounded-full bg-primary/10 text-primary font-display font-bold text-xs transition-all hover:bg-primary/20"
        >
          Entrar
        </a>
      )}
      {user && !showBack && (
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
          <span className="text-sm font-semibold text-on-primary font-body">{initials}</span>
        </div>
      )}
      {showBack && (
        <span className="material-symbols-rounded filled flex-shrink-0 text-primary text-[28px]">
          flight_takeoff
        </span>
      )}
    </header>
  );
}
