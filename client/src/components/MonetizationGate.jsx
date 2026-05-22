export default function MonetizationGate({
  open,
  status,
  loading = false,
  onClose,
  onWatchReward,
  onOpenOffer,
}) {
  if (!open) return null;

  const account = status?.account || {};
  const offers = status?.offers || {};

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 px-4 py-6 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[560px] rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] animate-fade-in-up">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 font-display text-xl font-bold text-on-surface">
              Suas consultas acabaram
            </p>
            <p className="font-body text-sm leading-relaxed text-on-surface-variant">
              Escolha uma forma de continuar. A primeira consulta continua gratuita e, depois disso, você pode liberar mais consultas assistindo a um anúncio ou seguir para um plano pago.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"
            aria-label="Fechar"
            disabled={loading}
          >
            <span className="material-symbols-rounded text-[20px]">close</span>
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-surface-container-low p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-on-surface-variant">Gratis</p>
            <p className="font-display text-sm font-bold text-on-surface">
              {Number(account.freeConsultsRemaining || 0)}
            </p>
          </div>
          <div className="rounded-2xl bg-surface-container-low p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-on-surface-variant">Recompensas</p>
            <p className="font-display text-sm font-bold text-on-surface">
              {Number(account.rewardCredits || 0)}
            </p>
          </div>
          <div className="rounded-2xl bg-surface-container-low p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-on-surface-variant">Pagas</p>
            <p className="font-display text-sm font-bold text-on-surface">
              {Number(account.paidCredits || 0)}
            </p>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <button
            onClick={onWatchReward}
            disabled={loading}
            className="rounded-2xl px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
            style={{ background: '#0f5238', color: '#ffffff' }}
          >
            <p className="mb-1 font-display text-sm font-bold">
              {loading ? 'Processando...' : offers.rewarded?.label || 'Assistir anuncio'}
            </p>
            <p className="font-body text-xs leading-relaxed text-white/85">
              {offers.rewarded?.description || 'Libera consultas extras com uma recompensa.'}
            </p>
          </button>

          <button
            onClick={() => onOpenOffer(offers.monthly)}
            disabled={loading || !offers.monthly?.enabled}
            className="rounded-2xl border border-surface-container-high px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
          >
            <p className="mb-1 font-display text-sm font-bold text-on-surface">
              {offers.monthly?.label || 'Plano mensal'}
            </p>
            <p className="font-body text-xs leading-relaxed text-on-surface-variant">
              {offers.monthly?.enabled ? offers.monthly?.description : 'Disponibilize um checkout quando quiser.'}
            </p>
          </button>

          <button
            onClick={() => onOpenOffer(offers.credits)}
            disabled={loading || !offers.credits?.enabled}
            className="rounded-2xl border border-surface-container-high px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
          >
            <p className="mb-1 font-display text-sm font-bold text-on-surface">
              {offers.credits?.label || 'Pacote de consultas'}
            </p>
            <p className="font-body text-xs leading-relaxed text-on-surface-variant">
              {offers.credits?.enabled ? offers.credits?.description : 'Disponibilize um checkout quando quiser.'}
            </p>
          </button>
        </div>

        <div className="rounded-2xl bg-[#f3f6f5] p-4">
          <p className="mb-1 font-display text-sm font-bold text-on-surface">
            Como o modelo funciona
          </p>
          <p className="font-body text-xs leading-relaxed text-on-surface-variant">
            1 consulta gratuita por usuario, depois consultas por recompensa e plano pago. O provedor de anuncio pode ser conectado mais tarde sem mudar a regra do saldo.
          </p>
        </div>
      </div>
    </div>
  );
}
