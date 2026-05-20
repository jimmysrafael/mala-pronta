import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin ? { email, password } : { name, email, password };

      const res = await fetch(endpoint, {
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
    <div className="min-h-screen flex items-center justify-center px-5 py-10 relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(135deg, rgba(15,82,56,0.06) 0%, rgba(45,106,79,0.04) 50%, rgba(177,240,206,0.08) 100%)',
        }}
      />
      {/* Decorative circles */}
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full opacity-[0.04] bg-primary -z-10" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full opacity-[0.06] bg-primary -z-10" />

      <div className="w-full max-w-[400px] animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center mb-4 shadow-lg" style={{ boxShadow: '0 8px 32px rgba(15,82,56,0.15)' }}>
            <span className="material-symbols-rounded filled text-white text-[32px]">
              flight_takeoff
            </span>
          </div>
          <h1 className="font-display font-extrabold text-2xl text-on-surface">MalaPronta IA</h1>
          <p className="font-body text-sm text-on-surface-variant mt-1">
            Sua viagem perfeita começa aqui
          </p>
        </div>

        {/* Card  */}
        <div
          className="bg-surface-container-lowest rounded-3xl p-7"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}
        >
          {/* Toggle */}
          <div className="flex bg-surface-container-high rounded-2xl p-1 mb-7">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl font-body font-semibold text-sm transition-all duration-200 ${
                isLogin
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
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
                placeholder="••••••••"
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
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-primary font-semibold hover:underline"
            >
              {isLogin ? 'Cadastre-se' : 'Entrar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
