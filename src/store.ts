import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { atom, createStore } from 'jotai';

interface PdfDetails {
  parent?: number | null;
  printRange?: string; // Gets updated from the table meta
  name: string;
  pages: number;
  path: string;
  size: number;
  type: 'pdf';
  id: number;
}
interface Dir {
  parent?: number | null;
  name: string;
  type: 'dir';
  id: number;
  path: string;
}

type Entries = PdfDetails | Dir;

export type EntriesWithChildren = DirWithChildren | PdfDetails;
export type DirWithChildren = Dir & { children: EntriesWithChildren[] };

export const pdfAtom = atom<Entries[] | null>(null);
export const groupedPdfsAtom = atom((get) => {
  const pdfs = get(pdfAtom);

  if (pdfs == null) {
    return null;
  }

  const map = new Map(
    pdfs.map((entry): [number, EntriesWithChildren] => {
      if (entry.type === 'pdf') {
        return [entry.id, { ...entry }];
      }
      return [entry.id, { ...entry, children: [] }];
    })
  );

  for (const [, entry] of map) {
    const parentKey = entry.parent;
    if (parentKey != null) {
      const parent = map.get(parentKey);

      if (parent != null && 'children' in parent) {
        parent.children.push(entry);
      } else {
        // If we do not find a node from the map for the parent, null out the field to force root
        entry.parent = null;
      }
    }
  }

  for (const [name, entry] of map) {
    if (entry.parent != null) {
      map.delete(name);
    }
  }

  return [...map.values()];
});
export const pdfsByIdAtom = atom((get) => {
  const pdfs = get(pdfAtom);

  return pdfs?.reduce(
    (acc, pdf) => {
      acc[pdf.id] = pdf;

      return acc;
    },
    {} as Record<string, Entries>
  );
});

const setupEvents = async (store: ReturnType<typeof createStore>) => {
  try {
    await listen<{ folder: string; entries: Entries[] }>('folder-processed', (event) => {
      const pdfMessage = event.payload.entries;

      store.set(pdfAtom, (prev) => {
        return [...(prev ?? []), ...pdfMessage];
      });
    });

    // After all events have been added, let the backend know we are fully ready
    void invoke('frontend_ready');
  } catch (error) {
    console.error('Error setting up events', error);
  }
};

export const setupStore = () => {
  const store = createStore();

  void setupEvents(store);

  return store;
};
