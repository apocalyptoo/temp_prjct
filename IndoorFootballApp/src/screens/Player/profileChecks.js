// The checks Edit profile runs before sending (docs/features/profiles-and-registration.md,
// section e; the backend's updatePlayerProfileSchema), with the backend's own messages,
// and the values to send. Name, phone and position use the same checks as sign-up.
import { cleanPhone } from '../../utils/phone';
import {
  charCount,
  nameProblem,
  phoneProblem,
  PLAYER_NAME,
  positionProblem,
} from '../Auth/signUpCommon';

export const AREA = { min: 2, max: 40 };
export const HEIGHT = { min: 100, max: 250 };
export const WEIGHT = { min: 30, max: 200 };

// Spaces at both ends removed, every run of spaces inside made one (like the backend).
export const tidyArea = text =>
  String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ');

export function areaProblem(area) {
  const tidied = tidyArea(area);
  if (tidied === '') return null; // optional
  const length = charCount(tidied);
  return length < AREA.min || length > AREA.max
    ? `Area must be between ${AREA.min} and ${AREA.max} characters`
    : null;
}

// A height or weight as typed: empty means "not set" (null). A comma counts as a
// decimal point. Returns { value, problem }.
export function readMeasurement(text, { min, max, label, unit }) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return { value: null, problem: null };
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value)) {
    return { value: null, problem: `${label} must be a number` };
  }
  if (value < min || value > max) {
    return {
      value,
      problem: `${label} must be between ${min} and ${max} ${unit}`,
    };
  }
  return { value, problem: null };
}

// Every field's problem (null when fine), whether there's any, and the request body:
// every field each time (P11), empty optional fields as null.
export function checkProfileEdit({
  name,
  phone,
  position,
  area,
  height,
  weight,
}) {
  const heightRead = readMeasurement(height, {
    ...HEIGHT,
    label: 'Height',
    unit: 'cm',
  });
  const weightRead = readMeasurement(weight, {
    ...WEIGHT,
    label: 'Weight',
    unit: 'kg',
  });
  const errors = {
    name: nameProblem(name, PLAYER_NAME, {
      required: 'Name is required',
      label: 'Name',
    }),
    phone: phoneProblem(phone),
    position: positionProblem(position),
    area: areaProblem(area),
    height: heightRead.problem,
    weight: weightRead.problem,
  };
  const tidiedArea = tidyArea(area);
  return {
    errors,
    ok: Object.values(errors).every(problem => problem === null),
    body: {
      name: name.trim(),
      phone: cleanPhone(phone),
      position,
      height: heightRead.value,
      weight: weightRead.value,
      area: tidiedArea === '' ? null : tidiedArea,
    },
  };
}

// A stored height or weight as it's shown in a field ("172" or "172.5"), or "".
export const measurementText = value =>
  value === null || value === undefined ? '' : String(value);
