import { useState } from 'react';

// Remembers which rows of a list are open, so one "Expand all / Collapse all" button can open or close them all.
//   isOpen(id)         is this row open
//   setOpen(id, open)  open or close one row (the row's own caret calls this)
//   allOpen(ids)       true when every row in `ids` is open (and there is at least one)
//   toggleAll(ids)     opens every row in `ids`, or closes them all when they were all open
export function useOpenSet() {
  const [open, setOpenIds] = useState(() => new Set());
  const isOpen = (id) => open.has(id);
  const setOpen = (id, value) =>
    setOpenIds((set) => {
      if (set.has(id) === value) return set; // nothing changed
      const next = new Set(set);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  const allOpen = (ids) => ids.length > 0 && ids.every((id) => open.has(id));
  const toggleAll = (ids) => setOpenIds(allOpen(ids) ? new Set() : new Set(ids));
  return { isOpen, setOpen, allOpen, toggleAll };
}
