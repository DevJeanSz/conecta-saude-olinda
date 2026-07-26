import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CircleGauge, X } from 'lucide-react';

const screens = [
  { label: 'Inicial', path: '/' },
  { label: 'Login', path: '/login' },
  { label: 'Cadastro', path: '/register' },
  { label: 'Cidadão', path: '/patient-portal' },
  { label: 'Gestor', path: '/admin' },
  { label: 'Recepção', path: '/admin/reception' },
  { label: 'Painel TV', path: '/display-tv' },
];

export const PrototypeNavigator: React.FC = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className={`prototype-nav${open ? ' is-open' : ''}`}>
      {open && (
        <div className="prototype-nav-panel">
          <div>
            <strong>Mapa de telas</strong>
            <button
              aria-label="Fechar mapa de telas"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X size={17} />
            </button>
          </div>
          <p>Navegue pelo protótipo completo.</p>
          <nav aria-label="Telas do protótipo">
            {screens.map((screen) => (
              <button
                className={location.pathname === screen.path ? 'active' : ''}
                key={screen.path}
                onClick={() => {
                  navigate(screen.path);
                  setOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                type="button"
              >
                <span>{screen.label}</span>
                <ArrowRight size={15} />
              </button>
            ))}
          </nav>
        </div>
      )}
      <button
        className="prototype-nav-trigger"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <CircleGauge size={18} />
        Ver todas as telas
      </button>
    </aside>
  );
};
