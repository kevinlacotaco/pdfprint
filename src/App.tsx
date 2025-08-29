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
import { useAtom, useAtomValue } from 'jotai';
import { atomWithReset, useResetAtom } from 'jotai/utils';
import { HTMLProps, useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import IconArrowDown from './assets/icons/icon-cheveron-down-circle.svg?react';
import IconArrowRight from './assets/icons/icon-cheveron-right-circle.svg?react';
import { Button } from './components/button/Button';
import { EditableTextCell } from './components/table/EditableTextCell';
import { HeaderCell } from './components/table/HeaderCell';
import { NumberCell } from './components/table/NumberCell';
import { TextCell } from './components/table/TextCell';
import { EntriesWithChildren, groupedPdfs, pdfAtom } from './store';
import { parsePrintRange } from './utils/parsePrintRange';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

const columnHelper = createColumnHelper<EntriesWithChildren>();

function IndeterminateCheckbox({
  indeterminate,
  className = '',
  ...rest
}: { indeterminate?: boolean } & HTMLProps<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null!);

  useEffect(() => {
    if (typeof indeterminate === 'boolean') {
      ref.current.indeterminate = !rest.checked && indeterminate;
    }
  }, [ref, indeterminate]);

  return <input type="checkbox" ref={ref} className={classNames('w-4 h-4 cursor-pointer', className)} {...rest} />;
}

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
            <button onClick={row.getToggleExpandedHandler()} style={{ cursor: 'pointer' }}>
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
                      className={
                        header.column.getCanSort()
                          ? 'cursor-pointer select-none w-full items-center justify-center flex'
                          : 'w-full items-center justify-center flex'
                      }
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
        <h1 className="text-3xl font-bold underline text-center">Pet Print PDF</h1>
      </header>
      <div className="flex-auto overflow-auto scroll-auto">
        {!isInitial && !emptyState && <DataTable tableData={grouped!} onChange={setData} />}
        {emptyState && (
          <div className="flex items-center justify-center h-full w-full">
            <div className="text-2xl text-center">No PDFs within the folder</div>
          </div>
        )}
        {isInitial && (
          <div className="flex flex-col space-y-3 items-center justify-center h-full w-full">
            <div className="text-2xl text-center">Select a folder to view PDFs</div>
            <Button onClick={selectFolder}>Select Folder</Button>
          </div>
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
