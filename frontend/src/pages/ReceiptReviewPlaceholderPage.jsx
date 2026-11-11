import { Link, useParams } from 'react-router-dom';
import '../receipt.css';
import Stepper from '../components/receipt/Stepper.jsx';
import { usePageTitle } from '../lib/usePageTitle.js';

// Where 'Check the items' goes for now. The real screen comes next iteration.
export default function ReceiptReviewPlaceholderPage() {
  usePageTitle('Check the items');
  const { receiptId } = useParams();
  return (
    <main className="page-wrap rcpt">
      <h1>Add expense</h1>
      <Stepper current={3} />
      <section className="panel" aria-labelledby="review-title">
        <h2 id="review-title">Check the items</h2>
        <p className="mute">This screen comes next. Your receipt is saved and read, and nothing has been added to an expense yet.</p>
        <div className="btn-row">
          <Link className="btn btn-tint" to={`/receipts/${receiptId}`}>Back to the receipt</Link>
          <Link className="btn btn-ghost" to="/home">Cancel</Link>
        </div>
      </section>
    </main>
  );
}
