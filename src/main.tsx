import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { atom, createStore, Provider } from 'jotai';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

const store = createStore();
export const pdfAtom = atom<{ name: string; pages: number; size: number }[]>([]);

listen('folder-processed', (event) => {
  const pdfMessage = event.payload as Array<{ name: string; pages: number; size: number }>;
  store.set(pdfAtom, pdfMessage);
})
  .then((cb) => {
    console.log('invoking');
    invoke('frontend_ready');

    return cb;
  })
  .catch((error) => {
    console.error('Error listening to folder-processed event:', error);
  });

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
