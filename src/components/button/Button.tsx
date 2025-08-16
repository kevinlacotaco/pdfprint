import classNames from 'classnames';
import { MouseEventHandler, ReactNode } from 'react';

type ButtonProps = {
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  type?: HTMLButtonElement['type'];
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  children?: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement> | undefined;
};

export const Button = ({
  onClick,
  variant = 'primary',
  disabled = false,
  type = 'button',
  size = 'md',
  title,
  children,
}: ButtonProps) => {
  // text-center justify-center items-center
  return (
    <button
      className={classNames(
        'rounded-sm text-sm  cursor-pointer  text-white tracking-wider whitespace-nowrap outline-offset-0 items-stretch flex min-w-0 w-auto basis-auto disabled:cursor-auto',
        {
          'hover:bg-gray-600 bg-gray-500 disabled:bg-gray-200 disabled:text-gray-400 ': variant === 'secondary',
          'hover:bg-blue-600 bg-blue-500 disabled:bg-blue-200 disabled:text-blue-400 ': variant === 'primary',
        }
      )}
      onClick={onClick}
      type={type}
      title={title}
      disabled={disabled}
    >
      <span className="text-center justify-center items-center flex relative w-full grow px-5 py-3">{children}</span>
    </button>
  );
};
