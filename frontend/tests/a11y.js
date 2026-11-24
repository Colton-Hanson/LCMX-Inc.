// Shared accessibility check for the tests. Color contrast is turned off here because the
// test browser can't measure colors; contrast is checked by hand in a real browser.
import { axe } from 'vi-axe';

export const checkA11y = (element = document.body) => axe(element, { rules: { 'color-contrast': { enabled: false } } });
