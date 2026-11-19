import { z } from 'zod';

// The admin forms check the same things as the server's DTOs, with the same words (BACKEND.md and
// UI-UX.md "Validation messages"). The server checks them again, plus the ones only it can know
// (a desk number that already exists, a floor name in use).

const text = (required, max = 80) =>
  z.string().trim().min(1, required).max(max, `Use at most ${max} characters.`);

export const officeSchema = z
  .object({
    name: text('Enter the office name.'),
    address: text('Enter the address.', 200),
    timeZone: z.string().min(1, 'Pick a time zone from the list, like Asia/Kolkata.'),
    opensAt: z.string(),
    closesAt: z.string(),
  })
  .refine((values) => values.closesAt > values.opensAt, {
    message: 'The closing time must be after the opening time.',
    path: ['closesAt'],
  });

export const officeEditSchema = z.object({
  name: text('Enter the office name.'),
  address: text('Enter the address.', 200),
});

export const floorSchema = z.object({ name: text('Enter the floor name.', 60) });

export const deskSchema = z.object({
  floorId: z.string().min(1, 'Pick a floor.'),
  area: text('Enter the area, like Quiet zone.', 60),
  row: z
    .string()
    .trim()
    .regex(/^[A-Za-z]$/, 'Use a single letter, like B.')
    .transform((value) => value.toUpperCase()),
  number: z.coerce.number().int('Enter a seat number from 1 to 99.').min(1, 'Enter a seat number from 1 to 99.').max(99, 'Enter a seat number from 1 to 99.'),
  features: z.array(z.string()).default([]),
});

export const roomSchema = z.object({
  floorId: z.string().min(1, 'Pick a floor.'),
  name: text('Enter the room name.'),
  capacity: z.coerce.number().int('Enter a capacity from 1 to 50.').min(1, 'Enter a capacity from 1 to 50.').max(50, 'Enter a capacity from 1 to 50.'),
  features: z.array(z.string()).default([]),
});

export const rulesSchema = z
  .object({
    opensAt: z.string(),
    closesAt: z.string(),
    bookAheadDays: z.coerce.number().int('Enter a number of days from 1 to 60.').min(1, 'Enter a number of days from 1 to 60.').max(60, 'Enter a number of days from 1 to 60.'),
    maxBookingHours: z.coerce.number().int('Enter at least 1 hour.').min(1, 'Enter at least 1 hour.'),
  })
  .refine((values) => values.closesAt > values.opensAt, {
    message: 'The closing time must be after the opening time.',
    path: ['closesAt'],
  });

/** Every half hour of the day, for the opening-hours selects ("00:00" … "23:30"). */
export const DAY_TIMES = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  return `${hours}:${index % 2 ? '30' : '00'}`;
});
