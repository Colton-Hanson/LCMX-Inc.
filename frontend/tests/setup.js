// setup.js — runs once before the tests (configured in vite.config.js).
// Adds extra "matchers" like expect(element).toBeInTheDocument() / toHaveAttribute(...)
// so tests can read like plain English.
import '@testing-library/jest-dom/vitest';
// Adds expect(results).toHaveNoViolations() for the accessibility checks.
import 'vi-axe/extend-expect';
// jsdom has no canvas. The accessibility checker (vi-axe) tries to use one for its colour-contrast check and jsdom
// then prints a long "Not implemented" error each time. This quiet stand-in just says "no canvas", and the checker
// skips that one check. (Colour contrast is checked in a real browser instead.)
HTMLCanvasElement.prototype.getContext = () => null;
// jsdom has no object URLs, which the receipt picture uses.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:test-picture';
  URL.revokeObjectURL = () => {};
}
