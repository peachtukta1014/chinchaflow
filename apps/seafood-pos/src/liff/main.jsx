import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import LineOrderLiffApp from './LineOrderLiffApp';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LineOrderLiffApp />
  </React.StrictMode>,
);
