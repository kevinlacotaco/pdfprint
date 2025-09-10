import { ReactNode } from 'react';

interface MenuProps {
  children: ReactNode;
}

export const Menu = ({ children }: MenuProps) => {
  return (
    <div className="border border-gray-200 px-1 py-1 bg-white rounded-md inline-grid gap-x-1 grid-cols-[auto_minmax(min-content,_1fr)] ">
      {children}
    </div>
  );
};
