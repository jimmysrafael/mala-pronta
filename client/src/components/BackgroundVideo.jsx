import { useEffect, useState } from 'react';

const VIDEO_POSTER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8f9f9" />
      <stop offset="100%" stop-color="#f3f6f5" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="72%">
      <stop offset="0%" stop-color="#b1f0ce" stop-opacity="0.42" />
      <stop offset="100%" stop-color="#b1f0ce" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="1200" height="1600" fill="url(#bg)" />
  <rect width="1200" height="1600" fill="url(#glow)" />
</svg>
`)}`;

export default function BackgroundVideo({ variant = 'page', className = '' }) {
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

  const isBanner = variant === 'banner';

  return (
    <div className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(177,240,206,0.45),transparent_36%),linear-gradient(180deg,#f8f9f9_0%,#f3f6f5_100%)]" />
      {showVideoBackground && (
        <video
          className={`absolute inset-0 h-full w-full object-cover scale-[1.03] ${
            isBanner ? 'opacity-70' : 'opacity-45'
          }`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={VIDEO_POSTER}
          aria-hidden="true"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        >
          <source src="/background-mala-pronta.mp4" type="video/mp4" />
        </video>
      )}
      <div
        className={`absolute inset-0 ${
          isBanner
            ? 'bg-gradient-to-b from-white/25 via-white/10 to-[#f8f9f9]'
            : 'bg-gradient-to-b from-[#f8f9f9]/55 via-[#f8f9f9]/78 to-[#f8f9f9]/96'
        }`}
      />
    </div>
  );
}
