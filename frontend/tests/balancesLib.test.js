// balancesLib.test.js — checks how the GET /balances reply is turned into rows and totals. Run with: npm test

import { buildBalances, FORMER_MEMBER } from '../src/lib/balances.js';

const row = (group, user, owed, owe) => ({
  group_id: group,
  other_user_id: user,
  net_amount: (Number(owed) - Number(owe)).toFixed(2),
  owed_to_you: owed,
  you_owe: owe,
});

const emailsByGroup = { 5: { 2: 'maya@example.com', 3: 'devin@example.com' }, 6: { 2: 'maya@example.com' } };

describe('buildBalances', () => {
  it('splits rows into who owes you and who you owe, with totals in cents', () => {
    const result = buildBalances({
      balances: { group_balances: [row(5, 2, '30.00', '0.00'), row(5, 3, '0.00', '12.50'), row(6, 2, '4.25', '0.00')] },
      emailsByGroup,
    });
    expect(result.owedToYou.map((r) => [r.name, r.cents])).toEqual([
      ['maya@example.com', 3000],
      ['maya@example.com', 425],
    ]);
    expect(result.youOwe.map((r) => [r.name, r.cents])).toEqual([['devin@example.com', 1250]]);
    expect(result.owedTotal).toBe(3425);
    expect(result.oweTotal).toBe(1250);
    expect(result.hasRows).toBe(true);
  });

  it('puts the biggest amount first, then the lower group number', () => {
    const result = buildBalances({
      balances: { group_balances: [row(6, 2, '5.00', '0.00'), row(5, 3, '5.00', '0.00'), row(5, 2, '9.99', '0.00')] },
      emailsByGroup,
    });
    expect(result.owedToYou.map((r) => `${r.groupId}-${r.userId}`)).toEqual(['5-2', '5-3', '6-2']);
  });

  it('skips settled rows but still reports that rows exist', () => {
    const result = buildBalances({ balances: { group_balances: [row(5, 2, '0.00', '0.00')] }, emailsByGroup });
    expect(result.owedToYou).toEqual([]);
    expect(result.youOwe).toEqual([]);
    expect(result.hasRows).toBe(true);
  });

  it('labels people who left the group and groups the browser does not know', () => {
    const result = buildBalances({
      balances: { group_balances: [row(5, 9, '3.00', '0.00'), row(7, 2, '0.00', '1.00')] },
      emailsByGroup: { 5: {}, 7: { 2: 'maya@example.com' } },
      groupNames: { 5: 'Lake House' },
    });
    expect(result.owedToYou[0]).toMatchObject({ name: FORMER_MEMBER, groupName: 'Lake House' });
    expect(result.youOwe[0]).toMatchObject({ name: 'maya@example.com', groupName: 'Group 7' });
  });

  it('handles an empty or missing reply', () => {
    expect(buildBalances({ balances: { group_balances: [] } })).toMatchObject({ owedTotal: 0, oweTotal: 0, hasRows: false });
    expect(buildBalances({ balances: undefined }).hasRows).toBe(false);
  });

  it('ignores an amount that is not dollars and cents', () => {
    const result = buildBalances({ balances: { group_balances: [row(5, 2, 'abc', '0.00')] }, emailsByGroup });
    expect(result.owedToYou).toEqual([]);
  });
});

describe('buildBalances: expense lines', () => {
  // You are user 1. Maya (2) owes you 341.66 over three expenses, and you owe her 119.16 for one: 222.50 net.
  const expense = (id, title, paidBy, shares) => ({ id, description: title, paid_by: paidBy, shares });
  const expenses = [
    expense(4, 'Food', 1, { 1: '33.34', 2: '33.33' }),
    expense(3, 'TV for house', 2, { 1: '119.16', 2: '119.16' }),
    expense(2, 'Lunch', 1, { 1: '8.34', 2: '8.33' }),
    expense(1, 'Rent', 1, { 2: '300.00' }),
  ];
  const balances = { group_balances: [row(5, 2, '222.50', '0.00')] };

  it('lists what makes up the balance biggest first, then what takes away from it', () => {
    const result = buildBalances({ balances, emailsByGroup, expensesByGroup: { 5: expenses }, myId: 1 });
    expect(result.owedToYou[0].lines).toEqual([
      { id: 1, title: 'Rent', cents: 30000, offset: false },
      { id: 4, title: 'Food', cents: 3333, offset: false },
      { id: 2, title: 'Lunch', cents: 833, offset: false },
      { id: 3, title: 'TV for house', cents: 11916, offset: true },
    ]);
  });

  it('works from the other side too: what you owe, with the expenses you paid taking away from it', () => {
    const result = buildBalances({
      balances: { group_balances: [row(5, 2, '0.00', '222.50')] },
      emailsByGroup,
      expensesByGroup: {
        5: [
          expense(1, 'Rent', 2, { 1: '300.00' }),
          expense(2, 'Lunch', 2, { 1: '8.33', 2: '8.34' }),
          expense(3, 'Food', 2, { 1: '33.33' }),
          expense(4, 'TV for house', 1, { 2: '119.16' }),
        ],
      },
      myId: 1,
    });
    expect(result.youOwe[0].lines.map((l) => [l.title, l.offset])).toEqual([
      ['Rent', false],
      ['Food', false],
      ['Lunch', false],
      ['TV for house', true],
    ]);
  });

  it('ignores expenses paid by someone else or where the other person has no share', () => {
    const result = buildBalances({
      balances: { group_balances: [row(5, 2, '5.00', '0.00')] },
      emailsByGroup,
      expensesByGroup: {
        5: [expense(1, 'Pizza', 1, { 2: '5.00' }), expense(2, 'Gas', 3, { 1: '9.00', 2: '9.00' }), expense(3, 'Solo', 1, { 1: '7.00' })],
      },
      myId: 1,
    });
    expect(result.owedToYou[0].lines.map((l) => l.title)).toEqual(['Pizza']);
  });

  it('gives no lines when they do not add up to the balance, or the group has no expenses loaded', () => {
    const off = buildBalances({ balances, emailsByGroup, expensesByGroup: { 5: expenses.slice(1) }, myId: 1 });
    expect(off.owedToYou[0].lines).toEqual([]);
    const none = buildBalances({ balances, emailsByGroup, myId: 1 });
    expect(none.owedToYou[0].lines).toEqual([]);
  });
});

