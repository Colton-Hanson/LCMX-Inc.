// Tests for the receipt API. Fake XMLHttpRequest, no backend.
import { vi } from 'vitest';
import { uploadReceipt, getReceipt } from '../src/api/receipts.js';

let xhr;
class FakeXhr {
  constructor() {
    xhr = this;
    this.upload = {};
    this.headers = {};
  }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(name, value) { this.headers[name] = value; }
  send(body) { this.body = body; }
  abort() { this.onabort(); }
}

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadReceipt', () => {
  const file = new File(['abc'], 'r.jpg', { type: 'image/jpeg' });

  it('posts multipart form data with the group and file, the cookie, and no manual Content-Type', () => {
    uploadReceipt({ groupId: 7, file });
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/receipts');
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.headers['Content-Type']).toBeUndefined();
    expect(xhr.body).toBeInstanceOf(FormData);
    expect(xhr.body.get('group_id')).toBe('7');
    expect(xhr.body.get('file').name).toBe('r.jpg');
  });

  it('reports whole-number progress', () => {
    const onProgress = vi.fn();
    uploadReceipt({ groupId: 1, file, onProgress });
    xhr.upload.onprogress({ lengthComputable: true, loaded: 62, total: 100 });
    xhr.upload.onprogress({ lengthComputable: false, loaded: 5, total: 0 });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(62);
  });

  it('resolves with the parsed body on success', async () => {
    const { promise } = uploadReceipt({ groupId: 1, file });
    xhr.status = 201;
    xhr.responseText = JSON.stringify({ id: 9, status: 'uploaded' });
    xhr.onload();
    await expect(promise).resolves.toEqual({ ok: true, status: 201, data: { id: 9, status: 'uploaded' } });
  });

  it('resolves with the error body on failure', async () => {
    const { promise } = uploadReceipt({ groupId: 1, file });
    xhr.status = 415;
    xhr.responseText = JSON.stringify({ detail: { code: 'wrong_format' } });
    xhr.onload();
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.data.detail.code).toBe('wrong_format');
  });

  it('keeps data null when the body is not JSON', async () => {
    const { promise } = uploadReceipt({ groupId: 1, file });
    xhr.status = 502;
    xhr.responseText = '<html>bad gateway</html>';
    xhr.onload();
    await expect(promise).resolves.toEqual({ ok: false, status: 502, data: null });
  });

  it('resolves as a network failure when the request cannot be made', async () => {
    const { promise } = uploadReceipt({ groupId: 1, file });
    xhr.onerror();
    await expect(promise).resolves.toEqual({ ok: false, status: 0, network: true });
  });

  it('can be aborted', async () => {
    const { promise, abort } = uploadReceipt({ groupId: 1, file });
    abort();
    await expect(promise).resolves.toEqual({ ok: false, status: 0, aborted: true });
  });
});

describe('getReceipt', () => {
  it('requests the receipt by id with the cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 3, status: 'uploaded' }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await getReceipt(3);
    expect(fetchMock).toHaveBeenCalledWith('/api/receipts/3', expect.objectContaining({ method: 'GET', credentials: 'include' }));
    expect(result).toEqual({ ok: true, status: 200, data: { id: 3, status: 'uploaded' } });
  });
});
