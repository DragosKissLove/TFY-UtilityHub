import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Installer } from './pages/Installer';
import './index.css';

// Premium global styles for standalone installer UI (without main app tailwind overhead)
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; height: 100%; overflow: hidden; background: transparent; }
  body { color: #fff; font-family: 'Segoe UI Variable','Segoe UI','Inter',sans-serif; -webkit-font-smoothing: antialiased; }
  
  /* Modern clean scrollbar */
  .s::-webkit-scrollbar { width: 4px; }
  .s::-webkit-scrollbar-track { background: transparent; }
  .s::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 99px; }
  .s::-webkit-scrollbar-thumb:hover { background: rgba(124, 94, 255, 0.2); }
  
  /* Background moving glows keyframes */
  @keyframes glowMove1 {
    0% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(60px, 40px) scale(1.15); }
    100% { transform: translate(0, 0) scale(1); }
  }
  @keyframes glowMove2 {
    0% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-50px, -30px) scale(0.9); }
    100% { transform: translate(0, 0) scale(1); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Installer />
  </StrictMode>
);
