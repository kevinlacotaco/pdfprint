import {
  createColumnHelper,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  RowData,
  RowSelectionState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import classNames from 'classnames';
import IconArrowDown from 'icons/icon-cheveron-down-circle.svg?react';
import IconArrowRight from 'icons/icon-cheveron-right-circle.svg?react';
import { useAtom, useAtomValue } from 'jotai';
import { atomWithReset, useResetAtom } from 'jotai/utils';
import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { Button } from './components/button/Button';
import { IndeterminateCheckbox } from './components/checkbox/IndeterminateCheckbox';
import { EditableTextCell } from './components/table/EditableTextCell';
import { HeaderCell } from './components/table/HeaderCell';
import { NumberCell } from './components/table/NumberCell';
import { TextCell } from './components/table/TextCell';
import { EntriesWithChildren, groupedPdfs, pdfAtom } from './store';
import { parsePrintRange } from './utils/parsePrintRange';
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
    header: (props) => {
      return <HeaderCell title="File Name" sorted={props.column.getIsSorted()} />;
    },
    cell: ({ row, getValue }) => {
      return (
        <div
          className="flex items-center px-2 space-x-2"
          style={{
            paddingLeft: row.depth != 0 ? `${row.depth * 2}rem` : undefined,
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
    header: (props) => {
      return <HeaderCell title="Page Count" sorted={props.column.getIsSorted()} />;
    },
    cell: (props) => {
      const row = props.row.original;
      if (row.type === 'pdf') {
        return <NumberCell value={row.pages} />;
      }
    },
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('size', {
    size: 100,
    maxSize: 100,
    header: (props) => {
      return <HeaderCell title="Size" sorted={props.column.getIsSorted()} />;
    },
    cell: (props) => {
      const row = props.row.original;
      if (row.type === 'pdf') {
        return <NumberCell type="unit" unit="byte" value={row.size} />;
      }
    },
    sortingFn: 'alphanumeric',
  }),
  columnHelper.display({
    size: 200,
    maxSize: 200,
    id: 'printRange',
    header: () => {
      return <HeaderCell title="Custom Pages" />;
    },
    cell: (props) => {
      const row = props.row.original;
      if (row.type === 'pdf') {
        return <EditableTextCell {...props} />;
      }
    },
  }),
];

type PdfDetails = {
  name: string;
  pages: number;
  size: number;
  type: 'pdf';
  id: number;
  path: string;
  printRange?: string;
};

type SerializedPdfDetails = {
  name: string;
  pages: number;
  size: number;
  printRange?: number[];
};

const rowSelectionAtom = atomWithReset<RowSelectionState>({});

const DataTable = ({
  tableData,
  onChange,
}: {
  tableData: EntriesWithChildren[];
  onChange?: (data: PdfDetails[] | undefined) => void;
}) => {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

  const [data, setData] = useState(tableData);
  const [rowSelection, setRowSelection] = useAtom(rowSelectionAtom);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  useEffect(() => {
    setData(tableData);
  }, [tableData]);

  const table = useReactTable<EntriesWithChildren>({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => {
      if (row.type === 'dir' && row.children.length > 0) {
        return row.children;
      }
      return undefined;
    },
    getRowId: (row) => row.id.toString(),
    state: {
      sorting,
      rowSelection,
      expanded: expanded,
    },
    enableRowSelection: (row) => {
      return row.original.type !== 'dir';
    },
    onSortingChange: setSorting,
    onExpandedChange: (updater) => {
      if (typeof updater === 'function') {
        setExpanded((old) => {
          const newVal = updater(old);
          if (typeof old === 'boolean' || typeof newVal === 'boolean') {
            return newVal;
          }

          const expandedKey = Object.keys(newVal).filter((k) => !(k in old))[0];
          if (expandedKey != null) {
            const row = table.getExpandedRowModel().flatRows.find((d) => d.original.id.toString() === expandedKey);
            const entry = row?.original;

            if (entry != null && entry.type === 'dir' && entry.children.length === 0) {
              invoke('load_dir', { folder: entry.path });
            }
          }

          return newVal;
        });
      } else {
        setExpanded(updater);
      }
    },
    getRowCanExpand: (row) => row.original.type === 'dir',

    onRowSelectionChange: setRowSelection,
    meta: {
      updateData: (rowIndex, columnId, value) => {
        setData((old) => {
          return old.map((row, index) => {
            if (index === rowIndex) {
              return {
                ...old[rowIndex]!,
                [columnId]: value,
              };
            }
            return row;
          });
        });
      },
    },
  });

  useEffect(() => {
    if (onChange != null) {
      const dataToSend = table
        .getSelectedRowModel()
        .flatRows.map((row) => row.original)
        .filter((value): value is PdfDetails => {
          return value.type === 'pdf';
        });

      onChange(dataToSend);
    }
  }, [onChange, table, rowSelection]);

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
                      title={
                        header.column.getCanSort()
                          ? header.column.getNextSortingOrder() === 'asc'
                            ? 'Sort ascending'
                            : header.column.getNextSortingOrder() === 'desc'
                              ? 'Sort descending'
                              : 'Clear sort'
                          : undefined
                      }
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
  const isInitial = pdfs == null;
  const emptyState = pdfs != null && pdfs.length === 0;
  const [data, setData] = useState<PdfDetails[]>();
  const resetRowSelection = useResetAtom(rowSelectionAtom);
  const isDisabled = data == null || data.length === 0;
  const grouped = useAtomValue(groupedPdfs);

  const print = useCallback(() => {
    if (data != null) {
      invoke('print_to_default', {
        pdfs: data.map(({ printRange, ...detail }) => {
          const serializedDetail: SerializedPdfDetails = detail;
          if (printRange != null) {
            serializedDetail.printRange = parsePrintRange(printRange);
          }
          return detail;
        }),
      });

      resetRowSelection();
    }
  }, [data]);

  const saveToFolder = useCallback(async () => {
    const file = await save({
      filters: [
        {
          name: 'PDFs',
          extensions: ['pdf'],
        },
      ],
    });

    if (file != null) {
      invoke('save_to_file', {
        file: file,
        pdfs: data?.map(({ printRange, ...detail }) => {
          const serializedDetail: SerializedPdfDetails = detail;
          if (printRange != null) {
            serializedDetail.printRange = parsePrintRange(printRange);
          }
          return detail;
        }),
      });
      resetRowSelection();
    }
  }, [data]);

  const selectFolder = useCallback(async () => {
    const file = await open({
      multiple: false,
      directory: true,
    });

    if (file != null) {
      invoke('select_workspace', { file });
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
        {!isInitial && !emptyState && <DataTable tableData={grouped!} onChange={setData} />}
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
