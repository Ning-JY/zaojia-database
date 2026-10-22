// 五金手册：纯数据与纯计算，不依赖 DOM，可在 Node 下直接 import 做公式复算。
// 口径：钢材密度 7850 kg/m3。1 m 长构件的重量 = 截面面积(mm2) x 0.00785 kg/m。
// H 型钢、工字钢、槽钢、角钢的截面面积均为忽略圆角的简化公式；国标表值已含圆角，
// 所以表值会比公式值大 2%~4%，工程取用以国标表为准。表面积为截面外轮廓周长 x 长度。

export const DENSITY = 7850;
export const KG_PER_MM2_M = 0.00785;

export const round2 = (v) => Math.round(v * 100) / 100;
export const round3 = (v) => Math.round(v * 1000) / 1000;

export function hArea(H, B, tw, tf) {
  return 2 * B * tf + (H - 2 * tf) * tw;
}
export function hSurface(H, B, tw) {
  return (2 * H + 4 * B - 2 * tw) / 1000;
}
export function channelArea(H, B, tw, tf) {
  return H * tw + 2 * (B - tw) * tf;
}
export function channelSurface(H, B, tw) {
  return (4 * B + 2 * H - 2 * tw) / 1000;
}
export function angleEqArea(a, t) {
  return (2 * a - t) * t;
}
export function angleEqSurface(a) {
  return (4 * a) / 1000;
}
export function angleUneqArea(a, b, t) {
  return (a + b - t) * t;
}
export function angleUneqSurface(a, b) {
  return (2 * a + 2 * b) / 1000;
}
export function squareArea(B, t) {
  return 4 * t * (B - t);
}
export function squareSurface(B) {
  return (4 * B) / 1000;
}
export function rectArea(B, H, t) {
  return 2 * t * (B + H - 2 * t);
}
export function rectSurface(B, H) {
  return (2 * (B + H)) / 1000;
}
export function roundArea(D, t) {
  const d = D - 2 * t;
  return (Math.PI / 4) * (D * D - d * d);
}
export function roundSurface(D) {
  return (Math.PI * D) / 1000;
}
export function plateWeightPerM2(t) {
  return t * 7.85;
}
export function rebarWeight(d) {
  return d * d * 0.00617;
}

// 类别定义：fields 供自定义计算器动态生成输入框。
export const CATEGORIES = [
  { id: 'h', label: 'H 型钢', unit: 'kg/m', fields: [
    { key: 'H', label: '高度 H', unit: 'mm' }, { key: 'B', label: '宽度 B', unit: 'mm' },
    { key: 'tw', label: '腹板厚 tw', unit: 'mm' }, { key: 'tf', label: '翼缘厚 tf', unit: 'mm' } ] },
  { id: 'i', label: '工字钢', unit: 'kg/m', fields: [
    { key: 'H', label: '高度 H', unit: 'mm' }, { key: 'B', label: '宽度 B', unit: 'mm' },
    { key: 'tw', label: '腹板厚 tw', unit: 'mm' }, { key: 'tf', label: '翼缘厚 tf', unit: 'mm' } ] },
  { id: 'channel', label: '槽钢', unit: 'kg/m', fields: [
    { key: 'H', label: '高度 H', unit: 'mm' }, { key: 'B', label: '腿宽 B', unit: 'mm' },
    { key: 'tw', label: '腹板厚 tw', unit: 'mm' }, { key: 'tf', label: '腿厚 tf', unit: 'mm' } ] },
  { id: 'angle-eq', label: '等边角钢', unit: 'kg/m', fields: [
    { key: 'a', label: '肢宽 a', unit: 'mm' }, { key: 't', label: '厚度 t', unit: 'mm' } ] },
  { id: 'angle-uneq', label: '不等边角钢', unit: 'kg/m', fields: [
    { key: 'a', label: '长肢 a', unit: 'mm' }, { key: 'b', label: '短肢 b', unit: 'mm' },
    { key: 't', label: '厚度 t', unit: 'mm' } ] },
  { id: 'square', label: '方管', unit: 'kg/m', fields: [
    { key: 'B', label: '边长 B', unit: 'mm' }, { key: 't', label: '壁厚 t', unit: 'mm' } ] },
  { id: 'rect', label: '矩管', unit: 'kg/m', fields: [
    { key: 'B', label: '宽度 B', unit: 'mm' }, { key: 'H', label: '高度 H', unit: 'mm' },
    { key: 't', label: '壁厚 t', unit: 'mm' } ] },
  { id: 'round', label: '圆管', unit: 'kg/m', fields: [
    { key: 'D', label: '外径 D', unit: 'mm' }, { key: 't', label: '壁厚 t', unit: 'mm' } ] },
  { id: 'plate', label: '钢板', unit: 'kg/㎡', fields: [
    { key: 't', label: '厚度 t', unit: 'mm' } ] },
  { id: 'rebar', label: '钢筋', unit: 'kg/m', fields: [
    { key: 'd', label: '直径 d', unit: 'mm' } ] },
];

// 按类别算截面面积、单重、表面积，并返回带代入数字的计算过程。
export function calcSection(catId, d) {
  let area = 0;
  let surface = 0;
  let process = '';
  if (catId === 'h' || catId === 'i') {
    area = hArea(d.H, d.B, d.tw, d.tf);
    surface = hSurface(d.H, d.B, d.tw);
    process = `截面面积 A = 2×${d.B}×${d.tf} + (${d.H} − 2×${d.tf})×${d.tw} = ${round2(area)} mm²（忽略圆角的简化公式）`;
  } else if (catId === 'channel') {
    area = channelArea(d.H, d.B, d.tw, d.tf);
    surface = channelSurface(d.H, d.B, d.tw);
    process = `截面面积 A = ${d.H}×${d.tw} + 2×(${d.B} − ${d.tw})×${d.tf} = ${round2(area)} mm²（忽略圆角的简化公式）`;
  } else if (catId === 'angle-eq') {
    area = angleEqArea(d.a, d.t);
    surface = angleEqSurface(d.a);
    process = `截面面积 A = (2×${d.a} − ${d.t})×${d.t} = ${round2(area)} mm²（忽略圆角的简化公式）`;
  } else if (catId === 'angle-uneq') {
    area = angleUneqArea(d.a, d.b, d.t);
    surface = angleUneqSurface(d.a, d.b);
    process = `截面面积 A = (${d.a} + ${d.b} − ${d.t})×${d.t} = ${round2(area)} mm²（忽略圆角的简化公式）`;
  } else if (catId === 'square') {
    area = squareArea(d.B, d.t);
    surface = squareSurface(d.B);
    process = `截面面积 A = 4×${d.t}×(${d.B} − ${d.t}) = ${round2(area)} mm²`;
  } else if (catId === 'rect') {
    area = rectArea(d.B, d.H, d.t);
    surface = rectSurface(d.B, d.H);
    process = `截面面积 A = 2×${d.t}×(${d.B} + ${d.H} − 2×${d.t}) = ${round2(area)} mm²`;
  } else if (catId === 'round') {
    area = roundArea(d.D, d.t);
    surface = roundSurface(d.D);
    process = `截面面积 A = π/4×(${d.D}² − ${d.D - 2 * d.t}²) = ${round2(area)} mm²`;
  } else if (catId === 'plate') {
    return { area: null, weight: plateWeightPerM2(d.t), surface: 2,
      process: `每平方米重量 = ${d.t} mm × 7.85 kg/(㎡·mm) = ${round2(plateWeightPerM2(d.t))} kg/㎡；表面积按双面计为 2 ㎡/㎡` };
  } else if (catId === 'rebar') {
    area = (Math.PI / 4) * d.d * d.d;
    surface = (Math.PI * d.d) / 1000;
    process = `截面面积 A = π/4×${d.d}² = ${round2(area)} mm²；单重 = ${d.d}² × 0.00617 = ${round3(rebarWeight(d.d))} kg/m`;
    return { area, weight: rebarWeight(d.d), surface, process };
  }
  const weight = area * KG_PER_MM2_M;
  return { area, weight, surface,
    process: `${process}；单重 = ${round2(area)} × 0.00785 = ${round2(weight)} kg/m；表面积 = ${round3(surface)} ㎡/m` };
}

// 常用规格表。source 为 'table' 的是 GB/T 11263 HW 系列常见表值；
// 其余为公式计算值，尺寸取常用系列，工程复核时仍以国标表为准。
function spec(catId, name, dimsText, dims, source, tableWeight) {
  const c = calcSection(catId, dims);
  return { catId, name, dimsText, dims, source, tableWeight: tableWeight ?? null,
    area: c.area, weight: c.weight, surface: c.surface, process: c.process };
}

export const SPECS = [
  // H 型钢：GB/T 11263 HW 系列常见表值（腹板/翼缘厚如 dims 所示）。
  spec('h', 'HW100×100', '100×100×6×8', { H: 100, B: 100, tw: 6, tf: 8 }, 'table', 17.2),
  spec('h', 'HW150×150', '150×150×7×10', { H: 150, B: 150, tw: 7, tf: 10 }, 'table', 31.9),
  spec('h', 'HW200×200', '200×200×8×12', { H: 200, B: 200, tw: 8, tf: 12 }, 'table', 50.5),
  spec('h', 'HW250×250', '250×250×9×14', { H: 250, B: 250, tw: 9, tf: 14 }, 'table', 72.4),
  spec('h', 'HW300×300', '300×300×10×15', { H: 300, B: 300, tw: 10, tf: 15 }, 'table', 94.5),
  spec('h', 'HW400×400', '400×400×13×21', { H: 400, B: 400, tw: 13, tf: 21 }, 'table', 172),
  // 工字钢：公式计算值。
  spec('i', '10#', '100×68×4.5×7.6', { H: 100, B: 68, tw: 4.5, tf: 7.6 }, 'formula'),
  spec('i', '12.6#', '126×74×5×8.4', { H: 126, B: 74, tw: 5, tf: 8.4 }, 'formula'),
  spec('i', '14#', '140×80×5.5×9.1', { H: 140, B: 80, tw: 5.5, tf: 9.1 }, 'formula'),
  spec('i', '16#', '160×88×6×9.9', { H: 160, B: 88, tw: 6, tf: 9.9 }, 'formula'),
  spec('i', '18#', '180×94×6.5×10.7', { H: 180, B: 94, tw: 6.5, tf: 10.7 }, 'formula'),
  spec('i', '20a', '200×100×7×11.4', { H: 200, B: 100, tw: 7, tf: 11.4 }, 'formula'),
  spec('i', '22a', '220×110×7.5×12.3', { H: 220, B: 110, tw: 7.5, tf: 12.3 }, 'formula'),
  spec('i', '25a', '250×116×8×13', { H: 250, B: 116, tw: 8, tf: 13 }, 'formula'),
  spec('i', '28a', '280×122×8.5×13.7', { H: 280, B: 122, tw: 8.5, tf: 13.7 }, 'formula'),
  spec('i', '32a', '320×130×9.5×15', { H: 320, B: 130, tw: 9.5, tf: 15 }, 'formula'),
  spec('i', '36a', '360×136×10×15.8', { H: 360, B: 136, tw: 10, tf: 15.8 }, 'formula'),
  // 槽钢：公式计算值。
  spec('channel', '8#', '80×43×5×8', { H: 80, B: 43, tw: 5, tf: 8 }, 'formula'),
  spec('channel', '10#', '100×48×5.3×8.5', { H: 100, B: 48, tw: 5.3, tf: 8.5 }, 'formula'),
  spec('channel', '12.6#', '126×53×5.5×9', { H: 126, B: 53, tw: 5.5, tf: 9 }, 'formula'),
  spec('channel', '14a', '140×58×6×9.5', { H: 140, B: 58, tw: 6, tf: 9.5 }, 'formula'),
  spec('channel', '16a', '160×63×6.5×10', { H: 160, B: 63, tw: 6.5, tf: 10 }, 'formula'),
  spec('channel', '18a', '180×68×7×10.5', { H: 180, B: 68, tw: 7, tf: 10.5 }, 'formula'),
  spec('channel', '20a', '200×73×7×11', { H: 200, B: 73, tw: 7, tf: 11 }, 'formula'),
  spec('channel', '22a', '220×77×7.5×11.5', { H: 220, B: 77, tw: 7.5, tf: 11.5 }, 'formula'),
  spec('channel', '25a', '250×78×8×12', { H: 250, B: 78, tw: 8, tf: 12 }, 'formula'),
  spec('channel', '28a', '280×82×8.5×12.5', { H: 280, B: 82, tw: 8.5, tf: 12.5 }, 'formula'),
  // 角钢：公式计算值。
  spec('angle-eq', '∠30×3', '30×30×3', { a: 30, t: 3 }, 'formula'),
  spec('angle-eq', '∠40×4', '40×40×4', { a: 40, t: 4 }, 'formula'),
  spec('angle-eq', '∠50×5', '50×50×5', { a: 50, t: 5 }, 'formula'),
  spec('angle-eq', '∠63×5', '63×63×5', { a: 63, t: 5 }, 'formula'),
  spec('angle-eq', '∠70×6', '70×70×6', { a: 70, t: 6 }, 'formula'),
  spec('angle-eq', '∠80×7', '80×80×7', { a: 80, t: 7 }, 'formula'),
  spec('angle-eq', '∠90×8', '90×90×8', { a: 90, t: 8 }, 'formula'),
  spec('angle-eq', '∠100×10', '100×100×10', { a: 100, t: 10 }, 'formula'),
  spec('angle-eq', '∠110×10', '110×110×10', { a: 110, t: 10 }, 'formula'),
  spec('angle-eq', '∠125×10', '125×125×10', { a: 125, t: 10 }, 'formula'),
  spec('angle-eq', '∠140×12', '140×140×12', { a: 140, t: 12 }, 'formula'),
  spec('angle-eq', '∠160×14', '160×160×14', { a: 160, t: 14 }, 'formula'),
  spec('angle-uneq', '∠50×32×4', '50×32×4', { a: 50, b: 32, t: 4 }, 'formula'),
  spec('angle-uneq', '∠63×40×5', '63×40×5', { a: 63, b: 40, t: 5 }, 'formula'),
  spec('angle-uneq', '∠75×50×5', '75×50×5', { a: 75, b: 50, t: 5 }, 'formula'),
  spec('angle-uneq', '∠90×56×6', '90×56×6', { a: 90, b: 56, t: 6 }, 'formula'),
  spec('angle-uneq', '∠100×63×6', '100×63×6', { a: 100, b: 63, t: 6 }, 'formula'),
  spec('angle-uneq', '∠100×80×8', '100×80×8', { a: 100, b: 80, t: 8 }, 'formula'),
  spec('angle-uneq', '∠125×80×8', '125×80×8', { a: 125, b: 80, t: 8 }, 'formula'),
  spec('angle-uneq', '∠140×90×10', '140×90×10', { a: 140, b: 90, t: 10 }, 'formula'),
  spec('angle-uneq', '∠160×100×12', '160×100×12', { a: 160, b: 100, t: 12 }, 'formula'),
  // 方管 / 矩管 / 圆管：公式计算值。
  spec('square', '□20×1.5', '20×20×1.5', { B: 20, t: 1.5 }, 'formula'),
  spec('square', '□30×2', '30×30×2', { B: 30, t: 2 }, 'formula'),
  spec('square', '□40×2', '40×40×2', { B: 40, t: 2 }, 'formula'),
  spec('square', '□50×2', '50×50×2', { B: 50, t: 2 }, 'formula'),
  spec('square', '□60×2.5', '60×60×2.5', { B: 60, t: 2.5 }, 'formula'),
  spec('square', '□80×3', '80×80×3', { B: 80, t: 3 }, 'formula'),
  spec('square', '□100×4', '100×100×4', { B: 100, t: 4 }, 'formula'),
  spec('square', '□120×4', '120×120×4', { B: 120, t: 4 }, 'formula'),
  spec('square', '□150×5', '150×150×5', { B: 150, t: 5 }, 'formula'),
  spec('square', '□200×6', '200×200×6', { B: 200, t: 6 }, 'formula'),
  spec('rect', '▭30×20×1.5', '30×20×1.5', { B: 30, H: 20, t: 1.5 }, 'formula'),
  spec('rect', '▭40×20×2', '40×20×2', { B: 40, H: 20, t: 2 }, 'formula'),
  spec('rect', '▭50×30×2', '50×30×2', { B: 50, H: 30, t: 2 }, 'formula'),
  spec('rect', '▭60×40×2', '60×40×2', { B: 60, H: 40, t: 2 }, 'formula'),
  spec('rect', '▭80×40×2.5', '80×40×2.5', { B: 80, H: 40, t: 2.5 }, 'formula'),
  spec('rect', '▭100×50×3', '100×50×3', { B: 100, H: 50, t: 3 }, 'formula'),
  spec('rect', '▭120×60×3', '120×60×3', { B: 120, H: 60, t: 3 }, 'formula'),
  spec('rect', '▭150×100×4', '150×100×4', { B: 150, H: 100, t: 4 }, 'formula'),
  spec('rect', '▭200×100×5', '200×100×5', { B: 200, H: 100, t: 5 }, 'formula'),
  spec('round', 'Φ21×2', '21×2', { D: 21, t: 2 }, 'formula'),
  spec('round', 'Φ27×2.5', '27×2.5', { D: 27, t: 2.5 }, 'formula'),
  spec('round', 'Φ33×3', '33×3', { D: 33, t: 3 }, 'formula'),
  spec('round', 'Φ42×3', '42×3', { D: 42, t: 3 }, 'formula'),
  spec('round', 'Φ48×3.5', '48×3.5', { D: 48, t: 3.5 }, 'formula'),
  spec('round', 'Φ60×3.5', '60×3.5', { D: 60, t: 3.5 }, 'formula'),
  spec('round', 'Φ76×4', '76×4', { D: 76, t: 4 }, 'formula'),
  spec('round', 'Φ89×4', '89×4', { D: 89, t: 4 }, 'formula'),
  spec('round', 'Φ108×4', '108×4', { D: 108, t: 4 }, 'formula'),
  spec('round', 'Φ133×5', '133×5', { D: 133, t: 5 }, 'formula'),
  spec('round', 'Φ159×6', '159×6', { D: 159, t: 6 }, 'formula'),
  spec('round', 'Φ219×6', '219×6', { D: 219, t: 6 }, 'formula'),
  // 钢板：kg/㎡，公式计算值。
  ...[1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 25, 30].map((t) =>
    spec('plate', `${t} mm 钢板`, `${t} mm`, { t }, 'formula')),
  // 钢筋：理论重量与国标表一致（d² × 0.00617），标注为国标表值。
  ...[6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32].map((d) =>
    spec('rebar', `Φ${d}`, `Φ${d}`, { d }, 'table', round3(rebarWeight(d)))),
];

export function catLabel(id) {
  return (CATEGORIES.find((c) => c.id === id) || {}).label || id;
}
