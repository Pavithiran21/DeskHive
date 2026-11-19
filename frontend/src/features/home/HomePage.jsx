import {
  IconArmchair,
  IconArrowAutofitHeight,
  IconDeviceDesktop,
  IconUsersGroup,
  IconWheelchair,
  IconWindow,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { Link } from 'react-router';
import { keys } from '../../api/queryClient';
import { getAvailability } from '../../api/spaces';
import { isAdmin, useAuth } from '../../auth/AuthContext';
import { SpacePicture } from '../../components/SpacePicture';
import { EmptyState, ErrorPanel } from '../../components/StatePanels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppHeader } from '../../layout/AppHeader';
import { featureText } from '../../lib/features';
import { pictureFor } from '../../lib/pictures';
import { formatDay } from '../../lib/time';
import { CATEGORIES, cardsFor, deskFeatureLine, deskFreeText, roomFreeText } from './homeCards';
import { PillSearch } from './PillSearch';
import { searchQuery, useSearchState } from './useSearchState';

const CATEGORY_ICONS = {
  ALL: IconArmchair,
  WINDOW: IconWindow,
  DUAL_MONITOR: IconDeviceDesktop,
  STANDING: IconArrowAutofitHeight,
  ROOMS: IconUsersGroup,
  ACCESSIBLE: IconWheelchair,
};

function CardSkeletons() {
  return (
    <div className="listings" aria-busy="true">
      <span className="sr-only" role="status">
        Loading spaces…
      </span>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index}>
          <div className="skel blk" style={{ height: 'auto', aspectRatio: '1 / .9' }} />
          <div className="skel" style={{ width: '70%' }} />
          <div className="skel" style={{ width: '45%' }} />
        </div>
      ))}
    </div>
  );
}

function DeskCard({ area, category, query }) {
  const features = Object.keys(area.freeWithFeature);
  const text = deskFreeText(area, category);
  return (
    <Link className="lst" to={`/spaces/desks/${area.floorId}?area=${encodeURIComponent(area.area)}&${query}`}>
      <div className="ph">
        <SpacePicture kind={pictureFor({ type: 'DESK', features, name: area.area })} />
        {(area.freeWithFeature.ACCESSIBLE ?? 0) > 0 && <span className="badge">Accessible seats</span>}
      </div>
      <h2>{area.area}</h2>
      <div className="feat">{deskFeatureLine(area)}</div>
      <div className={area.free === 0 ? 'free none' : 'free'}>
        <b>{text}</b>
      </div>
    </Link>
  );
}

function RoomCard({ room, rules, query }) {
  const { lead, rest } = roomFreeText(room, rules);
  const equipment = room.features.filter((code) => code !== 'STEP_FREE');
  return (
    <Link className="lst" to={`/spaces/rooms/${room.id}?${query}`}>
      <div className="ph">
        <SpacePicture kind={pictureFor({ type: 'ROOM', capacity: room.capacity, name: room.name })} />
        {room.features.includes('STEP_FREE') && <span className="badge">Step-free</span>}
      </div>
      <h2>{room.name}</h2>
      <div className="feat">
        {room.floor} · {room.capacity} {room.capacity === 1 ? 'seat' : 'seats'}
        {equipment.length > 0 && ` · ${featureText(equipment).toLowerCase()}`}
      </div>
      <div className={room.freeTimes.length ? 'free' : 'free none'}>
        <b>{lead}</b> {rest}
      </div>
    </Link>
  );
}

/** /home: find a space. Desk areas show their free desks, rooms their free times, for the chosen day and time. */
export function HomePage() {
  usePageTitle('Find a space');
  const { user } = useAuth();
  const { offices, state, update } = useSearchState();
  const openWhere = useRef(null);

  const availability = useQuery({
    queryKey: keys.availability(state && { officeId: state.officeId, date: state.date, from: state.from, to: state.to }),
    queryFn: () => getAvailability({ officeId: state.officeId, date: state.date, from: state.from, to: state.to }),
    enabled: Boolean(state),
    placeholderData: (previous) => previous,
  });

  const search = state && <PillSearch offices={offices.data} state={state} update={update} openWhereRef={openWhere} />;

  let body;
  if (offices.isPending) {
    body = <CardSkeletons />;
  } else if (offices.isError) {
    body = (
      <div className="page">
        <ErrorPanel error={offices.error} onRetry={() => offices.refetch()} />
      </div>
    );
  } else if (!state) {
    body = (
      <div className="page" style={{ maxWidth: 640 }}>
        <EmptyState logo title="No offices yet" text="Your admin hasn't set up an office yet, so there's nothing to book.">
          {isAdmin(user) && (
            <Link to="/admin/spaces" className="btn btn-cta">
              Set up an office
            </Link>
          )}
        </EmptyState>
      </div>
    );
  } else {
    body = <HomeCards availability={availability} state={state} update={update} openWhere={openWhere} />;
  }

  return (
    <>
      <AppHeader search={search} />
      {state && (
        <nav className="cats" aria-label="Space type">
          {CATEGORIES.map(({ id, label }) => {
            const Icon = CATEGORY_ICONS[id];
            return (
              <button key={id} type="button" aria-pressed={state.category === id} onClick={() => update({ category: id === 'ALL' ? null : id })}>
                <Icon aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>
      )}
      <main>
        <h1 className="sr-only">Find a space</h1>
        {body}
      </main>
    </>
  );
}

function HomeCards({ availability, state, update, openWhere }) {
  if (availability.isPending) {
    return <CardSkeletons />;
  }
  if (availability.isError) {
    return (
      <div className="page">
        <ErrorPanel error={availability.error} onRetry={() => availability.refetch()} />
      </div>
    );
  }

  const data = availability.data;
  const query = searchQuery(state);

  if (!data.deskAreas.length && !data.rooms.length) {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <EmptyState Icon={IconArmchair} title={`No spaces at ${state.office.name} yet`} text="Your admin hasn't added desks or rooms here. Pick another office.">
          <button type="button" className="btn btn-line" onClick={() => openWhere.current?.()}>
            Change office
          </button>
        </EmptyState>
      </div>
    );
  }

  const { desks, rooms } = cardsFor(data, state);
  const allFull = data.deskAreas.every((area) => area.free === 0) && data.rooms.every((room) => !room.freeTimes.length);

  return (
    <>
      {allFull && (
        <div className="page" style={{ paddingBottom: 0 }}>
          <div className="card pad" style={{ borderLeft: '4px solid var(--warn)' }} role="status">
            <b>{formatDay(state.date)} is fully booked</b>
            <div className="muted sm">Every desk and room is taken at that time. Try another day or another time.</div>
          </div>
        </div>
      )}
      {desks.length + rooms.length === 0 ? (
        <div className="page" style={{ maxWidth: 640 }}>
          <EmptyState Icon={IconArmchair} title="Nothing free with that feature" text="No free desk or room has it at this time. Try another day or All spaces.">
            <button type="button" className="btn btn-line" onClick={() => update({ category: null })}>
              Show all spaces
            </button>
          </EmptyState>
        </div>
      ) : (
        <div className="listings" aria-busy={availability.isFetching}>
          {desks.map((area) => (
            <DeskCard key={`${area.floorId}-${area.area}`} area={area} category={state.category} query={query} />
          ))}
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} rules={state.office.rules} query={query} />
          ))}
        </div>
      )}
    </>
  );
}
