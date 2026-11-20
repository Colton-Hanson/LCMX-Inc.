// The saved receipt picture, loaded from the server. Shows a calm "Picture removed" note when it is gone.
//   gone     true once it was deleted here
//   load     the fetch call (tests and the preview page pass their own)
//   onPhase  told 'loading' | 'image' | 'pdf' | 'removed' | 'error' as it changes
import { useEffect, useState } from 'react';
import Icon from '../Icons.jsx';
import Message from '../Message.jsx';
import { getReceiptPicture } from '../../api/receipts.js';
import '../../sprint7.css';

export default function ReceiptPicture({ receiptId, store, gone = false, load = getReceiptPicture, onPhase }) {
  const [pic, setPic] = useState({ phase: 'loading', url: '' });

  useEffect(() => {
    if (gone) {
      setPic({ phase: 'removed', url: '' });
      return undefined;
    }
    let cancelled = false;
    let url = '';
    setPic({ phase: 'loading', url: '' });
    load(receiptId).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        url = URL.createObjectURL(res.blob);
        setPic({ phase: res.blob.type === 'application/pdf' ? 'pdf' : 'image', url });
      } else if (res.status === 404) {
        setPic({ phase: 'removed', url: '' });
      } else {
        setPic({ phase: 'error', url: '' });
      }
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [receiptId, gone, load]);

  useEffect(() => {
    onPhase?.(pic.phase);
  }, [pic.phase, onPhase]);

  if (pic.phase === 'loading') return <p className="sm-mute" role="status">Loading the picture…</p>;
  if (pic.phase === 'error') return <Message kind="error" alert>We couldn’t load the picture.</Message>;
  if (pic.phase === 'removed') {
    return (
      <div className="pic-gone" role="img" aria-label="Picture removed. The items are kept.">
        <Icon name="trash" size={18} />
        <span>Picture removed</span>
      </div>
    );
  }
  if (pic.phase === 'pdf') {
    return <a className="btn btn-ghost btn-s" href={pic.url} target="_blank" rel="noreferrer">Open the receipt PDF</a>;
  }
  return <img className="pic-img" src={pic.url} alt={`Photo of the receipt${store ? ` from ${store}` : ''}`} />;
}
