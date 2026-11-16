import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './ui/App';
import { connect } from './net';

createRoot(document.getElementById('root')!).render(<App />);
connect();
