import { CellContext } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import { Input } from '../input/Input';

export const EditableTextCell = <TData, TValue>({
  getValue,
  row: { index },
  column: { id },
  table,
}: CellContext<TData, TValue>) => {
  const initialValue = getValue() ?? '';
  // We need to keep and update the state of the cell normally
  const [value, setValue] = useState(initialValue);

  // When the input is blurred, we'll call our table meta's updateData function
  const onBlur = () => {
    table.options.meta?.updateData(index, id, value);
  };

  // If the initialValue is changed external, sync it up with our state
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <div className="p-2">
      <Input
        value={value as string}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onBlur={onBlur}
      />
    </div>
  );
};
