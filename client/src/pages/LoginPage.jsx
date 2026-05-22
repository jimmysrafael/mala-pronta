import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import BackgroundVideo from '../components/BackgroundVideo';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin ? { email, password } : { name, email, password };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar sua solicitação');
      }

      login(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-5 py-6 sm:py-10">
      <BackgroundVideo />

      <button
        type="button"
        onClick={() => navigate('/')}
        className="relative z-20 mb-6 inline-flex items-center gap-2 self-start rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-on-surface shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-[1.02] hover:bg-white md:absolute md:left-5 md:top-5 md:mb-0"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}
      >
        <span className="material-symbols-rounded text-[18px]">arrow_back</span>
        Voltar para home
      </button>

      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center md:min-h-[calc(100vh-5rem)]">
        <div className="w-full max-w-[400px] animate-fade-in-up">
          <div className="flex flex-col items-center mb-10 pt-1 md:pt-0">
            <div
              className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center mb-4 shadow-lg"
              style={{ boxShadow: '0 8px 32px rgba(15,82,56,0.15)' }}
            >
              <span className="material-symbols-rounded filled text-white text-[32px]">
                flight_takeoff
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl text-on-surface">MalaPronta</h1>
            <p className="font-body text-sm text-on-surface-variant mt-1">
              Sua viagem perfeita começa aqui
            </p>
          </div>

          <div
            className="bg-surface-container-lowest rounded-3xl p-7"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}
          >
            <div className="flex bg-surface-container-high rounded-2xl p-1 mb-7">
              <button
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                }}
                className={`flex-1 py-2.5 rounded-xl font-body font-semibold text-sm transition-all duration-200 ${
                  isLogin
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => {
                  setIsLogin(false);
                  setError('');
                }}
                className={`flex-1 py-2.5 rounded-xl font-body font-semibold text-sm transition-all duration-200 ${
                  !isLogin
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                Cadastrar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {!isLogin && (
                <div>
                  <label className="block font-body text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    required={!isLogin}
                    className="w-full py-3.5 px-4 rounded-2xl bg-surface-container-high text-on-surface font-body text-sm placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-body text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full py-3.5 px-4 rounded-2xl bg-surface-container-high text-on-surface font-body text-sm placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none"
                />
              </div>

              <div>
                <label className="block font-body text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  minLength={6}
                  className="w-full py-3.5 px-4 rounded-2xl bg-surface-container-high text-on-surface font-body text-sm placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none"
                />
              </div>

              {error && (
                <div className="py-2.5 px-4 rounded-xl bg-red-50 text-error text-sm font-body font-medium flex items-center gap-2">
                  <span className="material-symbols-rounded text-[18px]">error</span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-[20px] font-display font-bold text-base flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100 mt-2"
                style={{
                  background: '#ffd167',
                  color: '#765900',
                }}
              >
                {loading ? (
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-current loading-dot" />
                    <div className="w-2 h-2 rounded-full bg-current loading-dot" />
                    <div className="w-2 h-2 rounded-full bg-current loading-dot" />
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-rounded filled text-[20px]">
                      {isLogin ? 'login' : 'person_add'}
                    </span>
                    {isLogin ? 'Entrar' : 'Criar Conta'}
                  </>
                )}
              </button>
            </form>

            <p className="text-center mt-5 font-body text-sm text-on-surface-variant">
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-primary font-semibold hover:underline"
              >
                {isLogin ? 'Cadastre-se' : 'Entrar'}
              </button>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
