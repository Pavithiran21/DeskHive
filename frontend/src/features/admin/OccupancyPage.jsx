import { IconChartBar, IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getOccupancy } from '../../api/admin';
import { keys } from '../../api/queryClient';
import { LogoMark } from '../../components/Logo';
import { Pager } from '../../components/Pager';
import { EmptyState, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { useOffices } from '../../hooks/useOffices';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useAuth } from '../../auth/AuthContext';
import { addDays, formatDay, mondayOf, todayIn, weekdayShort } from '../../lib/time';

/** "Mon 9 – Sun 15 Nov" (the month is named once when both days are in it). */
function weekText(weekStart, weekEnd) {
  const sameMonth = weekStart.slice(0, 7) === weekEnd.slice(0, 7);
  const start = sameMonth ? `${weekdayShort(weekStart)} ${Number(weekStart.slice(8))}` : formatDay(weekStart);
  return `${start} – ${formatDay(weekEnd)}`;
}

/** The API already rounds to one decimal; null means there was nothing to divide by. */
const percent = (value) => (value == null ? '—' : `${value}%`);

function Kpis({ report }) {
  const { kpis } = report;
  const noShowShare = kpis.bookings ? Math.round((kpis.noShows / kpis.bookings) * 100) : null;
  return (
    <>
      <div className="kpis">
        <div className="card">
          <span className="muted sm">Desk use</span>
          <b>{percent(kpis.deskUse)}</b>
          <span className="tag t-free">
            {kpis.deskDaysBooked} of {kpis.deskDaysAvailable} desk-days
          </span>
        </div>
        <div className="card">
          <span className="muted sm">Room use</span>
          <b>{percent(kpis.roomUse)}</b>
          <span className="tag t-gray">of open hours</span>
        </div>
        <div className="card">
          <span className="muted sm">No-shows released</span>
          <b>{kpis.noShows}</b>
          <span className="tag t-warn">{noShowShare == null ? 'no bookings' : `${noShowShare}% of bookings`}</span>
        </div>
        <div className="card">
          <span className="muted sm">Busiest day</span>
          <b>{kpis.busiestDay ? weekdayShort(kpis.busiestDay) : '—'}</b>
          <span className="tag t-rose">
            {kpis.busiestDayDesksBooked ?? 0} of {report.desks} desks
          </span>
        </div>
      </div>
      <p className="muted xs" style={{ margin: '-6px 0 14px' }}>
        Desk use = desk-days booked (not cancelled or released) ÷ desks × open days. Room use = room hours booked ÷ open hours.
        No-shows = bookings auto-released. Busiest day = most desks booked. All in the office's time zone.
      </p>
    </>
  );
}

/** Desks booked per day as plain CSS bars (no chart library); the busiest day is rose. */
function DayBars({ report }) {
  const max = Math.max(report.desks, 1);
  const top = Math.max(...report.desksBookedByDay.map((day) => day.desksBooked));
  const summary = report.desksBookedByDay.map((day) => `${weekdayShort(day.date)} ${day.desksBooked}`).join(', ');
  return (
    <div className="card pad">
      <b>
        Desks booked by day · {report.floor ?? 'All floors'} ({report.desks} desks)
      </b>
      <div className="bars" role="img" aria-label={`Desks booked of ${report.desks}: ${summary}`}>
        {report.desksBookedByDay.map((day) => (
          <div key={day.date} className="bar-col" aria-hidden="true">
            <span className="bar-v">{day.desksBooked}</span>
            <span
              className={day.desksBooked === top && top > 0 ? 'bar-f top' : 'bar-f'}
              style={{ height: `${(day.desksBooked / max) * 140}px` }}
            />
            <span className="bar-d">{weekdayShort(day.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BySpace({ report, onPage }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 6px' }}>
        <b>By space</b>
      </div>
      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Space</th>
              <th className="num">Bookings</th>
              <th className="num">Used</th>
              <th className="num">No-shows</th>
            </tr>
          </thead>
          <tbody>
            {report.bySpace.items.map((row) => (
              <tr key={row.spaceId}>
                <td>
                  {row.type === 'DESK' ? `Seat ${row.label}` : row.label}
                  <div className="muted xs">{row.floor}</div>
                </td>
                <td className="num">{row.bookings}</td>
                <td className="num">{percent(row.use)}</td>
                <td className="num">{row.noShows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager data={report.bySpace} onPage={onPage} />
    </div>
  );
}

/** /admin: occupancy for one office (and floor) and one week, in the office's time zone. */
export function OccupancyPage() {
  usePageTitle('Occupancy');
  const { user } = useAuth();
  const offices = useOffices();
  const [params, setParams] = useSearchParams();
  const officeFieldId = useId();
  const floorFieldId = useId();

  const list = offices.data ?? [];
  const office =
    list.find((entry) => String(entry.id) === params.get('office')) ?? list.find((entry) => entry.id === user.office?.id) ?? list[0];
  const floorId = params.get('floor') ?? '';
  const weekStart = params.get('week') ?? (office ? mondayOf(todayIn(office.timeZone)) : null);
  const page = Number(params.get('page') ?? 1);

  const report = useQuery({
    queryKey: keys.occupancy({ officeId: office?.id, floorId, weekStart, page }),
    queryFn: () => getOccupancy({ officeId: office.id, floorId: floorId || undefined, weekStart, page }),
    enabled: Boolean(office),
    placeholderData: (previous) => previous,
  });

  function set(changes) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  if (offices.isPending) {
    return <Skeleton label="Loading the report…" blocks={1} lines={2} />;
  }
  if (offices.isError) {
    return <ErrorPanel error={offices.error} onRetry={() => offices.refetch()} title="Couldn't load the report" />;
  }
  if (!office) {
    return (
      <div className="card state">
        <LogoMark size={52} />
        <h1 style={{ fontSize: 19, marginTop: 8 }}>Set up your first office</h1>
        <p className="muted sm">Add an office with its time zone, then its floors, desks and rooms. The report fills in once people book.</p>
        <Link to="/admin/spaces?new=office" className="btn btn-cta">
          <IconPlus aria-hidden="true" /> Add your first office
        </Link>
      </div>
    );
  }

  const data = report.data;
  return (
    <>
      <div className="row-flex" style={{ marginBottom: 14 }}>
        <h1 className="fill" style={{ fontSize: 24 }}>
          Occupancy
        </h1>
      </div>
      <div className="filters">
        <div>
          <label htmlFor={officeFieldId}>Office</label>
          <select id={officeFieldId} className="inp" value={office.id} onChange={(event) => set({ office: event.target.value, floor: null, week: null })}>
            {list.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={floorFieldId}>Floor</label>
          <select id={floorFieldId} className="inp" value={floorId} onChange={(event) => set({ floor: event.target.value })}>
            <option value="">All floors</option>
            {office.floors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="flabel">Week</span>
          <div className="row-flex" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <button type="button" className="icon-btn" aria-label="Previous week" onClick={() => set({ week: addDays(weekStart, -7) })}>
              <IconChevronLeft />
            </button>
            <b style={{ minWidth: 150, textAlign: 'center' }} aria-live="polite">
              {data ? weekText(data.weekStart, data.weekEnd) : formatDay(weekStart)}
            </b>
            <button type="button" className="icon-btn" aria-label="Next week" onClick={() => set({ week: addDays(weekStart, 7) })}>
              <IconChevronRight />
            </button>
          </div>
        </div>
      </div>
      {report.isPending ? (
        <Skeleton label="Loading the report…" blocks={1} lines={2} />
      ) : report.isError ? (
        <ErrorPanel error={report.error} onRetry={() => report.refetch()} title="Couldn't load the report" />
      ) : data.kpis.bookings === 0 ? (
        <EmptyState
          Icon={IconChartBar}
          title="No bookings in this week yet"
          text={`${data.office} · ${data.floor ?? 'All floors'} · ${weekText(data.weekStart, data.weekEnd)}. Numbers appear once people book.`}
        >
          <button type="button" className="btn btn-line" onClick={() => set({ week: addDays(weekStart, -7) })}>
            Previous week
          </button>
        </EmptyState>
      ) : (
        <div aria-busy={report.isFetching}>
          <Kpis report={data} />
          <div className="split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
            <DayBars report={data} />
            <BySpace report={data} onPage={(next) => set({ page: String(next) })} />
          </div>
        </div>
      )}
    </>
  );
}
