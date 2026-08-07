import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/router/AppRouter';
import './styles/tokens.css';
import './styles/global.css';
import './styles/app.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se encontró el nodo raíz de la aplicación.');
}

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
