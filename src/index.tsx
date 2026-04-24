import { Buffer } from 'buffer';
window.Buffer = Buffer;
(window as any).global = window;
window.process = { 
  env: {},
  version: '',
  nextTick: (cb: any) => setTimeout(cb, 0)
} as any;

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
