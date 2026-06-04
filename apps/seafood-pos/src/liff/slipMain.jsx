import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import LineSlipLiffApp from './LineSlipLiffApp';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LineSlipLiffApp />
  </React.StrictMode>,
);
