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

type CustomHeadingElement = Extract<keyof JSX.IntrinsicElements, 'h1' | 'h2' | 'h3' | 'h4'>;

export const Heading = ({ align = 'left', weight = 'normal', level, children }: HeadingProps) => {
  const H = `h${level}` as CustomHeadingElement;

  return (
    <H
      className={classNames({
        'text-center': align === 'center',
        'text-left': align === 'left',
        'text-right': align === 'right',
        'font-bold': weight === 'bold',
        'font-normal': weight === 'normal',
        'text-3xl': level === '1',
        'text-2xl': level === '2',
        'text-xl': level === '3',
        'text-lg': level === '4',
      })}
    >
      {children}
    </H>
  );
};
