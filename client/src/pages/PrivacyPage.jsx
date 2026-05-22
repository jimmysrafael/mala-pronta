import { useNavigate } from 'react-router-dom';
import PublicPageShell from '../components/PublicPageShell';

const sections = [
  {
    title: '1. Informações que coletamos',
    body: 'Coletamos dados informados pelo usuário, como nome, email, destino, orçamento e preferências de viagem. Também registramos dados técnicos necessários para funcionamento, segurança e limitações de uso.',
  },
  {
    title: '2. Como usamos os dados',
    body: 'Usamos os dados para autenticação, geração de roteiros, controle de saldo de consultas, melhoria do serviço e cumprimento de exigências de segurança e auditoria.',
  },
  {
    title: '3. Cookies e identificadores',
    body: 'Podemos usar identificadores locais e cookies do navegador para manter sessões, melhorar a experiência e contabilizar uso legítimo da plataforma.',
  },
  {
    title: '4. Compartilhamento',
    body: 'Podemos compartilhar dados com provedores necessários para o funcionamento do serviço, como hospedagem, autenticação, análise e monetização, sempre com a finalidade de operar o produto.',
  },
  {
    title: '5. Base de monetização',
    body: 'O serviço pode exibir Offerwall e recompensas de anúncio para liberar consultas adicionais. Nossos parceiros de publicidade podem coletar dados conforme suas próprias políticas e configurações de privacidade.',
  },
  {
    title: '6. Direitos do usuário',
    body: 'Você pode solicitar correção, atualização ou exclusão de dados conforme aplicável. Também pode entrar em contato para esclarecer dúvidas sobre privacidade ou tratamento de informações.',
  },
];

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <PublicPageShell title="Privacidade" onBack={() => navigate(-1)}>
      <section className="mt-6 animate-fade-in-up">
        <p className="mb-3 inline-flex rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Privacidade
        </p>
        <h1 className="mb-4 font-display text-3xl font-extrabold text-on-surface">
          Como tratamos seus dados dentro do MalaPronta.
        </h1>
        <p className="font-body text-sm leading-relaxed text-on-surface-variant">
          Esta política explica, em linguagem simples, quais dados usamos, por que coletamos essas informações e como isso se relaciona com o funcionamento do produto e com a monetização.
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
