import { useId } from 'react';

/** Office (each with its time zone) and floor, as native radio lists. */
export function WherePicker({ offices, officeId, floorId, onChange }) {
  const officeName = useId();
  const floorName = useId();
  const office = offices.find((entry) => entry.id === officeId);
  return (
    <>
      <fieldset className="radio-list" style={{ marginBottom: 6 }}>
        <legend className="flabel" style={{ marginBottom: 8 }}>
          Office
        </legend>
        {offices.map((entry) => (
          <label key={entry.id}>
            <input
              type="radio"
              name={officeName}
              checked={entry.id === officeId}
              onChange={() => onChange({ officeId: entry.id, floorId: null })}
            />
            <span>
              {entry.name}
              <small>
                Times in {entry.timeZoneName} ({entry.timeZone})
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      {office && office.floors.length > 0 && (
        <fieldset className="radio-list">
          <legend className="flabel" style={{ marginBottom: 8 }}>
            Floor
          </legend>
          <div className="g3" style={{ gap: 8 }}>
            <label>
              <input type="radio" name={floorName} checked={floorId === 'all'} onChange={() => onChange({ floorId: null })} />
              All
            </label>
            {office.floors.map((floor) => (
              <label key={floor.id}>
                <input
                  type="radio"
                  name={floorName}
                  checked={String(floor.id) === String(floorId)}
                  onChange={() => onChange({ floorId: floor.id })}
                />
                {floor.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
}
