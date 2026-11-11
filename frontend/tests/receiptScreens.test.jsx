// Tests for scanning a receipt: Home pop-up, upload, reading, summary, error cards and the placeholder. APIs are mocked.

import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as authApi from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import * as receiptsApi from '../src/api/receipts.js';
import { renderApp, findAlert, me, ok, fail, network } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');
vi.mock('../src/api/receipts.js');

const lake = { id: 5, name: 'Lake House', type: 'outing' };
const flat = { id: 6, name: 'Apartment 4B', type: 'roommate' };
const saveGroups = (...list) => localStorage.setItem('groups:1', JSON.stringify(list));

const saved = { id: 9, group_id: 5, uploader: 1, status: 'uploaded', file_type: 'image/jpeg', size: 3 };
const readReceipt = {
  ...saved,
  status: 'read',
  store: 'Corner Market',
  receipt_date: '2026-10-03',
  items: [
    { name: 'Milk', quantity: 1, unit_price: '3.50', line_total: '3.50' },
    { name: 'Bread', quantity: 2, unit_price: '2.25', line_total: '4.50' },
  ],
};
const picture = () => new File(['abc'], 'corner-market.jpg', { type: 'image/jpeg' });

// Fake upload that finishes with this result. abort is a spy so tests can see a cancel.
const finishedUpload = (result) => ({ promise: Promise.resolve(result), abort: vi.fn() });

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  saveGroups(lake, flat);
  authApi.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  receiptsApi.getReceipt.mockResolvedValue(ok(saved));
});

describe('Scan a receipt pop-up on Home', () => {
  it('asks for the group and opens the upload screen for the chosen one', async () => {
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: /Scan a receipt/ }));

    const dialog = await screen.findByRole('dialog');
    const group = within(dialog).getByLabelText('Group');
    expect(group).toHaveValue('5');
    await user.selectOptions(group, 'Apartment 4B');
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Choose your receipt' })).toBeInTheDocument();
    expect(screen.getByLabelText('Group')).toHaveValue('6');
    expect(screen.getByText('Nothing uploaded yet')).toBeInTheDocument();
  });

  it('closes with Cancel and stays on Home', async () => {
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: /Scan a receipt/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scan a receipt/ })).toBeInTheDocument();
  });

  it('asks for a group first when there are none', async () => {
    saveGroups();
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: /Scan a receipt/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Create a group first, then add expenses to it.')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Create group' })).toHaveAttribute('href', '/groups/new');
    expect(within(dialog).queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });
});

describe('Upload screen', () => {
  it('goes back to Home when it is opened without a group, or with one the user does not have', async () => {
    renderApp('/receipts/new');
    expect(await screen.findByRole('heading', { level: 1, name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument();
  });

  it('goes back to Home for an unknown group', async () => {
    renderApp('/receipts/new?group=999');
    expect(await screen.findByRole('heading', { level: 1, name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument();
  });

  it('uploads the picked file with the chosen group, then shows the reading screen for that receipt', async () => {
    receiptsApi.uploadReceipt.mockReturnValue(finishedUpload(ok(saved, 201)));
    const user = userEvent.setup();
    renderApp('/receipts/new?group=5');
    await screen.findByRole('heading', { name: 'Choose your receipt' });

    await user.selectOptions(screen.getByLabelText('Group'), 'Apartment 4B'); // group can still change before a file is picked
    await user.upload(screen.getByTestId('file-input'), picture());

    expect(receiptsApi.uploadReceipt).toHaveBeenCalledTimes(1);
    const sent = receiptsApi.uploadReceipt.mock.calls[0][0];
    expect(sent.groupId).toBe(6);
    expect(sent.file.name).toBe('corner-market.jpg');

    expect(await screen.findByText('The AI is reading it')).toBeInTheDocument();
    expect(screen.getByText('Upload successful')).toBeInTheDocument();
    expect(screen.getByText('corner-market.jpg')).toBeInTheDocument();
    expect(receiptsApi.getReceipt).toHaveBeenCalledWith('9');
  });

  it('shows a progress ring with the percent while the file is sent', async () => {
    let onProgress;
    receiptsApi.uploadReceipt.mockImplementation((args) => {
      onProgress = args.onProgress;
      return { promise: new Promise(() => {}), abort: vi.fn() };
    });
    const user = userEvent.setup();
    renderApp('/receipts/new?group=5');
    await screen.findByRole('heading', { name: 'Choose your receipt' });
    await user.upload(screen.getByTestId('file-input'), picture());

    act(() => onProgress(40));
    const ring = await screen.findByRole('progressbar', { name: 'Upload progress' });
    expect(ring).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('Uploading… 40%')).toBeInTheDocument();
    expect(screen.getByLabelText('Group')).toBeDisabled(); // locked once the upload starts
  });

  it('cancelling an upload in progress stops it, forgets the file and stays on the screen', async () => {
    const abort = vi.fn();
    receiptsApi.uploadReceipt.mockReturnValue({ promise: new Promise(() => {}), abort });
    const user = userEvent.setup();
    renderApp('/receipts/new?group=5');
    await screen.findByRole('heading', { name: 'Choose your receipt' });
    await user.upload(screen.getByTestId('file-input'), picture());
    await screen.findByRole('progressbar');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(abort).toHaveBeenCalled();
    expect(await screen.findByText('Nothing uploaded yet')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Group')).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Choose your receipt' })).toBeInTheDocument(); // still on the upload screen
  });

  it('a failed upload offers Try again and Choose another file, and no Cancel', async () => {
    receiptsApi.uploadReceipt.mockReturnValue(finishedUpload(network));
    const user = userEvent.setup();
    renderApp('/receipts/new?group=5');
    await screen.findByRole('heading', { name: 'Choose your receipt' });
    await user.upload(screen.getByTestId('file-input'), picture());
    await findAlert('Upload failed');

    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('shows the cause and the fix when the server refuses the file, and Try again sends it again', async () => {
    const refusal = fail(415, { detail: { code: 'wrong_format', message: 'Only JPEG and PDF receipts are supported.', action: 'Choose a .jpg, .jpeg, or .pdf file.' } });
    receiptsApi.uploadReceipt.mockImplementation(() => finishedUpload(refusal));
    const user = userEvent.setup({ applyAccept: false }); // a real browser lets you pick any file
    renderApp('/receipts/new?group=5');
    await screen.findByRole('heading', { name: 'Choose your receipt' });
    await user.upload(screen.getByTestId('file-input'), new File(['x'], 'notes.txt', { type: 'text/plain' }));

    const alert = await findAlert('Upload failed');
    expect(alert).toHaveTextContent('Only JPEG and PDF receipts are supported.');
    expect(alert).toHaveTextContent('Choose a .jpg, .jpeg, or .pdf file.');
    expect(alert).toHaveTextContent('notes.txt');
    await waitFor(() => expect(screen.getByText('Upload failed')).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(receiptsApi.uploadReceipt).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument();
  });

  it('explains a lost connection', async () => {
    receiptsApi.uploadReceipt.mockReturnValue(finishedUpload(network));
    const user = userEvent.setup();
    renderApp('/receipts/new?group=5');
    await screen.findByRole('heading', { name: 'Choose your receipt' });
    await user.upload(screen.getByTestId('file-input'), picture());
    const alert = await findAlert('Upload failed');
    expect(alert).toHaveTextContent(/connection|reach/i);
  });
});

describe('Reading and summary screen', () => {
  it('shows the AI is reading while the receipt is waiting, with the timer', async () => {
    renderApp('/receipts/9', { fileName: 'corner-market.jpg' });
    expect(await screen.findByText('The AI is reading it')).toBeInTheDocument();
    expect(screen.getByText(/Time so far: 0:0\d/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('The AI is reading your receipt');
    expect(screen.queryByRole('link', { name: 'Check the items' })).not.toBeInTheDocument();
    // file buttons are off while it reads
    expect(screen.getByRole('button', { name: 'Choose a file' })).toBeDisabled();
  });

  it('shows the store, date, item count and total once it is read, and Check the items opens the placeholder page', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok(readReceipt));
    const user = userEvent.setup();
    renderApp('/receipts/9', { fileName: 'corner-market.jpg' });

    expect(await screen.findByText('The AI finished reading it')).toBeInTheDocument();
    const found = screen.getByLabelText('What the AI found');
    expect(found).toHaveTextContent('StoreCorner Market');
    expect(found).toHaveTextContent('DateOct 3, 2026');
    expect(found).toHaveTextContent('Items2 found');
    expect(found).toHaveTextContent('Total$8.00');
    expect(screen.getByRole('status')).toHaveTextContent('Done: 2 items found');

    const check = screen.getByRole('link', { name: 'Check the items' });
    expect(check).toHaveAttribute('href', '/receipts/9/review');
    await user.click(check);

    expect(await screen.findByRole('heading', { level: 2, name: 'Check the items' })).toBeInTheDocument();
    expect(screen.getByText(/This screen comes next/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the receipt' })).toHaveAttribute('href', '/receipts/9');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/home');
  });

  it('says so when the AI could not read the receipt and offers another try', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok({ ...saved, status: 'failed' }));
    renderApp('/receipts/9');

    const alert = await findAlert('The AI couldn’t read this receipt');
    expect(alert).toHaveTextContent('Try another picture or take a new photo.');
    expect(screen.getByRole('button', { name: 'Try another picture' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Take a new photo' })).toBeEnabled();
    const card = alert.closest('section');
    expect(within(card).getByText('Upload successful')).toBeInTheDocument(); // upload row stays
    expect(within(card).queryByRole('link', { name: 'Enter by hand' })).not.toBeInTheDocument(); // the toggle already has it
    expect(within(card).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('uploads a new picture from the could-not-read screen and moves to its receipt', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok({ ...saved, status: 'failed' }));
    receiptsApi.uploadReceipt.mockReturnValue(finishedUpload(ok({ ...saved, id: 10 }, 201)));
    const user = userEvent.setup();
    renderApp('/receipts/9');
    await findAlert('The AI couldn’t read this receipt');

    receiptsApi.getReceipt.mockResolvedValue(ok({ ...saved, id: 10 }));
    await user.upload(screen.getByTestId('file-input'), picture());
    expect(receiptsApi.uploadReceipt.mock.calls[0][0].groupId).toBe(5); // same group as the receipt
    await waitFor(() => expect(receiptsApi.getReceipt).toHaveBeenCalledWith('10'));
    expect(await screen.findByText('The AI is reading it')).toBeInTheDocument();
  });

  it('sends the user back to Home when the receipt is not found', async () => {
    receiptsApi.getReceipt.mockResolvedValue(fail(404, { detail: 'Receipt not found.' }));
    renderApp('/receipts/404');
    expect(await screen.findByRole('heading', { level: 1, name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument();
    expect(screen.queryByText('We couldn’t open this receipt')).not.toBeInTheDocument();
  });

  it('Cancel while the AI is reading resets the screen without leaving it, and stops checking', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderApp('/receipts/9', { fileName: 'corner-market.jpg' });
      expect(await screen.findByText('The AI is reading it')).toBeInTheDocument();
      const checks = receiptsApi.getReceipt.mock.calls.length;

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(await screen.findByText('Nothing uploaded yet')).toBeInTheDocument();
      expect(screen.queryByText('The AI is reading it')).not.toBeInTheDocument();
      expect(screen.queryByText('corner-market.jpg')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Choose your receipt' })).toBeInTheDocument(); // didn't leave the page
      expect(document.querySelector('[aria-current="step"]')).toHaveTextContent('Upload');
      expect(screen.getByRole('button', { name: 'Choose a file' })).toBeEnabled();
      expect(screen.getByLabelText('Group')).toBeEnabled();
      expect(screen.getByRole('status')).toHaveTextContent('Cancelled');
      await waitFor(() => expect(screen.getByText('Upload status')).toHaveFocus());

      await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
      expect(receiptsApi.getReceipt.mock.calls.length).toBe(checks); // no more checks after Cancel
    } finally {
      vi.useRealTimers();
    }
  });

  it('after Cancel a new picture uploads and its own receipt is checked', async () => {
    receiptsApi.uploadReceipt.mockReturnValue(finishedUpload(ok({ ...saved, id: 10 }, 201)));
    const user = userEvent.setup();
    renderApp('/receipts/9');
    await screen.findByText('The AI is reading it');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByText('Nothing uploaded yet');

    receiptsApi.getReceipt.mockResolvedValue(ok({ ...saved, id: 10 }));
    await user.upload(screen.getByTestId('file-input'), picture());
    expect(receiptsApi.uploadReceipt.mock.calls[0][0].groupId).toBe(5);
    expect(await screen.findByText('The AI is reading it')).toBeInTheDocument();
    expect(receiptsApi.getReceipt).toHaveBeenCalledWith('10');
  });
});

describe('Check the items placeholder', () => {
  it('opens directly from its address with the third step current', async () => {
    renderApp('/receipts/9/review');
    expect(await screen.findByRole('heading', { level: 2, name: 'Check the items' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Add expense' })).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent('Check and assign');
  });
});
