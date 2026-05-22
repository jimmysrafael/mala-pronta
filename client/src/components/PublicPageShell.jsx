import Header from './Header';
import BackgroundVideo from './BackgroundVideo';

export default function PublicPageShell({ title, onBack, children }) {
  return (
    <>
      <Header title={title} showBack={Boolean(onBack)} onBack={onBack} />
      <main className="relative isolate min-h-screen overflow-hidden pt-16 pb-6">
        <BackgroundVideo />
        <div className="relative z-10 mx-auto max-w-[672px] px-5">{children}</div>
      </main>
    </>
  );
}
