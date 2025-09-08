import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// import './index.less';
// import store from './models';
// import { Provider } from 'react-redux';


const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);




