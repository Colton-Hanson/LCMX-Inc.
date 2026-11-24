// Check and assign (SCRUM-134): fix what the AI read, pick who shares each item, see each person's
// share live, then save it as an expense. Nothing is saved to an expense until Save expense.
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar, { avatarClass } from '../Avatar.jsx';
import Icon from '../Icons.jsx';
import { labelsFor } from '../../lib/people.js';
import Message from '../Message.jsx';
import ExpandText from './ExpandText.jsx';
import MiniReceipt from './MiniReceipt.jsx';
import PeoplePicker from './PeoplePicker.jsx';
import PictureSection from './PictureSection.jsx';
import { messageFromResult } from '../../lib/apiErrors.js';
import { EXPENSE_TITLE_MAX_LENGTH } from '../../lib/expenseValidators.js';
import { formatReceiptDate } from '../../lib/money.js';
import { lineCents, shareTotals, slipDate, slipLines, splitEvenly, toQuantity } from '../../lib/receiptMath.js';
import { formatCents, formatMoney, toCents } from '../../lib/splits.js';

const UNASSIGNED = 'Not assigned yet. It is left out of everyone’s share until you pick someone.';

const startRows = (receipt, everyone) =>
  [...(receipt.items ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((item, index) => ({
      key: item.id ?? `new-${index}`,
      id: item.id ?? null,
      name: item.name ?? '',
      qty: String(item.quantity ?? 1),
      price: formatCents(toCents(item.unit_price) ?? 0),
      people: everyone,
    }));

// True when what the receipt printed does not match its own numbers.
function printedMismatch(receipt, sumCents) {
  const printed = toCents(receipt.total);
  if (printed !== null && printed !== sumCents) return `The items add up to ${formatMoney(sumCents)}, but the receipt total says ${formatMoney(printed)}.`;
  const off = (receipt.items ?? []).some((item) => {
    const line = toCents(item.line_total);
    const unit = toCents(item.unit_price);
    return line !== null && unit !== null && line !== unit * (Number(item.quantity) || 0);
  });
  return off ? 'Some item totals on the receipt don’t match the quantity times the price.' : '';
}

// Builds the confirm body's assignments. Each item with a price is split evenly in cents between the people on it,
// so the shares add up to the item's total. Items with no price or nobody on them are left out.
//   rows    [{ cents, in: [userId] }]   itemIds  the saved id of each row, in the same order
export function buildAssignments(rows, itemIds) {
  return rows
    .map((row, index) => ({ row, id: itemIds[index] }))
    .filter(({ row }) => row.cents > 0 && row.in.length > 0)
    .map(({ row, id }) => {
      const parts = splitEvenly(row.cents, row.in);
      return {
        item_id: id,
        shares: row.in.filter((userId) => parts[userId] > 0).map((userId) => ({ user_id: userId, amount: formatCents(parts[userId]) })),
      };
    });
}

//   members      the group's members [{ user_id, email, is_admin }]
//   events       the group's events [{ id, name }] for the optional Event picker
//   saveItems(items)    saves the item list, resolves to the API result
//   saveExpense(body)   confirms the receipt as an expense, resolves to the API result
//   onSaved({ description, cents, count })  called after the expense is saved
//   removePicture, loadPicture  optional delete and fetch calls for the preview page
export default function ReceiptReview({ receipt, members, events = [], myId, groupName, saveItems, saveExpense, onSaved, onExpired, removePicture, loadPicture }) {
  const ids = useId();
  const shortNames = labelsFor(members);
  const people = members.map((m) => ({ id: m.user_id, name: m.user_id === myId ? `${shortNames[m.user_id]} (you)` : shortNames[m.user_id] }));
  const allIds = people.map((p) => p.id);
  const [onReceipt, setOnReceipt] = useState(allIds);
  const [rows, setRows] = useState(() => startRows(receipt, allIds));
  const [store, setStore] = useState(receipt.store ?? '');
  const [paidBy, setPaidBy] = useState(allIds.includes(myId) ? myId : allIds[0]);
  const [eventId, setEventId] = useState(''); // '' means no event
  const [openKey, setOpenKey] = useState(null); // which people panel is open
  const [dirty, setDirty] = useState(false);
  const [itemsNote, setItemsNote] = useState(''); // 'saving' | 'saved' | ''
  const [itemsError, setItemsError] = useState('');
  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const savingRef = useRef(false);

  const order = allIds.filter((id) => onReceipt.includes(id));
  const receiptPeople = people.filter((p) => order.includes(p.id));
  const checked = rows.map((row) => {
    const cents = lineCents(row.qty, row.price);
    return {
      ...row,
      cents,
      in: order.filter((id) => row.people.includes(id)),
      badName: row.name.trim() === '',
      badQty: toQuantity(row.qty) === null,
      badPrice: toCents(row.price) === null,
    };
  });
  const anyBad = checked.some((r) => r.badName || r.badQty || r.badPrice);
  const totals = shareTotals(checked.map((r) => ({ cents: r.cents ?? 0, people: r.in })), order);
  const flagged = checked.filter((r) => r.in.length === 0).length;
  const mismatch = printedMismatch(receipt, totals.total);
  const canSave = !anyBad && totals.assigned > 0 && !submitting;

  const change = (key, patch) => {
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    if ('name' in patch || 'qty' in patch || 'price' in patch) {
      setDirty(true);
      setItemsNote('');
    }
  };

  // Changing who is on the receipt puts them in, or takes them out of, every item.
  function changeReceiptPeople(next) {
    const added = next.filter((id) => !onReceipt.includes(id));
    setRows((list) => list.map((row) => ({ ...row, people: [...row.people.filter((id) => next.includes(id)), ...added] })));
    setOnReceipt(next);
  }

  // Sends the whole item list. Returns the saved items (with their ids) or null when it did not save.
  async function sendItems() {
    if (savingRef.current) return null;
    savingRef.current = true;
    setItemsError('');
    setItemsNote('saving');
    const res = await saveItems(
      checked.map((r) => ({ id: r.id, name: r.name.trim(), quantity: toQuantity(r.qty), unit_price: formatCents(toCents(r.price)) }))
    );
    savingRef.current = false;
    if (res.status === 401) {
      onExpired?.();
      return null;
    }
    if (!res.ok) {
      setItemsNote('');
      setItemsError(messageFromResult(res, 'We couldn’t save your changes to the items. Please try again.'));
      return null;
    }
    // The reply lists the items in the order we sent them. Keep their ids so the next save does not add them twice.
    const saved = Array.isArray(res.data?.items) ? res.data.items : [];
    setRows((list) => list.map((row, index) => ({ ...row, id: saved[index]?.id ?? row.id })));
    setDirty(false);
    setItemsNote('saved');
    return saved;
  }

  const saveOnBlur = () => {
    if (dirty && !anyBad) sendItems();
  };

  async function save() {
    setTried(true);
    setSubmitError('');
    if (!canSave) return;
    setSubmitting(true);
    let itemIds = checked.map((r) => r.id);
    if (dirty) {
      const saved = await sendItems();
      if (!saved) return setSubmitting(false);
      itemIds = saved.map((item) => item.id);
    }
    const description = (store.trim() || 'Receipt').slice(0, EXPENSE_TITLE_MAX_LENGTH);
    const res = await saveExpense({
      paid_by: paidBy,
      description,
      ...(eventId === '' ? {} : { event_id: Number(eventId) }),
      assignments: buildAssignments(checked, itemIds),
    });
    if (res.status === 401) return onExpired?.();
    if (!res.ok) {
      setSubmitting(false);
      return setSubmitError(messageFromResult(res, 'We couldn’t save the expense. Please try again.'));
    }
    const count = Object.keys(res.data?.shares ?? {}).length || order.filter((id) => totals.shares[id] > 0).length;
    onSaved({ description, cents: totals.assigned, count });
  }

  const pickLabel = (count) => (count === 0 ? 'Nobody' : count === order.length ? `Everyone (${count})` : `${count} of ${order.length}`);
  const saveHelp = anyBad ? 'Fix the highlighted items to save.' : totals.assigned === 0 ? 'Pick who shares at least one item to save.' : '';

  return (
    <div className="rv-cols rv">
      <section className="panel rv-main" aria-labelledby={`${ids}-found`}>
        <h2 id={`${ids}-found`}>What the AI found</h2>
        <div className="rv-fields">
          <div className="s7-field wide">
            <label htmlFor={`${ids}-store`}>Store</label>
            <input id={`${ids}-store`} className="form-in" type="text" autoComplete="off" maxLength={EXPENSE_TITLE_MAX_LENGTH} value={store} aria-describedby={`${ids}-store-help`} onChange={(e) => setStore(e.target.value)} />
            <p className="sm-mute" id={`${ids}-store-help`}>This becomes the name of the expense.</p>
          </div>
          <div className="s7-field">
            <label htmlFor={`${ids}-date`}>Date</label>
            <input id={`${ids}-date`} className="form-in" type="text" readOnly value={formatReceiptDate(receipt.receipt_date) || 'Not found'} />
          </div>
        </div>
        <div className="rv-fields">
          <div className="s7-field">
            <label htmlFor={`${ids}-group`}>Group</label>
            <input id={`${ids}-group`} className="form-in" type="text" readOnly value={groupName} />
          </div>
          <div className="s7-field">
            <label htmlFor={`${ids}-paid`}>Paid by</label>
            <select id={`${ids}-paid`} className="form-in" value={paidBy} onChange={(e) => setPaidBy(Number(e.target.value))}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {events.length > 0 && (
          <div className="rv-fields">
            <div className="s7-field">
              <label htmlFor={`${ids}-event`}>Event (optional)</label>
              <select id={`${ids}-event`} className="form-in" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">No event</option>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="rv-who">
          <div className="rv-who-text">
            <p className="fw-bold">Who’s on this receipt?</p>
            <p className="sm-mute">Set this once. Every item starts with all of them in.</p>
          </div>
          <PeoplePicker
            people={people}
            selected={order}
            onChange={changeReceiptPeople}
            label={order.length === people.length ? `Everyone (${order.length})` : `${order.length} of ${people.length}`}
            name="Who is on this receipt"
            open={openKey === 'receipt'}
            onToggle={() => setOpenKey(openKey === 'receipt' ? null : 'receipt')}
          />
        </div>

        <div>
          <div className="irow head" aria-hidden="true">
            <span>Item</span><span>Qty</span><span>Price</span><span>Who is in</span><span style={{ textAlign: 'right' }}>Split</span>
          </div>
          {checked.map((row, index) => {
            const title = row.name.trim() || `item ${index + 1}`;
            const count = row.in.length;
            return (
              <div key={row.key} className={`irow${count === 0 ? ' is-flag' : ''}`} role="group" aria-label={`Item ${index + 1}: ${title}`}>
                <label className="rv-cell rv-name">
                  <span className="rv-lab">{`Item #${index + 1}`}</span>
                  <input className="form-in" type="text" autoComplete="off" value={row.name} aria-label="Item name" aria-invalid={row.badName} onChange={(e) => change(row.key, { name: e.target.value })} onBlur={saveOnBlur} />
                </label>
                <label className="rv-cell rv-qty">
                  <span className="rv-lab">Qty</span>
                  <input className="form-in" type="text" inputMode="numeric" autoComplete="off" value={row.qty} aria-label={`Quantity for ${title}`} aria-invalid={row.badQty} onChange={(e) => change(row.key, { qty: e.target.value })} onBlur={saveOnBlur} />
                </label>
                <label className="rv-cell rv-price">
                  <span className="rv-lab">Price</span>
                  <input className="form-in" type="text" inputMode="decimal" autoComplete="off" value={row.price} aria-label={`Price for ${title}`} aria-invalid={row.badPrice} onChange={(e) => change(row.key, { price: e.target.value })} onBlur={saveOnBlur} />
                </label>
                <div className="rv-whocell" style={{ display: 'contents' }}>
                  <PeoplePicker
                    people={receiptPeople}
                    selected={row.in}
                    onChange={(next) => change(row.key, { people: next })}
                    label={pickLabel(count)}
                    name={`Who is in on ${title}`}
                    open={openKey === row.key}
                    onToggle={() => setOpenKey(openKey === row.key ? null : row.key)}
                  />
                </div>
                <span className="eachc">
                  {row.cents === null || count === 0 ? '-' : count === 1 ? formatMoney(row.cents) : `${formatMoney(Math.floor(row.cents / count))} each`}
                </span>
                {count === 0 && (
                  <p className="flagmsg"><Icon name="alert" /><span>{UNASSIGNED}</span></p>
                )}
              </div>
            );
          })}
        </div>
        {tried && anyBad && (
          <Message kind="error" alert>Some items need fixing. Each needs a name, a whole number quantity, and a price like 4.79.</Message>
        )}
        {itemsError && <Message kind="error" alert>{itemsError}</Message>}
        <p className="sm-mute" role="status">{itemsNote === 'saving' ? 'Saving your changes…' : itemsNote === 'saved' ? 'Changes saved.' : ''}</p>
        <div className="rv-total">
          <span>Receipt total</span>
          <span className="rv-money">{formatMoney(totals.total)}</span>
        </div>
      </section>

      <div className="rv-side">
        <section className="panel" aria-labelledby={`${ids}-share`}>
          <h2 id={`${ids}-share`}>Everyone’s share</h2>
          <div className="bar" role="img" aria-label="Each person’s share of the assigned items">
            {receiptPeople.map((p) => (
              <i key={p.id} className={avatarClass(p.name)} style={{ width: `${totals.assigned ? (totals.shares[p.id] / totals.assigned) * 100 : 0}%` }} />
            ))}
          </div>
          <div aria-live="polite">
            {receiptPeople.length === 0 && <p className="sm-mute">Nobody is on this receipt yet.</p>}
            {receiptPeople.map((p) => (
              <div className="prow" key={p.id}>
                <Avatar text={p.name} />
                <ExpandText>{p.name}</ExpandText>
                <span className="pct">{totals.assigned ? `${Math.round((totals.shares[p.id] / totals.assigned) * 100)}%` : '0%'}</span>
                <span className="rv-money">{formatMoney(totals.shares[p.id])}</span>
              </div>
            ))}
          </div>
          <dl className="rv-kv">
            <dt>Receipt total</dt><dd>{formatMoney(totals.total)}</dd>
            <dt>Left out (not assigned)</dt><dd>{formatMoney(totals.leftOut)}</dd>
            <dt className="is-strong">Split between people</dt><dd>{formatMoney(totals.assigned)}</dd>
          </dl>
          {flagged > 0 && (
            <Message kind="warn" role="status">
              {`${flagged} ${flagged === 1 ? 'item is' : 'items are'} not assigned yet. ${formatMoney(totals.leftOut)} is left out of the split.`}
            </Message>
          )}
          {mismatch && <Message kind="warn" role="status">{mismatch} Check the prices. You can still save.</Message>}
          {submitError && <Message kind="error" alert>{submitError}</Message>}
          <div className="btn-row">
            <button type="button" className="btn btn-tint" disabled={!canSave} aria-describedby={saveHelp ? `${ids}-save-help` : undefined} onClick={save}>
              {submitting ? 'Saving expense…' : 'Save expense'}
            </button>
            <Link className="btn btn-ghost" to="/home">Cancel</Link>
          </div>
          {saveHelp && <p className="strong-sm" id={`${ids}-save-help`}>{saveHelp}</p>}
          <p className="sm-mute">Saving adds this to the group’s expenses and updates balances. Cancel throws away what the AI found.</p>
        </section>

        <section className="panel" aria-labelledby={`${ids}-slip`}>
          <h2 id={`${ids}-slip`}>Your receipt</h2>
          <MiniReceipt
            store={receipt.store}
            location={receipt.store_location}
            date={slipDate(receipt.receipt_date)}
            lines={slipLines(checked.map((r) => ({ id: r.key, name: r.name, quantity: toQuantity(r.qty) ?? 1, unit_price: r.price, line_total: r.cents === null ? null : formatCents(r.cents) })))}
            total={formatCents(totals.total)}
          />
          <PictureSection
            receipt={receipt}
            myId={myId}
            isAdmin={members.some((m) => m.user_id === myId && m.is_admin)}
            onExpired={onExpired}
            load={loadPicture}
            remove={removePicture}
          />
        </section>
      </div>
    </div>
  );
}
