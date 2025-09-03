import {
  Column,
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  OnChangeFn,
  RowSelectionState,
  SortingState,
  TableMeta,
  TableOptions,
  TableState,
  useReactTable,
} from '@tanstack/react-table';

import classNames from 'classnames';

import { useState } from 'react';

export const DataTable = <T extends { id: string | number }>({
  tableData,
  columns,
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
  tableData: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  onChange?: OnChangeFn<RowSelectionState> | undefined;
  onExpanded?: (data: string[]) => void;
  onCollapsed?: (data: string[]) => void;
  state?: Partial<TableState> | undefined;
  getRowId?: TableOptions<T>['getRowId'];
  getSubRows?: TableOptions<T>['getSubRows'];
  enableRowSelection?: TableOptions<T>['enableRowSelection'];
  getRowCanExpand?: TableOptions<T>['getRowCanExpand'];
  onUpdate?: TableMeta<T>['updateData'];
}) => {
  // Local component state, can be overridden by properties.
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable<T>({
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
      const newValue = typeof updater === 'function' ? updater(expanded) : updater;

      if (typeof expanded === 'boolean' || typeof newValue === 'boolean') {
        return newValue;
      }

      if (onExpanded != null) {
        const expandedKeys = Object.keys(newValue).filter((k) => !(k in expanded));
        onExpanded(expandedKeys);
      }

      if (onCollapsed != null) {
        const collapsedKeys = Object.keys(expanded).filter((k) => !(k in newValue));

        onCollapsed(collapsedKeys);
      }

      setExpanded(newValue);
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

  const getTitle = (column: Column<T>) => {
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
