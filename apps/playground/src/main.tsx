import { createRoot } from 'react-dom/client';
import '@prism-ui/components/styles.css';
import './app.css';
import { App } from './App';

import.meta.glob(['../../../packages/components/src/*/*.css', '!../../../packages/components/src/styles/*.css'], { eager: true });
createRoot(document.getElementById('root')!).render(<App />);
