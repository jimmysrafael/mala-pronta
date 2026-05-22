import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicPageShell from '../components/PublicPageShell';
import { useToast } from '../components/Toast';

export default function ContactPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Suporte sobre o MalaPronta');
  const [message, setMessage] = useState('');

  const contactEmail = 'contato@malapronta.com';

  const handleSubmit = (e) => {
    e.preventDefault();

    const body = encodeURIComponent(
      `Nome: ${name}\nEmail: ${email}\n\n${message}`
    );
    const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${body}`;
    window.location.href = mailto;
    toast('Seu aplicativo de email foi aberto.');
  };

  return (
    <PublicPageShell title="Contato" onBack={() => navigate(-1)}>
      <section className="mt-6 animate-fade-in-up">
        <p className="mb-3 inline-flex rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Fale com a gente
        </p>
        <h1 className="mb-4 font-display text-3xl font-extrabold text-on-surface">
          Quer tirar dúvidas, sugerir melhorias ou relatar um problema?
        </h1>
        <p className="font-body text-sm leading-relaxed text-on-surface-variant">
          Você pode falar com a equipe pelo email abaixo ou enviar uma mensagem pelo formulário.
          Respondemos com prioridade para dúvidas sobre funcionamento, pagamento e conteúdo.
        </p>
      </section>

      <section className="mt-8 grid gap-4">
        <div className="rounded-[24px] bg-surface-container-lowest p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <h2 className="mb-2 font-display text-lg font-bold text-on-surface">Contato direto</h2>
          <a
            href={`mailto:${contactEmail}`}
            className="font-body text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {contactEmail}
          </a>
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            Atendimento em dias úteis, com retorno por email.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[24px] bg-surface-container-lowest p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <div className="grid gap-4">
            <div>
              <label className="mb-2 block font-body text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Nome
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-2xl bg-surface-container-high px-4 py-3 font-body text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Seu nome"
              />
            </div>
            <div>
              <label className="mb-2 block font-body text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-2xl bg-surface-container-high px-4 py-3 font-body text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="voce@exemplo.com"
              />
            </div>
            <div>
              <label className="mb-2 block font-body text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Assunto
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-2xl bg-surface-container-high px-4 py-3 font-body text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-2 block font-body text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Mensagem
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                className="w-full rounded-2xl bg-surface-container-high px-4 py-3 font-body text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Escreva sua mensagem aqui"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-5 w-full rounded-[20px] bg-primary px-5 py-4 font-display text-sm font-bold text-on-primary transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            Abrir email para contato
          </button>
        </form>
      </section>
    </PublicPageShell>
  );
}
