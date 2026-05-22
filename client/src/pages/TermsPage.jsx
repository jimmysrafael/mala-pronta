import { useNavigate } from 'react-router-dom';
import PublicPageShell from '../components/PublicPageShell';

const sections = [
  {
    title: '1. Aceitação dos termos',
    body: 'Ao acessar e usar o MalaPronta, você concorda com estes Termos de Uso e com as políticas associadas ao serviço.',
  },
  {
    title: '2. Uso do serviço',
    body: 'O site gera roteiros e estimativas de viagem com base nas informações informadas pelo usuário. O conteúdo tem caráter informativo e pode variar de acordo com disponibilidade, preço e data.',
  },
  {
    title: '3. Conta e acesso',
    body: 'Algumas funcionalidades exigem conta. O usuário é responsável por manter a segurança do seu acesso e fornecer dados corretos ao usar o serviço.',
  },
  {
    title: '4. Monetização',
    body: 'O site pode exibir um Offerwall, permitir acesso por recompensa e disponibilizar planos ou pacotes pagos. A primeira consulta pode ser gratuita e consultas adicionais podem exigir uma ação de monetização.',
  },
  {
    title: '5. Limitações',
    body: 'Não garantimos preço final, disponibilidade imediata, exatidão absoluta das informações de terceiros ou disponibilidade contínua de APIs externas.',
  },
  {
    title: '6. Encerramento',
    body: 'Podemos suspender ou limitar o acesso em caso de uso indevido, fraude, abuso de recursos ou violação destes termos.',
  },
];

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <PublicPageShell title="Termos de Uso" onBack={() => navigate(-1)}>
      <section className="mt-6 animate-fade-in-up">
        <p className="mb-3 inline-flex rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Termos
        </p>
        <h1 className="mb-4 font-display text-3xl font-extrabold text-on-surface">
          Regras básicas para usar o serviço com segurança e transparência.
        </h1>
        <p className="font-body text-sm leading-relaxed text-on-surface-variant">
          Estes termos foram escritos para deixar claro como o serviço funciona, o que o usuário pode esperar e quais limites existem no uso das funcionalidades.
        </p>
      </section>

      <section className="mt-8 grid gap-4">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-[24px] bg-surface-container-lowest p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)]"
          >
            <h2 className="mb-2 font-display text-lg font-bold text-on-surface">{section.title}</h2>
            <p className="font-body text-sm leading-relaxed text-on-surface-variant">{section.body}</p>
          </article>
        ))}
      </section>
    </PublicPageShell>
  );
}
