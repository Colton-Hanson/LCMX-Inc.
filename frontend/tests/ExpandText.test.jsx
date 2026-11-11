// Tests for the one-line note with the caret.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExpandText from '../src/components/receipt/ExpandText.jsx';

// jsdom has no layout, so the widths are set by hand to fake a cut-off line.
function setWidths(scroll, client) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => scroll });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => client });
}

afterEach(() => {
  delete HTMLElement.prototype.scrollWidth;
  delete HTMLElement.prototype.clientWidth;
});

describe('ExpandText', () => {
  it('shows no caret when the text fits', () => {
    setWidths(100, 100);
    render(<ExpandText>short.jpg</ExpandText>);
    expect(screen.getByText('short.jpg')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a caret when the text is cut off, and the caret opens and folds the full text', async () => {
    setWidths(500, 100);
    const user = userEvent.setup();
    render(<ExpandText>a-very-long-receipt-file-name-from-the-corner-market-october.jpg</ExpandText>);

    const text = screen.getByText(/a-very-long-receipt-file-name/); // full text is always on the page
    expect(text).toHaveClass('is-clip');
    const caret = screen.getByRole('button', { name: 'Show the full text' });
    expect(caret).toHaveAttribute('aria-expanded', 'false');

    await user.click(caret);
    expect(text).toHaveClass('is-open');
    const fold = screen.getByRole('button', { name: 'Show less' });
    expect(fold).toHaveAttribute('aria-expanded', 'true');

    await user.click(fold);
    expect(text).toHaveClass('is-clip');
  });
});
