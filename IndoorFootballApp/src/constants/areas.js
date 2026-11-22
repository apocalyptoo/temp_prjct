// Common areas, suggested while a player types their Area (docs/features/profiles-and-
// registration.md, P5 and P6). Any other text is still allowed: this list only helps
// people spell the common names the same way. The venues feature reuses it for venue
// areas. The backend doesn't know this list (filtering works on the stored text).
export const AREAS = [
  // Dhaka
  'Adabor',
  'Aftabnagar',
  'Agargaon',
  'Badda',
  'Banani',
  'Banasree',
  'Baridhara',
  'Bashundhara',
  'Cantonment',
  'Demra',
  'Dhanmondi',
  'Farmgate',
  'Gulshan',
  'Hazaribagh',
  'Jatrabari',
  'Kafrul',
  'Kalabagan',
  'Keraniganj',
  'Khilgaon',
  'Khilkhet',
  'Lalbagh',
  'Lalmatia',
  'Malibagh',
  'Mirpur',
  'Mohakhali',
  'Mohammadpur',
  'Motijheel',
  'Niketan',
  'Nikunja',
  'Old Dhaka',
  'Pallabi',
  'Rampura',
  'Savar',
  'Shahbagh',
  'Shantinagar',
  'Shyamoli',
  'Tejgaon',
  'Uttara',
  'Wari',
  // Nearby
  'Gazipur',
  'Narayanganj',
  'Tongi',
  // Other cities
  'Barishal',
  'Chattogram',
  'Cumilla',
  'Khulna',
  'Mymensingh',
  'Rajshahi',
  'Rangpur',
  'Sylhet',
];

export const MAX_SUGGESTIONS = 5;

const byName = (a, b) => a.localeCompare(b);

// Up to `limit` areas matching what was typed, ignoring upper/lower case and spaces at
// both ends: names that start with it first, then names that contain it, each group
// A–Z. Nothing for empty text, or once the text is exactly one of the names (it's been
// picked or typed in full).
export function suggestAreas(
  text,
  { areas = AREAS, limit = MAX_SUGGESTIONS } = {},
) {
  const typed = String(text ?? '')
    .trim()
    .toLowerCase();
  if (typed === '') return [];
  if (areas.some(name => name.toLowerCase() === typed)) return [];
  const starts = [];
  const contains = [];
  for (const name of areas) {
    const lower = name.toLowerCase();
    if (lower.startsWith(typed)) starts.push(name);
    else if (lower.includes(typed)) contains.push(name);
  }
  return [...starts.sort(byName), ...contains.sort(byName)].slice(0, limit);
}
