import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Firebase configuration placeholders as requested by prompt requirements
// These are not actively used by the logic but are present in the global scope
(window as any).__app_id = "calc-obra-gris-ai";
(window as any).__firebase_config = {
  apiKey: "PLACEHOLDER",
  authDomain: "placeholder.firebaseapp.com",
  projectId: "placeholder",
};
(window as any).__initial_auth_token = null;

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);