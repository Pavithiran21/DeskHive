import { zodResolver } from '@hookform/resolvers/zod';
import { IconAdjustments } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { saveRules } from '../../api/admin';
import { keys, queryClient } from '../../api/queryClient';
import { SelectField, TextField } from '../../components/Fields';
import { Alert, EmptyState, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { useOffices } from '../../hooks/useOffices';
import { usePageTitle } from '../../hooks/usePageTitle';
import { applyFieldErrors } from '../../lib/apiErrors';
import { formatTime, hhmm } from '../../lib/time';
import { useToast } from '../../toast/ToastContext';
import { DAY_TIMES, rulesSchema } from './adminSchemas';

const TIME_OPTIONS = DAY_TIMES.map((time) => ({ value: time, label: formatTime(time) }));

function RulesForm({ office }) {
  const { showToast } = useToast();
  const [refusal, setRefusal] = useState(null);
  const { rules } = office;
  const form = useForm({
    resolver: zodResolver(rulesSchema),
    defaultValues: {
      opensAt: hhmm(rules.opensAt),
      closesAt: hhmm(rules.closesAt),
      bookAheadDays: String(rules.bookAheadDays),
      maxBookingHours: String(rules.maxBookingHours),
    },
  });
  const { errors } = form.formState;
  const mutation = useMutation({
    mutationFn: (values) => saveRules(office.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.offices });
      showToast({ message: 'Rules saved. New bookings follow them.', Icon: IconAdjustments });
      form.reset(form.getValues());
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError)) setRefusal(error);
    },
  });

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        setRefusal(null);
        mutation.mutate(values);
      })}
    >
      <div className="time-pick">
        <div>
          <SelectField label={`Opens (${office.timeZoneName})`} options={TIME_OPTIONS} error={errors.opensAt?.message} {...form.register('opensAt')} />
        </div>
        <div>
          <SelectField label={`Closes (${office.timeZoneName})`} options={TIME_OPTIONS} error={errors.closesAt?.message} {...form.register('closesAt')} />
        </div>
      </div>
      <div className="time-pick">
        <div>
          <TextField label="Book ahead (days)" inputMode="numeric" error={errors.bookAheadDays?.message} {...form.register('bookAheadDays')} />
        </div>
        <div>
          <TextField label="Longest booking (hours)" inputMode="numeric" error={errors.maxBookingHours?.message} {...form.register('maxBookingHours')} />
        </div>
      </div>
      <p className="muted xs" style={{ margin: '-4px 0 14px' }}>
        One desk per person per day always applies. Changes apply to new bookings; existing ones stay.
      </p>
      {refusal && <Alert className="mb-3" message={refusal.message} />}
      <button type="submit" className="btn btn-dark btn-block" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save rules'}
      </button>
    </form>
  );
}

/** /admin/rules: opening hours, how far ahead and how long, per office, in the office's time zone. */
export function RulesPage() {
  usePageTitle('Booking rules');
  const offices = useOffices();
  const [params, setParams] = useSearchParams();
  const officeFieldId = useId();

  if (offices.isPending) return <Skeleton label="Loading the rules…" />;
  if (offices.isError) return <ErrorPanel error={offices.error} onRetry={() => offices.refetch()} />;
  const list = offices.data;
  if (!list.length) {
    return (
      <EmptyState logo title="Set up your first office" text="Booking rules belong to an office.">
        <Link to="/admin/spaces?new=office" className="btn btn-cta">
          Add your first office
        </Link>
      </EmptyState>
    );
  }
  const office = list.find((entry) => String(entry.id) === params.get('office')) ?? list[0];

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 14 }}>Booking rules</h1>
      <div className="card pad" style={{ maxWidth: 560 }}>
        <label htmlFor={officeFieldId}>Office</label>
        <select
          id={officeFieldId}
          className="inp"
          value={office.id}
          onChange={(event) => setParams({ office: event.target.value }, { replace: true })}
        >
          {list.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} ({entry.timeZoneName})
            </option>
          ))}
        </select>
        {/* key: a new form (with that office's values) for each office. */}
        <RulesForm key={office.id} office={office} />
      </div>
    </>
  );
}
