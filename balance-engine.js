/* Pure balance calculations. Bank/savings fields are reconciliation snapshots,
 * never running totals: changing a transaction changes the calculated balance. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HappyBalances = api;
})(globalThis, function () {
  'use strict';
  const key = (year, month) => Number(year) * 12 + Number(month) - 1;
  const parts = period => ({year: Math.floor(period / 12), month: period % 12 + 1});
  const iso = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const lastDay = (year, month) => new Date(year, month, 0).getDate();
  const number = value => Number(value || 0);
  const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd');
  const deleted = row => row.source === 'app_edited' && !String(row.description || '').trim() && !number(row.income) && !number(row.expense);
  const defaultCategory = row => /^(so du )?dau thang/.test(clean(row.description)) ? 'Số dư đầu tháng' : /rut (tien )?tiet kiem/.test(clean(row.description)) ? 'Rút tiết kiệm' : '';

  function context(rows, status, options = {}) {
    const category = options.categoryFor || defaultCategory;
    const normalizeDate = options.normalizeDate || (value => String(value || '').slice(0, 10));
    const active = rows.filter(row => !deleted(row));
    const year = number(status.year), month = number(status.month), end = iso(year, month, lastDay(year, month));
    const date = row => normalizeDate(row.txn_date, row.month) || end;
    const opening = row => category(row) === 'Số dư đầu tháng';
    const withdrawal = row => category(row) === 'Rút tiết kiệm';
    const later = options.isPayLater || (row => row.payment_method === 'pay_later' || row.source === 'app_pay_later');
    const wife = number(status.send_wife);
    // An actual expense row is already a debit; do not also debit its status card.
    const standaloneWife = wife && !active.some(row => number(row.expense) === wife && /gui vo|cho vo|chuyen vo/.test(clean(row.description))) ? wife : 0;
    const wifeDate = normalizeDate(status.send_wife_date, month) || end;
    const effects = cutoff => {
      let bank = 0, savings = 0, book = 0;
      for (const row of active) {
        if (date(row) > cutoff || opening(row)) continue;
        const income = number(row.income), expense = number(row.expense);
        book += income - expense;
        bank += income - (later(row) || row.payment_method === 'cash' || row.source === 'app_cash' ? 0 : expense);
        if (withdrawal(row)) savings -= income;
      }
      if (standaloneWife && wifeDate <= cutoff) {bank -= standaloneWife; book -= standaloneWife;}
      return {bank, savings, book};
    };
    return {active, opening, date, effects, end, normalizeDate};
  }

  // Legacy snapshots get a basis once, before any new edit/add/delete. Zero is
  // explicit when accompanied by a date; undated database defaults are absent.
  function checkpointFor(status, rows, options = {}) {
    const ctx = context(rows, status, options), existing = status.balance_checkpoint || {}, result = {...existing, version: 1};
    for (const kind of ['bank', 'savings']) {
      const field = `${kind}_balance`, rawDate = status[`${field}_date`];
      if (!rawDate && !number(status[field])) {delete result[kind]; continue;}
      const date = ctx.normalizeDate(rawDate, status.month) || ctx.end, amount = number(status[field]);
      const saved = existing[kind];
      if (saved && saved.date === date && saved.amount === amount && Number.isFinite(saved.basis)) continue;
      result[kind] = {date, amount, basis: ctx.effects(date)[kind]};
    }
    return result;
  }

  function build(rows, statuses, options = {}) {
    const target = key(options.year, options.month), grouped = new Map(), byPeriod = new Map();
    for (const row of rows) {
      const period = key(row.year, row.month);
      if (period > target || deleted(row)) continue;
      if (!grouped.has(period)) grouped.set(period, []);
      grouped.get(period).push(row);
    }
    for (const status of statuses) if (key(status.year, status.month) <= target) byPeriod.set(key(status.year, status.month), status);
    const earliest = Math.min(target, ...grouped.keys(), ...byPeriod.keys()), months = new Map();
    let previousBank = 0, previousSavings = 0;
    for (let period = earliest; period <= target; period++) {
      const {year, month} = parts(period), status = byPeriod.get(period) || {year, month}, monthlyRows = grouped.get(period) || [];
      const ctx = context(monthlyRows, status, options), checkpoint = checkpointFor(status, monthlyRows, options);
      const openingRows = ctx.active.filter(ctx.opening);
      const explicitOpening = !!checkpoint.start || openingRows.length > 0 || number(status.start_balance) !== 0;
      const opening = checkpoint.start || number(status.start_balance) !== 0 ? number(status.start_balance) : openingRows.length ? openingRows.reduce((sum, row) => sum + number(row.income) - number(row.expense), 0) : previousBank;
      const baseBank = opening, baseSavings = previousSavings;
      const at = day => {
        const date = iso(year, month, Math.max(1, Math.min(lastDay(year, month), day))), effects = ctx.effects(date);
        return {
          year, month, date, opening, inherited: !explicitOpening,
          bank: checkpoint.bank ? checkpoint.bank.amount + effects.bank - checkpoint.bank.basis : baseBank + effects.bank,
          savings: checkpoint.savings ? checkpoint.savings.amount + effects.savings - checkpoint.savings.basis : baseSavings + effects.savings,
          remaining: opening + effects.book,
          checkpoint, status
        };
      };
      const closing = at(lastDay(year, month));
      previousBank = closing.bank; previousSavings = closing.savings;
      months.set(period, {year, month, status, rows: monthlyRows, checkpoint, at, closing, effects: ctx.effects});
    }
    return {months, get: (year, month) => months.get(key(year, month))};
  }
  return {build, checkpointFor, context, key, lastDay};
});
