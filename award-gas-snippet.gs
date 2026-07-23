/* ══════════════════════════════════════════════════════════════════════════
   TSMCSD 2026 — 優秀海報論文現場評選　後端擴充
   搭配前端：poster-award.html
   ──────────────────────────────────────────────────────────────────────────
   安裝方式（3 步驟）
   ──────────────────────────────────────────────────────────────────────────
   1. 打開既有的 Apps Script 專案（就是 poster-review.html 在用的那一支，
      網址 .../macros/s/AKfycbz2njUGr6eORWe6V5iMITA_dbpu.../exec）

   2. 把「整份檔案」的內容貼到專案最下方（或新增一個 award.gs 檔案貼進去）

   3. 找到既有的 doGet(e) 函式，在它的「最開頭」插入這兩行：

          var __aw = handleAwardAction(e);
          if (__aw) return __aw;

      例如：

          function doGet(e) {
            var __aw = handleAwardAction(e);      // ← 新增
            if (__aw) return __aw;                // ← 新增

            var action = e.parameter.action;      // ← 原本的程式碼從這裡繼續
            ...
          }

   4. 部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選「新版本」→ 部署
      ※ 一定要建立「新版本」，否則不會生效。網址不會改變。

   ──────────────────────────────────────────────────────────────────────────
   設計說明
   ──────────────────────────────────────────────────────────────────────────
   • 本檔案只讀寫自己建立的兩張工作表，不碰任何既有資料：
       「優秀海報評分」 「優秀海報名次」
     兩張表都會在第一次使用時自動建立，不需要手動開。
   • 完全不依賴既有函式或既有工作表的欄位結構。
   • 若之後要移除本功能，刪掉這個檔案 + doGet 那兩行即可，其餘不受影響。
   ══════════════════════════════════════════════════════════════════════════ */

/** 工作表名稱 —— 如需改名，改這兩個常數即可 */
var AWARD_SHEET_SCORES = '優秀海報評分';
var AWARD_SHEET_RANKS  = '優秀海報名次';

var AWARD_HEADERS_SCORES = [
  '時間戳記','評審帳號','評審姓名','論文ID','論文編號','論文題目',
  '總分','評語','各向度分數(JSON)','狀態'
];
var AWARD_HEADERS_RANKS = ['論文ID','名次','更新時間'];


/* ══════════════════════════════════════════════════════════════
   路由：回傳 ContentService 輸出代表「本檔案已處理」；
        回傳 null 代表「不是本檔案負責的 action」，交還給原本的 doGet。
══════════════════════════════════════════════════════════════ */
function handleAwardAction(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action.indexOf('award') !== 0) return null;   // 只接手 award* 開頭的 action

  try {
    switch (action) {
      case 'awardSubmitScore': return _awardJson(awardSubmitScore_(e.parameter));
      case 'awardSaveDraft':   return _awardJson(awardSaveDraft_(e.parameter));
      case 'awardGetMyScores': return _awardJson(awardGetMyScores_(e.parameter));
      case 'awardGetScores':   return _awardJson(awardGetScores_());
      case 'awardSaveRank':    return _awardJson(awardSaveRank_(e.parameter));
      case 'awardGetRank':     return _awardJson({ success: true, ranks: _awardReadRanks_() });
      case 'awardPing':        return _awardJson({ success: true, version: '1.0', time: new Date() });
      default:
        return _awardJson({ success: false, message: '未知的 award action：' + action });
    }
  } catch (err) {
    return _awardJson({ success: false, message: String(err && err.message || err) });
  }
}

function _awardJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ══════════════════════════════════════════════════════════════
   工作表存取
══════════════════════════════════════════════════════════════ */
function _awardSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#3a4550')
      .setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function _awardScoresSheet_() { return _awardSheet_(AWARD_SHEET_SCORES, AWARD_HEADERS_SCORES); }
function _awardRanksSheet_()  { return _awardSheet_(AWARD_SHEET_RANKS,  AWARD_HEADERS_RANKS);  }

/** 去掉前端備援模式可能加上的 AW_ 前綴，統一以原始 paperId 儲存 */
function _awardCleanId_(pid) {
  pid = String(pid || '').trim();
  return pid.indexOf('AW_') === 0 ? pid.substring(3) : pid;
}

function _awardParseScores_(json) {
  try {
    var o = JSON.parse(json || '{}');
    return (o && typeof o === 'object') ? o : {};
  } catch (err) { return {}; }
}


/* ══════════════════════════════════════════════════════════════
   寫入：提交 / 暫存
   同一位評審 + 同一篇論文 只會有一列，重複送出即覆蓋。
   使用 LockService 避免多位評審同時提交造成覆寫。
══════════════════════════════════════════════════════════════ */
function _awardUpsert_(p, status) {
  var user  = String(p.reviewerUsername || '').trim();
  var pid   = _awardCleanId_(p.paperId);
  if (!user) return { success: false, message: '缺少 reviewerUsername' };
  if (!pid)  return { success: false, message: '缺少 paperId' };

  var scores = _awardParseScores_(p.scoresJson);
  var total  = Number(p.total);
  if (isNaN(total)) {
    total = 0;
    for (var k in scores) { var v = Number(scores[k]); if (!isNaN(v)) total += v; }
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (err) { return { success: false, message: '系統忙碌中，請稍候再試' }; }

  try {
    var sh   = _awardScoresSheet_();
    var last = sh.getLastRow();
    var rowIndex = -1;

    if (last > 1) {
      // B 欄 = 評審帳號、D 欄 = 論文ID
      var keys = sh.getRange(2, 2, last - 1, 3).getValues();   // B..D
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i][0]).trim() === user && String(keys[i][2]).trim() === pid) {
          rowIndex = i + 2;
          break;
        }
      }
    }

    var row = [
      new Date(),
      user,
      String(p.reviewerName || ''),
      pid,
      String(p.paperNo || ''),
      String(p.title || ''),
      total,
      String(p.comment || ''),
      JSON.stringify(scores),
      status
    ];

    if (rowIndex > 0) {
      // 已提交的紀錄不允許被草稿覆蓋
      var cur = String(sh.getRange(rowIndex, 10).getValue() || '');
      if (cur === 'submitted' && status === 'draft') {
        return { success: true, skipped: true, message: '已提交，草稿略過' };
      }
      sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    return { success: true, total: total, status: status };
  } finally {
    lock.releaseLock();
  }
}

function awardSubmitScore_(p) { return _awardUpsert_(p, 'submitted'); }
function awardSaveDraft_(p)   { return _awardUpsert_(p, 'draft');     }


/* ══════════════════════════════════════════════════════════════
   讀取
══════════════════════════════════════════════════════════════ */
function _awardReadAll_() {
  var sh = _awardScoresSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, AWARD_HEADERS_SCORES.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!String(r[1]).trim() || !String(r[3]).trim()) continue;
    out.push({
      timestamp: r[0],
      reviewer:  String(r[1]).trim(),
      reviewerName: String(r[2] || ''),
      paperId:   String(r[3]).trim(),
      paperNo:   String(r[4] || ''),
      title:     String(r[5] || ''),
      total:     Number(r[6]) || 0,
      comment:   String(r[7] || ''),
      scores:    _awardParseScores_(r[8]),
      status:    String(r[9] || 'submitted')
    });
  }
  return out;
}

/** 管理端：所有已提交的現場評分 + 已存的名次 */
function awardGetScores_() {
  var all = _awardReadAll_().filter(function (r) { return r.status === 'submitted'; });
  return { success: true, scores: all, ranks: _awardReadRanks_() };
}

/** 委員端：取回自己的紀錄（跨裝置續評用） */
function awardGetMyScores_(p) {
  var user = String(p.reviewerUsername || '').trim();
  if (!user) return { success: false, message: '缺少 reviewerUsername' };

  var scores = {}, draftsOut = {};
  _awardReadAll_().forEach(function (r) {
    if (r.reviewer !== user) return;
    var payload = {};
    for (var k in r.scores) payload[k] = r.scores[k];
    payload.comment = r.comment;
    payload.total   = r.total;
    if (r.status === 'submitted') scores[r.paperId] = payload;
    else draftsOut[r.paperId] = payload;
  });
  return { success: true, scores: scores, drafts: draftsOut };
}


/* ══════════════════════════════════════════════════════════════
   名次
══════════════════════════════════════════════════════════════ */
function _awardReadRanks_() {
  var sh = _awardRanksSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 3).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var pid = String(vals[i][0] || '').trim();
    if (pid) out.push({ pid: pid, rank: String(vals[i][1] || '') });
  }
  return out;
}

function awardSaveRank_(p) {
  var list;
  try { list = JSON.parse(p.dataJson || '[]'); }
  catch (err) { return { success: false, message: 'dataJson 格式錯誤' }; }
  if (!list || !list.length) return { success: false, message: '沒有資料' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (err) { return { success: false, message: '系統忙碌中，請稍候再試' }; }

  try {
    var sh = _awardRanksSheet_();
    var last = sh.getLastRow();
    var existing = {};
    if (last > 1) {
      var ids = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) existing[String(ids[i][0]).trim()] = i + 2;
    }
    var now = new Date(), added = 0, updated = 0;
    list.forEach(function (item) {
      var pid = _awardCleanId_(item.pid);
      if (!pid) return;
      var rank = String(item.rank || '');
      if (existing[pid]) { sh.getRange(existing[pid], 1, 1, 3).setValues([[pid, rank, now]]); updated++; }
      else { sh.appendRow([pid, rank, now]); added++; }
    });
    return { success: true, added: added, updated: updated };
  } finally {
    lock.releaseLock();
  }
}


/* ══════════════════════════════════════════════════════════════
   維護工具（可在 Apps Script 編輯器直接執行，不透過網頁）
══════════════════════════════════════════════════════════════ */

/** 安裝檢查：建立工作表並印出目前筆數 */
function awardSetupCheck() {
  var s = _awardScoresSheet_(), r = _awardRanksSheet_();
  Logger.log('「%s」現有 %s 列資料', AWARD_SHEET_SCORES, Math.max(0, s.getLastRow() - 1));
  Logger.log('「%s」現有 %s 列資料', AWARD_SHEET_RANKS,  Math.max(0, r.getLastRow() - 1));
  Logger.log('安裝正常，記得在 doGet(e) 開頭加入 handleAwardAction 那兩行並重新部署。');
}

/** 清空現場評分（正式評選前測試完畢時使用；名次表不動） */
function awardClearScores() {
  var sh = _awardScoresSheet_();
  var last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
  Logger.log('已清空「%s」。', AWARD_SHEET_SCORES);
}
