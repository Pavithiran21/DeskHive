import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { createDesk, createFloor, createOffice, createRoom, renameFloor, updateDesk, updateOffice, updateRoom } from '../../api/admin';
import { SelectField, TextField } from '../../components/Fields';
import { Alert } from '../../components/StatePanels';
import { applyFieldErrors } from '../../lib/apiErrors';
import { DESK_FEATURES, ROOM_FEATURES } from '../../lib/features';
import { allTimeZones, currentZoneName, formatTime, zoneShortName } from '../../lib/time';
import { DAY_TIMES, deskSchema, floorSchema, officeEditSchema, officeSchema, roomSchema } from './adminSchemas';

const TIME_OPTIONS = DAY_TIMES.map((time) => ({ value: time, label: formatTime(time) }));

/**
 * One admin form: React Hook Form + Zod, a server error under its field (fallbackField when the API
 * names none, like OFFICE_EXISTS), any other refusal in an alert above the buttons.
 */
function useAdminForm({ schema, defaultValues, save, onSaved, fallbackField }) {
  const [refusal, setRefusal] = useState(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues });
  const mutation = useMutation({
    mutationFn: save,
    onSuccess: onSaved,
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, { fallbackField })) setRefusal(error);
    },
  });
  const submit = form.handleSubmit((values) => {
    setRefusal(null);
    mutation.mutate(values);
  });
  return { form, errors: form.formState.errors, mutation, refusal, submit };
}

function Buttons({ onCancel, busy, label, extra }) {
  return (
    <div className="row-flex" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
      {extra}
      {extra && <span className="fill" />}
      {onCancel && (
        <button type="button" className="btn btn-text" onClick={onCancel}>
          Cancel
        </button>
      )}
      <button type="submit" className="btn btn-dark" disabled={busy}>
        {busy ? 'Saving…' : label}
      </button>
    </div>
  );
}

function Checkboxes({ legend, options, register }) {
  return (
    <fieldset>
      <legend className="flabel">{legend}</legend>
      {options.map((option) => (
        <label key={option.code} className="chk">
          <input type="checkbox" value={option.code} {...register('features')} /> {option.form}
        </label>
      ))}
    </fieldset>
  );
}

export function NewOfficeForm({ onSaved, onCancel }) {
  const zones = allTimeZones();
  const browserZone = currentZoneName(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const { form, errors, mutation, refusal, submit } = useAdminForm({
    schema: officeSchema,
    defaultValues: { name: '', address: '', timeZone: zones.includes(browserZone) ? browserZone : 'Asia/Kolkata', opensAt: '08:00', closesAt: '19:00' },
    save: createOffice,
    onSaved,
    fallbackField: 'name',
  });
  return (
    <form onSubmit={submit} noValidate>
      <h2 style={{ fontSize: 19, marginBottom: 14 }}>New office</h2>
      <TextField label="Name" error={errors.name?.message} {...form.register('name')} />
      <TextField label="Address" error={errors.address?.message} {...form.register('address')} />
      <SelectField
        label="Time zone"
        hint="Opening hours, check-in, reminders and auto-release use this zone. It can't be changed later."
        error={errors.timeZone?.message}
        options={zones.map((zone) => ({ value: zone, label: `${zone} (${zoneShortName(zone)})` }))}
        {...form.register('timeZone')}
      />
      <div className="time-pick">
        <div>
          <SelectField label="Opens" options={TIME_OPTIONS} error={errors.opensAt?.message} {...form.register('opensAt')} />
        </div>
        <div>
          <SelectField label="Closes" options={TIME_OPTIONS} error={errors.closesAt?.message} {...form.register('closesAt')} />
        </div>
      </div>
      <p className="muted xs" style={{ margin: '-6px 0 12px' }}>
        New offices start with the default rules: 14 days ahead, up to 8 hours a booking.
      </p>
      {refusal && <Alert className="mb-3" message={refusal.message} />}
      <Buttons onCancel={onCancel} busy={mutation.isPending} label="Create office" />
    </form>
  );
}

export function EditOfficeForm({ office, onSaved, onCancel, onDelete }) {
  const { form, errors, mutation, refusal, submit } = useAdminForm({
    schema: officeEditSchema,
    defaultValues: { name: office.name, address: office.address },
    save: (values) => updateOffice(office.id, values),
    onSaved,
    fallbackField: 'name',
  });
  return (
    <form onSubmit={submit} noValidate>
      <h2 style={{ fontSize: 19, marginBottom: 14 }}>Edit office</h2>
      <TextField label="Name" error={errors.name?.message} {...form.register('name')} />
      <TextField label="Address" error={errors.address?.message} {...form.register('address')} />
      <TextField
        label="Time zone"
        value={`${office.timeZone} (${office.timeZoneName})`}
        readOnly
        hint="Can't be changed after the office is created: existing bookings were chosen in this zone."
      />
      <p className="muted xs" style={{ margin: '0 0 12px' }}>
        Opening hours are set in <Link to={`/admin/rules?office=${office.id}`}>Booking rules</Link>.
      </p>
      {refusal && <Alert className="mb-3" message={refusal.message} />}
      <Buttons
        onCancel={onCancel}
        busy={mutation.isPending}
        label="Save office"
        extra={
          <button type="button" className="btn btn-text btn-sm btn-red" onClick={onDelete}>
            Delete office
          </button>
        }
      />
    </form>
  );
}

export function FloorForm({ office, floor, onSaved, onCancel }) {
  const { form, errors, mutation, refusal, submit } = useAdminForm({
    schema: floorSchema,
    defaultValues: { name: floor?.name ?? '' },
    save: (values) => (floor ? renameFloor(floor.id, values) : createFloor({ officeId: office.id, name: values.name })),
    onSaved,
    fallbackField: 'name',
  });
  return (
    <form onSubmit={submit} noValidate>
      <h2 style={{ fontSize: 19, marginBottom: 14 }}>{floor ? 'Rename floor' : 'New floor'}</h2>
      <TextField label="Office" value={`${office.name} (${office.timeZoneName})`} readOnly />
      <TextField label="Name" error={errors.name?.message} placeholder="Floor 4" {...form.register('name')} />
      {!floor && (
        <p className="muted xs" style={{ margin: '-4px 0 12px' }}>
          Add desks and rooms to the floor once it exists.
        </p>
      )}
      {refusal && <Alert className="mb-3" message={refusal.message} />}
      <Buttons onCancel={onCancel} busy={mutation.isPending} label={floor ? 'Save floor' : 'Create floor'} />
    </form>
  );
}

export function DeskForm({ office, floorId, desk, areas, onSaved, onCancel }) {
  const listId = useId();
  const { form, errors, mutation, refusal, submit } = useAdminForm({
    schema: deskSchema,
    defaultValues: {
      floorId: String(desk?.floorId ?? floorId),
      area: desk?.area ?? '',
      row: desk?.row ?? '',
      number: desk?.number ?? '',
      features: desk?.features ?? [],
    },
    save: (values) => {
      const body = { ...values, floorId: Number(values.floorId) };
      return desk ? updateDesk(desk.id, body) : createDesk(body);
    },
    onSaved,
    fallbackField: 'number',
  });
  return (
    <form onSubmit={submit} noValidate>
      <h2 style={{ fontSize: 19, marginBottom: 14 }}>{desk ? `Edit desk ${desk.label}` : 'New desk'}</h2>
      <SelectField
        label="Floor"
        options={office.floors.map((floor) => ({ value: String(floor.id), label: `${floor.name} · ${office.name}` }))}
        error={errors.floorId?.message}
        {...form.register('floorId')}
      />
      <TextField label="Area" list={listId} error={errors.area?.message} placeholder="Quiet zone" {...form.register('area')} />
      <datalist id={listId}>
        {areas.map((area) => (
          <option key={area} value={area} />
        ))}
      </datalist>
      <div className="time-pick">
        <div>
          <TextField label="Row" maxLength={1} error={errors.row?.message} placeholder="B" {...form.register('row')} />
        </div>
        <div>
          <TextField label="Number" inputMode="numeric" error={errors.number?.message} placeholder="7" {...form.register('number')} />
        </div>
      </div>
      <Checkboxes legend="Features" options={DESK_FEATURES} register={form.register} />
      {refusal && <Alert className="mb-3" message={refusal.message} />}
      <Buttons onCancel={onCancel} busy={mutation.isPending} label={desk ? 'Save desk' : 'Create desk'} />
    </form>
  );
}

export function RoomForm({ office, floorId, room, onSaved, onCancel }) {
  const { form, errors, mutation, refusal, submit } = useAdminForm({
    schema: roomSchema,
    defaultValues: {
      floorId: String(room?.floorId ?? floorId),
      name: room?.name ?? '',
      capacity: room?.capacity ?? '',
      features: room?.features ?? [],
    },
    save: (values) => {
      const body = { ...values, floorId: Number(values.floorId) };
      return room ? updateRoom(room.id, body) : createRoom(body);
    },
    onSaved,
    fallbackField: 'name',
  });
  return (
    <form onSubmit={submit} noValidate>
      <h2 style={{ fontSize: 19, marginBottom: 14 }}>{room ? 'Edit room' : 'New room'}</h2>
      <TextField label="Name" error={errors.name?.message} placeholder="Hive room" {...form.register('name')} />
      <SelectField
        label="Floor"
        options={office.floors.map((floor) => ({ value: String(floor.id), label: `${floor.name} · ${office.name}` }))}
        error={errors.floorId?.message}
        {...form.register('floorId')}
      />
      <TextField label="Capacity" inputMode="numeric" error={errors.capacity?.message} {...form.register('capacity')} />
      <Checkboxes legend="Equipment" options={ROOM_FEATURES} register={form.register} />
      {refusal && <Alert className="mb-3" message={refusal.message} />}
      <Buttons onCancel={onCancel} busy={mutation.isPending} label={room ? 'Save room' : 'Create room'} />
    </form>
  );
}
