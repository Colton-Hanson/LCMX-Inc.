// Small pieces of the receipt review screen that are not components themselves, kept here so the page file
// only exports components (Vite fast refresh needs that).
import { Link } from 'react-router-dom';
import Message from '../components/Message.jsx';

export const AI_NOTE = (
  <Message kind="info">
    <strong>Read by AI.</strong> It can make mistakes. Fix any name, quantity, or price, then tap the people who share each item.
  </Message>
);

// What to show for a receipt that is not ready to review. Returns null when it is.
export function reviewBlocker(receipt) {
  const id = receipt.id;
  const again = <Link className="btn btn-tint" to={`/receipts/new?group=${receipt.group_id}`}>Try another picture</Link>;
  const home = <Link className="btn btn-ghost" to="/home">Back to Home</Link>;
  if (receipt.expense_id != null || receipt.status === 'confirmed') {
    return { step: 4, title: 'This receipt is already saved', text: 'It was added as an expense, so there is nothing left to check.', actions: <><Link className="btn btn-tint" to={`/groups/${receipt.group_id}`}>Go to the group</Link>{home}</> };
  }
  if (receipt.status === 'failed') {
    return { step: 2, title: 'The AI couldn’t read this receipt', text: 'Nothing was added. Try another picture or take a new photo.', actions: <>{again}{home}</> };
  }
  if (receipt.status === 'abandoned') {
    return { step: 1, title: 'This receipt was abandoned', text: 'It wasn’t saved to an expense within 7 days, so its picture was deleted. Upload it again to start over.', actions: <>{again}{home}</> };
  }
  if (receipt.status !== 'read') {
    return { step: 2, title: 'The AI is still reading this receipt', text: 'The items will be ready to check as soon as it finishes.', actions: <><Link className="btn btn-tint" to={`/receipts/${id}`}>Back to the receipt</Link>{home}</> };
  }
  if ((receipt.items ?? []).length === 0) {
    return { step: 2, title: 'The AI couldn’t read this receipt', text: 'No items were found on it. Try another picture or take a new photo.', actions: <>{again}{home}</> };
  }
  return null;
}
