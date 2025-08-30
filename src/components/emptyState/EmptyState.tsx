import classNames from 'classnames';
import { ReactNode } from 'react';

type Spacing = '1' | '2' | '3' | '4';

interface EmptyStateProps {
  children: ReactNode;
  spacing?: Spacing;
}

export const EmptyState = ({ children, spacing = '3' }: EmptyStateProps) => {
  return (
    <div
      className={classNames(
        {
          'space-y-1': spacing === '1',
          'space-y-2': spacing === '2',
          'space-y-3': spacing === '3',
          'space-y-4': spacing === '4',
        },
        'flex flex-col items-center justify-center h-full w-full'
      )}
    >
      {children}
    </div>
  );
};
