import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { store } from './state/store';
import { App } from './App';

store.init();
createRoot(document.getElementById('app')!).render(<StrictMode><App /></StrictMode>);
