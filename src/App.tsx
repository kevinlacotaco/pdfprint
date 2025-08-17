import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  RowData,
  RowSelectionState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { invoke } from '@tauri-apps/api/core';
import { useAtom, useAtomValue } from 'jotai';
import { atomWithReset, useResetAtom } from 'jotai/utils';
import { HTMLProps, useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { Button } from './components/button/Button';
import { EditableTextCell } from './components/table/EditableTextCell';
import { HeaderCell } from './components/table/HeaderCell';
import { NumberCell } from './components/table/NumberCell';
import { TextCell } from './components/table/TextCell';
import { pdfAtom } from './main';
import { save } from '@tauri-apps/plugin-dialog';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

const columnHelper = createColumnHelper<PdfDetails>();

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

  return <input type="checkbox" ref={ref} className={className + ' cursor-pointer'} {...rest} />;
}

export const columns = [
  columnHelper.display({
    id: 'select',
    size: 50,
    maxSize: 50,
    enableSorting: false,

    header: ({ table }) => (
      <IndeterminateCheckbox
        {...{
          checked: table.getIsAllRowsSelected(),
          indeterminate: table.getIsSomeRowsSelected(),
          onChange: table.getToggleAllRowsSelectedHandler(),
        }}
      />
    ),
    cell: ({ row }) => (
      <div className="px-1 flex justify-center items-center">
        <IndeterminateCheckbox
          {...{
            checked: row.getIsSelected(),
            disabled: !row.getCanSelect(),
            indeterminate: row.getIsSomeSelected(),
            onChange: row.getToggleSelectedHandler(),
          }}
        />
      </div>
    ),
  }),

  columnHelper.accessor('name', {
    size: 300,
    header: (props) => {
      return <HeaderCell title="File Name" sorted={props.column.getIsSorted()} />;
    },
    cell: (props) => <TextCell value={props.getValue()} />,
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('pages', {
    size: 100,
    maxSize: 100,
    header: (props) => {
      return <HeaderCell title="Page Count" sorted={props.column.getIsSorted()} />;
    },
    cell: (props) => <NumberCell value={props.getValue()} />,
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('size', {
    size: 100,
    maxSize: 100,
    header: (props) => {
      return <HeaderCell title="Size" sorted={props.column.getIsSorted()} />;
    },
    cell: (props) => <NumberCell type="unit" unit="byte" value={props.getValue()} />,
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
      return <EditableTextCell {...props} />;
    },
  }),
];

type PdfDetails = {
  name: string;
  pages: number;
  size: number;
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
  tableData: PdfDetails[];
  onChange?: (data: PdfDetails[] | undefined) => void;
}) => {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

  const [data, setData] = useState(tableData);
  const [rowSelection, setRowSelection] = useAtom(rowSelectionAtom);

  useEffect(() => {
    if (onChange != null) {
      const dataToSend = data.filter((_value, idx) => {
        return rowSelection[idx] === true;
      });

      onChange(dataToSend);
    }
  }, [rowSelection, data]);

  const table = useReactTable<PdfDetails>({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
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
                      className={header.column.getCanSort() ? 'cursor-pointer select-none w-full' : 'w-full'}
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
          <tr key={row.id} className="even:bg-gray-200">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const range = (start: number, end: number): number[] => {
  return [...Array(end - start + 1).keys()].map((i) => i + start);
};

const parsePrintRange = (printRange: string): number[] => {
  const parts = printRange.split(',');

  return Array.from(
    new Set(
      parts.reduce((acc: number[], part: string) => {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);

          acc = acc.concat(range(start, end));
        } else {
          acc.push(parseInt(part, 10));
        }

        return acc;
      }, [])
    )
  ).sort((a, b) => a - b);
};

function App() {
  const pdfs = useAtomValue(pdfAtom);
  const isLoading = pdfs == null || pdfs.length === 0;
  const [data, setData] = useState<PdfDetails[]>();
  const resetRowSelection = useResetAtom(rowSelectionAtom);

  const print = useCallback(() => {
    invoke('print_to_default', {
      pdfs: data?.map(({ printRange, ...detail }) => {
        const serializedDetail: SerializedPdfDetails = detail;
        if (printRange != null) {
          serializedDetail.printRange = parsePrintRange(printRange);
        }
        return detail;
      }),
    });
    resetRowSelection();
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

  return (
    <main className="flex flex-col h-screen bg-gray-100 items-stretch">
      <header className="w-full items-center justify-center shrink-0 grow-0 basis-0">
        <h1 className="text-3xl font-bold underline text-center">Pet Print PDF</h1>
      </header>
      <div className="flex-auto overflow-auto scroll-auto">
        {!isLoading && <DataTable tableData={pdfs} onChange={setData} />}
        {isLoading && (
          <div className="flex items-center justify-center h-full w-full">
            <div className="text-2xl text-center">Loading...</div>
          </div>
        )}
      </div>
      <footer className="shrink-0 flex grow-0 basis-0 w-full space-x-1 p-2 justify-end">
        <Button disabled={data?.length === 0} onClick={saveToFolder} variant="secondary">
          Save to Combined PDF
        </Button>
        <Button disabled={data?.length === 0} onClick={print}>
          Print to Default Printer
        </Button>
      </footer>
    </main>
  );
}

export default App;
