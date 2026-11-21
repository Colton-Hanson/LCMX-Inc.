// The people list in the receipt review is a grid of equal boxes (5 across, 3 on a tablet, 2 on a phone). Run with: npm test

import { readFileSync } from 'node:fs';

const css = readFileSync('src/sprint7.css', 'utf8');

describe('People picker grid', () => {
  it('is 5 equal columns with a 6px gap', () => {
    const rule = css.match(/\.pk-list \{[^}]*\}/)[0];
    expect(rule).toContain('display: grid');
    expect(rule).toContain('repeat(5, minmax(0, 1fr))');
    expect(rule).toContain('gap: 6px');
  });

  it('is 3 columns on a tablet', () => {
    const tablet = css.match(/@media \(max-width: 900px\) \{\s*\.pk-list \{[^}]*\}/)[0];
    expect(tablet).toContain('repeat(3, minmax(0, 1fr))');
  });

  it('is 2 columns on a phone, including a 428px iPhone Pro Max', () => {
    const phone = css.match(/@media \(max-width: 560px\) \{\s*\.pk-list \{[^}]*\}/)[0];
    expect(phone).toContain('repeat(2, minmax(0, 1fr))');
  });
});
