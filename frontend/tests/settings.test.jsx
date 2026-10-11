// Tests for the Settings page: loading, profile and email change, password change, notifications, expired session.
// The API module is mocked, so no backend is needed. Run with: npm test

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import SettingsPage from '../src/pages/SettingsPage.jsx';
import RequireAuth from '../src/components/RequireAuth.jsx';
import * as api from '../src/api/auth.js';

vi.mock('../src/api/auth.js');

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="/login" element={<h1>LOGIN PAGE</h1>} />
        <Route path="/home" element={<h1>HOME PAGE</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

const profile = {
  id: 1,
  name: 'Cole',
  email: 'cole@umkc.edu',
  photo_url: null,
  notify_group_invite: true,
  notify_new_expense: true,
  notify_settlement: false,
  notify_removed_from_group: true,
  email_verified: true,
  pending_email: null,
};
const ok = (data) => ({ ok: true, status: 200, data });

// The password form stays hidden until "Change password" is pressed.
async function openPasswordForm(user) {
  await user.click(await screen.findByRole('button', { name: 'Change password' }));
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getProfile.mockResolvedValue(ok(profile));
});

describe('Settings page', () => {
  it('shows the three sections with the saved values', async () => {
    renderSettings();
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Password' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Cole');
    expect(screen.getByLabelText('Email')).toHaveValue('cole@umkc.edu');
    expect(screen.getByLabelText('Someone marks a payment as paid')).not.toBeChecked();
    expect(screen.getByLabelText('Someone invites me to a group')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Upload a photo' })).toBeDisabled();
  });

  it('sends a 401 from the profile load to the login page', async () => {
    api.getProfile.mockResolvedValue({ ok: false, status: 401, data: { detail: 'Authentication required.' } });
    renderSettings();
    expect(await screen.findByRole('heading', { name: 'LOGIN PAGE' })).toBeInTheDocument();
  });

  it('shows an error when the profile cannot be loaded', async () => {
    api.getProfile.mockResolvedValue({ ok: false, status: 0, network: true });
    renderSettings();
    expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t reach the server');
  });

  it('saves a changed name and nothing else', async () => {
    api.updateProfile.mockResolvedValue(ok({ ...profile, name: 'Colton' }));
    renderSettings();
    const user = userEvent.setup();
    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Colton');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ name: 'Colton' }));
    expect(api.requestEmailChange).not.toHaveBeenCalled();
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
  });

  it('says so when nothing changed and does not call the API', async () => {
    renderSettings();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('There are no changes to save.')).toBeInTheDocument();
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('starts an email change, fills in the code, and confirms it', async () => {
    api.requestEmailChange.mockResolvedValue(ok({ message: 'sent', verification_token: 'tok123' }));
    api.confirmEmailChange.mockResolvedValue(ok({}));
    renderSettings();
    const user = userEvent.setup();
    const email = await screen.findByLabelText('Email');
    await user.clear(email);
    await user.type(email, 'New@UMKC.edu');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.requestEmailChange).toHaveBeenCalledWith('new@umkc.edu'));
    expect(api.updateProfile).not.toHaveBeenCalled();

    const code = await screen.findByLabelText('Verification code');
    expect(code).toHaveValue('tok123');
    expect(screen.getByLabelText('Email')).toHaveValue('new@umkc.edu'); // keeps the address being verified

    api.getProfile.mockResolvedValue(ok({ ...profile, email: 'new@umkc.edu' }));
    await user.click(screen.getByRole('button', { name: 'Confirm email' }));
    await waitFor(() => expect(api.confirmEmailChange).toHaveBeenCalledWith('tok123'));
    expect(await screen.findByText('Your email address was updated.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('new@umkc.edu');
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument();
  });

  it('handles two email changes in a row, confirming each with its own code', async () => {
    // A small fake server: remembers the email, the pending email, and only accepts the matching code.
    const server = { email: 'cole@umkc.edu', pending: null };
    api.getProfile.mockImplementation(async () =>
      ok({ ...profile, email: server.email, pending_email: server.pending })
    );
    api.requestEmailChange.mockImplementation(async (newEmail) => {
      server.pending = newEmail;
      return ok({ verification_token: `code-for-${newEmail}` });
    });
    api.confirmEmailChange.mockImplementation(async (token) => {
      if (token !== `code-for-${server.pending}`) {
        return { ok: false, status: 400, data: { detail: 'Invalid or expired verification token.' } };
      }
      server.email = server.pending;
      server.pending = null;
      return ok({});
    });

    renderSettings();
    const user = userEvent.setup();
    for (const next of ['one@umkc.edu', 'two@umkc.edu']) {
      const email = await screen.findByLabelText('Email');
      await user.clear(email);
      await user.type(email, next);
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByLabelText('Verification code')).toHaveValue(`code-for-${next}`);
      await user.click(screen.getByRole('button', { name: 'Confirm email' }));
      await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue(next));
      await waitFor(() => expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument());
      expect(server.email).toBe(next);
    }
  });

  it('shows an error under Name and sends nothing when the name is blank', async () => {
    renderSettings();
    const user = userEvent.setup();
    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Enter your name.')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveFocus();
    expect(api.updateProfile).not.toHaveBeenCalled();

    await user.type(name, 'C');
    expect(screen.queryByText('Enter your name.')).not.toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'false');
  });

  it('rejects a name over 255 characters before saving', async () => {
    renderSettings();
    const user = userEvent.setup();
    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.click(name);
    await user.paste('a'.repeat(256));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Name must be 255 characters or fewer.')).toBeInTheDocument();
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('shows an error under Email and sends nothing when the email is not valid', async () => {
    renderSettings();
    const user = userEvent.setup();
    const email = await screen.findByLabelText('Email');
    await user.clear(email);
    await user.type(email, 'cole @gmail.com');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Enter a valid email address, like name@example.com.')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveFocus();
    expect(api.requestEmailChange).not.toHaveBeenCalled();
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('shows both field errors at once and saves neither', async () => {
    renderSettings();
    const user = userEvent.setup();
    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    const email = screen.getByLabelText('Email');
    await user.clear(email);
    await user.type(email, 'nope');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address, like name@example.com.')).toBeInTheDocument();
    expect(name).toHaveFocus();
    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(api.requestEmailChange).not.toHaveBeenCalled();
  });

  it('puts a server-side email rejection (422) under Email in plain words', async () => {
    api.requestEmailChange.mockResolvedValue({
      ok: false,
      status: 422,
      data: { detail: [{ msg: 'value is not a valid email address: odd' }] },
    });
    renderSettings();
    const user = userEvent.setup();
    const email = await screen.findByLabelText('Email');
    await user.clear(email);
    await user.type(email, 'ok@umkc.edu');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter a valid email address, like name@example.com.')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
  });

  it('puts a server-side name rejection under Name', async () => {
    api.updateProfile.mockResolvedValue({ ok: false, status: 422, data: { detail: 'Name cannot be blank.' } });
    renderSettings();
    const user = userEvent.setup();
    const name = await screen.findByLabelText('Name');
    await user.type(name, ' Jr');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Name cannot be blank.')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the server message when an email change is rejected', async () => {
    api.requestEmailChange.mockResolvedValue({
      ok: false,
      status: 409,
      data: { detail: 'That email address is already in use.' },
    });
    renderSettings();
    const user = userEvent.setup();
    const email = await screen.findByLabelText('Email');
    await user.clear(email);
    await user.type(email, 'taken@umkc.edu');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('That email address is already in use.')).toBeInTheDocument();
  });

  it('sends a new code for the pending email and fills it in', async () => {
    api.getProfile.mockResolvedValue(ok({ ...profile, pending_email: 'new@umkc.edu' }));
    api.requestEmailChange.mockResolvedValue(ok({ verification_token: 'fresh-code' }));
    renderSettings();
    const user = userEvent.setup();
    expect(await screen.findByLabelText('Verification code')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Send a new code' }));
    await waitFor(() => expect(api.requestEmailChange).toHaveBeenCalledWith('new@umkc.edu'));
    expect(screen.getByLabelText('Verification code')).toHaveValue('fresh-code');
    expect(screen.getByText('A new verification code was filled in below.')).toBeInTheDocument();
  });

  it('shows an error for a wrong verification code', async () => {
    api.getProfile.mockResolvedValue(ok({ ...profile, pending_email: 'new@umkc.edu' }));
    api.confirmEmailChange.mockResolvedValue({
      ok: false,
      status: 400,
      data: { detail: 'Invalid or expired verification token.' },
    });
    renderSettings();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Verification code'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Confirm email' }));
    expect(await screen.findByText('Invalid or expired verification token.')).toBeInTheDocument();
  });

  it('changes the password and sends the user to log in again', async () => {
    api.changePassword.mockResolvedValue(ok({}));
    renderSettings();
    const user = userEvent.setup();
    await openPasswordForm(user);
    await user.type(screen.getByLabelText('Current password'), 'Oldpass1!');
    await user.type(screen.getByLabelText('New password'), 'Newpass1!');
    await user.type(screen.getByLabelText('Confirm new password'), 'Newpass1!');
    expect(screen.getByText('✓ Passwords match.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() =>
      expect(api.changePassword).toHaveBeenCalledWith({ currentPassword: 'Oldpass1!', newPassword: 'Newpass1!' })
    );
    expect(await screen.findByRole('heading', { name: 'LOGIN PAGE' })).toBeInTheDocument();
  });

  it('shows an error under each empty password field and sends nothing', async () => {
    renderSettings();
    const user = userEvent.setup();
    await openPasswordForm(user);
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByText('Enter your current password.')).toBeInTheDocument();
    expect(screen.getByText('Enter a new password.')).toBeInTheDocument();
    expect(screen.getByText('Confirm your new password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveFocus();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('shows the requirements error under New password when it is too weak', async () => {
    renderSettings();
    const user = userEvent.setup();
    await openPasswordForm(user);
    await user.type(screen.getByLabelText('Current password'), 'Oldpass1!');
    await user.type(screen.getByLabelText('New password'), 'weak');
    await user.type(screen.getByLabelText('Confirm new password'), 'weak');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByText('Your new password doesn’t meet all the requirements yet.')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('New password')).toHaveFocus();
    expect(api.changePassword).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('New password'), 'x');
    expect(screen.queryByText('Your new password doesn’t meet all the requirements yet.')).not.toBeInTheDocument();
  });

  it('shows the mismatch error under Confirm new password', async () => {
    renderSettings();
    const user = userEvent.setup();
    await openPasswordForm(user);
    await user.type(screen.getByLabelText('Current password'), 'Oldpass1!');
    await user.type(screen.getByLabelText('New password'), 'Newpass1!');
    await user.type(screen.getByLabelText('Confirm new password'), 'Newpass2!');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByText('The new passwords don’t match.')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Confirm new password')).toHaveFocus();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('shows a wrong current password under Current password', async () => {
    api.changePassword.mockResolvedValue({
      ok: false,
      status: 400,
      data: { detail: 'Current password is incorrect.' },
    });
    renderSettings();
    const user = userEvent.setup();
    await openPasswordForm(user);
    const current = screen.getByLabelText('Current password');
    await user.type(current, 'Wrongpass1!');
    await user.type(screen.getByLabelText('New password'), 'Newpass1!');
    await user.type(screen.getByLabelText('Confirm new password'), 'Newpass1!');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument();
    expect(current).toHaveAttribute('aria-invalid', 'true');
    expect(current).toHaveFocus();
  });

  it('keeps a server outage as a general message at the bottom of the password form', async () => {
    api.changePassword.mockResolvedValue({ ok: false, status: 0, network: true });
    renderSettings();
    const user = userEvent.setup();
    await openPasswordForm(user);
    await user.type(screen.getByLabelText('Current password'), 'Oldpass1!');
    await user.type(screen.getByLabelText('New password'), 'Newpass1!');
    await user.type(screen.getByLabelText('Confirm new password'), 'Newpass1!');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText(/couldn’t reach the server/)).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'false');
  });

  it('keeps the password form hidden until Change password is pressed, and Cancel closes and clears it', async () => {
    renderSettings();
    const user = userEvent.setup();
    const opener = await screen.findByRole('button', { name: 'Change password' });
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();

    await user.click(opener);
    const current = screen.getByLabelText('Current password');
    expect(current).toHaveFocus();
    await user.type(current, 'abc');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('saves all four notification choices', async () => {
    const saved = { ...profile, notify_settlement: true };
    api.updateProfile.mockResolvedValue(ok(saved));
    renderSettings();
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('Someone marks a payment as paid'));
    await user.click(screen.getByRole('button', { name: 'Save notification choices' }));
    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith({
        notify_group_invite: true,
        notify_new_expense: true,
        notify_settlement: true,
        notify_removed_from_group: true,
      })
    );
    expect(await screen.findByText('Notification choices saved.')).toBeInTheDocument();
  });

  it('redirects to login if the session ends while saving', async () => {
    api.updateProfile.mockResolvedValue({ ok: false, status: 401, data: { detail: 'Authentication required.' } });
    renderSettings();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Save notification choices' }));
    expect(await screen.findByRole('heading', { name: 'LOGIN PAGE' })).toBeInTheDocument();
  });

  it('offers a Settings link in the account menu', async () => {
    renderSettings();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Account menu/ }));
    const menu = screen.getByRole('link', { name: 'Settings' });
    expect(menu).toHaveAttribute('href', '/settings');
    expect(within(document.body).getByText('cole@umkc.edu', { selector: '.account-email' })).toBeInTheDocument();
  });
});
