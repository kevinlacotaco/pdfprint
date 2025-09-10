import classNames from 'classnames';
import { ReactNode } from 'react';

interface MenuItemProps {
  children: ReactNode;
  isDisabled?: boolean;
  onAction: () => void;
  accelerator?: string;
}

export const MenuItem = ({ children, isDisabled = false, onAction, accelerator }: MenuItemProps) => {
  return (
    <div
      className={classNames(
        'px-2 py-0.5 rounded-sm text-sm grid place-content-stretch items-center grid-cols-subgrid col-span-2 auto-cols-min',
        {
          'hover:bg-gray-700 hover:text-white cursor-pointer': !isDisabled,
          ' text-gray-300': isDisabled,
        }
      )}
      onClick={onAction}
    >
      <div className="whitespace-nowrap ">{children}</div>
      <div className=" whitespace-nowrap text-right text-xs">{accelerator}</div>
    </div>
  );
};
