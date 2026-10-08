import React from 'react';
import { ServerStatus } from '../hooks/useServerStatus';

interface ServerWakeUpProps {
  status: ServerStatus;
  elapsedSeconds: number;
  onRetry: () => void;
}

const tips = [
  'El servidor gratuito se duerme tras 15 min de inactividad.',
  'Una vez despierto, responde a toda velocidad.',
  'Los primeros segundos son los más lentos — luego va fluido.',
  'Preparando el motor de inteligencia artificial...',
  'Iniciando conexión con la base de datos...',
];

export function ServerWakeUp({ status, elapsedSeconds, onRetry }: ServerWakeUpProps) {
  const tipIndex = Math.min(Math.floor(elapsedSeconds / 12), tips.length - 1);
  const progressPercent = Math.min((elapsedSeconds / 60) * 100, 95);

  if (status === 'error') {
    return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          {/* Icono de error */}
          <div style={{ ...styles.iconWrapper, background: 'rgba(239,68,68,0.15)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 style={styles.title}>No se pudo conectar</h2>
          <p style={styles.subtitle}>
            El servidor tardó demasiado en responder. Puede estar en mantenimiento.
          </p>
          <button style={styles.retryBtn} onClick={onRetry}>
            Intentar de nuevo
          </button>
        </div>
        <style>{animations}</style>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Orbes de fondo animados */}
        <div style={styles.orb1} />
        <div style={styles.orb2} />

        {/* Ícono central con anillos pulsantes */}
        <div style={styles.iconWrapper}>
          <div style={styles.ring1} />
          <div style={styles.ring2} />
          <div style={styles.ring3} />
          <div style={styles.iconInner}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
        </div>

        {/* Título */}
        <h2 style={styles.title}>Despertando el servidor</h2>
        <p style={styles.subtitle}>
          El servidor estaba en reposo. Esto tarda{' '}
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>30–60 segundos</span> la primera vez.
        </p>

        {/* Barra de progreso */}
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressBar,
              width: `${progressPercent}%`,
              transition: 'width 1s ease-out',
            }}
          />
          <div style={{ ...styles.progressGlow, left: `${progressPercent}%` }} />
        </div>

        {/* Cronómetro */}
        <div style={styles.timerRow}>
          <span style={styles.timerDot} />
          <span style={styles.timerText}>
            {elapsedSeconds}s — {elapsedSeconds < 10 ? 'iniciando...' : 'casi listo...'}
          </span>
        </div>

        {/* Puntos de carga */}
        <div style={styles.dotsRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                ...styles.dot,
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </div>

        {/* Tip rotativo */}
        <p style={styles.tip} key={tipIndex}>
          💡 {tips[tipIndex]}
        </p>
      </div>

      <style>{animations}</style>
    </div>
  );
}

// ─── Estilos en objeto (no depende de Tailwind, funciona siempre) ────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0c29 0%, #1a1042 50%, #0f0c29 100%)',
    zIndex: 9999,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px 40px',
    maxWidth: '420px',
    width: '90%',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(167,139,250,0.2)',
    borderRadius: '24px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(139,92,246,0.08)',
    overflow: 'hidden',
    gap: '16px',
  },
  orb1: {
    position: 'absolute',
    top: '-60px',
    right: '-60px',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  orb2: {
    position: 'absolute',
    bottom: '-80px',
    left: '-60px',
    width: '240px',
    height: '240px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  iconWrapper: {
    position: 'relative',
    width: '90px',
    height: '90px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring1: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '2px solid rgba(167,139,250,0.4)',
    animation: 'pulse-ring 2s ease-out infinite',
  },
  ring2: {
    position: 'absolute',
    inset: '-12px',
    borderRadius: '50%',
    border: '1.5px solid rgba(167,139,250,0.2)',
    animation: 'pulse-ring 2s ease-out infinite 0.4s',
  },
  ring3: {
    position: 'absolute',
    inset: '-26px',
    borderRadius: '50%',
    border: '1px solid rgba(167,139,250,0.1)',
    animation: 'pulse-ring 2s ease-out infinite 0.8s',
  },
  iconInner: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(59,130,246,0.3))',
    border: '1px solid rgba(167,139,250,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'float 3s ease-in-out infinite',
  },
  title: {
    margin: '8px 0 0',
    fontSize: '22px',
    fontWeight: 700,
    color: '#f1f0ff',
    textAlign: 'center',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: '0',
    fontSize: '14px',
    color: 'rgba(200,195,255,0.7)',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  progressTrack: {
    position: 'relative',
    width: '100%',
    height: '6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '99px',
    overflow: 'visible',
    marginTop: '4px',
  },
  progressBar: {
    height: '100%',
    borderRadius: '99px',
    background: 'linear-gradient(90deg, #7c3aed, #a78bfa, #60a5fa)',
    boxShadow: '0 0 12px rgba(167,139,250,0.6)',
  },
  progressGlow: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#c4b5fd',
    boxShadow: '0 0 16px 4px rgba(196,181,253,0.8)',
    transition: 'left 1s ease-out',
  },
  timerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  timerDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#4ade80',
    boxShadow: '0 0 8px #4ade80',
    animation: 'blink 1.2s ease-in-out infinite',
  },
  timerText: {
    fontSize: '13px',
    color: 'rgba(200,195,255,0.6)',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'monospace',
  },
  dotsRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c3aed, #60a5fa)',
    animation: 'bounce-dot 1.2s ease-in-out infinite',
  },
  tip: {
    margin: '4px 0 0',
    fontSize: '12px',
    color: 'rgba(167,139,250,0.6)',
    textAlign: 'center',
    lineHeight: 1.5,
    animation: 'fade-in 0.6s ease',
    minHeight: '36px',
    padding: '0 8px',
  },
  retryBtn: {
    marginTop: '8px',
    padding: '12px 32px',
    borderRadius: '12px',
    border: '1px solid rgba(167,139,250,0.4)',
    background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(96,165,250,0.2))',
    color: '#c4b5fd',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

// ─── Keyframes CSS ───────────────────────────────────────────────────────────

const animations = `
  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: 0.8; }
    70%  { transform: scale(1.4); opacity: 0;   }
    100% { transform: scale(1.4); opacity: 0;   }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px);   }
    50%       { transform: translateY(-6px);  }
  }

  @keyframes blink {
    0%, 100% { opacity: 1;   }
    50%       { opacity: 0.3; }
  }

  @keyframes bounce-dot {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40%            { transform: scale(1.2); opacity: 1;   }
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
`;
