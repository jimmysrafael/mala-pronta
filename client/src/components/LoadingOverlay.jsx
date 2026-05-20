import { useState, useEffect } from 'react';

const messages = [
  'Buscando voos disponíveis...',
  'Consultando hotéis na região...',
  'Descobrindo atrações locais...',
  'Analisando o clima do destino...',
  'Calculando o melhor orçamento...',
  'Montando seu roteiro personalizado...',
];

export default function LoadingOverlay() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-surface/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-16 h-16">
          <span className="material-symbols-rounded filled text-primary text-[64px] animate-bounce">
            flight_takeoff
          </span>
        </div>

        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-primary loading-dot" />
          <div className="w-3 h-3 rounded-full bg-primary loading-dot" />
          <div className="w-3 h-3 rounded-full bg-primary loading-dot" />
        </div>

        <div className="text-center">
          <p className="font-display font-bold text-lg text-on-surface mb-1">
            Criando seu roteiro personalizado...
          </p>
          <p className="font-body text-sm text-on-surface-variant transition-all duration-300">
            {messages[msgIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
