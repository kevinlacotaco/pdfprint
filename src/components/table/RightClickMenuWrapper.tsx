import classNames from 'classnames';
import React, { CSSProperties, ReactNode, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu } from '../menu/Menu';
import { MenuItem } from '../menuitem/MenuItem';
import { Separator } from '../separator/Separator';

interface Action {
  type: 'action';
  id: string;
  text: string;
  action: () => void;
}

interface Separator {
  type: 'separator';
}

type RightClickMenuItem = Separator | Action;

const ContextMenuPortal = ({
  children,
  hidden,
  style,
}: {
  children?: ReactNode;
  hidden: boolean;
  style?: CSSProperties;
}) => {
  return createPortal(
    <div
      className={classNames('fixed z-30', {
        hidden: hidden,
      })}
      style={style}
    >
      {children}
    </div>,
    document.body
  );
};

const Backdrop = ({
  children,
  hidden,
  style,
  onMouseDown,
}: {
  children?: ReactNode;
  onMouseDown: React.DOMAttributes<HTMLDivElement>['onMouseDown'];
  hidden: boolean;
  style?: CSSProperties;
}) => {
  return createPortal(
    <div
      className={classNames('fixed h-full w-full top-0 left-0 z-20 bg-gray-50 opacity-5', {
        hidden: hidden,
      })}
      onMouseDown={onMouseDown}
      style={style}
    >
      {children}
    </div>,
    document.body
  );
};

interface BoundingBox {
  top: number;
  left: number;
  width: number;
  height: number;
  x: number;
  y: number;
  bottom: number;
  right: number;
}

export const RightClickMenu = ({
  children,
  actions,
  getIsDisabled,
}: {
  children: ReactNode;
  actions: RightClickMenuItem[];
  getIsDisabled?: (action: Action) => boolean;
}) => {
  const relativeRef = useRef<BoundingBox | null>(null);
  const [open, setOpen] = useState(false);

  const clickHandler = useCallback((event: React.MouseEvent) => {
    event.preventDefault();

    const callback = () => {
      relativeRef.current = {
        top: event.pageY,
        left: event.pageX,
        width: 0,
        height: 0,
        x: event.pageX,
        y: event.pageY,
        bottom: 0,
        right: 0,
      };
      setOpen(true);
    };

    callback();
  }, []);

  return (
    <div onContextMenu={clickHandler}>
      {children}

      <ContextMenuPortal hidden={!open} style={{ top: relativeRef.current?.top, left: relativeRef.current?.left }}>
        <Menu>
          {actions.map((action, idx) => {
            return action.type === 'action' ? (
              <MenuItem
                key={action.id}
                onAction={() => {
                  action.action();
                  setOpen(false);
                }}
                isDisabled={getIsDisabled == null ? false : getIsDisabled(action)}
              >
                {action.text}
              </MenuItem>
            ) : (
              <Separator key={`separator-${idx.toString()}`} />
            );
          })}
        </Menu>
      </ContextMenuPortal>
      <Backdrop
        hidden={!open}
        onMouseDown={() => {
          setOpen(false);
        }}
      />
    </div>
  );
};
