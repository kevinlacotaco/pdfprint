import { CellContext } from '@tanstack/react-table';
import { ReactNode } from 'react';

import IconArrowDown from 'icons/icon-cheveron-down-circle.svg?react';
import IconArrowRight from 'icons/icon-cheveron-right-circle.svg?react';
import { IndeterminateCheckbox } from '../checkbox/IndeterminateCheckbox';

export const CellContainer = <T, V>({ children, context }: { children: ReactNode; context: CellContext<T, V> }) => {
  const { row, table } = context;
  const visibleColumns = table.getAllFlatColumns();
  const isFirstVisibleColumn = context.column.id === visibleColumns[0]?.id;

  return (
    <div
      className="flex items-center px-2 space-x-2"
      style={{
        paddingLeft: row.depth == 0 || !isFirstVisibleColumn ? undefined : `${(row.depth * 2).toFixed(0)}rem`,
      }}
    >
      {row.getCanSelect() && isFirstVisibleColumn && (
        <IndeterminateCheckbox
          {...{
            checked: row.getIsSelected(),
            disabled: !row.getCanSelect(),
            indeterminate: row.getIsSomeSelected(),
            onChange: row.getToggleSelectedHandler(),
          }}
        />
      )}
      {row.getCanExpand() && isFirstVisibleColumn && (
        <button onClick={row.getToggleExpandedHandler()} className="cursor-pointer">
          {row.getIsExpanded() ? (
            <IconArrowDown className="inline w-4 h-4 text-gray-800 " />
          ) : (
            <IconArrowRight className="inline w-4 h-4 text-gray-800" />
          )}
        </button>
      )}
      {children}
    </div>
  );
};
