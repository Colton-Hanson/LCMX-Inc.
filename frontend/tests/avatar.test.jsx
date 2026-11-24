// Avatars show two initials, and one person is the same colour everywhere. Run with: npm test
import { render } from '@testing-library/react';
import Avatar, { avatarClass, initialsOf } from '../src/components/Avatar.jsx';

describe('initialsOf', () => {
  it('gives two letters for a first name and last initial', () => {
    expect(initialsOf('Colton H.')).toBe('CH');
    expect(initialsOf('Johnson Davis')).toBe('JD');
  });

  it('gives one letter for one word, an email, or when single is asked for', () => {
    expect(initialsOf('Bob')).toBe('B');
    expect(initialsOf('alice@example.com')).toBe('A');
    expect(initialsOf('Apartment 4B', true)).toBe('A');
  });

  it('ignores the (you) and (2) tags', () => {
    expect(initialsOf('Johnson D. (you)')).toBe('JD');
    expect(initialsOf('Alex R. (2)')).toBe('AR');
  });

  it('falls back to a question mark', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });
});

describe('avatar colour', () => {
  it('is the same for the full name, the short name and the (you) name', () => {
    expect(avatarClass('Johnson Davis')).toBe(avatarClass('Johnson D.'));
    expect(avatarClass('Johnson D.')).toBe(avatarClass('Johnson D. (you)'));
  });

  it('is one of the five colours', () => {
    ['Colton H.', 'Bob', 'Carol', 'Dave', 'x@y.z'].forEach((n) => expect(avatarClass(n)).toMatch(/^av-[1-5]$/));
  });

  it('renders the two letters and is hidden from screen readers', () => {
    const { container } = render(<Avatar text="Colton H." />);
    const el = container.querySelector('.av');
    expect(el).toHaveTextContent('CH');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveClass(avatarClass('Colton H.'));
  });
});
