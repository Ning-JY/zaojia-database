// 造价文件查看器：纯解析逻辑，不依赖 DOM、不发任何网络请求。
// 策略分层、诚实优先：先认容器，再列内部文件，再尝试结构化解析；
// 解析不到的字段一律留空并由调用方提示，绝不编造金额。

export function detectContainer(bytes) {
  if (bytes.length === 0) return { type: 'empty', label: '空文件', detail: '文件大小为 0 字节，没有可解析内容。' };
  const b0 = bytes[0];
  const b1 = bytes[1];
  if (b0 === 0x50 && b1 === 0x4b) return { type: 'zip', label: 'ZIP 容器（PK 开头）', detail: '文件头为 ZIP 格式，尝试用本地 fflate 解压并列出内部文件。' };
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 200)).trimStart();
  if (head.startsWith('<?xml') || head.startsWith('<')) return { type: 'xml', label: 'XML 文本', detail: '文件可直接按文本读取，尝试按 XML/文本结构提取字段。' };
  if (head.startsWith('{') || head.startsWith('[')) return { type: 'json', label: 'JSON 文本', detail: '文件可直接按文本读取，尝试按 JSON 结构提取字段。' };
  if (/^[\x09\x0a\x0d\x20-\x7e\u4e00-\u9fff,;\t\r\n]{50,}$/.test(head)) return { type: 'text', label: '纯文本', detail: '文件可直接按文本读取，尝试按 CSV/键值结构提取字段。' };
  return { type: 'binary', label: '二进制专有格式（未识别）', detail: '文件头既不是 ZIP 也不是可读文本，可能是计价软件的专有二进制格式，本页不猜测其内部结构，只提取可读字符串并列出文件结构。' };
}

export function extractStrings(bytes, maxCount = 120) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const out = [];
  // 连续可读字符（含中文）长度 >= 4 的片段，过滤掉纯乱码控制符。
  const re = /[\u4e00-\u9fffA-Za-z0-9_.\-/:： ]{4,}/g;
  let m;
  while ((m = re.exec(text)) !== null && out.length < maxCount) {
    const s = m[0].trim();
    if (s.length >= 4 && !out.includes(s)) out.push(s);
  }
  return out;
}

export function extractKeyValues(text) {
  const info = {};
  const keys = ['项目名称', '工程名称', '建设单位', '施工单位', '编制单位', '编制人', '工程地点', '编制日期', '计价依据', '专业'];
  for (const k of keys) {
    const m = text.match(new RegExp(k + '\\s*[：:]\\s*([^\\n<,;；]{1,60})'));
    if (m) info[k] = m[1].trim();
  }
  return info;
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

// 把一个对象按字段名模式映射为清单行；映射不到的字段留 null。
export function mapRowFields(obj) {
  const get = (re) => {
    for (const k of Object.keys(obj)) if (re.test(k)) return obj[k];
    return null;
  };
  const qty = num(get(/数量|工程量|qty|quantity/i));
  const price = num(get(/单价|price/i));
  let amount = num(get(/合价|金额|amount|total/i));
  if (amount === null && qty !== null && price !== null) amount = Math.round(qty * price * 100) / 100;
  return {
    code: get(/编码|code|编号|清单编码/i) ?? '',
    name: get(/名称|name|项目名称|内容/i) ?? '',
    unit: get(/单位|unit/i) ?? '',
    qty, price, amount,
  };
}

function rowsFromObjects(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(mapRowFields).filter((r) => r.name || r.code);
}

function rowsFromCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const head = lines[0].split(/[,;\t]/).map((s) => s.trim());
  const hasCode = head.some((h) => /编码|名称/.test(h));
  if (!hasCode) return [];
  return lines.slice(1).map((l) => {
    const cells = l.split(/[,;\t]/);
    const obj = {};
    head.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return mapRowFields(obj);
  }).filter((r) => r.name || r.code);
}

// XML：用标签名做轻量分组。连续出现的一组叶子字段若含“名称”或“编码”，视为一行；
// 找不到这种结构时返回空数组，调用方如实提示，不硬凑。
export function rowsFromXml(text) {
  const leaves = [];
  const re = /<([A-Za-z_][\w.:-]*)(?:\s[^>]*)?>([^<>]{1,200})<\/\1>/g;
  let m;
  while ((m = re.exec(text)) !== null) leaves.push({ tag: m[1], value: m[2].trim() });
  if (!leaves.length) return [];
  const rows = [];
  let cur = {};
  const flush = () => {
    if (cur.name || cur.code) rows.push(mapRowFields(cur));
    cur = {};
  };
  for (const leaf of leaves) {
    if (/编码|code/i.test(leaf.tag) && (cur.name || cur.code)) flush();
    cur[leaf.tag] = leaf.value;
  }
  flush();
  return rows;
}

export function tryParseText(text) {
  const info = extractKeyValues(text);
  let boq = [];
  let feeText = null;
  try {
    const json = JSON.parse(text);
    const arr = Array.isArray(json) ? json : (json.boq || json.items || json.list || json.data || null);
    if (arr) boq = rowsFromObjects(arr);
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      const feeKeys = Object.keys(json).filter((k) => /措施|规费|税金|总价|合计/.test(k));
      if (feeKeys.length) feeText = feeKeys.map((k) => `${k}：${json[k]}`).join('；');
    }
  } catch { /* 不是 JSON，继续按 CSV/XML 尝试 */ }
  if (!boq.length) boq = rowsFromCsv(text);
  if (!boq.length) boq = rowsFromXml(text);
  return { info, boq, feeText };
}

export function unzipEntries(bytes, unzipSync) {
  const raw = unzipSync(new Uint8Array(bytes));
  return Object.entries(raw).map(([name, data]) => ({
    name, size: data.length, data,
    kind: /\.xml$/i.test(name) ? 'XML' : /\.json$/i.test(name) ? 'JSON' : /\.(csv|txt)$/i.test(name) ? '文本' : '其他',
  }));
}

export function sumAmount(rows) {
  return rows.reduce((a, r) => a + (r.amount || 0), 0);
}

// ---------------------------------------------------------------------------
// GCFX / SGCFX 二进制条目解析（2026-10-22 样例实测结论，见文末注释）
// 容器是 ZIP，条目名形如 0/<单位目录>/<表号>。本节只解析经样例验证的
// 两张表：3003（分部分项清单行）、3010（费用汇总）。
// 未验证的字段不猜：人材机 3007 的数量/合价、措施项目单项明细、
// 3003 行的定额子目等，全部留空或只在页面提示，不进入合计。
// ---------------------------------------------------------------------------

function dv(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
function i32(bytes, off) { return dv(bytes).getInt32(off, true); }
function f64(bytes, off) { return dv(bytes).getFloat64(off, true); }

// 在字节流 offset 处读取一个 UTF-16LE 字符串（length 个字符）。
function utf16At(bytes, off, length) {
  let s = '';
  for (let k = 0; k < length; k++) {
    const code = bytes[off + 2 * k] | (bytes[off + 2 * k + 1] << 8);
    s += String.fromCharCode(code);
  }
  return s;
}
function isDigitByte(b) { return b >= 0x30 && b <= 0x39; }

// 在 offset 处是否为 12 位数字的 UTF-16LE 编码（不要求对齐，逐字节判定）。
function is12DigitCode(bytes, off) {
  if (off + 24 > bytes.length) return false;
  for (let k = 0; k < 12; k++) {
    if (!isDigitByte(bytes[off + 2 * k]) || bytes[off + 2 * k + 1] !== 0) return false;
  }
  return true;
}

const UNIT_MAP = { m3: 'm³', m2: 'm²' };
function mapUnit(raw) { return UNIT_MAP[raw] || raw; }

// 3003 锚点解析：编码(12位) + 紧跟 int32 9 + 9 位父码 + int32 名称长度 +
// 名称 + int32 单位长度 + 单位 + double 综合单价 + int32 + double 未四舍五入合价
// + double 四舍五入合价。数量的判定见 parseBoqEntry 注释。
export function parseBoqEntry(bytes) {
  const rows = [];
  const n = bytes.length;
  for (let off = 0; off + 80 < n; off++) {
    if (!is12DigitCode(bytes, off)) continue;
    const code = utf16At(bytes, off, 12);
    // 父码校验：紧跟 int32 9，再 9 位父码等于编码前 9 位。
    if (off + 28 > n) continue;
    if (i32(bytes, off + 24) !== 9) continue;
    const parent = utf16At(bytes, off + 28, 9);
    if (parent !== code.slice(0, 9)) continue;
    // 名称
    const nameLenOff = off + 46;
    if (nameLenOff + 4 > n) continue;
    const nameLen = i32(bytes, nameLenOff);
    if (nameLen <= 0 || nameLen > 200) continue;
    const nameOff = nameLenOff + 4;
    if (nameOff + nameLen * 2 > n) continue;
    const name = utf16At(bytes, nameOff, nameLen);
    if (!name || /^\s*$/.test(name)) continue;
    // 单位
    const unitLenOff = nameOff + nameLen * 2;
    if (unitLenOff + 4 > n) continue;
    const unitLen = i32(bytes, unitLenOff);
    if (unitLen <= 0 || unitLen > 20) continue;
    const unitOff = unitLenOff + 4;
    if (unitOff + unitLen * 2 > n) continue;
    const unitRaw = utf16At(bytes, unitOff, unitLen);
    const unitEnd = unitOff + unitLen * 2;
    if (unitEnd + 28 > n) continue;
    const price = f64(bytes, unitEnd);
    const amtUnrounded = f64(bytes, unitEnd + 12);
    const amount = f64(bytes, unitEnd + 20);
    if (!Number.isFinite(price) || !Number.isFinite(amount) || amount < 0) continue;
    // 数量：先试行首附近的成对双精度值（样例中 248/320 行在此命中，
    // 偏移 -53、-45、-61、-37、-69、-29、-77、-21，成对出现、间隔 8 字节，
    // 且 数量×单价 四舍五入后等于行合价）；未命中时用未四舍五入合价 ÷ 单价
    // 反推，并只在 行首前 5000 字节内找到该数值的双精度对 时才标记为确认，
    // 否则标记为 derived（反推），页面如实标注，不冒充直接解析。
    let qty = null, qtySource = null;
    for (const delta of [-53, -45, -61, -37, -69, -29, -77, -21]) {
      const qOff = off + delta;
      if (qOff < 0 || qOff + 16 > n) continue;
      const q1 = f64(bytes, qOff), q2 = f64(bytes, qOff + 8);
      if (q1 !== q2 || !Number.isFinite(q1) || q1 < 0) continue;
      if (Math.abs(Math.round(q1 * price * 100) / 100 - amount) < 0.015) { qty = q1; qtySource = 'pair'; break; }
    }
    if (qty === null && price > 0 && Number.isFinite(amtUnrounded)) {
      const q = Math.round((amtUnrounded / price) * 1000) / 1000;
      if (Number.isFinite(q) && q >= 0) {
        qty = q; qtySource = 'derived';
        // 在行首前 5000 字节内找该数值的双精度对
        const buf = new DataView(new ArrayBuffer(8));
        buf.setFloat64(0, q, true);
        const pat = [buf.getUint8(0), buf.getUint8(1), buf.getUint8(2), buf.getUint8(3), buf.getUint8(4), buf.getUint8(5), buf.getUint8(6), buf.getUint8(7)];
        const start = Math.max(0, off - 5000);
        for (let p = start; p + 16 <= off; p++) {
          let ok = true, ok2 = true;
          for (let k = 0; k < 8; k++) {
            if (bytes[p + k] !== pat[k]) { ok = false; break; }
            if (bytes[p + 8 + k] !== pat[k]) { ok2 = false; break; }
          }
          if (ok && ok2) { qtySource = 'pair_far'; break; }
        }
      }
    }
    rows.push({
      code, name, unit: mapUnit(unitRaw), unitRaw, qty, qtySource,
      price, amount, amountUnrounded: amtUnrounded, offset: off,
    });
    // 跳过已解析的头部，避免在名称/单位内重复命中数字串
    off = unitEnd + 28 - 1;
  }
  return rows;
}

// 3010 费用汇总：按 UTF-16LE 数字串扫描（不要求对齐），取形如 1234.56 的串。
// 样例中每单位恰好 6 个，顺序为：分部分项合计、措施项目合计、安全生产措施费、
// 税前合计、增值税、总价，且满足 分部分项+措施=税前、税前+增值税=总价（9%税率）。
export function parseFeeEntry(bytes) {
  const amounts = [];
  const n = bytes.length;
  let i = 0;
  while (i + 1 < n) {
    if (isDigitByte(bytes[i]) && bytes[i + 1] === 0) {
      let j = i, s = '';
      while (j + 1 < n && ((isDigitByte(bytes[j]) && bytes[j + 1] === 0) || (bytes[j] === 0x2e && bytes[j + 1] === 0))) {
        s += String.fromCharCode(bytes[j]);
        j += 2;
      }
      if (/^\d+\.\d{2}$/.test(s)) amounts.push(Number(s));
      i = j;
    } else {
      i++;
    }
  }
  const fee = amounts.length >= 6 ? {
    boq: amounts[0], measures: amounts[1], safety: amounts[2],
    taxBase: amounts[3], vat: amounts[4], total: amounts[5],
  } : null;
  const consistent = fee
    && Math.abs((fee.boq + fee.measures) - fee.taxBase) < 0.02
    && Math.abs((fee.taxBase + fee.vat) - fee.total) < 0.02;
  return { amounts, fee: consistent ? fee : null, consistent: !!consistent };
}

// 3007 人材机价格信息（仅补充，不计入合计）：把条目按偶数/奇数两种对齐
// 解码为 UTF-16LE 文本，从中提取带 "clmc"（材料名称）的价格信息对象附近的
// cldw（单位）、csj（价格）等字段。数量与合价未稳定映射，本函数不返回它们。
export function parseMaterialsPriceInfo(bytes) {
  const items = [];
  const seen = new Set();
  for (const startOff of [0, 1]) {
    let text = '';
    for (let p = startOff; p + 1 < bytes.length; p += 2) {
      const code = bytes[p] | (bytes[p + 1] << 8);
      text += (code >= 0x20 && code < 0xd800) ? String.fromCharCode(code) : '\u0000';
    }
    const re = /"clmc"\s*:\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const window = text.slice(Math.max(0, m.index - 200), m.index + 1200);
      const get = (key) => {
        const mm = window.match(new RegExp('"' + key + '"\\s*:\\s*(?:"([^"]*)"|([0-9.eE+-]+))'));
        return mm ? (mm[1] !== undefined ? mm[1] : Number(mm[2])) : null;
      };
      const name = m[1];
      const price = get('csj');
      const unit = get('cldw');
      if (!name) continue;
      const key = name + '|' + String(unit) + '|' + String(price);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ name, unit: unit || '', price: typeof price === 'number' ? price : null });
    }
  }
  return items;
}

// 给定 unzip 后的条目列表，汇总所有带 3003/3010 的单位工程。
// 返回单位数组、全部清单行（带 unitDir）、费用合计与自洽校验。
export function parseGcfxUnits(entries) {
  const byDir = new Map();
  for (const e of entries) {
    const m = e.name.match(/^0\/(\d+)\/(3003|3010|3007)$/);
    if (!m) continue;
    if (!byDir.has(m[1])) byDir.set(m[1], {});
    byDir.get(m[1])[m[2]] = e.data;
  }
  const units = [];
  for (const [dir, tables] of [...byDir.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    if (!tables['3003'] || !tables['3010']) continue;
    const boq = parseBoqEntry(tables['3003']);
    const feeRes = parseFeeEntry(tables['3010']);
    const boqTotal = Math.round(boq.reduce((a, r) => a + (r.amount || 0), 0) * 100) / 100;
    const feeBoq = feeRes.fee ? feeRes.fee.boq : null;
    units.push({
      dir, boq, fee: feeRes.fee, feeAmounts: feeRes.amounts, feeConsistent: feeRes.consistent,
      boqTotal, boqDiff: feeBoq === null ? null : Math.round((boqTotal - feeBoq) * 100) / 100,
      materials: tables['3007'] ? parseMaterialsPriceInfo(tables['3007']) : [],
    });
  }
  const boqRowsAll = [];
  for (const u of units) for (const r of u.boq) boqRowsAll.push({ ...r, unitDir: u.dir });
  const sumFee = (k) => Math.round(units.reduce((a, u) => a + (u.fee ? u.fee[k] : 0), 0) * 100) / 100;
  const totals = {
    boq: sumFee('boq'), measures: sumFee('measures'), safety: sumFee('safety'),
    taxBase: sumFee('taxBase'), vat: sumFee('vat'), total: sumFee('total'),
  };
  const boqSum = Math.round(boqRowsAll.reduce((a, r) => a + (r.amount || 0), 0) * 100) / 100;
  return {
    units, boqRowsAll, totals,
    boqSum, boqDiff: Math.round((boqSum - totals.boq) * 100) / 100,
    qtyDerivedCount: boqRowsAll.filter((r) => r.qtySource === 'derived').length,
    qtyUnresolvedCount: boqRowsAll.filter((r) => r.qty === null).length,
  };
}
