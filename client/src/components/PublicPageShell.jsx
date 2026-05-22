import { useEffect, useState } from 'react';
import Header from './Header';

export default function PublicPageShell({ title, onBack, children }) {
  const [showVideoBackground, setShowVideoBackground] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const updatePreference = () => {
      const shouldReduceMotion = reduceMotionQuery.matches || connection?.saveData;
      setShowVideoBackground(!shouldReduceMotion);
    };

    updatePreference();

    reduceMotionQuery.addEventListener?.('change', updatePreference);
    connection?.addEventListener?.('change', updatePreference);

    return () => {
      reduceMotionQuery.removeEventListener?.('change', updatePreference);
      connection?.removeEventListener?.('change', updatePreference);
    };
  }, []);

  return (
    <>
      <Header title={title} showBack={Boolean(onBack)} onBack={onBack} />
      <main className="relative isolate min-h-screen overflow-hidden pt-16 pb-6">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(177,240,206,0.45),transparent_36%),linear-gradient(180deg,#f8f9f9_0%,#f3f6f5_100%)]" />
        {showVideoBackground && (
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <video
              className="h-full w-full object-cover scale-[1.03] opacity-45"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              onError={() => setShowVideoBackground(false)}
            >
              <source src="/background-mala-pronta.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-b from-[#f8f9f9]/55 via-[#f8f9f9]/78 to-[#f8f9f9]/96" />
          </div>
        )}
        <div className="relative z-10 mx-auto max-w-[672px] px-5">{children}</div>
      </main>
    </>
  );
}
