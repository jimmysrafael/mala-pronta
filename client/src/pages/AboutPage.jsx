import { useNavigate } from 'react-router-dom';
import PublicPageShell from '../components/PublicPageShell';

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <PublicPageShell title="Sobre" onBack={() => navigate(-1)}>
      <section className="mt-6 animate-fade-in-up">
        <p className="mb-3 inline-flex rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Sobre o serviço
        </p>
        <h1 className="mb-4 font-display text-3xl font-extrabold text-on-surface">
          Planejamento de viagem com foco em clareza, orçamento e utilidade real.
        </h1>
        <p className="font-body text-sm leading-relaxed text-on-surface-variant">
          O MalaPronta ajuda o usuário a montar roteiros personalizados com base em destino, duração, orçamento e preferências.
          A proposta é simplificar a decisão de viagem com informações úteis, organização visual e uma experiência que não dependa de dezenas de abas abertas.
        </p>
      </section>

      <section className="mt-8 grid gap-4">
        <div className="rounded-[24px] bg-surface-container-lowest p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <h2 className="mb-2 font-display text-lg font-bold text-on-surface">O que entregamos</h2>
          <p className="font-body text-sm leading-relaxed text-on-surface-variant">
            Um roteiro organizado por dias, estimativas de custo, sugestões de passagem, hospedagem, clima e atrações.
            O usuário pode usar a plataforma de forma gratuita em uma primeira consulta e, depois, acessar novas consultas por meio de recompensas ou planos.
          </p>
        </div>

        <div className="rounded-[24px] bg-surface-container-lowest p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <h2 className="mb-2 font-display text-lg font-bold text-on-surface">Como o site se sustenta</h2>
          <p className="font-body text-sm leading-relaxed text-on-surface-variant">
            Mantemos uma estrutura híbrida: conteúdo gratuito, oferta recompensada e opções pagas opcionais.
            Isso ajuda a manter o serviço acessível sem depender exclusivamente de paywall.
          </p>
        </div>
      </section>
    </PublicPageShell>
  );
}
