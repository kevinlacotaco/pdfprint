import { ChangeEventHandler, FormEventHandler, ReactNode } from 'react';

type InputProps = {
  value: HTMLInputElement['value'];
  onChange: ChangeEventHandler<HTMLInputElement>;
  onBlur: FormEventHandler<HTMLInputElement>;
  label?: ReactNode;
  'aria-label'?: ReactNode;
  name?: string;
  disabled?: boolean;
  type?: HTMLInputElement['type'];
  size?: 'sm' | 'md' | 'lg';
};

export const Input = ({ onChange, onBlur }: InputProps) => {
  return (
    <div className="flex flex-col">
      <input className="rounded-sm w-full p-2 border-2 border-gray-500" onChange={onChange} onBlur={onBlur} />
    </div>
  );
};
