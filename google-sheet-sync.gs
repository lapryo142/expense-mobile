/**
 * Google Sheet -> Supabase sync bridge.
 * DO NOT paste your service_role key into this file.
 * In Apps Script: Project Settings -> Script Properties, create:
 * SUPABASE_URL = https://cmejwdeklvmgqrollnqn.supabase.co
 * SUPABASE_SERVICE_ROLE = your service_role/secret key
 * APP_USER_ID = the Supabase Auth user UUID that owns the finance data
 *
 * This script is intentionally a second step. Run syncSheetToSupabase()
 * manually first; later you can add a time-driven trigger.
 */
function syncSheetToSupabase() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('SUPABASE_URL');
  const key = props.getProperty('SUPABASE_SERVICE_ROLE');
  const userId = props.getProperty('APP_USER_ID');
  if (!url || !key || !userId) throw new Error('Missing Script Properties');

  const sh = SpreadsheetApp.getActive().getSheetByName('2026');
  const blocks = {1:7,2:12,3:17,4:22,5:27,6:32,7:37,8:42}; // 1-based columns
  const rows = [];

  Object.keys(blocks).forEach(mm => {
    const month = Number(mm), c = blocks[mm];
    for (let r=4;r<=36;r++) {
      const desc = sh.getRange(r,c).getDisplayValue().trim();
      if (!desc || /^Đầu tháng/i.test(desc)) continue;
      const low = desc.toLowerCase();
      if (['tổng','đưa vợ','bỏ vào tiết kiệm','tiết kiệm','tổng tiết kiệm','còn lại','còn lại ngân hàng','chênh lệch (ăn uống)'].includes(low)) continue;
      const dateDisplay = sh.getRange(r,c+1).getDisplayValue().trim();
      const income = Number(sh.getRange(r,c+2).getValue() || 0);
      const expense = Number(sh.getRange(r,c+3).getValue() || 0);
      if (!income && !expense) continue;
      const m = dateDisplay.match(/^(\d{1,2})[\/-](\d{1,2})/);
      const day = m ? Number(m[1]) : null;
      const iso = day ? `2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null;
      rows.push({
        user_id:userId, year:2026, month, row_order:r, description:desc,
        txn_date:iso, income, expense, source:'sheet',
        source_key:`sheet-2026-${month}-${r}`
      });
    }
  });

  const endpoint = url + '/rest/v1/transactions?on_conflict=user_id,source_key';
  const options = {
    method:'post',
    contentType:'application/json',
    headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'resolution=merge-duplicates'},
    payload:JSON.stringify(rows),
    muteHttpExceptions:true
  };
  const res = UrlFetchApp.fetch(endpoint, options);
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}
