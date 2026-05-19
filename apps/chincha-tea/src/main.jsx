import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>🧋 Chincha Tea</h1>
      <p>Coming soon...</p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
