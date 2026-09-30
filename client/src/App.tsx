import { useEffect, useState } from 'react';

export default function App() {
  const [serverStatus, setServerStatus] = useState<string>('checking...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setServerStatus(data.status))
      .catch(() => setServerStatus('offline'));
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '480px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>My little son</h1>
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        <p style={{ fontSize: '15px', color: '#4A5A4C' }}>
          Server status: <strong style={{ color: serverStatus === 'ok' ? '#23372A' : '#D08A1E' }}>{serverStatus}</strong>
        </p>
      </div>
    </div>
  );
}
