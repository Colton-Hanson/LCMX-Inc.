// setup.js — runs once before the tests (configured in vite.config.js).
// Adds extra "matchers" like expect(element).toBeInTheDocument() / toHaveAttribute(...)
// so tests can read like plain English.
import '@testing-library/jest-dom/vitest';
// Adds expect(results).toHaveNoViolations() for the accessibility checks.
import 'vi-axe/extend-expect';
// jsdom has no object URLs, which the receipt picture uses.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:test-picture';
  URL.revokeObjectURL = () => {};
}
