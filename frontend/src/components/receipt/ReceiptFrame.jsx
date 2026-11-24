import { Link } from 'react-router-dom';
import '../../receipt.css';
import Icon from '../Icons.jsx';
import Stepper from './Stepper.jsx';

// Shared layout for the receipt screens: title, steps and the two cards. step is the current step (1 to 3).
export default function ReceiptFrame({ step, left, right }) {
  return (
    <main className="page-wrap rcpt">
      <div className="rc-top">
        <h1 className="title-case">Add expense</h1>
        <div className="seg" role="group" aria-label="How to add">
          <Link to="/expenses/new"><Icon name="edit" size={16} /><span>Enter by <span className="cap">hand</span></span></Link>
          <span className="on" aria-current="page"><Icon name="scan" size={16} /><span>Scan a <span className="cap">receipt</span></span></span>
        </div>
      </div>
      <Stepper current={step} />
      <div className="rc-cols">
        {left}
        {right}
      </div>
    </main>
  );
}
