import { SortDirection } from '@tanstack/react-table';
import DownChevron from 'icons/icon-cheveron-down.svg?react';
import UpChevron from 'icons/icon-cheveron-up.svg?react';

export interface HeaderCellProps {
  title: string;
  sorted?: SortDirection | false;
  className?: string;
}

export const HeaderCell = ({ title, sorted = false }: HeaderCellProps) => {
  return (
    <div className="py-1.5 font-semibold">
      {title}
      {{
        asc: <UpChevron className="inline w-6 h-6 text-gray-800 dark:text-white" />,
        desc: <DownChevron className="inline w-6 h-6 text-gray-800 dark:text-white" />,
      }[sorted as string] ?? null}
    </div>
  );
};
