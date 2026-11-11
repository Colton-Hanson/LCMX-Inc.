// Tests for turning failed receipt calls into messages.
import { uploadErrorFromResult } from '../src/lib/receiptErrors.js';

const fail = (status, data) => ({ ok: false, status, data });

describe('uploadErrorFromResult', () => {
  it('uses the message and action the server sends for upload errors', () => {
    const result = fail(415, { detail: { code: 'wrong_format', message: 'Only JPEG and PDF files work.', action: 'Pick a .jpg or .pdf file.' } });
    expect(uploadErrorFromResult(result)).toEqual({ code: 'wrong_format', message: 'Only JPEG and PDF files work.', action: 'Pick a .jpg or .pdf file.' });
  });
  it.each([['corrupt_file', 422], ['upload_failed', 500]])('keeps the %s code', (code, status) => {
    const result = fail(status, { detail: { code, message: 'M', action: 'A' } });
    expect(uploadErrorFromResult(result)).toEqual({ code, message: 'M', action: 'A' });
  });
  it('adds the size limit to the too-large message', () => {
    const result = fail(413, { detail: { code: 'file_too_large', message: 'The receipt exceeds the upload size limit.', action: 'Choose a smaller file.' } });
    expect(uploadErrorFromResult(result)).toEqual({ code: 'file_too_large', message: 'This file is too large (max 10 MB).', action: 'Choose a smaller file.' });
  });
  it('fills in an action when the server leaves it out', () => {
    const result = fail(422, { detail: { code: 'corrupt_file', message: 'Broken.' } });
    expect(uploadErrorFromResult(result).action).toBe('Please try again.');
  });
  it('handles the network being down', () => {
    expect(uploadErrorFromResult({ ok: false, status: 0, network: true }).code).toBe('network');
  });
  it('handles not being logged in', () => {
    expect(uploadErrorFromResult(fail(401, { detail: 'Not authenticated' })).code).toBe('signed_out');
  });
  it('shows a plain string detail (not a member of the group)', () => {
    const error = uploadErrorFromResult(fail(404, { detail: 'Group not found.' }));
    expect(error.message).toBe('Group not found.');
  });
  it('joins validation messages from a list detail', () => {
    const error = uploadErrorFromResult(fail(422, { detail: [{ msg: 'Value error, group_id must be positive' }] }));
    expect(error).toMatchObject({ code: 'invalid', message: 'group_id must be positive' });
  });
  it('handles server errors without a detail object', () => {
    expect(uploadErrorFromResult(fail(500, null)).code).toBe('server');
  });
  it('falls back when there is nothing usable', () => {
    expect(uploadErrorFromResult(fail(400, null)).code).toBe('unknown');
  });
});
