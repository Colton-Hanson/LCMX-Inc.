// The four group types the backend accepts, in the order the mockup shows them.
// `value` is what the API sends and returns; `label` is what people read.
export const GROUP_TYPES = [
  { value: 'roommate', label: 'Roommate' },
  { value: 'partner', label: 'Partner' },
  { value: 'outing', label: 'Group outing' },
  { value: 'family', label: 'Family' },
];

export const DEFAULT_GROUP_TYPE = 'outing';

// "outing" -> "Group outing". An unknown value is shown as it is.
export const typeLabel = (value) => GROUP_TYPES.find((t) => t.value === value)?.label ?? String(value ?? '');
