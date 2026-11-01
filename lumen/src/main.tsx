import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useCatalogStore } from './stores/catalog'

// Expose store for test automation & verification
(window as unknown as { __CATALOG_STORE__: unknown }).__CATALOG_STORE__ = useCatalogStore;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
