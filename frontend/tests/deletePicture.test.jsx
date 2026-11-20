// Tests for the mini receipt and deleting the receipt picture (SCRUM-137). The API modules are mocked.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import * as receiptsApi from '../src/api/receipts.js';
import * as proposedApi from '../src/api/proposed.js';
import DeletePicture, { KEEP_RULE } from '../src/components/receipt/DeletePicture.jsx';
import MiniReceipt from '../src/components/receipt/MiniReceipt.jsx';
import PictureSection, { canDeletePicture } from '../src/components/receipt/PictureSection.jsx';
import { slipDate, slipLines } from '../src/lib/receiptMath.js';
import { checkA11y } from './a11y.js';
import { renderApp, findAlert, me, ok, fail, network } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');
vi.mock('../src/api/receipts.js');
vi.mock('../src/api/proposed.js', async (original) => ({ ...(await original()), deleteReceiptPicture: vi.fn() }));

const items = [
  { id: 1, name: 'Oat milk', quantity: 1, unit_price: '4.79', line_total: '4.79', position: 0 },
  { id: 2, name: 'Pasta', quantity: 2, unit_price: '2.19', line_total: '4.38', position: 1 },
];
const receipt = { id: 9, group_id: 5, uploader: 1, expense_id: null, status: 'read', store: 'Corner Market', store_location: null, receipt_date: '2026-10-03', items };
const notBuilt = fail(405, { detail: 'Method Not Allowed' });
const picture = { ok: true, status: 200, blob: new Blob(['jpeg'], { type: 'image/jpeg' }) };
const removed = fail(404, { detail: 'Receipt picture was removed.' });
const deleted = ok({ receipt_id: 9, picture_deleted: true, expense_id: null });

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  localStorage.setItem('groups:1', JSON.stringify([{ id: 5, name: 'Lake House', type: 'outing' }]));
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok([{ user_id: 1, email: me.email, is_admin: false }]));
  receiptsApi.getReceipt.mockResolvedValue(ok(receipt));
  receiptsApi.getReceiptPicture.mockResolvedValue(picture);
  proposedApi.deleteReceiptPicture.mockResolvedValue(deleted);
});

describe('Mini receipt', () => {
  it('builds the printed lines, with quantity and price when there is more than one', () => {
    expect(slipLines(items)).toEqual([
      { key: 1, label: 'OAT MILK', amount: '4.79' },
      { key: 2, label: 'PASTA  2 @ 2.19', amount: '4.38' },
    ]);
  });

  it('gives a line a name when the item has none', () => {
    expect(slipLines([{ name: null, quantity: 1, unit_price: '1.00', line_total: '1.00' }])[0].label).toBe('ITEM 1');
  });

  it('writes the date the short way', () => {
    expect(slipDate('2026-10-03')).toBe('10/03/26');
    expect(slipDate('soon')).toBe('');
  });

  it('shows the store, the date, each line and the total, with a name for screen readers', () => {
    render(<MiniReceipt store="Corner Market" date="10/03/26" lines={slipLines(items)} total="9.17" />);
    const slip = screen.getByRole('group', { name: 'Receipt: Corner Market, 10/03/26, 2 items, total 9.17' });
    expect(within(slip).getByText('CORNER MARKET')).toBeInTheDocument();
    expect(within(slip).getByText('PASTA 2 @ 2.19')).toBeInTheDocument();
    expect(within(slip).getByText('TOTAL')).toBeInTheDocument();
    expect(within(slip).getByText('9.17')).toBeInTheDocument();
  });

  it('has no accessibility problems, short or long', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ key: i, label: `ITEM ${i}`, amount: '1.00' }));
    render(<main><MiniReceipt store="" lines={many} total="12.00" /></main>);
    expect(screen.getByRole('group', { name: 'Receipt items, scrolls' })).toHaveAttribute('tabindex', '0');
    expect(await checkA11y()).toHaveNoViolations();
  });
});

describe('Delete receipt picture', () => {
  const setup = (props = {}) => {
    const remove = props.remove ?? vi.fn().mockResolvedValue(ok(null, 204));
    const onExpired = vi.fn();
    render(<main><DeletePicture receiptId={9} remove={remove} onExpired={onExpired} {...props} /></main>);
    return { user: userEvent.setup(), remove, onExpired };
  };
  const open = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Delete receipt picture' }));
    return screen.getByRole('dialog', { name: 'Delete the receipt picture?' });
  };

  it('shows the 7 day keep rule', () => {
    setup();
    expect(screen.getByText(KEEP_RULE)).toBeInTheDocument();
    expect(KEEP_RULE).toMatch(/kept for 7 days/);
    expect(KEEP_RULE).toMatch(/marked abandoned/);
  });

  it('says in the dialog that the picture is deleted and all items are kept', async () => {
    const { user, remove } = setup();
    const dialog = await open(user);
    expect(dialog).toHaveAccessibleDescription('The saved picture is deleted for good. All the items are kept, so nothing else changes.');
    expect(within(dialog).getByRole('button', { name: 'Keep it' })).toHaveFocus();
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes the picture and says the items are kept', async () => {
    const { user, remove } = setup();
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete picture' }));
    expect(remove).toHaveBeenCalledWith(9);
    const done = await screen.findByText('Picture deleted. All items are kept.');
    expect(done.closest('[role="status"]')).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete receipt picture' })).not.toBeInTheDocument();
  });

  it('keeps the picture on Keep it and on Escape, and gives focus back', async () => {
    const { user, remove } = setup();
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await open(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete receipt picture' })).toHaveFocus();
    expect(remove).not.toHaveBeenCalled();
  });

  it('works with the keyboard only', async () => {
    const { user, remove } = setup();
    await user.tab();
    await user.keyboard('{Enter}');
    const dialog = screen.getByRole('dialog');
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Delete picture' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('shows a calm not available note and turns the button off when the server cannot delete yet', async () => {
    const { user } = setup({ remove: vi.fn().mockResolvedValue(notBuilt) });
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete picture' }));
    const note = await within(dialog).findByText('Deleting the picture isn’t available yet. Nothing was deleted.');
    expect(note.closest('[role="status"]')).toBeInTheDocument();
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    const button = within(dialog).getByRole('button', { name: 'Delete picture' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Deleting the picture isn’t available yet. Nothing was deleted.');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('shows the server message when it fails', async () => {
    const { user } = setup({ remove: vi.fn().mockResolvedValue(fail(409, { detail: 'This picture is already gone.' })) });
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete picture' }));
    expect(await findAlert('This picture is already gone.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete picture' })).toBeEnabled();
  });

  // Changed for the real backend: only a network failure, 405 or 501 counts as "not available".
  it('shows the not available note when the server cannot be reached', async () => {
    const { user } = setup({ remove: vi.fn().mockResolvedValue(network) });
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete picture' }));
    expect(await within(dialog).findByText('Deleting the picture isn’t available yet. Nothing was deleted.')).toBeInTheDocument();
  });

  it('shows the server message for a real 404 or 403 instead of "not available"', async () => {
    const { user } = setup({ remove: vi.fn().mockResolvedValue(fail(403, { detail: 'Only the receipt uploader or a group administrator can manage this receipt.' })) });
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete picture' }));
    expect(await findAlert('Only the receipt uploader or a group administrator can manage this receipt.')).toBeInTheDocument();
    expect(within(dialog).queryByText(/isn’t available yet/)).not.toBeInTheDocument();
  });

  it('tells the page when the login has ended', async () => {
    const { user, onExpired } = setup({ remove: vi.fn().mockResolvedValue(fail(401)) });
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete picture' }));
    expect(onExpired).toHaveBeenCalled();
  });

  it('has no accessibility problems, closed, open and after deleting', async () => {
    const { user } = setup();
    expect(await checkA11y()).toHaveNoViolations();
    const dialog = await open(user);
    expect(await checkA11y()).toHaveNoViolations();
    await user.click(within(dialog).getByRole('button', { name: 'Delete picture' }));
    await screen.findByText('Picture deleted. All items are kept.');
    expect(await checkA11y()).toHaveNoViolations();
  });
});

describe('Who may delete the picture', () => {
  it('is the uploader or a group admin, and only once reading is over', () => {
    const base = { id: 9, uploader: 1, status: 'read' };
    expect(canDeletePicture({ receipt: base, myId: 1, isAdmin: false })).toBe(true);
    expect(canDeletePicture({ receipt: base, myId: 2, isAdmin: true })).toBe(true);
    expect(canDeletePicture({ receipt: base, myId: 2, isAdmin: false })).toBe(false);
    expect(canDeletePicture({ receipt: { ...base, status: 'confirmed' }, myId: 1 })).toBe(true);
    expect(canDeletePicture({ receipt: { ...base, status: 'uploaded' }, myId: 1, isAdmin: true })).toBe(false);
    expect(canDeletePicture({ receipt: { ...base, status: 'reading' }, myId: 1, isAdmin: true })).toBe(false);
  });
});

describe('Receipt picture', () => {
  const show = (props = {}) =>
    render(<main><PictureSection receipt={receipt} myId={1} isAdmin={false} load={receiptsApi.getReceiptPicture} remove={proposedApi.deleteReceiptPicture} {...props} /></main>);

  it('shows the picture with alt text, and the delete button for the uploader', async () => {
    show();
    expect(await screen.findByRole('img', { name: 'Photo of the receipt from Corner Market' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Delete receipt picture' })).toBeInTheDocument();
    expect(receiptsApi.getReceiptPicture).toHaveBeenCalledWith(9);
  });

  it('hides the delete button from someone who is not the uploader or an admin', async () => {
    show({ myId: 2 });
    await screen.findByRole('img', { name: 'Photo of the receipt from Corner Market' });
    expect(screen.queryByRole('button', { name: 'Delete receipt picture' })).not.toBeInTheDocument();
  });

  it('shows Picture removed, and no delete button, when the server says it is gone', async () => {
    receiptsApi.getReceiptPicture.mockResolvedValue(removed);
    show();
    expect(await screen.findByRole('img', { name: 'Picture removed. The items are kept.' })).toHaveTextContent('Picture removed');
    expect(screen.queryByRole('button', { name: 'Delete receipt picture' })).not.toBeInTheDocument();
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('switches to Picture removed after deleting', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Delete receipt picture' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete picture' }));
    expect(await screen.findByText('Picture deleted. All items are kept.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Picture removed. The items are kept.' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Photo of the receipt/ })).not.toBeInTheDocument();
    expect(await checkA11y()).toHaveNoViolations();
  });
});

describe('Receipt status screen', () => {
  it('shows the mini receipt and the delete button once the receipt is read', async () => {
    const user = userEvent.setup();
    renderApp('/receipts/9');
    expect(await screen.findByRole('group', { name: 'Receipt: Corner Market, 10/03/26, 2 items, total 9.17' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Delete receipt picture' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete picture' }));
    expect(proposedApi.deleteReceiptPicture).toHaveBeenCalledWith(9); // the id from the receipt itself
    expect(await screen.findByText('Picture deleted. All items are kept.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Picture removed. The items are kept.' })).toBeInTheDocument();
  });

  it('gives the delete button to a group admin who did not upload it, and not to other members', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok({ ...receipt, uploader: 2 }));
    groupsApi.getMembers.mockResolvedValue(ok([{ user_id: 1, email: me.email, is_admin: true }]));
    const first = renderApp('/receipts/9');
    expect(await screen.findByRole('button', { name: 'Delete receipt picture' })).toBeInTheDocument();
    first.unmount();
    groupsApi.getMembers.mockResolvedValue(ok([{ user_id: 1, email: me.email, is_admin: false }]));
    renderApp('/receipts/9');
    await screen.findByRole('img', { name: 'Photo of the receipt from Corner Market' });
    expect(screen.queryByRole('button', { name: 'Delete receipt picture' })).not.toBeInTheDocument();
  });

  it('shows the keep rule while the receipt is being read', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok({ ...receipt, status: 'uploaded', items: [] }));
    renderApp('/receipts/9');
    expect(await screen.findByText(KEEP_RULE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete receipt picture' })).not.toBeInTheDocument();
  });

  it('says an abandoned receipt was abandoned and offers to upload it again', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok({ ...receipt, status: 'abandoned', items: [] }));
    renderApp('/receipts/9');
    expect(await screen.findByText('This receipt was abandoned')).toBeInTheDocument();
    expect(screen.getByText(/wasn’t saved to an expense within 7 days/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload it again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Check the items' })).not.toBeInTheDocument();
    expect(receiptsApi.getReceipt).toHaveBeenCalledTimes(1);
    expect(await checkA11y()).toHaveNoViolations();
  });
});
