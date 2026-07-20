import { setBaseUrl } from '@workspace/api-client-react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

setBaseUrl(import.meta.env.VITE_API_BASE || '');
createRoot(document.getElementById('root')!).render(<App />);
