import Message from './Message.jsx';

// Calm note for something the server can't do yet. Read out politely, not as an error.
export default function NotAvailable({ id, children }) {
  return <Message kind="info" role="status" id={id}>{children}</Message>;
}
