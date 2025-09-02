import {
  Column,
  ColumnDef,
  createColumnHelper,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  OnChangeFn,
  RowData,
  RowSelectionState,
  SortingState,
  TableMeta,
  TableOptions,
  TableState,
  Updater,
  useReactTable,
} from '@tanstack/react-table';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import classNames from 'classnames';
import IconArrowDown from 'icons/icon-cheveron-down-circle.svg?react';
import IconArrowRight from 'icons/icon-cheveron-right-circle.svg?react';
import { useAtomValue } from 'jotai';
import { useCallback, useState } from 'react';
import './App.css';
import { Button } from './components/button/Button';
import { IndeterminateCheckbox } from './components/checkbox/IndeterminateCheckbox';
import { HeaderCell } from './components/table/HeaderCell';
import { NumberCell } from './components/table/NumberCell';
import { TextCell } from './components/table/TextCell';
import { EntriesWithChildren, groupedPdfsAtom, pdfAtom, pdfsByIdAtom } from './store';
import { parsePrintRange } from './utils/parse-print-range';
import { Heading } from './components/heading/Heading';
import { EmptyState } from './components/emptyState/EmptyState';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

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

const DataTable = ({
  tableData,
  onChange,
  onExpanded,
  onCollapsed,
  state,
  getRowId = (row) => row.id.toString(),
  getSubRows,
  enableRowSelection,
  getRowCanExpand,
  onUpdate,
}: {
  tableData: EntriesWithChildren[];
  columns: ColumnDef<EntriesWithChildren, never>[];
  onChange?: OnChangeFn<RowSelectionState> | undefined;
  onExpanded?: (data: string[]) => void;
  onCollapsed?: (data: string[]) => void;
  state?: Partial<TableState> | undefined;
  getRowId?: TableOptions<EntriesWithChildren>['getRowId'];
  getSubRows?: TableOptions<EntriesWithChildren>['getSubRows'];
  enableRowSelection?: TableOptions<EntriesWithChildren>['enableRowSelection'];
  getRowCanExpand?: TableOptions<EntriesWithChildren>['getRowCanExpand'];
  onUpdate?: TableMeta<EntriesWithChildren>['updateData'];
}) => {
  // Local component state, can be overridden by properties.
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable<EntriesWithChildren>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: getSubRows,
    getRowId,
    getRowCanExpand,

    state: {
      sorting,
      expanded: expanded,
      ...state,
    },
    enableRowSelection,
    onSortingChange: setSorting,
    onExpandedChange: (updater) => {
      setExpanded((old) => {
        const newValue = typeof updater === 'function' ? updater(old) : updater;

        if (typeof old === 'boolean' || typeof newValue === 'boolean') {
          return newValue;
        }

        if (onExpanded != null) {
          const expandedKeys = Object.keys(newValue).filter((k) => !(k in old));
          onExpanded(expandedKeys);
        }

        if (onCollapsed != null) {
          const collapsedKeys = Object.keys(old).filter((k) => !(k in newValue));

          onCollapsed(collapsedKeys);
        }

        return newValue;
      });
    },

    onRowSelectionChange: onChange,
    meta: {
      updateData: (id, columnId, value) => {
        if (typeof onUpdate === 'function') {
          onUpdate(id, columnId, value);
        }
      },
    },
  });

  const getTitle = (column: Column<EntriesWithChildren>) => {
    if (column.getCanSort()) {
      if (column.getNextSortingOrder() === 'asc') {
        return 'Sort ascending';
      }
      if (column.getNextSortingOrder() === 'desc') {
        return 'Sort descending';
      }

      return 'Clear sort';
    }

    return;
  };

  return (
    <table className="border-separate border-spacing-0 w-full max-w-full table-fixed">
      <thead className="sticky left-0 top-0 z-20 bg-gray-400">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return (
                <th key={header.id} className=" whitespace-nowrap" style={{ width: header.column.columnDef.size }}>
                  {header.isPlaceholder ? null : (
                    <div
                      className={classNames('w-full items-center justify-center flex', {
                        'cursor-pointer select-none': header.column.getCanSort(),
                      })}
                      onClick={header.column.getToggleSortingHandler()}
                      title={getTitle(header.column)}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            onClick={row.getToggleSelectedHandler()}
            className={classNames(
              {
                'cursor-pointer': row.getCanSelect(),
                'odd:bg-white even:bg-gray-200': !row.getIsSelected(),
                'odd:bg-blue-100 even:bg-blue-200': row.getIsSelected(),
              },
              'h-15'
            )}
          >
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
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
        pdfs: data
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
          .filter((entry) => entry != null),
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
          pdfs: data
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
            .filter((entry) => entry != null),
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

  const onExpanded = useCallback(
    (entries: string[]) => {
      if (pdfsById != null) {
        void entries
          .map((id) => pdfsById[id])
          // Currently, will try to load the directory on each expand change.
          .filter((entry) => entry != null && entry.type === 'dir')
          .map((entry) => invoke('load_dir', { folder: entry.path }));
      }
    },
    [pdfsById]
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
