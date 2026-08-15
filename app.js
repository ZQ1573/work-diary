// ===== 存储 key（首页独有） =====
const K_ANCHOR = 'bw_anchor';     // 锚点周一的时间戳
const K_ANCHOR_BIG = 'bw_isbig';  // 锚点周是否大周
const K_MEMO = 'memo_notes';      // 旧单条备忘（仅用于一次性迁移，不再写入）

// ===== 工具函数 =====
function getThisMonday(now) {
  now = now || new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = d.getDay();
  const diff = (dow === 0) ? 6 : (dow - 1);
  d.setDate(d.getDate() - diff);
  return d;
}

function isBigWeek(anchorMonday, anchorIsBig, now) {
  now = now || new Date();
  const weeks = Math.floor((getThisMonday(now) - anchorMonday) / (7 * 86400000));
  return anchorIsBig ? (weeks % 2 === 0) : (weeks % 2 === 1);
}

// 首次使用：默认锚点本周一 + 默认大周 + 4 个默认节点
function ensureInit() {
  if (localStorage.getItem(K_ANCHOR) === null) {
    save(K_ANCHOR, getThisMonday().getTime());
    save(K_ANCHOR_BIG, true);
  }
  if (localStorage.getItem(K_NODES) === null) {
    save(K_NODES, [
      { id: 1, name: '上班', time: '08:30' },
      { id: 2, name: '下班', time: '12:00' },
      { id: 3, name: '上班', time: '13:30' },
      { id: 4, name: '下班', time: '18:00' }
    ]);
  }
  if (localStorage.getItem(K_RECORDS) === null) save(K_RECORDS, {});
  if (localStorage.getItem(K_MEMO_DAILY) === null) {
    // 兼容旧数据：把单条备忘迁入当天
    const old = load(K_MEMO, '');
    const daily = {};
    if (old) daily[fmtDate(new Date())] = old;
    save(K_MEMO_DAILY, daily);
  }
}

// ===== 模块A：大小周 =====
function renderWeek() {
  const anchor = new Date(load(K_ANCHOR, getThisMonday().getTime()));
  const isBig = load(K_ANCHOR_BIG, true);
  const big = isBigWeek(anchor, isBig);
  const el = document.getElementById('weekText');
  el.textContent = big ? '大周' : '小周';
  el.className = big ? 'week-big' : 'week-small';

  const mon = getThisMonday();
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  document.getElementById('weekRange').textContent =
    fmtDate(mon) + ' ~ ' + fmtDate(sun);
}

function toggleWeek() {
  const mon = getThisMonday();
  const big = isBigWeek(new Date(load(K_ANCHOR)), load(K_ANCHOR_BIG));
  save(K_ANCHOR, mon.getTime());
  save(K_ANCHOR_BIG, !big);
  renderWeek();
}

// ===== 模块B：打卡 =====
function getTodayRecords() {
  const all = load(K_RECORDS, {});
  const key = fmtDate(new Date());
  return all[key] || {};
}

function renderNodes() {
  const nodes = load(K_NODES, []);
  const rec = getTodayRecords();
  const list = document.getElementById('nodeList');
  list.innerHTML = '';
  nodes.forEach(function (n) {
    list.appendChild(buildNodeRow(n, rec[n.id], {
      onPunch: punch,
      onEditTime: editNodeTime,
      onDel: delNode
    }));
  });
  updateClock();
}

// 当前日期 + 实时时间（精确到秒），每秒刷新
function updateClock() {
  const el = document.getElementById('todayLabel');
  if (el) el.textContent = '今日：' + fmtDate(new Date()) + ' ' + nowHMS();
}

function punch(id) {
  const all = load(K_RECORDS, {});
  const key = fmtDate(new Date());
  if (!all[key]) all[key] = {};
  if (all[key][id] && all[key][id].done) {
    delete all[key][id];
  } else {
    all[key][id] = { done: true, at: nowHMS() };
  }
  save(K_RECORDS, all);
  renderNodes();
}

// 修改节点的目标时间点
function editNodeTime(id) {
  const nodes = load(K_NODES, []);
  const n = nodes.find(function (x) { return x.id === id; });
  if (!n) return;
  const cur = n.time || '';
  const v = prompt('设置目标时间点（格式 HH:MM，留空表示不限制）：', cur);
  if (v === null) return;
  const trimmed = v.trim();
  if (trimmed && !/^(\d{1,2}):(\d{2})$/.test(trimmed)) {
    alert('格式不正确，请使用 HH:MM，例如 08:30');
    return;
  }
  n.time = trimmed ? normalizeTime(trimmed) : '';
  save(K_NODES, nodes);
  renderNodes();
}

function normalizeTime(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  return String(parseInt(m[1], 10)).padStart(2, '0') + ':' + m[2];
}

function addNode() {
  const inp = document.getElementById('nodeName');
  const timeInp = document.getElementById('nodeTime');
  const name = inp.value.trim();
  if (!name) return;
  let time = '';
  if (timeInp.value) {
    time = normalizeTime(timeInp.value);
  }
  const nodes = load(K_NODES, []);
  const id = nodes.length ? Math.max.apply(null, nodes.map(function (n) { return n.id; })) + 1 : 1;
  nodes.push({ id: id, name: name, time: time });
  save(K_NODES, nodes);
  inp.value = '';
  timeInp.value = '';
  renderNodes();
}

function delNode(id) {
  let nodes = load(K_NODES, []);
  nodes = nodes.filter(function (n) { return n.id !== id; });
  save(K_NODES, nodes);
  renderNodes();
}

function clearToday() {
  const all = load(K_RECORDS, {});
  delete all[fmtDate(new Date())];
  save(K_RECORDS, all);
  renderNodes();
}

// ===== 模块C：备忘（按天存储） =====
function initMemo() {
  const ta = document.getElementById('memo');
  const daily = load(K_MEMO_DAILY, {});
  ta.value = daily[fmtDate(new Date())] || '';
  ta.addEventListener('input', function () {
    const d = load(K_MEMO_DAILY, {});
    d[fmtDate(new Date())] = ta.value;
    save(K_MEMO_DAILY, d);
  });
}

// ===== 数据管理 =====
function resetAll() {
  if (!confirm('确定重置今日状态？将清空今日的打卡记录与今日备忘，不影响其他日期及大小周。')) return;
  const today = fmtDate(new Date());
  // 仅清今日打卡记录
  const all = load(K_RECORDS, {});
  delete all[today];
  save(K_RECORDS, all);
  // 仅清今日备忘
  const memo = load(K_MEMO_DAILY, {});
  delete memo[today];
  save(K_MEMO_DAILY, memo);
  // 同步清空首页备忘输入框
  const ta = document.getElementById('memo');
  if (ta) ta.value = '';
  renderNodes();
}

// ===== 启动 =====
function init() {
  ensureInit();
  renderWeek();
  renderNodes();
  initMemo();

  document.getElementById('toggleWeek').onclick = toggleWeek;
  document.getElementById('addNode').onclick = addNode;
  document.getElementById('clearToday').onclick = clearToday;
  document.getElementById('resetAll').onclick = resetAll;

  // 每天 0 点自动刷新今日状态
  setInterval(function () {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      renderNodes();
      renderWeek();
    }
  }, 30000);

  // 实时时钟：每秒刷新"今日"时间
  setInterval(updateClock, 1000);
}

document.addEventListener('DOMContentLoaded', init);
