import { createColumnHelper, RowSelectionState, Updater } from '@tanstack/react-table';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import IconArrowDown from 'icons/icon-cheveron-down-circle.svg?react';
import IconArrowRight from 'icons/icon-cheveron-right-circle.svg?react';
import { useAtomValue } from 'jotai';
import { useAtomCallback } from 'jotai/utils';
import { useCallback, useState } from 'react';
import './App.css';
import { Button } from './components/button/Button';
import { IndeterminateCheckbox } from './components/checkbox/IndeterminateCheckbox';
import { EmptyState } from './components/emptyState/EmptyState';
import { Heading } from './components/heading/Heading';
import { DataTable } from './components/table/DataTable';
import { HeaderCell } from './components/table/HeaderCell';
import { NumberCell } from './components/table/NumberCell';
import { TextCell } from './components/table/TextCell';
import { Entries, EntriesWithChildren, groupedPdfsAtom, loadedDirsAtom, pdfAtom, pdfsByIdAtom } from './store';
import { parsePrintRange } from './utils/parse-print-range';

const columnHelper = createColumnHelper<EntriesWithChildren>();

const alphanumericCollator = new Intl.Collator('en', { numeric: true });
const columns = [
  columnHelper.accessor('name', {
    size: 300,
    header: (properties) => {
      return <HeaderCell title="File Name" sorted={properties.column.getIsSorted()} />;
    },
    cell: ({ row, getValue }) => {
      return (
        <div
          className="flex items-center px-2 space-x-2"
          style={{
            paddingLeft: row.depth == 0 ? undefined : `${(row.depth * 2).toFixed(0)}rem`,
          }}
        >
          {row.original.type === 'pdf' && (
            <IndeterminateCheckbox
              {...{
                checked: row.getIsSelected(),
                disabled: !row.getCanSelect(),
                indeterminate: row.getIsSomeSelected(),
                onChange: row.getToggleSelectedHandler(),
              }}
            />
          )}
          {row.getCanExpand() && (
            <button onClick={row.getToggleExpandedHandler()} className="cursor-pointer">
              {row.getIsExpanded() ? (
                <IconArrowDown className="inline w-4 h-4 text-gray-800 " />
              ) : (
                <IconArrowRight className="inline w-4 h-4 text-gray-800" />
              )}
            </button>
          )}
          <TextCell value={getValue()} />
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const origA = rowA.original;
      const origB = rowB.original;
      if (origA.type === 'dir' && origB.type === 'pdf') {
        return -1;
      }
      if (origB.type === 'dir' && origA.type === 'pdf') {
        return 1;
      }

      return alphanumericCollator.compare(origA.name, origB.name);
    },
  }),
  columnHelper.accessor('pages', {
    size: 100,
    maxSize: 100,
    header: (properties) => {
      return <HeaderCell title="Page Count" sorted={properties.column.getIsSorted()} />;
    },
    cell: (properties) => {
      const row = properties.row.original;
      if (row.type === 'pdf') {
        return <NumberCell value={row.pages} />;
      }
    },
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('size', {
    size: 100,
    maxSize: 100,
    header: (properties) => {
      return <HeaderCell title="Size" sorted={properties.column.getIsSorted()} />;
    },
    cell: (properties) => {
      const row = properties.row.original;
      if (row.type === 'pdf') {
        return <NumberCell type="unit" unit="byte" value={row.size} />;
      }
    },
    sortingFn: 'alphanumeric',
  }),
];

interface SerializedPdfDetails {
  name: string;
  pages: number;
  size: number;
  printRange?: number[];
}

const serializePdfs = (pdfs: string[], pdfsById: Record<string, Entries> | undefined): SerializedPdfDetails[] => {
  return pdfs
    .map((id) => {
      const pdf = pdfsById?.[id];
      if (pdf != null && pdf.type === 'pdf') {
        const { printRange, ...serializedDetail } = pdf;
        if (printRange != null) {
          (serializedDetail as SerializedPdfDetails).printRange = parsePrintRange(printRange);
        }
        return serializedDetail;
      }
    })
    .filter((entry) => entry != null);
};

function App() {
  const pdfs = useAtomValue(pdfAtom);
  const grouped = useAtomValue(groupedPdfsAtom);
  const pdfsById = useAtomValue(pdfsByIdAtom);
  const isInitial = pdfs == null || grouped == null;
  const emptyState = pdfs != null && pdfs.length === 0 && grouped != null;
  const [data, setData] = useState<string[]>();
  const isDisabled = data == null || data.length === 0;

  const print = useCallback(() => {
    if (data != null) {
      void invoke('print_to_default', {
        pdfs: serializePdfs(data, pdfsById),
      });

      setData([]);
    }
  }, [data, pdfsById]);

  const saveToFolder = useCallback(() => {
    const callback = async () => {
      const file = await save({
        filters: [
          {
            name: 'PDFs',
            extensions: ['pdf'],
          },
        ],
      });

      if (file != null && data != null) {
        void invoke('save_to_file', {
          file: file,
          pdfs: serializePdfs(data, pdfsById),
        });
        setData([]);
      }
    };

    void callback();
  }, [data, pdfsById]);

  const selectFolder = useCallback(() => {
    const callback = async () => {
      const file = await open({
        multiple: false,
        directory: true,
      });

      if (file != null) {
        void invoke('select_workspace', { file });
      }
    };
    void callback();
  }, []);

  const onExpanded = useAtomCallback(
    useCallback(
      (get, set, entries: string[]) => {
        const loadedPdfs = get(loadedDirsAtom);

        if (pdfsById != null) {
          void entries
            .map((id) => pdfsById[id])
            .filter((entry): entry is Entries => {
              const loaded = (entry != null && loadedPdfs[entry.id.toString()]) ?? false;
              return entry != null && entry.type === 'dir' && !loaded;
            })
            .map((entry) => {
              return invoke('load_dir', { folder: entry.path }).then(() => {
                set(loadedDirsAtom, {
                  ...loadedPdfs,
                  [entry.id.toString()]: true,
                });
              });
            });
        }
      },
      [pdfsById]
    )
  );

  const onChange = useCallback((entries: Updater<RowSelectionState>) => {
    if (typeof entries === 'function') {
      setData((old) => {
        const newVal = entries(
          old?.reduce((acc, id) => {
            acc[id] = true;

            return acc;
          }, {} as RowSelectionState) ?? {}
        );

        return Object.keys(newVal);
      });
    } else {
      setData(Object.keys(entries));
    }
  }, []);

  return (
    <main className="flex flex-col h-screen bg-gray-100 items-stretch">
      <header className="w-full items-center justify-center shrink-0 grow-0 basis-0">
        <Heading level="1" weight="bold" align="center">
          Pet Print PDF
        </Heading>
      </header>
      <div className="flex-auto overflow-auto scroll-auto">
        {!isInitial && !emptyState && (
          <DataTable
            tableData={grouped}
            columns={columns}
            state={{
              rowSelection:
                data?.reduce((acc, id) => {
                  acc[id] = true;

                  return acc;
                }, {} as RowSelectionState) ?? {},
            }}
            enableRowSelection={(row) => {
              return row.original.type !== 'dir';
            }}
            getRowCanExpand={(row) => row.original.type === 'dir'}
            getSubRows={(row) => {
              if (row.type === 'dir' && row.children.length > 0) {
                return row.children;
              }
              return;
            }}
            onChange={onChange}
            onExpanded={onExpanded}
          />
        )}
        {emptyState && (
          <EmptyState>
            <Heading level="2" align="center">
              No PDFs within the folder
            </Heading>
          </EmptyState>
        )}
        {isInitial && (
          <EmptyState>
            <Heading level="2" align="center">
              Select a folder to view PDFs
            </Heading>

            <Button onClick={selectFolder}>Select Folder</Button>
          </EmptyState>
        )}
      </div>
      <footer className="shrink-0 flex grow-0 basis-0 w-full space-x-1 p-2 justify-end">
        <Button disabled={isDisabled} onClick={saveToFolder} variant="secondary">
          Save to Combined PDF
        </Button>
        <Button disabled={isDisabled} onClick={print}>
          Print to Default Printer
        </Button>
      </footer>
    </main>
  );
}

export default App;
