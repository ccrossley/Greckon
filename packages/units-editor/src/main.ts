import './bootstrap-services.js';
import { mountApp } from './app.js';
import './style.css';

const root = document.querySelector('#app');
if (!root) {
  throw new Error('Missing #app root element');
}

void mountApp(root);
