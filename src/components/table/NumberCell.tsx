export interface NumberCellProps {
  value?: number;
  fractionDigits?: number;
  type?: Intl.NumberFormatOptionsStyle;
  unit?: Intl.NumberFormatOptions['unit'];
}

const LOCALE = 'en-US';

export const NumberCell = ({ value, type = 'decimal', unit, fractionDigits = 0 }: NumberCellProps) => {
  let formattedValue = '';

  if (value != null) {
    switch (type) {
      case 'decimal': {
        formattedValue = new Intl.NumberFormat(LOCALE, {
          style: type,
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        }).format(value);
        break;
      }
      case 'unit': {
        formattedValue = new Intl.NumberFormat(LOCALE, {
          notation: 'compact',
          style: type,
          unit: unit,
          unitDisplay: 'narrow',
        }).format(value);
      }
    }
  }

  return (
    <div className="truncate p-1.5 text-right tabular-nums w-full" title={formattedValue}>
      {formattedValue}
    </div>
  );
};
