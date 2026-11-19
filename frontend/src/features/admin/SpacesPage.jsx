import { IconArmchair, IconBuilding, IconPencil, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { deleteFloor, deleteOffice, deleteSpace, listSpaces } from '../../api/admin';
import { keys, queryClient } from '../../api/queryClient';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Pager } from '../../components/Pager';
import { EmptyState, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useOffices } from '../../hooks/useOffices';
import { usePageTitle } from '../../hooks/usePageTitle';
import { featureText } from '../../lib/features';
import { useToast } from '../../toast/ToastContext';
import { DeskForm, EditOfficeForm, FloorForm, NewOfficeForm, RoomForm } from './SpaceForms';

const spaceName = (space) => (space.type === 'DESK' ? `Desk ${space.label}` : space.label);

function refreshSpaces() {
  queryClient.invalidateQueries({ queryKey: keys.offices });
  queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
  queryClient.invalidateQueries({ queryKey: ['availability'] });
}

function OfficeTree({ offices, officeId, floorId, onOffice, onFloor, onAddFloor, onAddOffice }) {
  return (
    <div className="card pad" style={{ padding: 14 }}>
      <div className="row-flex" style={{ marginBottom: 8 }}>
        <b className="fill">Offices</b>
        <button type="button" className="btn btn-soft btn-sm" onClick={onAddOffice}>
          <IconPlus aria-hidden="true" /> Office
        </button>
      </div>
      <nav className="tree" aria-label="Offices and floors">
        {offices.map((office) => (
          <div key={office.id} style={{ display: 'contents' }}>
            <button type="button" aria-current={office.id === officeId && !floorId ? 'true' : undefined} onClick={() => onOffice(office)}>
              <IconBuilding aria-hidden="true" /> {office.name} <small>{office.timeZoneName}</small>
            </button>
            {office.floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                className="sub"
                aria-current={String(floor.id) === String(floorId) ? 'true' : undefined}
                onClick={() => onFloor(office, floor)}
              >
                {floor.name} <small>{floor.desks + floor.rooms}</small>
              </button>
            ))}
            <button type="button" className="sub add" onClick={() => onAddFloor(office)}>
              <IconPlus aria-hidden="true" /> Add floor
            </button>
          </div>
        ))}
      </nav>
    </div>
  );
}

function SpaceTable({ office, floor, selectedId, onSelect, onNewDesk, onNewRoom, onAreas }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const params = { floorId: floor.id, q: q || undefined, page };
  const spaces = useQuery({ queryKey: keys.adminSpaces(params), queryFn: () => listSpaces(params), placeholderData: (previous) => previous });
  const items = spaces.data?.items ?? [];
  // The desk form suggests the area names already used on this floor.
  const areaKey = [...new Set(items.filter((space) => space.type === 'DESK').map((space) => space.area))].join('|');
  useEffect(() => {
    onAreas(areaKey ? areaKey.split('|') : []);
  }, [areaKey, onAreas]);

  return (
    <div className="card" style={{ overflow: 'hidden', minWidth: 0 }}>
      <div className="row-flex" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
        <b style={{ width: '100%' }}>
          {floor.name} · {office.name}
        </b>
        <input
          className="inp fill"
          style={{ margin: 0, width: 'auto', padding: '7px 12px', fontSize: 14 }}
          aria-label="Search spaces"
          placeholder="Search A1, Hive…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <button type="button" className="btn btn-line btn-sm" onClick={onNewDesk}>
          <IconPlus aria-hidden="true" /> Desk
        </button>
        <button type="button" className="btn btn-line btn-sm" onClick={onNewRoom}>
          <IconPlus aria-hidden="true" /> Room
        </button>
      </div>
      {spaces.isPending ? (
        <Skeleton className="pad" label="Loading spaces…" />
      ) : spaces.isError ? (
        <ErrorPanel error={spaces.error} onRetry={() => spaces.refetch()} />
      ) : items.length === 0 && !q ? (
        <div className="state">
          <IconArmchair className="big gray" aria-hidden="true" />
          <h2>{floor.name} has no desks or rooms yet</h2>
          <p className="muted sm">Give each desk a row and a number to build the seat map, or add a meeting room.</p>
          <div className="row-flex">
            <button type="button" className="btn btn-line" onClick={onNewDesk}>
              <IconPlus aria-hidden="true" /> Desk
            </button>
            <button type="button" className="btn btn-line" onClick={onNewRoom}>
              <IconPlus aria-hidden="true" /> Room
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="pad muted sm">No space on {floor.name} matches “{q}”.</p>
      ) : (
        <div className={spaces.isPlaceholderData ? 'tablewrap stale' : 'tablewrap'} aria-busy={spaces.isFetching}>
          <table className="tbl cards">
            <thead>
              <tr>
                <th>Space</th>
                <th>Type</th>
                <th>Area</th>
                <th>Features</th>
              </tr>
            </thead>
            <tbody>
              {items.map((space) => (
                <tr key={space.id} className={space.id === selectedId ? 'click on' : 'click'} onClick={() => onSelect(space)}>
                  <td>
                    <button type="button" className="rowlink" onClick={() => onSelect(space)}>
                      {space.label}
                    </button>
                  </td>
                  <td data-l="Type">{space.type === 'DESK' ? 'Desk' : `Room · ${space.capacity} seats`}</td>
                  <td data-l="Area">{space.area ?? '—'}</td>
                  <td data-l="Features">{featureText(space.features)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager data={spaces.data} onPage={setPage} showSize />
    </div>
  );
}

function SpaceView({ space, office, onEdit, onDelete }) {
  return (
    <>
      <h2 style={{ fontSize: 20 }}>{spaceName(space)}</h2>
      <dl className="dl tight" style={{ marginTop: 12 }}>
        <dt>Floor</dt>
        <dd>
          {space.floor}, {office.name}
        </dd>
        {space.type === 'DESK' ? (
          <>
            <dt>Area</dt>
            <dd>{space.area}</dd>
            <dt>Seat map</dt>
            <dd>
              Row {space.row}, number {space.number}
            </dd>
          </>
        ) : (
          <>
            <dt>Capacity</dt>
            <dd>{space.capacity} people</dd>
          </>
        )}
        <dt>{space.type === 'DESK' ? 'Features' : 'Equipment'}</dt>
        <dd>{featureText(space.features)}</dd>
      </dl>
      <div className="row-flex" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-line btn-sm" onClick={onEdit}>
          <IconPencil aria-hidden="true" /> Edit
        </button>
        <button type="button" className="btn btn-text btn-sm btn-red" onClick={onDelete}>
          Delete
        </button>
      </div>
    </>
  );
}

function FloorView({ floor, office, onRename, onDelete }) {
  return (
    <>
      <div className="row-flex">
        <h2 className="fill" style={{ fontSize: 20 }}>
          {floor.name}
        </h2>
        <span className="tag t-gray">{floor.desks + floor.rooms} spaces</span>
      </div>
      <dl className="dl tight" style={{ marginTop: 12 }}>
        <dt>Office</dt>
        <dd>{office.name}</dd>
        <dt>Desks</dt>
        <dd>{floor.desks}</dd>
        <dt>Rooms</dt>
        <dd>{floor.rooms}</dd>
      </dl>
      <div className="row-flex" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-line btn-sm" onClick={onRename}>
          <IconPencil aria-hidden="true" /> Rename
        </button>
        <button type="button" className="btn btn-text btn-sm btn-red" onClick={onDelete}>
          Delete
        </button>
      </div>
    </>
  );
}

function OfficeView({ office, onEdit }) {
  return (
    <>
      <h2 style={{ fontSize: 20 }}>{office.name}</h2>
      <dl className="dl tight" style={{ marginTop: 12 }}>
        <dt>Address</dt>
        <dd>{office.address}</dd>
        <dt>Time zone</dt>
        <dd>
          {office.timeZone} ({office.timeZoneName})
        </dd>
        <dt>Floors</dt>
        <dd>{office.floors.length}</dd>
      </dl>
      <button type="button" className="btn btn-line btn-sm" style={{ marginTop: 16 }} onClick={onEdit}>
        <IconPencil aria-hidden="true" /> Edit office
      </button>
    </>
  );
}

/**
 * /admin/spaces: offices (each with its time zone) → floors → desks and rooms. A click opens a
 * read-only view with Edit and Delete; deletes are refused while something depends on them (409).
 */
export function SpacesPage() {
  usePageTitle('Spaces and seats');
  const offices = useOffices();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  // pane: what the right column shows: 'office' | 'floor' | 'space' | a form ('new-office', 'edit-office',
  // 'new-floor', 'rename-floor', 'new-desk', 'new-room', 'edit-space').
  const [pane, setPane] = useState(params.get('new') === 'office' ? 'new-office' : null);
  const [space, setSpace] = useState(null);
  const [areas, setAreas] = useState([]);
  const [confirm, setConfirm] = useState(null); // { kind, item }

  const list = offices.data ?? [];
  const office = list.find((entry) => String(entry.id) === params.get('office')) ?? list[0] ?? null;
  const floor = office?.floors.find((entry) => String(entry.id) === params.get('floor')) ?? (params.get('office') ? null : office?.floors[0]) ?? null;

  function select(nextOffice, nextFloor, nextPane) {
    const next = { office: String(nextOffice.id) };
    if (nextFloor) next.floor = String(nextFloor.id);
    setParams(next, { replace: true });
    setSpace(null);
    setPane(nextPane);
  }

  const remove = useMutation({
    mutationFn: ({ kind, item }) => (kind === 'space' ? deleteSpace(item.id) : kind === 'floor' ? deleteFloor(item.id) : deleteOffice(item.id)),
    onSuccess: (_, { kind, item }) => {
      refreshSpaces();
      setConfirm(null);
      showToast({ message: `${kind === 'space' ? spaceName(item) : item.name} deleted` });
      if (kind === 'office') {
        setParams({}, { replace: true });
      } else if (kind === 'floor') {
        setParams({ office: String(office.id) }, { replace: true });
      }
      setSpace(null);
      setPane(kind === 'space' ? 'floor' : 'office');
    },
  });

  function askDelete(kind, item) {
    remove.reset();
    setConfirm({ kind, item });
  }

  if (offices.isPending) {
    return <Skeleton label="Loading spaces…" lines={5} />;
  }
  if (offices.isError) {
    return <ErrorPanel error={offices.error} onRetry={() => offices.refetch()} />;
  }

  const savedThen = (message, after) => (saved) => {
    refreshSpaces();
    showToast({ message, Icon: IconBuilding });
    after?.(saved);
  };

  let paneBody;
  const current = pane ?? (space ? 'space' : floor ? 'floor' : 'office');
  if (current === 'new-office' || !office) {
    paneBody = (
      <NewOfficeForm
        onCancel={office ? () => setPane(null) : undefined}
        onSaved={savedThen('Office created', (created) => select(created, null, 'new-floor'))}
      />
    );
  } else if (current === 'edit-office') {
    paneBody = (
      <EditOfficeForm
        key={office.id}
        office={office}
        onCancel={() => setPane('office')}
        onDelete={() => askDelete('office', office)}
        onSaved={savedThen('Office saved', () => setPane('office'))}
      />
    );
  } else if (current === 'new-floor' || current === 'rename-floor') {
    paneBody = (
      <FloorForm
        key={`${current}-${floor?.id}`}
        office={office}
        floor={current === 'rename-floor' ? floor : null}
        onCancel={() => setPane(null)}
        onSaved={savedThen(current === 'rename-floor' ? 'Floor renamed' : 'Floor created', (saved) => select(office, saved, 'floor'))}
      />
    );
  } else if ((current === 'new-desk' || (current === 'edit-space' && space?.type === 'DESK')) && floor) {
    paneBody = (
      <DeskForm
        key={`${current}-${space?.id}`}
        office={office}
        floorId={floor.id}
        desk={current === 'edit-space' ? space : null}
        areas={areas}
        onCancel={() => setPane(null)}
        onSaved={savedThen(current === 'new-desk' ? 'Desk created' : 'Desk saved', (saved) => {
          setSpace(saved);
          setPane('space');
        })}
      />
    );
  } else if ((current === 'new-room' || current === 'edit-space') && floor) {
    paneBody = (
      <RoomForm
        key={`${current}-${space?.id}`}
        office={office}
        floorId={floor.id}
        room={current === 'edit-space' ? space : null}
        onCancel={() => setPane(null)}
        onSaved={savedThen(current === 'new-room' ? 'Room created' : 'Room saved', (saved) => {
          setSpace(saved);
          setPane('space');
        })}
      />
    );
  } else if (current === 'space' && space) {
    paneBody = <SpaceView space={space} office={office} onEdit={() => setPane('edit-space')} onDelete={() => askDelete('space', space)} />;
  } else if (current === 'floor' && floor) {
    paneBody = <FloorView floor={floor} office={office} onRename={() => setPane('rename-floor')} onDelete={() => askDelete('floor', floor)} />;
  } else {
    paneBody = <OfficeView office={office} onEdit={() => setPane('edit-office')} />;
  }

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 14 }}>Spaces and seats</h1>
      {list.length === 0 && pane !== 'new-office' ? (
        <EmptyState logo title="Set up your first office" text="Add an office with its time zone, then its floors, desks and rooms.">
          <button type="button" className="btn btn-cta" onClick={() => setPane('new-office')}>
            <IconPlus aria-hidden="true" /> Add your first office
          </button>
        </EmptyState>
      ) : (
        <div className="spaces">
          {list.length > 0 ? (
            <OfficeTree
              offices={list}
              officeId={office?.id}
              floorId={floor?.id}
              onOffice={(next) => select(next, null, 'office')}
              onFloor={(nextOffice, nextFloor) => select(nextOffice, nextFloor, 'floor')}
              onAddFloor={(nextOffice) => select(nextOffice, null, 'new-floor')}
              onAddOffice={() => setPane('new-office')}
            />
          ) : (
            <div />
          )}
          {office && floor ? (
            <SpaceTable
              key={floor.id}
              office={office}
              floor={floor}
              selectedId={space?.id}
              onSelect={(row) => {
                setSpace(row);
                setPane('space');
              }}
              onNewDesk={() => setPane('new-desk')}
              onNewRoom={() => setPane('new-room')}
              onAreas={setAreas}
            />
          ) : office ? (
            <div className="card state">
              <IconBuilding className="big gray" aria-hidden="true" />
              <h2>{office.floors.length ? `Pick a floor of ${office.name}` : `${office.name} has no floors yet`}</h2>
              <p className="muted sm">{office.floors.length ? 'Its desks and rooms show here.' : 'Add a floor, then its desks and rooms.'}</p>
              {!office.floors.length && (
                <div className="row-flex">
                  <button type="button" className="btn btn-line" onClick={() => setPane('new-floor')}>
                    <IconPlus aria-hidden="true" /> Add floor
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div />
          )}
          <section className="card pad viewpane" aria-label="Details">
            {paneBody}
          </section>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm ? `Delete ${confirm.kind === 'space' ? spaceName(confirm.item) : confirm.item.name}?` : ''}
        description="This can't be undone. Past bookings stay in the reports."
        keepLabel="Keep it"
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={remove.isPending}
        error={remove.error}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove.mutate(confirm)}
      />
    </>
  );
}
