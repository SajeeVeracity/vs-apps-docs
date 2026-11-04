import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useHistory, useLocation } from '@docusaurus/router';
import { shortLabel, switchTarget } from '../flavours/resolve.mjs';
import { saveChoice, useChoice, useFlavourSite } from '../flavours/useFlavours';

const capitalise = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/** Navbar item. The trigger shows the pair in short text; the popover has one row of full names per axis. */
export default function FlavourPicker({ mobile }: { mobile?: boolean }): ReactElement {
  const { axes, baseUrl } = useFlavourSite();
  const choice = useChoice();
  const history = useHistory();
  const { pathname, search, hash } = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => root.current?.contains(event.target as Node) || setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const names = Object.keys(axes);
  const short = names.map((axis) => shortLabel(axes[axis][choice[axis]])).join(' · ');
  const spoken = names.map((axis) => `${axis} ${axes[axis][choice[axis]]}`).join(', ');

  function pick(axis: string, flavour: string): void {
    setOpen(false);
    trigger.current?.focus();
    saveChoice({ [axis]: flavour });
    const to = switchTarget({ pathname, baseUrl, axes, axis, flavour });
    if (to) history.push(to + search + hash);
  }

  return (
    <div
      className={`flavour-picker${mobile ? ' flavour-picker--mobile' : ''}`}
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        setOpen(false);
        trigger.current?.focus();
      }}
    >
      <button
        type="button"
        ref={trigger}
        className="flavour-picker__trigger"
        aria-expanded={open}
        aria-controls={popover}
        aria-label={`${short}. ${capitalise(spoken)}`}
        onClick={() => setOpen(!open)}
      >
        <span className="flavour-picker__label">{short}</span>
        <span className="flavour-picker__caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="flavour-picker__popover" id={popover} role="group" aria-label="Flavours">
          {names.map((axis) => (
            <div className="flavour-picker__row" key={axis}>
              <span className="flavour-picker__rowlabel">{capitalise(axis)}</span>
              <div className="flavour-picker__seg">
                {Object.entries(axes[axis]).map(([flavour, label]) => (
                  <button key={flavour} type="button" aria-pressed={flavour === choice[axis]} onClick={() => pick(axis, flavour)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
