import classNames from 'classnames';
import { HTMLProps, useEffect, useRef } from 'react';

export const IndeterminateCheckbox = ({
  indeterminate,
  className = '',
  ...rest
}: { indeterminate?: boolean } & HTMLProps<HTMLInputElement>) => {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof indeterminate === 'boolean' && ref.current != null) {
      ref.current.indeterminate = !rest.checked && indeterminate;
    }
  }, [ref, indeterminate, rest.checked]);

  return <input type="checkbox" ref={ref} className={classNames('w-4 h-4 cursor-pointer', className)} {...rest} />;
};
