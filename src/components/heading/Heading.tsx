import classNames from 'classnames';
import { ReactNode } from 'react';

type Alignment = 'left' | 'center' | 'right';
type Level = '1' | '2' | '3' | '4';
type Weight = 'normal' | 'bold';

type HeadingProps = {
  align?: Alignment;
  level: Level;
  weight?: Weight;
  children: ReactNode;
};

export const Heading = ({ align = 'left', weight = 'normal', level, children }: HeadingProps) => {
  const classes = classNames({
    'text-center': align === 'center',
    'text-left': align === 'left',
    'text-right': align === 'right',
    'font-bold': weight === 'bold',
    'font-normal': weight === 'normal',
    'text-3xl': level === '1',
    'text-2xl': level === '2',
    'text-xl': level === '3',
    'text-l': level === '4',
  });

  switch (level) {
    case '1':
      return <h1 className={classes}>{children}</h1>;
    case '2':
      return <h2 className={classes}>{children}</h2>;
    case '3':
      return <h3 className={classes}>{children}</h3>;
    case '4':
      return <h4 className={classes}>{children}</h4>;
  }
};
