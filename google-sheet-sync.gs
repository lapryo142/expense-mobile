/**
 * Happy Money - bidirectional Google Sheet <-> Supabase sync.
 *
 * Supabase remains the canonical transaction store. Google Sheet keeps the
 * existing horizontal month layout and acts as a second editing surface.
 *
 * Year tabs are discovered automatically from numeric tab names (2026, 2027…).
 * Month blocks are discovered automatically from row 2 headers
 * (JANUARY ... DECEMBER). No code change is needed when a new month/year is added.
 *
 * Script Properties required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE
 *   APP_USER_ID
 */

const EXPENSE_SYNC = {
  firstSupportedYear: 2026,
  monthHeaderRow: 2,
  firstDataRow: 4,
  maxAutomaticNewRows: 25,
  idNotePrefix: 'expense-sync-id:',
  monthNames: {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
  },
  statusRows: {
    send_wife: { labels: ['đưa vợ', 'gửi vợ'], dateField: 'send_wife_date' },
    savings_balance: { labels: ['tổng tiết kiệm'], dateField: 'savings_balance_date' },
    bank_balance: { labels: ['còn lại ngân hàng', 'còn lại trong ngân hàng'], dateField: 'bank_balance_date' }
  },
  ignoredLabels: [
    'tổng', 'đưa vợ', 'gửi vợ', 'bỏ vào tiết kiệm', 'tiết kiệm', 'tổng tiết kiệm',
    'còn lại', 'còn lại ngân hàng', 'còn lại trong ngân hàng', 'chênh lệch (ăn uống)'
  ]
};

function syncExpenseBidirectional() {
  const config = getExpenseSyncConfig_();
  const contexts = getExpenseYearContexts_();
  if (!contexts.length) throw new Error('Không tìm thấy tab năm hợp lệ (ví dụ 2026, 2027).');

  const totals = { uploadedFromSheet: 0, downloadedToSheet: 0, alreadyInSheet: 0, monthlyStatusCellsUpdated: 0 };

  contexts.forEach(context => {
    const initialRemoteRows = fetchTransactions_(config, context.year);
    applyPendingAppEditsToSheet_(context, initialRemoteRows);
    const sheetRows = readExpenseSheetRows_(context, initialRemoteRows);

    const remoteIds = new Set(initialRemoteRows.map(row => row.source_key).filter(Boolean));
    const unmatchedSheetRows = sheetRows.filter(row => !remoteIds.has(row.source_key));
    if (unmatchedSheetRows.length > EXPENSE_SYNC.maxAutomaticNewRows) {
      throw new Error(
        'Safety stop ' + context.year + ': ' + unmatchedSheetRows.length +
        ' Sheet rows did not match Supabase. No database write was made.'
      );
    }

    if (sheetRows.length) upsertTransactions_(config, sheetRows);
    totals.uploadedFromSheet += sheetRows.length;

    const remoteRows = fetchTransactions_(config, context.year);
    const result = writeMissingRemoteRowsToSheet_(context, remoteRows);
    totals.downloadedToSheet += result.inserted;
    totals.alreadyInSheet += result.existing;

    const statusResult = syncMonthlyStatusesToSheet_(config, context);
    totals.monthlyStatusCellsUpdated += statusResult.updated;
  });

  SpreadsheetApp.flush();
  Logger.log(JSON.stringify(totals));
}

function syncSheetToSupabase() {
  syncExpenseBidirectional();
}

function testExpenseSyncConnection() {
  const config = getExpenseSyncConfig_();
  const contexts = getExpenseYearContexts_();
  const count = contexts.reduce((sum, context) => sum + fetchTransactions_(config, context.year).length, 0);
  Logger.log('Supabase connection OK. Transactions found: ' + count);
}

function installExpenseSyncTrigger() {
  const handler = 'syncExpenseBidirectional';
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === handler)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(5).create();
  Logger.log('Installed one 5-minute trigger for ' + handler);
}

function getExpenseSyncConfig_() {
  const props = PropertiesService.getScriptProperties();
  const config = {
    url: String(props.getProperty('SUPABASE_URL') || '').replace(/\/$/, ''),
    key: props.getProperty('SUPABASE_SERVICE_ROLE'),
    userId: props.getProperty('APP_USER_ID')
  };
  if (!config.url || !config.key || !config.userId) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE or APP_USER_ID in Script Properties.');
  }
  return config;
}

function getExpenseYearContexts_() {
  return SpreadsheetApp.getActive().getSheets()
    .map(sheet => {
      const title = String(sheet.getName() || '').trim();
      if (!/^\d{4}$/.test(title)) return null;
      const year = Number(title);
      if (year < EXPENSE_SYNC.firstSupportedYear) return null;
      const monthColumns = detectMonthColumns_(sheet);
      if (!Object.keys(monthColumns).length) return null;
      return { sheet: sheet, year: year, monthColumns: monthColumns };
    })
    .filter(Boolean)
    .sort((a, b) => a.year - b.year);
}

function detectMonthColumns_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(EXPENSE_SYNC.monthHeaderRow, 1, 1, lastColumn).getDisplayValues()[0];
  const result = {};
  headers.forEach((value, index) => {
    const key = normalizeLabel_(value);
    const month = EXPENSE_SYNC.monthNames[key];
    if (month && !result[month]) result[month] = index + 1;
  });
  return result;
}

function fetchMonthlyStatuses_(config, year) {
  const query = [
    'user_id=eq.' + encodeURIComponent(config.userId),
    'year=eq.' + year,
    'select=year,month,bank_balance,bank_balance_date,savings_balance,savings_balance_date,send_wife,send_wife_date,updated_at',
    'order=month.asc'
  ].join('&');
  return requestSupabase_(config, '/rest/v1/monthly_status?' + query, { method: 'get' });
}

function syncMonthlyStatusesToSheet_(config, context) {
  const statuses = fetchMonthlyStatuses_(config, context.year);
  let updated = 0;

  (statuses || []).forEach(status => {
    const month = Number(status.month);
    const descriptionColumn = context.monthColumns[month];
    if (!descriptionColumn) return;

    Object.keys(EXPENSE_SYNC.statusRows).forEach(field => {
      const rowConfig = EXPENSE_SYNC.statusRows[field];
      const value = status[field];
      if (value === null || value === undefined || value === '') return;

      const targetRow = findSummaryRowByLabels_(context.sheet, descriptionColumn, rowConfig.labels);
      if (!targetRow) return;

      const rawDate = status[rowConfig.dateField] || String(status.updated_at || '').slice(0, 10);
      const dateValue = rawDate ? new Date(String(rawDate).slice(0, 10) + 'T12:00:00') : '';
      context.sheet.getRange(targetRow, descriptionColumn + 1).setValue(dateValue);
      if (dateValue) context.sheet.getRange(targetRow, descriptionColumn + 1).setNumberFormat('dd/MM');
      context.sheet.getRange(targetRow, descriptionColumn + 3).setValue(toInteger_(value));
      updated += 2;
    });
  });

  return { updated: updated };
}

function findSummaryRowByLabels_(sheet, descriptionColumn, labels) {
  const totalRow = findMonthTotalRow_(sheet, descriptionColumn);
  const lastRow = Math.min(sheet.getLastRow(), totalRow + 20);
  const count = Math.max(0, lastRow - totalRow);
  if (!count) return null;
  const wanted = new Set((labels || []).map(normalizeLabel_));
  const displays = sheet.getRange(totalRow + 1, descriptionColumn, count, 1).getDisplayValues();
  for (let index = 0; index < displays.length; index += 1) {
    if (wanted.has(normalizeLabel_(displays[index][0]))) return totalRow + 1 + index;
  }
  return null;
}

function readExpenseSheetRows_(context, remoteRows) {
  const rows = [];
  const claimedRemoteIds = new Set();

  Object.keys(context.monthColumns).map(Number).sort((a, b) => a - b).forEach(month => {
    const column = context.monthColumns[month];
    const totalRow = findMonthTotalRow_(context.sheet, column);
    const rowCount = Math.max(0, totalRow - EXPENSE_SYNC.firstDataRow);
    if (!rowCount) return;

    const range = context.sheet.getRange(EXPENSE_SYNC.firstDataRow, column, rowCount, 4);
    const values = range.getValues();
    const displays = range.getDisplayValues();
    const notes = context.sheet.getRange(EXPENSE_SYNC.firstDataRow, column, rowCount, 1).getNotes();

    values.forEach((row, index) => {
      const description = String(displays[index][0] || '').trim();
      if (!isTransactionDescription_(description)) return;
      const income = toInteger_(row[2]);
      const expense = toInteger_(row[3]);
      if (!income && !expense) return;

      const sheetRow = EXPENSE_SYNC.firstDataRow + index;
      let sourceKey = readSyncId_(notes[index][0]);

      // When a month block is copied, Google Sheets also copies notes. A copied
      // August sync ID must never become the September transaction ID.
      if (sourceKey && claimedRemoteIds.has(sourceKey)) sourceKey = '';
      if (sourceKey) {
        const remoteWithId = (remoteRows || []).find(remote => remote.source_key === sourceKey);
        if (remoteWithId && (Number(remoteWithId.year) !== context.year || Number(remoteWithId.month) !== month)) {
          sourceKey = '';
        }
      }

      if (!sourceKey) {
        const draft = {
          year: context.year,
          month: month,
          row_order: sheetRow,
          description: description,
          txn_date: parseExpenseDate_(row[1], displays[index][1], context.year, month),
          income: income,
          expense: expense
        };
        const match = findUnclaimedRemoteMatch_(draft, remoteRows || [], claimedRemoteIds);
        sourceKey = match && match.source_key ? match.source_key : 'sheet-' + Utilities.getUuid();
        context.sheet.getRange(sheetRow, column).setNote(EXPENSE_SYNC.idNotePrefix + sourceKey);
      }
      claimedRemoteIds.add(sourceKey);

      rows.push({
        user_id: null,
        year: context.year,
        month: month,
        row_order: sheetRow,
        description: description,
        txn_date: parseExpenseDate_(row[1], displays[index][1], context.year, month),
        income: income,
        expense: expense,
        source: transactionSourceFromKey_(sourceKey),
        source_key: sourceKey,
        updated_at: new Date().toISOString()
      });
    });
  });

  return rows;
}

function findUnclaimedRemoteMatch_(sheetRow, remoteRows, claimedIds) {
  const candidates = remoteRows.filter(remote => {
    if (!remote.source_key || claimedIds.has(remote.source_key)) return false;
    return Number(remote.year) === Number(sheetRow.year) &&
      Number(remote.month) === Number(sheetRow.month) &&
      normalizeLabel_(remote.description) === normalizeLabel_(sheetRow.description) &&
      toInteger_(remote.income) === toInteger_(sheetRow.income) &&
      toInteger_(remote.expense) === toInteger_(sheetRow.expense);
  });
  if (!candidates.length) return null;
  const sameRow = candidates.find(remote => Number(remote.row_order) === Number(sheetRow.row_order));
  if (sameRow) return sameRow;
  const sameDate = candidates.find(remote => String(remote.txn_date || '') === String(sheetRow.txn_date || ''));
  return sameDate || (candidates.length === 1 ? candidates[0] : null);
}

function fetchTransactions_(config, year) {
  const query = [
    'user_id=eq.' + encodeURIComponent(config.userId),
    'year=eq.' + year,
    'select=id,year,month,row_order,description,txn_date,income,expense,source,source_key,updated_at',
    'order=month.asc,row_order.asc,created_at.asc'
  ].join('&');
  return requestSupabase_(config, '/rest/v1/transactions?' + query, { method: 'get' }) || [];
}

function upsertTransactions_(config, rows) {
  const payload = rows.map(row => Object.assign({}, row, { user_id: config.userId }));
  requestSupabase_(config, '/rest/v1/transactions?on_conflict=user_id,source_key', {
    method: 'post',
    payload: JSON.stringify(payload),
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
  });
}

function applyPendingAppEditsToSheet_(context, remoteRows) {
  const pending = (remoteRows || []).filter(row => row.source === 'app_edited' && row.source_key);
  pending.forEach(transaction => {
    const targetColumn = context.monthColumns[Number(transaction.month)];
    if (!targetColumn) return;
    const existing = findSheetRowBySyncId_(context, transaction.source_key);
    let targetRow;

    if (existing && existing.column === targetColumn) {
      targetRow = existing.row;
    } else {
      if (existing) {
        context.sheet.getRange(existing.row, existing.column, 1, 4).clearContent();
        context.sheet.getRange(existing.row, existing.column).clearNote();
      }
      targetRow = findWritableRow_(context.sheet, targetColumn);
    }

    context.sheet.getRange(targetRow, targetColumn, 1, 4).setValues([[
      transaction.description || '',
      transaction.txn_date ? new Date(transaction.txn_date + 'T12:00:00') : '',
      toInteger_(transaction.income),
      toInteger_(transaction.expense)
    ]]);
    context.sheet.getRange(targetRow, targetColumn + 1).setNumberFormat('dd/MM');
    context.sheet.getRange(targetRow, targetColumn).setNote(EXPENSE_SYNC.idNotePrefix + transaction.source_key);
  });
}

function findSheetRowBySyncId_(context, sourceKey) {
  const wanted = String(sourceKey || '');
  const months = Object.keys(context.monthColumns).map(Number).sort((a, b) => a - b);
  for (let monthIndex = 0; monthIndex < months.length; monthIndex += 1) {
    const column = context.monthColumns[months[monthIndex]];
    const totalRow = findMonthTotalRow_(context.sheet, column);
    const count = Math.max(0, totalRow - EXPENSE_SYNC.firstDataRow);
    if (!count) continue;
    const notes = context.sheet.getRange(EXPENSE_SYNC.firstDataRow, column, count, 1).getNotes();
    for (let index = 0; index < notes.length; index += 1) {
      if (readSyncId_(notes[index][0]) === wanted) return { row: EXPENSE_SYNC.firstDataRow + index, column: column };
    }
  }
  return null;
}

function writeMissingRemoteRowsToSheet_(context, remoteRows) {
  const existingIds = collectSheetSyncIds_(context);
  const missingRows = remoteRows.filter(row => row.source_key && context.monthColumns[Number(row.month)] && !existingIds.has(row.source_key));
  if (missingRows.length > EXPENSE_SYNC.maxAutomaticNewRows) {
    throw new Error(
      'Safety stop ' + context.year + ': ' + missingRows.length +
      ' Supabase rows did not match the Sheet. No transaction rows were inserted.'
    );
  }

  let inserted = 0;
  let existing = 0;
  remoteRows.forEach(transaction => {
    if (!transaction.source_key) return;
    if (existingIds.has(transaction.source_key)) { existing += 1; return; }
    const column = context.monthColumns[Number(transaction.month)];
    if (!column) return;

    const targetRow = findWritableRow_(context.sheet, column);
    context.sheet.getRange(targetRow, column, 1, 4).setValues([[
      transaction.description || '',
      transaction.txn_date ? new Date(transaction.txn_date + 'T12:00:00') : '',
      toInteger_(transaction.income),
      toInteger_(transaction.expense)
    ]]);
    context.sheet.getRange(targetRow, column + 1).setNumberFormat('dd/MM');
    context.sheet.getRange(targetRow, column).setNote(EXPENSE_SYNC.idNotePrefix + transaction.source_key);
    existingIds.add(transaction.source_key);
    inserted += 1;
  });
  return { inserted: inserted, existing: existing };
}

function collectSheetSyncIds_(context) {
  const ids = new Set();
  Object.keys(context.monthColumns).forEach(monthKey => {
    const column = context.monthColumns[Number(monthKey)];
    const totalRow = findMonthTotalRow_(context.sheet, column);
    const count = Math.max(0, totalRow - EXPENSE_SYNC.firstDataRow);
    if (!count) return;
    context.sheet.getRange(EXPENSE_SYNC.firstDataRow, column, count, 1).getNotes().forEach(row => {
      const id = readSyncId_(row[0]);
      if (id) ids.add(id);
    });
  });
  return ids;
}

function findWritableRow_(sheet, descriptionColumn) {
  let totalRow = findMonthTotalRow_(sheet, descriptionColumn);
  for (let row = EXPENSE_SYNC.firstDataRow; row < totalRow; row += 1) {
    if (!String(sheet.getRange(row, descriptionColumn).getDisplayValue() || '').trim()) return row;
  }
  sheet.insertRowBefore(totalRow);
  return totalRow;
}

function findMonthTotalRow_(sheet, descriptionColumn) {
  const lastRow = Math.max(sheet.getLastRow(), EXPENSE_SYNC.firstDataRow);
  const displays = sheet.getRange(
    EXPENSE_SYNC.firstDataRow,
    descriptionColumn,
    lastRow - EXPENSE_SYNC.firstDataRow + 1,
    1
  ).getDisplayValues();
  for (let index = 0; index < displays.length; index += 1) {
    if (normalizeLabel_(displays[index][0]) === 'tổng') return EXPENSE_SYNC.firstDataRow + index;
  }
  throw new Error('Could not find TỔNG row in ' + sheet.getName() + ', column ' + descriptionColumn + '.');
}

function isTransactionDescription_(description) {
  if (!description || /^đầu tháng/i.test(description)) return false;
  return EXPENSE_SYNC.ignoredLabels.indexOf(normalizeLabel_(description)) === -1;
}

function normalizeLabel_(value) {
  return String(value || '').trim().toLowerCase();
}

function readSyncId_(note) {
  const value = String(note || '').trim();
  return value.indexOf(EXPENSE_SYNC.idNotePrefix) === 0 ? value.slice(EXPENSE_SYNC.idNotePrefix.length).trim() : '';
}

function transactionSourceFromKey_(sourceKey) {
  const key = String(sourceKey || '');
  if (key.indexOf('app-pay-later-') === 0) return 'app_pay_later';
  if (key.indexOf('app-cash-') === 0) return 'app_cash';
  if (key.indexOf('app-') === 0) return 'app';
  if (key.indexOf('sheet-') === 0) return 'sheet_new';
  return 'sheet';
}

function parseExpenseDate_(rawValue, displayValue, year, month) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    const day = Number(Utilities.formatDate(rawValue, Session.getScriptTimeZone(), 'd'));
    return year + '-' + pad2_(month) + '-' + pad2_(day);
  }
  const match = String(displayValue || '').match(/^(\d{1,2})[\/-](\d{1,2})/);
  if (!match) return null;
  const day = Number(match[1]);
  if (day < 1 || day > 31) return null;
  return year + '-' + pad2_(month) + '-' + pad2_(day);
}

function toInteger_(value) {
  if (typeof value === 'number') return Math.round(value || 0);
  return Number(String(value || '').replace(/[^0-9-]/g, '')) || 0;
}

function pad2_(number) {
  return String(number).padStart(2, '0');
}

function requestSupabase_(config, path, options) {
  const request = Object.assign({}, options || {});
  request.contentType = 'application/json';
  request.muteHttpExceptions = true;
  request.headers = Object.assign({
    apikey: config.key,
    Authorization: 'Bearer ' + config.key
  }, request.headers || {});

  const response = UrlFetchApp.fetch(config.url + path, request);
  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('Supabase request failed (' + status + '): ' + body);
  }
  return body ? JSON.parse(body) : null;
}
