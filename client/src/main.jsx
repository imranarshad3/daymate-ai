import React from 'react';
import ReactDOM from 'react-dom/client';
import { IconContext } from '@phosphor-icons/react';
import App from './App.jsx';
import { registerSW } from './utils/push.js';
import './styles.css';

registerSW();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IconContext.Provider value={{ weight: 'duotone', size: 18, mirrored: false }}>
      <App />
    </IconContext.Provider>
  </React.StrictMode>
);
