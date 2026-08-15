// ===== 共享存储 key =====
const K_NODES = 'pw_nodes';        // 打卡节点
const K_RECORDS = 'pw_records';    // 打卡记录（按天）
const K_MEMO_DAILY = 'memo_daily'; // 备忘（按天）

// ===== 工具函数 =====
function load(key, def) {
  const v = localStorage.getItem(key);
  if (v === null) return def;
  try { return JSON.parse(v); } catch (e) { return def; }
}
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
function nowHMS() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' +
         String(d.getMinutes()).padStart(2, '0') + ':' +
         String(d.getSeconds()).padStart(2, '0');
}
function toMinutes(hm) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hm); // 支持 HH:MM 或 HH:MM:SS
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / 60 : 0);
}
// 对比实际与目标时间，返回文案（'' 表示无目标或无法对比）
function diffText(at, target) {
  if (!at || !target) return '';
  const a = toMinutes(at), t = toMinutes(target);
  if (a === null || t === null) return '';
  const mins = Math.round(a - t);
  if (mins > 0) return '（晚于目标 ' + mins + ' 分钟）';
  if (mins < 0) return '（早于目标 ' + (-mins) + ' 分钟）';
  return '（准时）';
}

// 构建单个打卡节点行。handlers: { onPunch, onEditTime, onDel }（可为 null）
// rec: 该节点记录 { done, at } 或 undefined
function buildNodeRow(node, rec, handlers) {
  const done = rec && rec.done;
  const div = document.createElement('div');
  div.className = 'node' + (done ? ' done' : '');

  const info = document.createElement('div');
  info.className = 'node-info';
  const name = document.createElement('div');
  name.className = 'node-name';
  name.textContent = node.name + (node.time ? '（目标 ' + node.time + '）' : '');
  const time = document.createElement('div');
  time.className = 'node-time' + (node.time ? ' editable' : '');
  if (done) {
    time.textContent = '已打卡 ' + rec.at + diffText(rec.at, node.time);
    if (handlers && handlers.onEditTime) time.title = '点击修改目标时间';
  } else {
    time.textContent = node.time ? ('目标 ' + node.time + ' · 未打卡') : '未打卡';
    if (handlers && handlers.onEditTime) time.title = '点击设置目标时间';
  }
  if (handlers && handlers.onEditTime) time.onclick = function () { handlers.onEditTime(node.id); };
  info.appendChild(name);
  info.appendChild(time);

  if (handlers && handlers.onPunch) {
    const btn = document.createElement('button');
    btn.className = 'node-btn';
    btn.textContent = done ? '取消' : '打卡';
    btn.onclick = function () { handlers.onPunch(node.id); };
    div.appendChild(btn);
  }
  if (handlers && handlers.onDel) {
    const del = document.createElement('button');
    del.className = 'node-del';
    del.textContent = '×';
    del.title = '删除节点';
    del.onclick = function () { handlers.onDel(node.id); };
    div.appendChild(del);
  }
  div.appendChild(info);
  return div;
}
