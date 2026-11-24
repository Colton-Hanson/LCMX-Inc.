import Icon from './Icons.jsx';

// The small Edit and Delete buttons next to an expense. Only rendered for people allowed to change it.
export default function ExpenseActions({ title, onEdit, onDelete }) {
  return (
    <span className="exp-actions">
      <button type="button" className="icon-btn" aria-label={`Edit ${title}`} onClick={onEdit}>
        <Icon name="edit" size={18} />
      </button>
      <button type="button" className="icon-btn icon-btn--danger" aria-label={`Delete ${title}`} onClick={onDelete}>
        <Icon name="trash" size={18} />
      </button>
    </span>
  );
}
