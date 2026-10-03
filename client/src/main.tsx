import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Wrap mount in try/catch so a boot-time error is captured with its real stack
// (same-origin catch is not subject to the cross-origin "Script error" masking
// that empties window.onerror) and shipped to the server for diagnosis.
try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (err: any) {
  const stack = (err && (err.stack || err.message)) || String(err);
  try {
    (window as any).__postErr?.({ phase: 'render', message: err && err.message, stack });
  } catch { /* ignore */ }
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML =
      '<pre style="white-space:pre-wrap;word-break:break-word;padding:16px;font:12px monospace;color:#b3261e;">BOOT ERROR\n' +
      stack.replace(/[<>&]/g, '') +
      '</pre>';
  }
}
