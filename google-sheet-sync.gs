/**
 * Expense Mobile V8 Clean - bidirectional Google Sheet <-> Supabase sync.
 *
 * Supabase remains the canonical transaction store. Google Sheet keeps its
 * existing horizontal month layout and acts as a second editing surface.
 *
 * Script Properties required:
 *   SUPABASE_URL          https://cmejwdeklvmgqrollnqn.supabase.co
 *   SUPABASE_SERVICE_ROLE Supabase service_role/secret key
 *   APP_USER_ID           Supabase Auth user UUID that owns the data
 *
 * Security: never paste the service_role key into this source file.
 */

const EXPENSE_SYNC = {
  sheetName: '2026',
  year: 2026,
  firstDataRow: 4,
  maxAutomaticNewRows: 25,
  descriptionColumns: { 1: 7, 2: 12, 3: 17, 4: 22, 5: 27, 6: 32, 7: 37, 8: 42 },
  idNotePrefix: 'expense-sync-id:',
  ignoredLabels: [
    'tổng', 'đưa vợ', 'bỏ vào tiết kiệm', 'tiết kiệm', 'tổng tiết kiệm',
    'còn lại', 'còn lại ngân hàng', 'chênh lệch (ăn uống)'
  ]
};

/**
 * Main function for a manual run or a time-driven trigger.
 * Order matters: Sheet edits are uploaded first, then Supabase additions are
 * downloaded. This prevents a remote copy from overwriting the latest Sheet edit.
 */
function syncExpenseBidirectional() {
  const config = getExpenseSyncConfig_();
  const sheet = getExpenseSheet_();
  // Fetch first so the initial run can adopt the IDs already created by the
  // V8 seed import. Never invent a second ID for an existing Sheet row.
  const initialRemoteRows = fetchTransactions_(config);
  // Apply explicit App edits to their existing Sheet rows before the normal
  // Sheet-first upload. This preserves the same source_key and prevents an old
  // Sheet value from overwriting a deliberate long-press edit in the App.
  applyPendingAppEditsToSheet_(sheet, initialRemoteRows);
  const sheetRows = readExpenseSheetRows_(sheet, initialRemoteRows);

  const remoteIds = new Set(initialRemoteRows.map(row => row.source_key).filter(Boolean));
  const unmatchedSheetRows = sheetRows.filter(row => !remoteIds.has(row.source_key));
  if (unmatchedSheetRows.length > EXPENSE_SYNC.maxAutomaticNewRows) {
    throw new Error(
      'Safety stop: ' + unmatchedSheetRows.length +
      ' Sheet rows did not match Supabase. No database write was made.'
    );
  }

  if (sheetRows.length) upsertTransactions_(config, sheetRows);

  const remoteRows = fetchTransactions_(config);
  const result = writeMissingRemoteRowsToSheet_(sheet, remoteRows);

  SpreadsheetApp.flush();
  Logger.log(JSON.stringify({
    uploadedFromSheet: sheetRows.length,
    downloadedToSheet: result.inserted,
    alreadyInSheet: result.existing
  }));
}

/** Backwards-compatible name used by the old setup instructions. */
function syncSheetToSupabase() {
  syncExpenseBidirectional();
}

/** Run once after adding the script to confirm credentials without writing. */
function testExpenseSyncConnection() {
  const config = getExpenseSyncConfig_();
  const rows = fetchTransactions_(config);
  Logger.log('Supabase connection OK. Transactions found: ' + rows.length);
}

/** Optional helper: creates a 5-minute time-driven trigger. Run only once. */
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

function getExpenseSheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(EXPENSE_SYNC.sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + EXPENSE_SYNC.sheetName);
  return sheet;
}

function readExpenseSheetRows_(sheet, remoteRows) {
  const rows = [];
  const claimedRemoteIds = new Set();

  Object.keys(EXPENSE_SYNC.descriptionColumns).forEach(monthKey => {
    const month = Number(monthKey);
    const column = EXPENSE_SYNC.descriptionColumns[month];
    const totalRow = findMonthTotalRow_(sheet, column);
    const rowCount = Math.max(0, totalRow - EXPENSE_SYNC.firstDataRow);
    if (!rowCount) return;

    const range = sheet.getRange(EXPENSE_SYNC.firstDataRow, column, rowCount, 4);
    const values = range.getValues();
    const displays = range.getDisplayValues();
    const notes = sheet.getRange(EXPENSE_SYNC.firstDataRow, column, rowCount, 1).getNotes();

    values.forEach((row, index) => {
      const description = String(displays[index][0] || '').trim();
      if (!isTransactionDescription_(description)) return;

      const income = toInteger_(row[2]);
      const expense = toInteger_(row[3]);
      if (!income && !expense) return;

      const sheetRow = EXPENSE_SYNC.firstDataRow + index;
      let sourceKey = readSyncId_(notes[index][0]);
      if (!sourceKey) {
        const draft = {
          year: EXPENSE_SYNC.year,
          month: month,
          row_order: sheetRow,
          description: description,
          txn_date: parseExpenseDate_(row[1], displays[index][1], month),
          income: income,
          expense: expense
        };
        const match = findUnclaimedRemoteMatch_(draft, remoteRows || [], claimedRemoteIds);
        sourceKey = match && match.source_key
          ? match.source_key
          : 'sheet-' + Utilities.getUuid();
        sheet.getRange(sheetRow, column).setNote(EXPENSE_SYNC.idNotePrefix + sourceKey);
      }
      claimedRemoteIds.add(sourceKey);

      rows.push({
        user_id: null, // filled immediately before the API request
        year: EXPENSE_SYNC.year,
        month: month,
        row_order: sheetRow,
        description: description,
        txn_date: parseExpenseDate_(row[1], displays[index][1], month),
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

  // Row order is the strongest discriminator for repeated descriptions such as
  // Tennis, Shopee or Rút tiết kiệm. Date is the fallback when a row moved.
  const sameRow = candidates.find(remote => Number(remote.row_order) === Number(sheetRow.row_order));
  if (sameRow) return sameRow;
  const sameDate = candidates.find(remote => String(remote.txn_date || '') === String(sheetRow.txn_date || ''));
  return sameDate || (candidates.length === 1 ? candidates[0] : null);
}

function fetchTransactions_(config) {
  const query = [
    'user_id=eq.' + encodeURIComponent(config.userId),
    'year=eq.' + EXPENSE_SYNC.year,
    'select=id,year,month,row_order,description,txn_date,income,expense,source,source_key,updated_at',
    'order=month.asc,row_order.asc,created_at.asc'
  ].join('&');
  return requestSupabase_(config, '/rest/v1/transactions?' + query, { method: 'get' });
}

function upsertTransactions_(config, rows) {
  const payload = rows.map(row => Object.assign({}, row, { user_id: config.userId }));
  requestSupabase_(
    config,
    '/rest/v1/transactions?on_conflict=user_id,source_key',
    {
      method: 'post',
      payload: JSON.stringify(payload),
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
    }
  );
}

function applyPendingAppEditsToSheet_(sheet, remoteRows) {
  const pending = (remoteRows || []).filter(row => row.source === 'app_edited' && row.source_key);
  pending.forEach(transaction => {
    const existing = findSheetRowBySyncId_(sheet, transaction.source_key);
    const targetColumn = EXPENSE_SYNC.descriptionColumns[Number(transaction.month)];
    if (!targetColumn) return;

    let targetRow;
    if (existing && existing.column === targetColumn) {
      targetRow = existing.row;
    } else {
      if (existing) {
        sheet.getRange(existing.row, existing.column, 1, 4).clearContent();
        sheet.getRange(existing.row, existing.column).clearNote();
      }
      targetRow = findWritableRow_(sheet, targetColumn);
    }

    sheet.getRange(targetRow, targetColumn, 1, 4).setValues([[
      transaction.description || '',
      transaction.txn_date ? new Date(transaction.txn_date + 'T12:00:00') : '',
      toInteger_(transaction.income),
      toInteger_(transaction.expense)
    ]]);
    sheet.getRange(targetRow, targetColumn + 1).setNumberFormat('dd/MM');
    sheet.getRange(targetRow, targetColumn).setNote(EXPENSE_SYNC.idNotePrefix + transaction.source_key);
  });
}

function findSheetRowBySyncId_(sheet, sourceKey) {
  const wanted = String(sourceKey || '');
  const months = Object.keys(EXPENSE_SYNC.descriptionColumns);
  for (let monthIndex = 0; monthIndex < months.length; monthIndex += 1) {
    const column = EXPENSE_SYNC.descriptionColumns[Number(months[monthIndex])];
    const totalRow = findMonthTotalRow_(sheet, column);
    const count = Math.max(0, totalRow - EXPENSE_SYNC.firstDataRow);
    if (!count) continue;
    const notes = sheet.getRange(EXPENSE_SYNC.firstDataRow, column, count, 1).getNotes();
    for (let index = 0; index < notes.length; index += 1) {
      if (readSyncId_(notes[index][0]) === wanted) {
        return { row: EXPENSE_SYNC.firstDataRow + index, column: column };
      }
    }
  }
  return null;
}

function writeMissingRemoteRowsToSheet_(sheet, remoteRows) {
  const existingIds = collectSheetSyncIds_(sheet);
  const missingRows = remoteRows.filter(row => row.source_key && !existingIds.has(row.source_key));
  if (missingRows.length > EXPENSE_SYNC.maxAutomaticNewRows) {
    throw new Error(
      'Safety stop: ' + missingRows.length +
      ' Supabase rows did not match the Sheet. No transaction rows were inserted.'
    );
  }
  let inserted = 0;
  let existing = 0;

  remoteRows.forEach(transaction => {
    if (!transaction.source_key) return;
    if (existingIds.has(transaction.source_key)) {
      existing += 1;
      return;
    }

    const month = Number(transaction.month);
    const column = EXPENSE_SYNC.descriptionColumns[month];
    if (!column) return;

    const targetRow = findWritableRow_(sheet, column);
    const values = [[
      transaction.description || '',
      transaction.txn_date ? new Date(transaction.txn_date + 'T12:00:00') : '',
      toInteger_(transaction.income),
      toInteger_(transaction.expense)
    ]];

    sheet.getRange(targetRow, column, 1, 4).setValues(values);
    sheet.getRange(targetRow, column + 1).setNumberFormat('dd/MM');
    sheet.getRange(targetRow, column).setNote(EXPENSE_SYNC.idNotePrefix + transaction.source_key);
    existingIds.add(transaction.source_key);
    inserted += 1;
  });

  return { inserted: inserted, existing: existing };
}

function collectSheetSyncIds_(sheet) {
  const ids = new Set();
  Object.keys(EXPENSE_SYNC.descriptionColumns).forEach(monthKey => {
    const column = EXPENSE_SYNC.descriptionColumns[Number(monthKey)];
    const totalRow = findMonthTotalRow_(sheet, column);
    const count = Math.max(0, totalRow - EXPENSE_SYNC.firstDataRow);
    if (!count) return;
    sheet.getRange(EXPENSE_SYNC.firstDataRow, column, count, 1).getNotes().forEach(row => {
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

  // This month has no empty transaction row. Insert a complete spreadsheet row
  // before the summary line so every month block and its formulas stay aligned.
  sheet.insertRowBefore(totalRow);
  return totalRow;
}

function findMonthTotalRow_(sheet, descriptionColumn) {
  const lastRow = Math.max(sheet.getLastRow(), EXPENSE_SYNC.firstDataRow);
  const displays = sheet
    .getRange(EXPENSE_SYNC.firstDataRow, descriptionColumn, lastRow - EXPENSE_SYNC.firstDataRow + 1, 1)
    .getDisplayValues();

  for (let index = 0; index < displays.length; index += 1) {
    if (normalizeLabel_(displays[index][0]) === 'tổng') return EXPENSE_SYNC.firstDataRow + index;
  }
  throw new Error('Could not find TỔNG row in column ' + descriptionColumn + '.');
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
  return value.indexOf(EXPENSE_SYNC.idNotePrefix) === 0
    ? value.slice(EXPENSE_SYNC.idNotePrefix.length).trim()
    : '';
}

function transactionSourceFromKey_(sourceKey) {
  const key = String(sourceKey || '');
  if (key.indexOf('app-') === 0) return 'app';
  if (key.indexOf('sheet-') === 0) return 'sheet_new';
  return 'sheet';
}

function parseExpenseDate_(rawValue, displayValue, month) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return Utilities.formatDate(rawValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const match = String(displayValue || '').match(/^(\d{1,2})[\/-](\d{1,2})/);
  if (!match) return null;
  const day = Number(match[1]);
  const parsedMonth = Number(match[2]) || month;
  if (day < 1 || day > 31 || parsedMonth < 1 || parsedMonth > 12) return null;
  return EXPENSE_SYNC.year + '-' + pad2_(parsedMonth) + '-' + pad2_(day);
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

