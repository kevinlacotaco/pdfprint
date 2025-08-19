import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { atom, createStore } from 'jotai';

type PdfDetails = { name: string; pages: number; size: number };

export const pdfAtom = atom<PdfDetails[] | null>(null);

const setupEvents = async (store: ReturnType<typeof createStore>) => {
  try {
    await listen<PdfDetails[]>('folder-processed', (event) => {
      const pdfMessage = event.payload;
      store.set(pdfAtom, pdfMessage);
    });

    // After all events have been added, let the backend know we are fully ready
    invoke('frontend_ready');
  } catch (error) {
    console.error('Error setting up events', error);
  }
};

export const setupStore = () => {
  const store = createStore();

  void setupEvents(store);

  return store;
};
