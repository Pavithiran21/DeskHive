import { IconSearch } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DateCalendar } from '../../components/DateCalendar';
import { TimeChips } from '../../components/TimeChips';
import { useDismiss } from '../../hooks/useDismiss';
import { slotLabel } from '../../lib/slots';
import { formatDay } from '../../lib/time';
import { WherePicker } from './WherePicker';

function whereText(state) {
  const floor = state.office.floors.find((entry) => String(entry.id) === String(state.floorId));
  const city = state.office.name.replace(/^Northwind\s+/, '');
  return floor ? `${city} · ${floor.name}` : state.office.name;
}

/**
 * The pill search in the header: Where / When / Time segments, each opening a popover, and the round
 * search button. A choice applies at once (it is written to the URL), so the cards below update.
 * Below 860 px the pill collapses into one "Find a space" button that opens all three in a sheet.
 */
export function PillSearch({ offices, state, update, openWhereRef }) {
  const [open, setOpen] = useState(null);
  const [left, setLeft] = useState(0);
  const pillRef = useRef(null);
  const sheetRef = useRef(null);
  const buttons = { where: useRef(null), when: useRef(null), time: useRef(null) };

  const close = useCallback(() => setOpen(null), []);
  useDismiss(open !== null && open !== 'sheet', pillRef, close, buttons[open]);

  // "Change office" on the empty state opens the Where popover.
  useEffect(() => {
    if (openWhereRef) {
      openWhereRef.current = () => setOpen(window.matchMedia('(max-width: 859px)').matches ? 'sheet' : 'where');
    }
  }, [openWhereRef]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (open === 'sheet' && sheet && !sheet.open) {
      sheet.showModal();
    } else if (open !== 'sheet' && sheet?.open) {
      sheet.close();
    }
  }, [open]);

  function toggle(name, button) {
    setLeft(name === 'when' ? button.offsetLeft : 0);
    setOpen((current) => (current === name ? null : name));
  }

  const segment = (name, small, text) => (
    <button
      ref={buttons[name]}
      type="button"
      className="seg"
      aria-haspopup="dialog"
      aria-expanded={open === name}
      onClick={(event) => toggle(name, event.currentTarget)}
    >
      <small>{small}</small>
      <span>{text}</span>
    </button>
  );

  const where = (
    <WherePicker offices={offices} officeId={state.officeId} floorId={state.floorId} onChange={update} />
  );
  const when = (
    <DateCalendar
      office={state.office}
      value={state.date}
      onChange={(date) => {
        update({ date });
        if (open !== 'sheet') {
          setOpen(null);
        }
      }}
    />
  );
  const time = (
    <TimeChips
      office={state.office}
      date={state.date}
      value={{ slot: state.slot, from: state.from, to: state.to }}
      onChange={(value) => update(value)}
      className="slots mt-0"
    />
  );

  const timeText = slotLabel(state.slot, state.from, state.to);

  return (
    <>
      <div className="pill" role="search" aria-label="Find a space" ref={pillRef}>
        {segment('where', 'Where', whereText(state))}
        {segment('when', 'When', formatDay(state.date))}
        {segment('time', 'Time', timeText)}
        <button type="button" className="go" aria-label="Search" onClick={close}>
          <IconSearch />
        </button>
        {open === 'where' && (
          <div className="popover" role="dialog" aria-label="Choose a place" style={{ left: 0 }}>
            {where}
          </div>
        )}
        {open === 'when' && (
          <div className="popover" role="dialog" aria-label="Choose a date" style={{ left }}>
            {when}
          </div>
        )}
        {open === 'time' && (
          <div className="popover" role="dialog" aria-label="Choose a time" style={{ right: 0, width: 440 }}>
            {time}
          </div>
        )}
      </div>
      <button type="button" className="find-btn" aria-haspopup="dialog" onClick={() => setOpen('sheet')}>
        <IconSearch aria-hidden="true" />
        <span>
          <b className="sm">Find a space</b>
          <span className="muted xs" style={{ display: 'block' }}>
            {whereText(state)} · {formatDay(state.date)} · {timeText}
          </span>
        </span>
      </button>
      <dialog ref={sheetRef} className="sheet-dlg" aria-label="Find a space" onClose={close}>
        {open === 'sheet' && (
          <div style={{ padding: '0 20px' }}>
            <div className="grab" aria-hidden="true" />
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Find a space</h2>
            {where}
            <hr className="divider" />
            {when}
            <hr className="divider" />
            {time}
            <button type="button" className="btn btn-cta btn-block" style={{ marginTop: 12 }} onClick={close}>
              Show spaces
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
