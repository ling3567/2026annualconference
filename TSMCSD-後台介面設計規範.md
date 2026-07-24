# TSMCSD 系統後台介面設計規範

> 適用範圍：2026 年會系列系統（投稿、評審、報到、報名）之**後台管理／評審介面**。
> 對外活動網頁（親切活潑風格）另循 `taiwan-medical-event-web` 規範，不適用本文件。
> 基準檔：`poster-review.html`

---

## 1. 設計原則

| 原則 | 說明 |
|---|---|
| **資料密度優先** | 後台使用者是委員與承辦人，一次要掃過幾十筆資料。緊湊 > 寬鬆。 |
| **用粗細與顏色強調，不用放大字** | 同一張表格裡字級一致，靠 `font-weight` 與語意色區分主次。 |
| **中文可折行是常態** | 不要為了「不折行」硬撐欄寬。長文字（題目、單位）折 2–3 行是正常的。 |
| **短代碼與數值不折行** | 編號、序號、分數、票數必須單行，否則難以比對。 |
| **次要資訊往下收** | 收進展開子列或詳細視窗，不佔用欄位寬度。 |

---

## 2. 設計 Token

### 2.1 色彩

```css
:root {
  /* 基底 */
  --dark:    #3a4550;   --dark-2: #546070;
  --main:    #7a90a4;   --main-d: #5e7080;   --main-l: #a8bfcc;
  --main-bg: #dce6ec;
  --bg:      #e4e2dc;   --bg2:    #f0eeea;   --white: #ffffff;
  --ink:     #2a2420;   --slate:  #4a3e38;   --muted: #7a6e68;
  --border:  #b8c8d4;   --border2:#ccd8e0;

  /* 後台管理專用色（語意色） */
  --adm-blue:   #1e4d8c;  --adm-blue-l: #dbeafe;  --adm-blue-d: #e8f0fb;
  --adm-gold:   #9a6f0a;  --adm-gold-bg:#fdf6e3;
  --adm-green:  #1e6b45;  --adm-green-bg:#f0faf5;
  --adm-red:    #b91c1c;  --adm-red-l:  #fee2e2;
  --adm-orange: #c05621;

  /* 陰影與圓角 */
  --sh-sm: 0 1px 4px rgba(42,36,32,.08);
  --sh:    0 2px 10px rgba(42,36,32,.09);
  --sh-md: 0 6px 20px rgba(42,36,32,.12);
  --r: 10px;
}
```

**語意對應（務必固定，不要換色）**

| 意義 | 色 |
|---|---|
| 主要／編號／可點擊 | `--adm-blue` |
| 通過、已繳費、完成 | `--adm-green` |
| 退稿、警示、錯誤 | `--adm-red` |
| 優秀海報、榮譽標記 | `--adm-gold` |
| 需注意但非錯誤（分數差距大、同人重複） | `--adm-orange` / `#f59e0b` |
| 無資料、停用 | `#718096`／`—` |

> 空值一律顯示破折號 `—`，不要留白、不要 `N/A`。

### 2.2 字型與字級

```css
body{
  font-family:'Microsoft JhengHei','Noto Sans TC',sans-serif;
  font-size:16px; line-height:1.7;
}
```

| 用途 | 字級 | 字重 |
|---|---|---|
| 區塊標題 `.sec-head h3` | 1.05rem | 700 |
| 一般表格內容 | **0.85rem** | 400 |
| 表格內強調（分數、編號） | 0.85rem | 700 |
| 表頭 `th` | 0.78rem | 700，`letter-spacing:.04em` |
| 按鈕 | 0.8rem／小按鈕 0.75rem | 500 |
| 附註標籤（非會員、⚠提示） | 0.72rem | 700 |

**規則：同一張表格內只允許兩種字級** — 內容 0.85rem 與附註 0.72rem。任何「這欄比較重要所以放大」的想法，改用粗體或色塊。

### 2.3 圓角與陰影

- 卡片／區塊：`border-radius:10px`，`box-shadow:0 1px 3px rgba(0,0,0,.05),0 2px 8px rgba(0,0,0,.04)`
- 按鈕：`7px`　標籤 chip：`20px`（膠囊）或 `5–6px`（方形標記）
- 分隔線：`1px solid #edf2f7`（表格內）／`var(--border2)`（卡片內）

---

## 3. 元件

### 3.1 區塊卡片

```html
<div class="sec">
  <div class="sec-head"><h3>標題</h3><button class="adm-btn adm-btn-outline adm-btn-sm">動作</button></div>
  <div class="sec-body"> … </div>
</div>
```

### 3.2 按鈕

| 類別 | 用途 |
|---|---|
| `.adm-btn-primary` | 主要動作（儲存、送出） |
| `.adm-btn-success` | 確認通過 |
| `.adm-btn-danger` | 退稿、刪除 |
| `.adm-btn-outline` | 次要動作（詳細、全文、匯出） |
| `+ .adm-btn-sm` | 表格列內一律加此類別 |

### 3.3 標籤 chip

`.chip` + `.chip-blue / -green / -gray / -red / -orange`；論文編號用 `.chip-no`。

---

## 4. 資料表格規範（本次修訂重點）

### 4.1 基礎

```css
.res-tbl{ table-layout:fixed; width:100%; }
.res-tbl th{ padding:.55rem .5rem; font-size:.78rem; }
.res-tbl td{ padding:.6rem .5rem; font-size:.85rem; line-height:1.55;
             vertical-align:middle; word-break:break-word; }
.res-tbl td .adm-btn-sm{ padding:.28rem .45rem; font-size:.8rem; }
.res-tbl td .sub-lbl{ font-size:.72rem; }
```

**必用 `table-layout:fixed`**：auto 佈局會讓各欄互搶寬度，中文就會逐字直排。

### 4.2 欄寬計算（最容易踩的坑）

`table-layout:fixed` 下，`th` 的 `width` **不含** `padding`。實際佔用 = 設定寬 + 左右內距。

```
可用寬 ≈ 1250px
固定欄總和 = Σ(設定寬) + 欄數 × (padding×2)
自動欄（論文題目）= 可用寬 − 固定欄總和
```

> 曾發生：內距 `.9rem`（29px／欄）未計入，11 欄多吃 320px，題目欄只剩 150px。
> 後台表格內距一律用 `.5rem`（16px／欄）。

### 4.3 折行策略

| 資料型別 | 策略 |
|---|---|
| 論文題目、教案主題 | `word-break:break-word`，自動欄寬，多行 |
| 機構名稱 | `word-break:break-word`，130px，2–3 行 |
| 編號、公告序號（EP-73C） | `white-space:nowrap` |
| 分數、票數、差距 | `white-space:nowrap` + `text-align:center` |
| 長度固定的中文短語（如「2/3位退稿」） | 主動用 `<br>` 拆兩行，比撐寬欄位好 |

⚠ **禁用 `word-break:keep-all`**：中文無空格，會被視為單一長字而溢出到隔壁欄。

### 4.4 欄位取捨

- 資訊性欄位（職類、聯絡人、會員狀態）→ 收進**展開子列**與**詳細視窗**，不佔欄。
- **判讀性欄位（平均總分、分數差距、推薦票數、退稿數）一律保留為獨立欄位**，不合併、不收折 — 委員需橫向比對。
- 收起的欄位要在 `title` 屬性保留提示，並在詳細視窗以標籤列完整呈現。

### 4.5 列內操作

「詳細／全文」按鈕橫排 + `flex-wrap`，欄寬 80px。直排會撐高整列。

### 4.6 現行欄寬參考值（評分結果表）

| 欄位 | 寬 | 折行 |
|---|---|---|
| 展出方式 | 78 | 按鈕滿版 |
| 公告序號 | 70 | nowrap |
| 編號 | 56 | nowrap |
| 論文題目 | auto (~360) | 多行 |
| 投稿單位 | 130 | 多行 |
| 類別 | 60 | 標籤另行 |
| 平均總分 | 64 | nowrap |
| 分數差距 | 70 | nowrap |
| 推薦 | 46 | nowrap |
| 退稿 | 66 | `<br>` 兩行 |
| 詳細 | 80 | 按鈕 wrap |

> 表頭本身 `white-space:nowrap`，欄寬不得小於「表頭文字 + 排序圖示」寬度（4 個中文字約需 62px）。

---

## 5. 互動慣例

- 可排序表頭：加 `cursor:pointer; user-select:none` 與 `↕` 圖示；目前排序欄顯示 `↑ / ↓`。
- 列點擊 → 展開子列顯示補充欄位（聯絡人／職類／會員／同投稿者其他篇）。
- 「詳細」→ 彈窗顯示評分明細；彈窗頂端固定放**題目 + 資訊標籤列**（單位／職類／類別／聯絡人）。
- 每張資料表都要有「匯出 CSV」；CSV 保留**所有**欄位，包含畫面上收起來的。

---

## 6. 新頁面檢查清單

- [ ] 沿用 `:root` token，未自創色碼
- [ ] 表格加 `table-layout:fixed` 並用 `<th style="width:…">` 明確配比
- [ ] 欄寬有計入 padding，自動欄剩餘寬 ≥ 300px
- [ ] 表格內字級只有 0.85rem 與 0.72rem 兩種
- [ ] 未使用 `word-break:keep-all`
- [ ] 短代碼與數值 nowrap，長中文可折行
- [ ] 空值顯示 `—`
- [ ] 判讀性數值欄未被合併或收折
- [ ] 列內按鈕橫排、使用 `.adm-btn-sm`
- [ ] 有匯出 CSV，且欄位完整
