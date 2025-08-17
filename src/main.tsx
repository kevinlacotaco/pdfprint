import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { atom, createStore, Provider } from 'jotai';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

type PdfDetails = { name: string; pages: number; size: number };

const store = createStore();
export const pdfAtom = atom<PdfDetails[]>([]);

listen<PdfDetails[]>('folder-processed', (event) => {
  const pdfMessage = event.payload;
  store.set(pdfAtom, pdfMessage);
})
  .then((cb) => {
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
