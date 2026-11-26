'use strict';
(() => {
// =====================================================================
//  Mapa Mental — editor de mapas mentais com nós e fios
// =====================================================================
const $ = (s, r = document) => r.querySelector(s);
const stage = $('#stage'), canvas = $('#canvas'), ctx = canvas.getContext('2d');
const editor = $('#editor'), menu = $('#ctxmenu');
const searchBox = $('#search'), searchInput = $('#search input'), searchList = $('#search ul');
const mctx = document.createElement('canvas').getContext('2d');

const BG = '#D4D0C8';
const FONT = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif';
const F = {
  idea: `13px ${FONT}`, panel: `12px ${FONT}`, scribble: `22px ${FONT}`, group: `600 12px ${FONT}`,
  link: `13px ${FONT}`, comp: `600 12px ${FONT}`, image: `12px ${FONT}`, check: `12px ${FONT}`,
  checkTitle: `600 12px ${FONT}`, io: `600 10px ${FONT}`, tag: `11px ${FONT}`, shape: `13px ${FONT}`,
};
const FS = { idea: 13, panel: 12, scribble: 22, group: 12, link: 13, comp: 12, image: 12, check: 12, shape: 13 };
const LH = { idea: 17, panel: 16, scribble: 28, group: 16, link: 17, comp: 16, image: 16, check: 20, shape: 17 };
const ROW = 20, CHECK_HEAD = 26, CAPTION = 22, PORT_GAP = 20, LINK_OPEN = 22;
const GRID = 20, IDEA_MAX = 240, ZMIN = 0.1, ZMAX = 4;

// corpo (top/bot), borda, faixa central escura (cTop/cBot), texto da faixa e cor das etiquetas I/O
const STATES = {
  normal:   { label: 'Normal',     top: '#E4E4E4', bot: '#B2B2B2', edge: '#1A1A1A', cTop: '#5E5E5E', cBot: '#2A2A2A', cText: '#FFFFFF', io: '#1A1A1A' },
  warning:  { label: 'Aviso',      top: '#FFC46E', bot: '#F08A10', edge: '#5A2A00', cTop: '#8E4C00', cBot: '#552A00', cText: '#FFF2DC', io: '#3A1C00' },
  error:    { label: 'Erro',       top: '#E86060', bot: '#B01414', edge: '#3C0000', cTop: '#7E0C0C', cBot: '#480000', cText: '#FFE8E8', io: '#2A0000' },
  disabled: { label: 'Desativado', top: '#DADADA', bot: '#C6C6C6', edge: '#8C8C8C', cTop: '#B8B8B8', cBot: '#A2A2A2', cText: '#F2F2F2', io: '#8C8C8C' },
};
const SEL = { top: '#BDE877', bot: '#6DAA24', edge: '#1E4A00', io: '#143300' };
const SEL_CENTER = { cTop: '#447A14', cBot: '#1F4405' };
const SIDE = 18; // largura das zonas laterais de entrada/saída
const WIRE = 'rgba(28,28,28,0.85)', WIRE_SEL = '#3D8B0A';
const PANEL_COLORS = ['#FFF9A6', '#D9F2B3', '#CDE3FF', '#FFD7D7', '#FFFFFF', '#E5D5FF'];
const GROUP_COLORS = ['#A98BEA', '#96A587', '#8AA0C8', '#E0A060', '#D47A7A', '#B0B0B0', '#E8D85A'];
const TYPES = ['idea', 'panel', 'scribble', 'group', 'comp', 'check', 'link', 'image', 'shape', 'draw'];
const TYPE_LABEL = { idea: 'Ideia', panel: 'Painel', scribble: 'Rabisco', group: 'Grupo', comp: 'Componente', check: 'Checklist', link: 'Link', image: 'Imagem', shape: 'Forma', draw: 'Desenho' };
const STATEFUL = ['idea', 'comp', 'link'];
const LINK_C = { cTop: '#2B5384', cBot: '#16304F', cText: '#CFE6FF' };

// ---------------------------------------------------------------- utils
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const isHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => Math.round(v * (1 - f)));
  return `rgb(${c.join(',')})`;
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function loadJSON(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = isIOS || /Android/i.test(navigator.userAgent);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------- texto
const wrapCache = new Map();
function wrap(text, font, maxW) {
  const key = font + '|' + maxW + '|' + text;
  const hit = wrapCache.get(key);
  if (hit) return hit;
  mctx.font = font;
  const out = [];
  for (const para of String(text).split('\n')) {
    if (!maxW) { out.push(para); continue; }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const t = line + word;
      if (mctx.measureText(t).width > maxW && line.trim()) { out.push(line.trimEnd()); line = word.trimStart(); }
      else line = t;
      while (line.length > 1 && mctx.measureText(line).width > maxW) {
        let i = line.length - 1;
        while (i > 1 && mctx.measureText(line.slice(0, i)).width > maxW) i--;
        out.push(line.slice(0, i));
        line = line.slice(i);
      }
    }
    out.push(line);
  }
  if (wrapCache.size > 3000) wrapCache.clear();
  wrapCache.set(key, out);
  return out;
}
function textWidth(lines, font) {
  mctx.font = font;
  let w = 0;
  for (const l of lines) w = Math.max(w, mctx.measureText(l).width);
  return w;
}
// ---------- Formatos das pilhas (ideias): quadrado, círculo, triângulo, losango, estrela
// Numa ideia com formato, as bolinhas ficam em volta da forma (n.anchors = [[u, v], ...],
// posições de 0 a 1 dentro do retângulo da pilha). Cada bolinha serve de entrada e de saída.
const FORMS = { square: 'Quadrado', circle: 'Círculo', triangle: 'Triângulo', diamond: 'Losango', star: 'Estrela' };
const FORM_ICON = { '': '▭', square: '■', circle: '●', triangle: '▲', diamond: '◆', star: '★' };
const FORM_K = {
  square: { tw: 0.8, th: 0.8, base: 90, ty: 0.5 },
  circle: { tw: 0.68, th: 0.68, base: 96, ty: 0.5 },
  triangle: { tw: 0.46, th: 0.34, base: 124, ty: 0.66 },
  diamond: { tw: 0.5, th: 0.48, base: 112, ty: 0.5 },
  star: { tw: 0.36, th: 0.3, base: 140, ty: 0.56 },
};
const STAR_IN = 0.45, STAR_H = (1 + Math.cos(Math.PI / 5)) / 2;   // raio interno; altura/largura da estrela
const isFormed = n => !!n && n.type === 'idea' && !!FORMS[n.form];
// imagens também podem ter bolinhas em volta (contorno retangular)
const canAnchor = n => isFormed(n) || (!!n && n.type === 'image');
const hasAnchors = n => isFormed(n) || (!!n && n.type === 'image' && !!(n.anchors && n.anchors.length));
const fk = n => n.type === 'image' ? 'image' : n.form;
const r3 = v => Math.round(v * 1000) / 1000;
const circleAt = deg => [r3(0.5 + 0.5 * Math.cos(deg * Math.PI / 180)), r3(0.5 + 0.5 * Math.sin(deg * Math.PI / 180))];
function formVerts(form) {
  if (form === 'square' || form === 'image') return [[0, 0], [1, 0], [1, 1], [0, 1]];
  if (form === 'diamond') return [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];
  if (form === 'triangle') return [[0.5, 0], [1, 1], [0, 1]];
  if (form === 'star') {
    const v = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? STAR_IN : 1;
      v.push([r3(0.5 + 0.5 * r * Math.cos(a)), r3((1 + r * Math.sin(a)) / (2 * STAR_H))]);
    }
    return v;
  }
  return null;
}
function defaultAnchors(form) {
  if (form === 'circle') return [180, 270, 0, 90].map(circleAt);          // um em cada quadrante
  if (form === 'image') return [[0, 0.5], [1, 0.5]];                      // entrada à esquerda, saída à direita
  if (form === 'square') return [[0, 0.5], [0.5, 0], [1, 0.5], [0.5, 1]];  // um em cada lado
  if (form === 'star') return formVerts('star').filter((_, i) => !(i % 2)); // uma em cada ponta
  return formVerts(form);                                                   // triângulo e losango: nas pontas
}
// bolinhas extras oferecidas para cada formato
function anchorExtras(form) {
  if (form === 'circle') return [
    { label: '+ A cada 45º', pts: () => [0, 45, 90, 135, 180, 225, 270, 315].map(circleAt) },
    { label: '+ A cada 30º', pts: () => Array.from({ length: 12 }, (_, i) => circleAt(i * 30)) },
  ];
  if (['triangle', 'diamond', 'star'].includes(form)) return [{
    label: '+ Meio das arestas',
    pts: () => { const V = formVerts(form); return V.map((a, i) => { const b = V[(i + 1) % V.length]; return [r3((a[0] + b[0]) / 2), r3((a[1] + b[1]) / 2)]; }); },
  }];
  if (form === 'image') return [
    { label: '+ Meio dos lados', pts: () => [[0, 0.5], [0.5, 0], [1, 0.5], [0.5, 1]] },
    { label: '+ Cantos', pts: () => [[0, 0], [1, 0], [1, 1], [0, 1]] },
  ];
  return [];
}
function formCenter(n) {
  return { x: n.x + n.w / 2, y: n.form === 'star' ? n.y + n.w / 2 : n.form === 'triangle' ? n.y + n.h * 2 / 3 : n.y + n.h / 2 };
}
// bolinhas em coordenadas do mapa, com a direção "para fora" (o fio sai nessa direção)
function anchorPts(n) {
  const A = n.anchors && n.anchors.length ? n.anchors : defaultAnchors(fk(n));
  const c = formCenter(n);
  return A.map(([u, v]) => {
    const x = n.x + u * n.w, y = n.y + v * n.h;
    const dx = x - c.x, dy = y - c.y, l = Math.hypot(dx, dy) || 1;
    return { x, y, dx: dx / l, dy: dy / l };
  });
}
// ponto do contorno da forma mais próximo de (wx, wy), em [u, v]
function projectOutline(n, wx, wy) {
  if (n.form === 'circle') {
    const a = Math.atan2((wy - n.y - n.h / 2) / (n.h / 2), (wx - n.x - n.w / 2) / (n.w / 2));
    return [r3(0.5 + 0.5 * Math.cos(a)), r3(0.5 + 0.5 * Math.sin(a))];
  }
  const V = formVerts(fk(n)).map(([u, v]) => ({ x: n.x + u * n.w, y: n.y + v * n.h }));
  let best = null, bd = Infinity;
  V.forEach((a, i) => {
    const b = V[(i + 1) % V.length], dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    const t = l ? clamp(((wx - a.x) * dx + (wy - a.y) * dy) / l, 0, 1) : 0;
    const px = a.x + t * dx, py = a.y + t * dy, d = dist(wx, wy, px, py);
    if (d < bd) { bd = d; best = [r3((px - n.x) / n.w), r3((py - n.y) / n.h)]; }
  });
  return best;
}
function formTextMax(n) {
  const k = FORM_K[n.form];
  return Math.max(30, (n.fw || k.base * 1.5) * k.tw - 10);
}
function measureForm(n) {
  const k = FORM_K[n.form];
  const L = wrap(ideaText(n), F.idea, formTextMax(n));
  const tw = textWidth(L, F.idea), th = L.length * LH.idea;
  const S = Math.max(n.fw || k.base, Math.ceil((tw + 12) / k.tw), Math.ceil((th + 10) / k.th));
  n.w = S;
  n.h = Math.round(n.form === 'triangle' ? S * 0.87 : n.form === 'star' ? S * STAR_H : S);
}
function formPath(g, n) {
  const { x, y, w, h } = n;
  if (n.form === 'square') return rr(g, x, y, w, h, 8);
  g.beginPath();
  if (n.form === 'circle') { g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); return; }
  formVerts(fk(n)).forEach(([u, v], i) => (i ? g.lineTo(x + u * w, y + v * h) : g.moveTo(x + u * w, y + v * h)));
  g.closePath();
}
function drawFormIdea(g, n, isSel, scale, hideText) {
  const { C } = palette(n, isSel);
  g.save();
  g.lineJoin = 'round';
  shadow(g, scale);
  formPath(g, n);
  const gr = g.createLinearGradient(0, n.y, 0, n.y + n.h);
  gr.addColorStop(0, C.top); gr.addColorStop(1, C.bot);
  g.fillStyle = gr;
  g.fill();
  noShadow(g);
  g.lineWidth = isSel ? 1.7 : 1.2;
  g.strokeStyle = C.edge;
  g.stroke();
  g.restore();
  if (!hideText && scale > 0.22) {
    const L = wrap(ideaText(n), F.idea, formTextMax(n));
    g.font = F.idea;
    g.fillStyle = C.io;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const y0 = n.y + n.h * FORM_K[n.form].ty - (L.length - 1) * LH.idea / 2 + 0.5;
    L.forEach((l, i) => g.fillText(l, n.x + n.w / 2, y0 + i * LH.idea));
  }
}
// pontas dos fios ligados a n (para religar na bolinha mais próxima depois de mudar a forma)
function endPoints(n) {
  return { in: ports(n, 'in').map(p => ({ ...p })), out: ports(n, 'out').map(p => ({ ...p })) };
}
function nearestIdx(list, p) {
  let bi = 0, bd = Infinity;
  list.forEach((q, i) => { const d = dist(p.x, p.y, q.x, q.y); if (d < bd) { bd = d; bi = i; } });
  return bi;
}
function remapEnds(n, old) {
  const nin = ports(n, 'in'), nout = ports(n, 'out');
  for (const w of doc.wires) {
    if (w.from === n.id && nout.length) { const p = old.out[w.fp | 0] || old.out[0]; w.fp = p ? nearestIdx(nout, p) : 0; }
    if (w.to === n.id && nin.length) { const p = old.in[w.tp | 0] || old.in[0]; w.tp = p ? nearestIdx(nin, p) : 0; }
  }
}
function reshape(n, fn) {
  const old = endPoints(n), cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  fn();
  measure(n);
  n.x = Math.round(cx - n.w / 2); n.y = Math.round(cy - n.h / 2);
  remapEnds(n, old);
}
function formCmd(form) {
  if (!selectedNodes().some(n => n.type === 'idea')) return toast('Selecione uma ou mais ideias para trocar o formato');
  setForm(form);
}
function setForm(form) {
  const ns = selectedNodes().filter(n => n.type === 'idea' && !n.locked);
  if (!ns.length) return;
  checkpoint();
  for (const n of ns) reshape(n, () => {
    if (form) { n.form = form; n.anchors = defaultAnchors(form); }
    else { delete n.form; delete n.anchors; }
  });
  changed();
}

// ---------- Modo de edição das bolinhas de uma pilha
let anchorEdit = null;   // { id, others: [ids selecionados antes] }
function startAnchorEdit(n) {
  if (!canAnchor(n)) return;
  if (!canEdit()) return readOnlyToast();
  if (n.locked) return toast('Objeto travado — destrave para editar (Ctrl+L)');
  if (editing) commitEdit();
  if (!n.anchors || !n.anchors.length) {
    // imagem antiga (1 entrada + 1 saída): passa para bolinhas, religando os fios no lugar certo
    checkpoint();
    const old = endPoints(n);
    n.anchors = defaultAnchors(fk(n));
    remapEnds(n, old);
    changed();
  }
  anchorEdit = { id: n.id, others: [...sel].filter(id => id !== n.id) };
  sel = new Set([n.id]); selWire = null;
  buildAnchorbar();
  updateStatus(); render();
}
function endAnchorEdit() {
  if (!anchorEdit) return;
  anchorEdit = null;
  $('#anchorbar').hidden = true;
  hideMenus();
  render();
}
function anchorNode() {
  const n = anchorEdit && byId(anchorEdit.id);
  return n && canAnchor(n) && !isHidden(n) && !n.locked ? n : null;
}
function changeAnchors(n, fn) {
  checkpoint();
  const old = endPoints(n);
  fn(n.anchors);
  remapEnds(n, old);
  changed();
}
function addAnchors(n, pts) {
  const novos = pts.filter(p => !n.anchors.some(a => Math.abs(a[0] - p[0]) < 0.02 && Math.abs(a[1] - p[1]) < 0.02));
  if (!novos.length) return toast('Essas bolinhas já existem');
  if (n.anchors.length + novos.length > 48) return toast('Máximo de 48 bolinhas');
  changeAnchors(n, A => A.push(...novos));
}
function removeAnchor(n, idx) {
  if (n.anchors.length <= 1) return toast('A pilha precisa de pelo menos uma bolinha');
  changeAnchors(n, A => A.splice(idx, 1));
}
function applyAnchorsTo(targets) {
  const src = anchorNode();
  if (!src || !targets.length) return;
  checkpoint();
  for (const t of targets) reshape(t, () => { if (src.type === 'idea') t.form = src.form; t.anchors = src.anchors.map(a => [...a]); });
  changed();
  toast(`Bolinhas aplicadas a ${targets.length} pilha${targets.length > 1 ? 's' : ''}`);
}
function buildAnchorbar() {
  const n = anchorNode(), bar = $('#anchorbar');
  if (!n) return endAnchorEdit();
  bar.innerHTML = '';
  const nome = n.type === 'image' ? 'Imagem' : FORMS[n.form];
  bar.append(el('span', 'lbl', `Bolinhas (${nome}): arraste para mover · duplo clique na borda acrescenta · duplo clique na bolinha remove`));
  const btn = (t, fn) => { const b = el('button', null, t); b.addEventListener('click', fn); bar.append(b); return b; };
  for (const x of anchorExtras(fk(n))) btn(x.label, () => { const m = anchorNode(); if (m) addAnchors(m, x.pts()); });
  btn('Padrão', () => { const m = anchorNode(); if (m) changeAnchors(m, A => A.splice(0, A.length, ...defaultAnchors(fk(m)))); });
  const ap = btn('Aplicar a…', () => {
    const m = anchorNode(); if (!m) return;
    const selOthers = anchorEdit.others.map(byId).filter(t => t && t.type === m.type && !t.locked && t !== m);
    const same = doc.nodes.filter(t => t !== m && t.type === m.type && (m.type === 'image' || t.form === m.form) && !t.locked);
    const r = ap.getBoundingClientRect(), s = stage.getBoundingClientRect();
    showMenu(r.left - s.left, r.bottom - s.top, [
      { label: `Pilhas que estavam selecionadas (${selOthers.length})`, disabled: !selOthers.length, action: () => applyAnchorsTo(selOthers) },
      { label: m.type === 'image' ? `Todas as imagens (${same.length})` : `Todas as pilhas em ${FORMS[m.form].toLowerCase()} (${same.length})`, disabled: !same.length, action: () => applyAnchorsTo(same) },
    ]);
  });
  btn('Concluir', endAnchorEdit);
  bar.hidden = false;
}
function drawAnchorEdit(g) {
  const n = anchorNode();
  if (!n) return;
  const k = 1 / view.z;
  g.save();
  formPath(g, n);
  g.setLineDash([6 * k, 4 * k]);
  g.lineWidth = 1.5 * k;
  g.strokeStyle = WIRE_SEL;
  g.stroke();
  g.setLineDash([]);
  anchorPts(n).forEach((p, i) => {
    const hot = hover && hover.node === n && hover.kind === 'anchor' && hover.idx === i;
    g.beginPath();
    g.arc(p.x, p.y, hot ? 8 : 6.5, 0, Math.PI * 2);
    g.fillStyle = SEL.top;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#111111';
    g.stroke();
  });
  g.restore();
}

// Largura fixa (n.fw): ideias, links e componentes podem ter a largura escolhida pela pessoa
const WIDE = ['idea', 'link', 'comp'];
function textMax(n, extra) {
  if (isFormed(n)) return formTextMax(n);
  if (!n.fw) return IDEA_MAX;
  const { lw, rw } = compGeom(n);
  return Math.max(30, n.fw - lw - rw - 24 - (extra || 0));
}
function measure(n) {
  const portsH = n.inputs ? Math.max(n.inputs.length, n.outputs.length, 1) * PORT_GAP + 8 : 0;
  if (isFormed(n)) measureForm(n);
  else if (n.type === 'idea') {
    const L = wrap(ideaText(n), F.idea, textMax(n));
    const { lw, rw } = compGeom(n);
    n.w = n.fw ? Math.max(lw + rw + 54, n.fw) : Math.max(116, Math.ceil(textWidth(L, F.idea) + lw + rw + 24));
    n.h = Math.max(38, L.length * LH.idea + 18, portsH);
  } else if (n.type === 'scribble') {
    const L = wrap(n.text || ' ', F.scribble, 0);
    n.w = Math.max(40, Math.ceil(textWidth(L, F.scribble)) + 8);
    n.h = L.length * LH.scribble + 6;
  } else if (n.type === 'link') {
    const L = wrap(linkLabel(n), F.link, textMax(n, LINK_OPEN));
    const { lw, rw } = compGeom(n);
    n.w = n.fw ? Math.max(lw + rw + 54 + LINK_OPEN, n.fw) : Math.max(130, Math.ceil(textWidth(L, F.link) + lw + rw + 24 + LINK_OPEN));
    n.h = Math.max(38, L.length * LH.link + 18, portsH);
  } else if (n.type === 'comp') {
    const { lw, rw } = compGeom(n);
    mctx.font = F.comp;
    const nameW = mctx.measureText(n.text || ' ').width;
    n.w = Math.max(Math.ceil(lw + 26 + rw), n.fw || 0);
    n.h = Math.ceil(Math.max(Math.max(n.inputs.length, n.outputs.length, 1) * PORT_GAP + 8, nameW + 22, 44));
  } else if (n.type === 'check') {
    let w = textWidth([n.text || ' '], F.checkTitle) + 54;
    w = Math.max(w, textWidth(n.items.map(i => i.t), F.check) + 46);
    n.w = Math.max(170, Math.ceil(w));
    n.h = CHECK_HEAD + Math.max(1, n.items.length) * ROW + 8;
  }
}
// zonas laterais do componente (largura das etiquetas de entrada/saída)
function compGeom(n) {
  if (isFormed(n)) return { lw: 0, rw: 0 };
  mctx.font = F.io;
  const side = list => Math.max(20, ...list.map(s => mctx.measureText(s).width + 12));
  return { lw: side(n.inputs), rw: side(n.outputs) };
}
function linkLabel(n) {
  if (n.text) return n.text;
  try { return new URL(n.url).hostname || n.url || 'link'; } catch { return n.url || 'link'; }
}
function safeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try {
    const p = new URL(u);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(p.protocol) ? p.href : '';
  } catch { return ''; }
}
// texto editável: no checklist, 1ª linha = título e cada linha seguinte = um item
function getNodeText(n) {
  return n.type === 'check' ? [n.text, ...n.items.map(i => i.t)].join('\n') : n.text;
}
function setNodeText(n, v, prevItems) {
  if (n.type !== 'check') { n.text = v; return; }
  const lines = v.split('\n');
  n.text = (lines.shift() || '').trim();
  const prev = new Map((prevItems || n.items).map(i => [i.t, i.done]));
  n.items = lines.map(s => s.trim()).filter(Boolean).slice(0, 50).map(t => ({ t, done: !!prev.get(t) }));
}
const textKey = n => JSON.stringify([n.text, n.items || null, n.inputs || null, n.outputs || null]);
// nós com parâmetros nomeados (etiquetas editáveis e botões + ao aproximar)
const PARAM_TYPES = ['idea', 'comp', 'link'];
// entradas/saídas novas nascem sem texto (dá para nomear com duplo clique no ponto)
const DEFAULT_PORTS = { idea: [[''], ['']], link: [[''], ['']], comp: [['', ''], ['']] };
function nextLabel() { return ''; }

// ---------------------------------------------------------------- estado
// Número da versão do app (mesmo número de VERSION em sw.js): aparece em Ajuda → Versão
const APP_VERSION = 'v45';
const IDX = 'mm.index', CUR = 'mm.current';
let doc = null;
let view = { x: 0, y: 0, z: 1 };
let sel = new Set();
let pendingWire = null;      // fio solto no vazio esperando a escolha no menu (some quando o menu fecha)
let selWire = null;
let past = [], future = [];
let idMap = null;
let editing = null;
let hover = null;
let hoverNode = null;
let clip = loadJSON('mm.clip', null);
let lastMouse = null;
const settings = Object.assign({ grid: true, snap: false, selectMode: false, penColor: '#1A1A1A', penWidth: 4 }, loadJSON('mm.settings', {}));

function byId(id) {
  if (!idMap) idMap = new Map(doc.nodes.map(n => [n.id, n]));
  return idMap.get(id);
}
const hasGrips = n => n.type !== 'scribble' && n.type !== 'group' && n.type !== 'draw';
function portCount(n, kind) {
  if (!hasGrips(n)) return 0;
  if (hasAnchors(n)) return anchorPts(n).length;
  if (n.inputs) return (kind === 'in' ? n.inputs : n.outputs).length;
  return 1;
}
function ports(n, kind) {
  if (hasAnchors(n)) return anchorPts(n);
  const k = portCount(n, kind), x = kind === 'in' ? n.x : n.x + n.w;
  const out = [];
  for (let i = 0; i < k; i++) out.push({ x, y: n.y + n.h * (i + 0.5) / k });
  return out;
}
const gripIn = (n, i = 0) => ports(n, 'in')[i] || { x: n.x, y: n.y + n.h / 2 };
const gripOut = (n, i = 0) => ports(n, 'out')[i] || { x: n.x + n.w, y: n.y + n.h / 2 };
function nearestPort(n, kind, w) {
  if (hasAnchors(n) && w.x !== undefined) return nearestIdx(ports(n, kind), w);
  let best = 0, bd = Infinity;
  ports(n, kind).forEach((p, i) => { const d = Math.abs(p.y - w.y); if (d < bd) { bd = d; best = i; } });
  return best;
}
const selectedNodes = () => doc.nodes.filter(n => sel.has(n.id));
const single = () => { const s = selectedNodes(); return s.length === 1 ? s[0] : null; };

function makeNode(type, x, y, text = '', extra = {}) {
  const n = { id: uid(), type, x, y, w: 0, h: 0, text };
  if (currentFolder) n.parent = currentFolder;
  if (type === 'idea') n.state = 'normal';
  if (DEFAULT_PORTS[type]) { n.inputs = [...DEFAULT_PORTS[type][0]]; n.outputs = [...DEFAULT_PORTS[type][1]]; }
  if (type === 'panel') { n.w = 200; n.h = 110; n.color = PANEL_COLORS[0]; }
  if (type === 'group') { n.w = 0; n.h = 0; n.color = isHex(settings.groupColor) ? settings.groupColor : GROUP_COLORS[0]; n.style = 'box'; n.members = []; }
  if (type === 'comp') n.state = 'normal';
  if (type === 'link') { n.state = 'normal'; n.url = ''; }
  if (type === 'image') { n.w = 220; n.h = 180; n.src = ''; }
  if (type === 'check') { n.items = [{ t: 'Primeiro item', done: false }, { t: 'Segundo item', done: false }]; if (!text) n.text = 'Checklist'; }
  if (type === 'shape') { n.shape = 'rect'; n.color = SHAPE_COLORS[1]; n.w = 160; n.h = 90; }
  if (type === 'draw') { n.color = settings.penColor; n.width = settings.penWidth; n.pts = []; }
  Object.assign(n, extra);
  measure(n);
  return n;
}

function normalize(d) {
  const nodes = (Array.isArray(d.nodes) ? d.nodes : [])
    .filter(n => n && TYPES.includes(n.type))
    .map(n => {
      const o = { id: String(n.id || uid()), type: n.type, x: +n.x || 0, y: +n.y || 0, w: +n.w || 0, h: +n.h || 0, text: String(n.text ?? '') };
      if (STATEFUL.includes(o.type)) o.state = STATES[n.state] ? n.state : 'normal';
      const strList = (v, d) => Array.isArray(v) ? v.slice(0, 12).map(s => String(s).slice(0, 20)) : d;
      if (DEFAULT_PORTS[o.type]) { o.inputs = strList(n.inputs, [...DEFAULT_PORTS[o.type][0]]); o.outputs = strList(n.outputs, [...DEFAULT_PORTS[o.type][1]]); }
      if (o.type === 'link') o.url = safeUrl(n.url);
      if (o.type === 'image') {
        o.src = typeof n.src === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(n.src) ? n.src : '';
        o.w = Math.max(80, o.w || 220); o.h = Math.max(60, o.h || 180);
        const A = (Array.isArray(n.anchors) ? n.anchors : []).slice(0, 48).filter(a => Array.isArray(a) && isFinite(a[0]) && isFinite(a[1])).map(a => [clamp(+a[0], 0, 1), clamp(+a[1], 0, 1)]);
        if (A.length) o.anchors = A;
      }
      if (o.type === 'check') o.items = (Array.isArray(n.items) ? n.items : []).slice(0, 50)
        .map(i => ({ t: String((i && i.t) || '').slice(0, 200), done: !!(i && i.done) })).filter(i => i.t);
      if (o.type === 'panel') { o.color = isHex(n.color) ? n.color : PANEL_COLORS[0]; o.w = Math.max(80, o.w || 200); o.h = Math.max(40, o.h || 110); }
      if (o.type === 'group') {
        o.color = isHex(n.color) ? n.color : GROUP_COLORS[0];
        o.style = GROUP_STYLES[n.style] ? n.style : 'box';
        o.members = Array.isArray(n.members) ? n.members.map(String) : null; // null = grupo antigo, migrado abaixo
        if (n.hidden) o.hidden = true;
      }
      if (n.locked) o.locked = true;
      if (WIDE.includes(o.type) && +n.fw > 0) o.fw = Math.round(clamp(+n.fw, 40, 3000));
      if (n.parent) o.parent = String(n.parent).slice(0, 64);
      if ((n.votes | 0) > 0) o.votes = n.votes | 0;
      if (o.type === 'idea' && n.icon) o.icon = String(n.icon).slice(0, 8);
      if (o.type === 'idea' && FORMS[n.form]) {
        o.form = n.form;
        const A = (Array.isArray(n.anchors) ? n.anchors : []).slice(0, 48).filter(a => Array.isArray(a) && isFinite(a[0]) && isFinite(a[1])).map(a => [clamp(+a[0], 0, 1), clamp(+a[1], 0, 1)]);
        o.anchors = A.length ? A : defaultAnchors(o.form);
      }
      if (o.type === 'idea' && n.layout && typeof n.layout === 'object') {
        const lay = {};
        for (const [k, v] of Object.entries(n.layout).slice(0, 500)) if (Array.isArray(v) && isFinite(v[0]) && isFinite(v[1])) lay[String(k).slice(0, 64)] = v.length > 2 ? [+v[0], +v[1], v[2] ? 1 : 0] : [+v[0], +v[1]];
        if (Object.keys(lay).length) o.layout = lay;
      }
      if (o.type === 'shape') { o.shape = SHAPES[n.shape] ? n.shape : 'rect'; o.color = isHex(n.color) ? n.color : SHAPE_COLORS[1]; o.w = Math.max(40, o.w || 160); o.h = Math.max(30, o.h || 90); }
      if (o.type === 'draw') {
        o.color = isHex(n.color) ? n.color : '#1A1A1A'; o.width = clamp(+n.width || 3, 1, 40);
        o.pts = (Array.isArray(n.pts) ? n.pts : []).slice(0, 8000).filter(q => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1])).map(q => [+q[0], +q[1]]);
        o.w = Math.max(1, o.w); o.h = Math.max(1, o.h);
      }
      measure(o);
      return o;
    });
  fixGroups(nodes);
  const byIdN = new Map(nodes.map(n => [n.id, n]));
  const seen = new Set();
  const wires = [];
  for (const w of Array.isArray(d.wires) ? d.wires : []) {
    if (!w) continue;
    const a = byIdN.get(w.from), b = byIdN.get(w.to);
    const fp = Math.max(0, w.fp | 0), tp = Math.max(0, w.tp | 0);
    if (!a || !b || a === b || fp >= portCount(a, 'out') || tp >= portCount(b, 'in')) continue;
    const key = `${a.id}:${fp}>${b.id}:${tp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    wires.push({ ...wireStyleOf(w), id: String(w.id || uid()), from: a.id, to: b.id, fp, tp });
  }
  const v = d.view && isFinite(d.view.x) && isFinite(d.view.y) && isFinite(d.view.z) && d.view.z > 0
    ? { x: +d.view.x, y: +d.view.y, z: clamp(+d.view.z, ZMIN, ZMAX) } : null;
  return { id: String(d.id || uid()), name: String(d.name || 'Mapa sem nome').slice(0, 80), nodes, wires, view: v, updated: +d.updated || Date.now() };
}

// ---------------------------------------------------------------- grupos
// Como no Grasshopper: o grupo guarda a lista de membros e o contorno é
// recalculado a partir deles (mover um membro estica o grupo).
const GROUP_STYLES = { box: 'Contorno caixa (box)', blob: 'Contorno blob', rect: 'Contorno retângulo' };
const GROUP_PAD = 12, RECT_PAD = 30, RECT_R = 22, RECT_K = 26, BLOB_PAD = 14, FIELD_STEP = 4;
const groupGeo = new Map(); // id -> { key, fill: Path2D, stroke: Path2D, field, top }
function fixGroups(nodes) {
  for (const g of nodes) {
    if (g.type === 'group' && g.members === null) {
      g.members = nodes.filter(n => n !== g && g.w > 0 && inside(n, g)).map(n => n.id);
    }
  }
  let again = true;
  while (again) {
    again = false;
    const ids = new Set(nodes.map(n => n.id));
    for (let i = nodes.length - 1; i >= 0; i--) {
      const g = nodes[i];
      if (g.type !== 'group') continue;
      const m = [...new Set(g.members.filter(id => id !== g.id && ids.has(id)))];
      g.members = m;
      if (!m.length) { nodes.splice(i, 1); again = true; }
    }
  }
  updateGroups(nodes);
}
function updateGroups(nodes) {
  const groups = nodes.filter(n => n.type === 'group');
  if (!groups.length) return;
  const map = new Map(nodes.map(n => [n.id, n]));
  for (let pass = 0; pass < 3; pass++) {
    for (const g of groups) {
      const ms = g.members.map(id => map.get(id)).filter(Boolean);
      if (!ms.length) continue;
      const key = g.style + '|' + ms.map(n => `${Math.round(n.x)},${Math.round(n.y)},${Math.round(n.w)},${Math.round(n.h)}`).join(';');
      let geo = groupGeo.get(g.id);
      if (!geo || geo.key !== key) { geo = buildGroupGeo(g.style, ms); geo.key = key; groupGeo.set(g.id, geo); }
      g.x = geo.bb.x; g.y = geo.bb.y; g.w = geo.bb.w; g.h = geo.bb.h;
    }
  }
}
// suavização entre dois campos (cantos internos arredondados no estilo retângulo)
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
// campo implícito: >= 0 dentro do contorno
function groupField(style, ms) {
  if (style === 'blob') {
    // "metaballs": um círculo em volta de cada membro, que se fundem suavemente
    const cs = ms.map(n => ({ x: n.x + n.w / 2, y: n.y + n.h / 2, r2: (Math.hypot(n.w, n.h) / 2 + BLOB_PAD) ** 2 }));
    return (x, y) => { let s = 0; for (const c of cs) s += c.r2 / Math.max((x - c.x) ** 2 + (y - c.y) ** 2, 1e-6); return s - 1; };
  }
  // retângulos arredondados em volta de cada membro, unidos com cantos internos suaves
  const rs = ms.map(n => ({ cx: n.x + n.w / 2, cy: n.y + n.h / 2, hw: n.w / 2 + RECT_PAD, hh: n.h / 2 + RECT_PAD }));
  return (x, y) => {
    let d = Infinity;
    for (const r of rs) {
      const qx = Math.abs(x - r.cx) - r.hw + RECT_R, qy = Math.abs(y - r.cy) - r.hh + RECT_R;
      const di = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - RECT_R;
      d = d === Infinity ? di : smin(d, di, RECT_K);
    }
    return -d;
  };
}
function buildGroupGeo(style, ms) {
  const mb = bbox(ms);
  if (style !== 'blob' && style !== 'rect') {
    const bb = { x: mb.x - GROUP_PAD, y: mb.y - GROUP_PAD, w: mb.w + 2 * GROUP_PAD, h: mb.h + 2 * GROUP_PAD };
    const fill = new Path2D(); fill.rect(bb.x, bb.y, bb.w, bb.h);
    return { bb, fill, stroke: fill, field: (x, y) => (x >= bb.x && x <= bb.x + bb.w && y >= bb.y && y <= bb.y + bb.h ? 1 : -1), top: { x: bb.x + bb.w / 2, y: bb.y } };
  }
  const field = groupField(style, ms);
  // área de busca do contorno
  let m = RECT_PAD + 4;
  if (style === 'blob') m = Math.max(...ms.map(n => Math.hypot(n.w, n.h) / 2 + BLOB_PAD)) * 0.6 + 8;
  let step = FIELD_STEP;
  const ext = { x: mb.x - m, y: mb.y - m, w: mb.w + 2 * m, h: mb.h + 2 * m };
  while ((ext.w / step) * (ext.h / step) > 60000) step *= 1.5; // mapas grandes: grade mais grossa
  const nx = Math.ceil(ext.w / step) + 1, ny = Math.ceil(ext.h / step) + 1;
  const v = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = field(ext.x + i * step, ext.y + j * step);
  const fill = new Path2D(), stroke = new Path2D();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, top = null;
  const lerp = (a, b, va, vb) => a + (b - a) * (va / (va - vb));
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const x = ext.x + i * step, y = ext.y + j * step;
      const c = [[x, y, v[j * nx + i]], [x + step, y, v[j * nx + i + 1]], [x + step, y + step, v[(j + 1) * nx + i + 1]], [x, y + step, v[(j + 1) * nx + i]]];
      const ins = c.map(p => p[2] >= 0);
      if (!ins.some(Boolean)) continue;
      if (ins.every(Boolean)) { fill.rect(x, y, step, step); continue; }
      // polígono da célula (cantos internos + pontos de cruzamento), sentido horário
      const poly = [];
      for (let k = 0; k < 4; k++) {
        const a = c[k], b = c[(k + 1) % 4];
        if (ins[k]) poly.push([a[0], a[1], false]);
        if (ins[k] !== ins[(k + 1) % 4]) {
          const px = a[0] === b[0] ? a[0] : lerp(a[0], b[0], a[2], b[2]);
          const py = a[1] === b[1] ? a[1] : lerp(a[1], b[1], a[2], b[2]);
          poly.push([px, py, true]);
          x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
          if (!top || py < top.y) top = { x: px, y: py };
        }
      }
      fill.moveTo(poly[0][0], poly[0][1]);
      for (let k = 1; k < poly.length; k++) fill.lineTo(poly[k][0], poly[k][1]);
      fill.closePath();
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length];
        if (a[2] && b[2]) { stroke.moveTo(a[0], a[1]); stroke.lineTo(b[0], b[1]); }
      }
    }
  }
  if (!isFinite(x0)) { x0 = mb.x; y0 = mb.y; x1 = mb.x + mb.w; y1 = mb.y + mb.h; }
  return { bb: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, fill, stroke, field, top: top || { x: mb.x + mb.w / 2, y: mb.y } };
}
function groupContains(g, x, y) {
  const geo = groupGeo.get(g.id);
  if (geo && geo.field(x, y) >= 0) return true;
  // etiqueta com o nome
  const t = geo && groupTag(g, geo);
  return !!t && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h + 5;
}
// etiqueta branca com o nome, acima do contorno (como no Grasshopper)
function groupTag(g, geo) {
  if (!g.text) return null;
  const w = textWidth([g.text], F.tag) + 10, h = 16;
  return { x: geo.top.x - w / 2, y: geo.top.y - h - 6, w, h, ax: geo.top.x, ay: geo.top.y };
}
// todos os membros (inclusive de grupos aninhados)
function groupMembersDeep(g, acc = new Set()) {
  for (const id of g.members) {
    if (acc.has(id)) continue;
    acc.add(id);
    const m = byId(id);
    if (m && m.type === 'group') groupMembersDeep(m, acc);
  }
  return acc;
}

// ---------------------------------------------------------------- histórico
const snapshot = () => JSON.stringify({ nodes: persistNodes(), wires: doc.wires });
function checkpoint() {
  guardEdit();
  past.push(snapshot());
  if (past.length > 150) past.shift();
  future = [];
}
function restore(s) {
  const d = JSON.parse(s);
  doc.nodes = d.nodes;
  doc.wires = d.wires;
  doc.nodes.forEach(measure);
  changed();
}
function undo() {
  if (editing) commitEdit();
  if (!past.length) return toast('Nada para desfazer');
  future.push(snapshot());
  restore(past.pop());
}
function redo() {
  if (editing) commitEdit();
  if (!future.length) return toast('Nada para refazer');
  past.push(snapshot());
  restore(future.pop());
}

function changed() {
  fixGroups(doc.nodes);
  computeHidden();
  syncFolderLayout();
  queueMicrotask(cloudAfterChange);
  idMap = null;
  for (const id of [...sel]) if (!byId(id)) sel.delete(id);
  if (selWire && !doc.wires.some(w => w.id === selWire)) selWire = null;
  scheduleSave();
  updateStatus();
  render();
}

// ---------------------------------------------------------------- persistência
let saveT = null;
function setSaveState(t) { $('#saveState').textContent = t; }
function saveNow() {
  clearTimeout(saveT);
  saveT = null;
  doc.updated = Date.now();
  doc.view = { ...view };
  const ok = saveJSON('mm.map.' + doc.id, folderSwap.size ? { ...doc, nodes: persistNodes() } : doc);
  const idx = loadJSON(IDX, {});
  idx[doc.id] = { name: doc.name, updated: doc.updated };
  saveJSON(IDX, idx);
  try { localStorage.setItem(CUR, doc.id); } catch {}
  setSaveState(ok ? 'Salvo' : 'Erro ao salvar (armazenamento cheio?)');
  if (ok) recordVersion();
}
function scheduleSave(quiet) {
  if (!quiet) setSaveState('Salvando…');
  clearTimeout(saveT);
  saveT = setTimeout(saveNow, 400);
}
function flushSave() { if (saveT) saveNow(); }

function openMap(id) {
  const d = loadJSON('mm.map.' + id, null);
  if (!d) return false;
  flushSave();
  if (editing) commitEdit();
  doc = normalize(d);
  doc.cloud = !!d.cloud; doc.role = d.role || null; doc.dirty = d.dirty || null;
  currentFolder = null; folderViews = {}; folderSwap = new Map(); updateCrumbs(); endAnchorEdit();
  idMap = null;
  past = []; future = [];
  sel.clear(); selWire = null;
  $('#mapName').value = doc.name;
  if (doc.view) view = { ...doc.view }; else fitView(false);
  try { localStorage.setItem(CUR, doc.id); } catch {}
  cloudOnOpen();
  updateStatus();
  render();
  return true;
}

function newMap(starter = false) {
  flushSave();
  if (editing) commitEdit();
  doc = { id: uid(), name: starter ? 'Meu primeiro mapa' : 'Novo mapa', nodes: [], wires: [], view: null, updated: Date.now() };
  idMap = null;
  past = []; future = [];
  sel.clear(); selWire = null;
  if (starter) seedStarter();
  $('#mapName').value = doc.name;
  view = { x: W / 2, y: H / 2, z: 1 };
  fitView(false);
  saveNow();
  if (me && sb) cloudOnNew(); else cloudOnOpen();
  updateStatus();
  render();
  closeOverlay('#drawer');
}

function seedStarter() {
  const N = (type, x, y, text, extra) => { const n = makeNode(type, x, y, text, extra); doc.nodes.push(n); return n; };
  const W_ = (a, b) => doc.wires.push({ id: uid(), from: a.id, to: b.id });
  const root = N('idea', 0, 0, 'Mapa Mental');
  const a = N('idea', 0, 0, 'Ideias');
  const b = N('idea', 0, 0, 'Tarefas');
  const c = N('idea', 0, 0, 'Referências');
  const b1 = N('idea', 0, 0, 'Em andamento', { state: 'warning' });
  const b2 = N('idea', 0, 0, 'Bloqueada', { state: 'error' });
  const b3 = N('idea', 0, 0, 'Pausada', { state: 'disabled' });
  const a1 = N('idea', 0, 0, 'Arraste da bolinha\nda direita para criar');
  W_(root, a); W_(root, b); W_(root, c); W_(b, b1); W_(b, b2); W_(b, b3); W_(a, a1);
  layoutTrees();
  for (const n of [a, a1]) n.y -= 40;
  const g = makeNode('group', 0, 0, 'Estados', { members: [b1.id, b2.id, b3.id] });
  doc.nodes.unshift(g);
  updateGroups(doc.nodes);
  const all = bbox(doc.nodes);
  N('panel', all.x + all.w + 60, all.y, 'Dicas\n• Duplo clique/toque no fundo: criar\n• Arraste da bolinha direita: conectar\n• Tab: nova ideia filha · Enter: irmã\n• F2 ou duplo clique: editar texto\n• Botão direito / segurar: menu\n• Roda do mouse / pinça: zoom', { w: 250, h: 150 });
  N('scribble', all.x, all.y - 60, 'Comece por aqui ↓');
  const comp = N('comp', all.x + all.w + 60, all.y + 190, 'Decidir', { inputs: ['Custo', 'Prazo'], outputs: ['Sim', 'Não'] });
  measure(comp);
  const chk = N('check', comp.x + comp.w + 80, comp.y - 10, 'Próximos passos', { items: [{ t: 'Listar ideias', done: true }, { t: 'Conectar com fios', done: false }, { t: 'Instalar no celular', done: false }] });
  measure(chk);
  doc.wires.push({ id: uid(), from: comp.id, to: chk.id, fp: 0, tp: 0 });
  doc.nodes.unshift(makeNode('group', 0, 0, '', { members: [comp.id, chk.id], style: 'blob', color: GROUP_COLORS[2] }));
  updateGroups(doc.nodes);
  idMap = null;
}

// ---------------------------------------------------------------- geometria
function wirePts(a, b, w) {
  return curve(gripOut(a, w && w.fp), gripIn(b, w && w.tp));
}
// Fio no estilo do Grasshopper: sai da saída e chega na entrada sempre na horizontal, em curva suave e aberta.
// Quanto mais "para trás" ou mais desalinhado verticalmente, mais a curva abre (calibrado pelo print do Grasshopper).
function curveDir(p0, p3) {
  const d0 = p0.dx !== undefined ? [p0.dx, p0.dy] : [1, 0], d3 = p3.dx !== undefined ? [p3.dx, p3.dy] : [-1, 0];
  const L = Math.max(40, dist(p0.x, p0.y, p3.x, p3.y) * 0.45);
  return [p0, { x: p0.x + d0[0] * L, y: p0.y + d0[1] * L }, { x: p3.x + d3[0] * L, y: p3.y + d3[1] * L }, p3];
}
function curve(p0, p3) {
  if (p0.dx !== undefined || p3.dx !== undefined) return curveDir(p0, p3);
  const dx = p3.x - p0.x, ady = Math.abs(p3.y - p0.y);
  const forward = ady > 0 ? Math.min(1, Math.max(0, dx / ady)) : 1; // 1 = bem à frente, 0 = ao lado/atrás
  const d = Math.max(dx >= 0 ? 30 : 80, Math.abs(dx) * 0.9, 0.6 * ady, 1.05 * ady * (1 - forward));
  return [p0, { x: p0.x + d, y: p0.y }, { x: p3.x - d, y: p3.y }, p3];
}
function bez(p, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
    y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
  };
}
function segDist(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l = dx * dx + dy * dy;
  const t = l ? clamp(((px - a.x) * dx + (py - a.y) * dy) / l, 0, 1) : 0;
  return dist(px, py, a.x + t * dx, a.y + t * dy);
}
function bbox(nodes) {
  if (!nodes.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.w); y1 = Math.max(y1, n.y + n.h); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const inside = (n, g) => n.x >= g.x && n.y >= g.y && n.x + n.w <= g.x + g.w && n.y + n.h <= g.y + g.h;
const intersects = (n, r) => n.x < r.x + r.w && n.x + n.w > r.x && n.y < r.y + r.h && n.y + n.h > r.y;

function hitTest(wx, wy, touch) {
  const tol = (touch ? 16 : 7) / view.z;
  const gt = Math.max(tol, 6 / view.z);
  const ns = doc.nodes;
  let best = null, bd = Infinity;
  if (anchorEdit) {
    const n = anchorNode();
    if (n) anchorPts(n).forEach((q, idx) => { const d = dist(wx, wy, q.x, q.y); if (d <= Math.max(gt, 9 / view.z) && d < bd) { bd = d; best = { kind: 'anchor', node: n, idx }; } });
    if (best) return best;
  }
  // controles de alinhar/distribuir (multisseleção)
  for (const b of alignButtons()) {
    if (Math.abs(wx - b.x) <= b.s / 2 + 1 / view.z && Math.abs(wy - b.y) <= b.s / 2 + 1 / view.z) return { kind: 'align', act: b.act };
  }
  // botões + (aparecem ao aproximar)
  for (let i = ns.length - 1; i >= 0; i--) {
    const n = ns[i];
    if (!zuiVisible(n)) continue;
    for (const b of zuiButtons(n)) {
      const d = dist(wx, wy, b.x, b.y);
      if (d <= Math.max(ZUI_R + 1.5, (touch ? 12 : 6) / view.z) && d < bd) { bd = d; best = { kind: 'zui', node: n, side: b.side, at: b.at, minus: b.minus }; }
    }
  }
  if (best) return best;
  for (let i = ns.length - 1; i >= 0; i--) {
    const n = ns[i];
    if (!hasGrips(n) || isHidden(n)) continue;
    for (const kind of hasAnchors(n) ? ['out'] : ['in', 'out']) {
      ports(n, kind).forEach((p, idx) => {
        const d = dist(wx, wy, p.x, p.y);
        if (d <= gt && d < bd) { bd = d; best = { kind, node: n, idx }; }
      });
    }
  }
  if (best) return best;
  for (let i = ns.length - 1; i >= 0; i--) {
    const n = ns[i];
    if (n.type === 'group' || isHidden(n)) continue;
    if (n.type === 'draw') { if (drawHit(n, wx, wy, tol)) return { kind: 'node', node: n }; continue; }
    if (['panel', 'image', 'shape'].includes(n.type) && !n.locked && dist(wx, wy, n.x + n.w, n.y + n.h) <= tol + 4 / view.z) return { kind: 'resize', node: n };
    if (WIDE.includes(n.type) && sel.has(n.id) && !n.locked && canEdit() && dist(wx, wy, n.x + n.w - 3 / view.z, n.y + n.h - 3 / view.z) <= tol + 4 / view.z) return { kind: 'width', node: n };
    if (wx >= n.x && wx <= n.x + n.w && wy >= n.y && wy <= n.y + n.h) {
      if (n.inputs && !isFormed(n)) {
        const { lw, rw } = compGeom(n);
        if (n.type === 'link' && n.url && wx >= n.x + n.w - rw - LINK_OPEN && wx <= n.x + n.w - rw) return { kind: 'open', node: n };
        if (wx <= n.x + lw && n.inputs.length) return { kind: 'param', node: n, side: 'in', idx: nearestPort(n, 'in', { y: wy }) };
        if (wx >= n.x + n.w - rw && n.outputs.length) return { kind: 'param', node: n, side: 'out', idx: nearestPort(n, 'out', { y: wy }) };
      }
      if (n.type === 'check' && wx <= n.x + 32 && wy >= n.y + CHECK_HEAD) {
        const r = Math.floor((wy - n.y - CHECK_HEAD) / ROW);
        if (r >= 0 && r < n.items.length) return { kind: 'toggle', node: n, idx: r };
      }
      return { kind: 'node', node: n };
    }
  }
  for (const w of doc.wires) {
    const a = byId(w.from), b = byId(w.to);
    if (!a || !b || isHidden(a) || isHidden(b)) continue;
    const p = wirePts(a, b, w);
    let prev = p[0];
    for (let i = 1; i <= 24; i++) {
      const c = bez(p, i / 24);
      if (segDist(wx, wy, prev, c) <= Math.max(tol * 0.8, 5 / view.z)) return { kind: 'wire', wire: w };
      prev = c;
    }
  }
  for (let i = ns.length - 1; i >= 0; i--) {
    const n = ns[i];
    if (n.type !== 'group' || isHidden(n)) continue;
    if (groupContains(n, wx, wy)) return { kind: 'node', node: n };
  }
  return { kind: 'none' };
}
// ---------- ZUI: botões + entre os parâmetros quando o zoom está próximo
const ZUI_ZOOM = 1.3, ZUI_R = 3.6;
function zuiVisible(n) {
  return !!n.inputs && !isFormed(n) && !anchorEdit && !n.locked && !isHidden(n) && !presenting && view.z >= ZUI_ZOOM && (sel.has(n.id) || hoverNode === n) && !(editing && editing.node === n);
}
function zuiButtons(n) {
  const { lw, rw } = compGeom(n);
  const out = [];
  for (const [side, list, cx] of [['in', n.inputs, n.x + lw / 2], ['out', n.outputs, n.x + n.w - rw / 2]]) {
    // como no Grasshopper: um + no topo (insere no início) e outro na base (insere no fim)
    // + e − lado a lado: no topo agem na primeira porta, na base na última
    const k = list.length, d = ZUI_R + 0.8;
    const yt = n.y + ZUI_R + 1.5, yb = n.y + n.h - ZUI_R - 1.5;
    if (k) {
      out.push({ side, at: 0, x: cx - d, y: yt }, { side, at: 0, x: cx + d, y: yt, minus: true });
      out.push({ side, at: k, x: cx - d, y: yb }, { side, at: k - 1, x: cx + d, y: yb, minus: true });
    } else {
      out.push({ side, at: 0, x: cx, y: yt }, { side, at: 0, x: cx, y: yb });
    }
  }
  return out;
}
function drawZui(g, n) {
  for (const b of zuiButtons(n)) {
    g.beginPath();
    g.arc(b.x, b.y, ZUI_R, 0, Math.PI * 2);
    g.fillStyle = '#111111';
    g.fill();
    g.beginPath();
    g.moveTo(b.x - 1.9, b.y); g.lineTo(b.x + 1.9, b.y);
    if (!b.minus) { g.moveTo(b.x, b.y - 1.9); g.lineTo(b.x, b.y + 1.9); }
    g.lineWidth = 0.9;
    g.strokeStyle = '#FFFFFF';
    g.stroke();
  }
}
function addPort(n, side, at) {
  if (editing) commitEdit();
  const list = side === 'in' ? n.inputs : n.outputs;
  if (list.length >= 12) return toast('Máximo de 12 por lado');
  checkpoint();
  list.splice(at, 0, nextLabel(list, side));
  for (const w of doc.wires) {
    if (side === 'in' && w.to === n.id && (w.tp | 0) >= at) w.tp = (w.tp | 0) + 1;
    if (side === 'out' && w.from === n.id && (w.fp | 0) >= at) w.fp = (w.fp | 0) + 1;
  }
  measure(n);
  sel = new Set([n.id]);
  changed();
  startEdit(n, true, { side, idx: at });
}
function removePort(n, side, idx) {
  const list = side === 'in' ? n.inputs : n.outputs;
  if (!list[idx] && list[idx] !== '') return;
  checkpoint();
  list.splice(idx, 1);
  doc.wires = doc.wires.filter(w => !(side === 'in' && w.to === n.id && (w.tp | 0) === idx) && !(side === 'out' && w.from === n.id && (w.fp | 0) === idx));
  for (const w of doc.wires) {
    if (side === 'in' && w.to === n.id && (w.tp | 0) > idx) w.tp--;
    if (side === 'out' && w.from === n.id && (w.fp | 0) > idx) w.fp--;
  }
  measure(n);
  changed();
}

// ---------- Alinhar e distribuir (como os controles do Grasshopper na multisseleção)
const ALIGN_LABEL = {
  left: 'Alinhar à esquerda', cx: 'Centralizar na horizontal', right: 'Alinhar à direita',
  top: 'Alinhar no topo', cy: 'Centralizar na vertical', bottom: 'Alinhar embaixo',
  dh: 'Distribuir na horizontal', dv: 'Distribuir na vertical',
};
function alignItems() {
  const ids = new Set();
  for (const n of selectedNodes()) {
    if (n.type === 'group') { for (const id of groupMembersDeep(n)) { const m = byId(id); if (m && m.type !== 'group') ids.add(id); } }
    else ids.add(n.id);
  }
  return doc.nodes.filter(n => ids.has(n.id));
}
function alignBox() {
  if (editing || presenting || (gesture && gesture.moved)) return null;
  const items = alignItems();
  if (items.length < 2) return null;
  const bb = bbox(items), p = 8 / view.z + 4;
  return { x: bb.x - p, y: bb.y - p, w: bb.w + 2 * p, h: bb.h + 2 * p };
}
function alignButtons() {
  const bb = alignBox();
  if (!bb) return [];
  const s = 13 / view.z, cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
  const out = [];
  for (const [y, dy] of [[bb.y, -1], [bb.y + bb.h, 1]]) {
    out.push({ x: cx - s, y, act: 'left', s }, { x: cx, y, act: 'cx', s }, { x: cx + s, y, act: 'right', s }, { x: cx, y: y + dy * s, act: 'dh', s });
  }
  for (const [x, dx] of [[bb.x, -1], [bb.x + bb.w, 1]]) {
    out.push({ x, y: cy - s, act: 'top', s }, { x, y: cy, act: 'cy', s }, { x, y: cy + s, act: 'bottom', s }, { x: x + dx * s, y: cy, act: 'dv', s });
  }
  return out;
}
function drawAlign(g) {
  const bb = alignBox();
  if (!bb) return;
  const z = view.z;
  g.setLineDash([2 / z, 2 / z]);
  g.lineWidth = 1 / z;
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.strokeRect(bb.x, bb.y, bb.w, bb.h);
  g.setLineDash([]);
  for (const b of alignButtons()) {
    const h = b.s / 2 - 0.6 / z, x = b.x, y = b.y, u = b.s * 0.26;
    g.fillStyle = '#2B2B2B';
    g.fillRect(x - h, y - h, 2 * h, 2 * h);
    g.lineWidth = 1 / z;
    g.strokeStyle = '#FFFFFF';
    g.strokeRect(x - h, y - h, 2 * h, 2 * h);
    g.beginPath();
    g.lineWidth = 1.3 / z;
    const arrow = (dx, dy) => {
      const tx = x + dx * u, ty = y + dy * u, bx = tx - dx * u * 0.8, by = ty - dy * u * 0.8;
      g.moveTo(x - dx * u, y - dy * u); g.lineTo(tx, ty);
      g.moveTo(bx - dy * u * 0.7, by + dx * u * 0.7); g.lineTo(tx, ty); g.lineTo(bx + dy * u * 0.7, by - dx * u * 0.7);
    };
    switch (b.act) {
      case 'left': arrow(-1, 0); break;
      case 'right': arrow(1, 0); break;
      case 'top': arrow(0, -1); break;
      case 'bottom': arrow(0, 1); break;
      case 'cx': case 'cy':
        g.moveTo(x - u, y); g.lineTo(x + u, y); g.moveTo(x, y - u); g.lineTo(x, y + u); break;
      case 'dh': for (const k of [-1, 0, 1]) { g.moveTo(x + k * u * 0.8, y - u); g.lineTo(x + k * u * 0.8, y + u); } break;
      case 'dv': for (const k of [-1, 0, 1]) { g.moveTo(x - u, y + k * u * 0.8); g.lineTo(x + u, y + k * u * 0.8); } break;
    }
    g.strokeStyle = '#FFFFFF';
    g.stroke();
  }
}
function doAlign(act) {
  const items = alignItems().filter(n => !n.locked);
  if (items.length < 2) return toast('Objetos travados não são alinhados');
  checkpoint();
  const bb = bbox(items);
  if (act === 'left') items.forEach(n => (n.x = bb.x));
  else if (act === 'right') items.forEach(n => (n.x = bb.x + bb.w - n.w));
  else if (act === 'cx') items.forEach(n => (n.x = bb.x + bb.w / 2 - n.w / 2));
  else if (act === 'top') items.forEach(n => (n.y = bb.y));
  else if (act === 'bottom') items.forEach(n => (n.y = bb.y + bb.h - n.h));
  else if (act === 'cy') items.forEach(n => (n.y = bb.y + bb.h / 2 - n.h / 2));
  else if (act === 'dh' || act === 'dv') {
    // espaços iguais entre os objetos, mantendo o primeiro e o último no lugar
    const [p, s] = act === 'dh' ? ['x', 'w'] : ['y', 'h'];
    const sorted = [...items].sort((a, b) => (a[p] + a[s] / 2) - (b[p] + b[s] / 2));
    const first = sorted[0], last = sorted[sorted.length - 1];
    const total = sorted.reduce((t, n) => t + n[s], 0);
    const gap = ((last[p] + last[s]) - first[p] - total) / (sorted.length - 1);
    let cur = first[p];
    for (const n of sorted) { n[p] = cur; cur += n[s] + gap; }
  }
  changed();
  toast(ALIGN_LABEL[act]);
}

function nodeAtForWire(w, exclude, needKind) {
  const pad = 10 / view.z;
  for (let i = doc.nodes.length - 1; i >= 0; i--) {
    const n = doc.nodes[i];
    if (!portCount(n, needKind) || n === exclude) continue;
    if (w.x >= n.x - pad && w.x <= n.x + n.w + pad && w.y >= n.y - pad && w.y <= n.y + n.h + pad) return n;
  }
  return null;
}

// ---------------------------------------------------------------- desenho
let W = 0, H = 0, dpr = 1, raf = 0, needFit = false;
function resize() {
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const first = !W;
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  W = r.width; H = r.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  if (first && needFit) { needFit = false; fitView(false); }
  draw();
}
function render() { if (!raf) raf = requestAnimationFrame(draw); }

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawGrid(g, v, w, h) {
  let s = GRID * v.z;
  let major = 5;
  while (s < 9) { s *= 5; }
  const ox = ((v.x % s) + s) % s, oy = ((v.y % s) + s) % s;
  const startI = Math.round((ox - v.x) / s), startJ = Math.round((oy - v.y) / s);
  g.lineWidth = 1;
  g.beginPath();
  for (let x = ox, i = startI; x < w; x += s, i++) if (i % major) { g.moveTo(Math.round(x) + .5, 0); g.lineTo(Math.round(x) + .5, h); }
  for (let y = oy, j = startJ; y < h; y += s, j++) if (j % major) { g.moveTo(0, Math.round(y) + .5); g.lineTo(w, Math.round(y) + .5); }
  g.strokeStyle = 'rgba(0,0,0,0.055)';
  g.stroke();
  g.beginPath();
  for (let x = ox, i = startI; x < w; x += s, i++) if (!(i % major)) { g.moveTo(Math.round(x) + .5, 0); g.lineTo(Math.round(x) + .5, h); }
  for (let y = oy, j = startJ; y < h; y += s, j++) if (!(j % major)) { g.moveTo(0, Math.round(y) + .5); g.lineTo(w, Math.round(y) + .5); }
  g.strokeStyle = 'rgba(0,0,0,0.11)';
  g.stroke();
}

function drawWire(g, p, hl, faded, scale, w) {
  g.beginPath();
  g.moveTo(p[0].x, p[0].y);
  g.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
  g.setLineDash(faded || (w && w.dash) ? [7, 5] : []);
  g.lineWidth = Math.max(hl ? 3.6 : 3, 1.2 / scale);
  g.strokeStyle = hl ? WIRE_SEL : faded ? 'rgba(60,60,60,0.45)' : (w && w.color) || WIRE;
  g.stroke();
  g.setLineDash([]);
  if (w && w.arrow) {
    const a = bez(p, 0.93), b = p[3];
    const ang = Math.atan2(b.y - a.y, b.x - a.x), L = 12, A = 0.42;
    const tx = b.x - Math.cos(ang) * 6, ty = b.y - Math.sin(ang) * 6;
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx - L * Math.cos(ang - A), ty - L * Math.sin(ang - A));
    g.lineTo(tx - L * Math.cos(ang + A), ty - L * Math.sin(ang + A));
    g.closePath();
    g.fillStyle = g.strokeStyle;
    g.fill();
  }
  if (w && w.label && scale > 0.25) {
    const m = bez(p, 0.5);
    g.font = `11px ${FONT}`;
    const tw = g.measureText(w.label).width + 12;
    g.fillStyle = '#FFFFFF';
    g.fillRect(m.x - tw / 2, m.y - 9, tw, 18);
    g.lineWidth = 1;
    g.strokeStyle = hl ? WIRE_SEL : '#333333';
    g.strokeRect(m.x - tw / 2, m.y - 9, tw, 18);
    g.fillStyle = '#111111';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(w.label, m.x, m.y + 0.5);
  }
}

function shadow(g, scale) {
  g.shadowColor = 'rgba(0,0,0,0.28)';
  g.shadowBlur = 6 * scale;
  g.shadowOffsetY = 2 * scale;
}
function noShadow(g) { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0; }

// Bolinhas de conexão no estilo Grasshopper: anel preto grosso com miolo branco,
// desenhado ATRÁS do corpo — só a metade de fora aparece, formando um "C".
function drawGrips(g, n, edge) {
  const R = 5.2;
  for (const k of hasAnchors(n) ? ['out'] : ['in', 'out']) {
    ports(n, k).forEach((p, idx) => {
      const hot = hover && hover.node === n && hover.kind === k && hover.idx === idx;
      g.beginPath();
      g.arc(p.x, p.y, hot ? R + 1.5 : R, 0, Math.PI * 2);
      g.fillStyle = hot ? SEL.top : '#FFFFFF';
      g.fill();
      g.lineWidth = 2.6;
      g.strokeStyle = edge;
      g.stroke();
    });
  }
}

// cores do corpo conforme estado e seleção
function palette(n, isSel) {
  const S = STATES[n.locked ? 'disabled' : n.state] || STATES.normal;
  return { S, C: isSel ? { ...S, ...SEL } : S, K: isSel && (n.state || 'normal') === 'normal' ? SEL_CENTER : S };
}
// corpo cinza com borda preta, sombra e brilho (comum a todos os "componentes")
function drawBody(g, n, C, isSel, scale) {
  g.save();
  shadow(g, scale);
  rr(g, n.x, n.y, n.w, n.h, 7);
  const gr = g.createLinearGradient(0, n.y, 0, n.y + n.h);
  gr.addColorStop(0, C.top); gr.addColorStop(1, C.bot);
  g.fillStyle = gr;
  g.fill();
  g.restore();
  g.lineWidth = isSel ? 1.7 : 1.2;
  g.strokeStyle = C.edge;
  g.stroke();
  rr(g, n.x + 1.5, n.y + 1.5, n.w - 3, n.h - 3, 6);
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.stroke();
}
// faixa escura interna
function drawStrip(g, x, y, w, h, K) {
  rr(g, x, y, w, h, 5);
  const pg = g.createLinearGradient(0, y, 0, y + h);
  pg.addColorStop(0, K.cTop); pg.addColorStop(1, K.cBot);
  g.fillStyle = pg;
  g.fill();
  g.lineWidth = 0.8;
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.stroke();
}
// etiquetas das entradas (esquerda) e saídas (direita)
function drawIO(g, n, C, scale) {
  if (scale <= 0.4 || !n.inputs) return;
  const { lw, rw } = compGeom(n);
  const f = editing && editing.node === n && editing.field;
  g.font = F.io;
  g.fillStyle = C.io;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  ports(n, 'in').forEach((p, i) => { if (!(f && f.side === 'in' && f.idx === i)) g.fillText(n.inputs[i], n.x + lw / 2 + 1, p.y + 0.5); });
  ports(n, 'out').forEach((p, i) => { if (!(f && f.side === 'out' && f.idx === i)) g.fillText(n.outputs[i], n.x + n.w - rw / 2 - 1, p.y + 0.5); });
}

function drawComp(g, n, isSel, scale, hideText) {
  const { S, C, K } = palette(n, isSel);
  drawBody(g, n, C, isSel, scale);
  const { lw, rw } = compGeom(n);
  if (!hideText && scale > 0.22) {
    g.save();
    g.translate(n.x + lw + 13, n.y + n.h / 2);
    g.rotate(-Math.PI / 2);
    g.font = F.comp;
    g.fillStyle = C.io;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(n.text || '', 0, 0.5, n.h - 14);
    g.restore();
  }
  drawIO(g, n, C, scale);
}

function drawLink(g, n, isSel, scale, hideText) {
  const { S, C } = palette(n, isSel);
  drawBody(g, n, C, isSel, scale);
  const { lw, rw } = compGeom(n);
  const px = n.x + lw, py = n.y + 4, pw = n.w - lw - rw, ph = n.h - 8;
  // área de abrir (↗)
  const ox = px + pw - LINK_OPEN;
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(ox + .5, py + 4); g.lineTo(ox + .5, py + ph - 4); g.stroke();
  const cx = ox + LINK_OPEN / 2, cy = n.y + n.h / 2;
  g.strokeStyle = n.url ? C.io : 'rgba(0,0,0,0.3)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cx - 4, cy + 4); g.lineTo(cx + 4, cy - 4);
  g.moveTo(cx - 1, cy - 4); g.lineTo(cx + 4, cy - 4); g.lineTo(cx + 4, cy + 1);
  g.stroke();
  if (!hideText && scale > 0.22) {
    const L = wrap(linkLabel(n), F.link, textMax(n, LINK_OPEN));
    g.font = F.link;
    g.fillStyle = n.state === 'normal' && !isSel ? '#0B4F9E' : C.io;
    g.strokeStyle = g.fillStyle;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const mx = px + (pw - LINK_OPEN) / 2;
    const y0 = n.y + n.h / 2 - (L.length - 1) * LH.link / 2 + 0.5;
    L.forEach((l, i) => {
      g.fillText(l, mx, y0 + i * LH.link);
      const tw = g.measureText(l).width;
      g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(mx - tw / 2, y0 + i * LH.link + 8); g.lineTo(mx + tw / 2, y0 + i * LH.link + 8); g.stroke();
    });
  }
  drawIO(g, n, C, scale);
}

const imgCache = new Map();
function getImg(src) {
  if (!src) return null;
  let im = imgCache.get(src);
  if (!im) { im = new Image(); im.onload = render; im.src = src; imgCache.set(src, im); }
  return im.complete && im.naturalWidth ? im : null;
}
// Imagem: só a figura (sem borda) e as bolinhas de conexão (legenda, se houver, fica abaixo)
function drawImage(g, n, isSel, scale, hideText) {
  const im = getImg(n.src);
  if (im) {
    // mantém a proporção da foto: a altura acompanha a largura
    const th = Math.max(20, n.w * im.naturalHeight / im.naturalWidth);
    if (Math.abs(n.h - th) > 0.5) { n.h = th; scheduleSave(true); }
    g.drawImage(im, n.x, n.y, n.w, n.h);
  } else {
    g.setLineDash([5, 4]);
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.strokeRect(n.x, n.y, n.w, n.h);
    g.setLineDash([]);
    if (scale > 0.3) {
      g.fillStyle = '#666';
      g.font = F.image;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(n.src ? 'Carregando…' : 'Sem imagem', n.x + n.w / 2, n.y + n.h / 2);
    }
  }
  if (isSel) {
    g.lineWidth = 2;
    g.strokeStyle = SEL.edge;
    g.strokeRect(n.x - 1, n.y - 1, n.w + 2, n.h + 2);
    if (!n.locked) {
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = 1.5;
      g.beginPath();
      for (const k of [5, 10]) { g.moveTo(n.x + n.w - k - 2, n.y + n.h - 2); g.lineTo(n.x + n.w - 2, n.y + n.h - k - 2); }
      g.stroke();
    }
  }
  if (!hideText && scale > 0.22 && n.text) {
    g.font = F.image;
    g.fillStyle = '#1A1A1A';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(n.text, n.x + n.w / 2, n.y + n.h + 5, Math.max(n.w, 160));
  }
}

function drawCheck(g, n, isSel, scale, hideText) {
  const C = isSel ? { ...STATES.normal, ...SEL } : STATES.normal;
  const K = isSel ? SEL_CENTER : STATES.normal;
  drawBody(g, n, C, isSel, scale);
  drawStrip(g, n.x + 4, n.y + 4, n.w - 8, CHECK_HEAD - 6, K);
  const done = n.items.filter(i => i.done).length;
  if (!hideText && scale > 0.22) {
    g.textBaseline = 'middle';
    g.font = F.checkTitle;
    g.fillStyle = '#FFFFFF';
    g.textAlign = 'left';
    g.fillText(n.text || '', n.x + 11, n.y + CHECK_HEAD / 2 + 1, n.w - 60);
    g.fillStyle = done && done === n.items.length ? '#BDE877' : '#D8D8D8';
    g.textAlign = 'right';
    g.fillText(`${done}/${n.items.length}`, n.x + n.w - 11, n.y + CHECK_HEAD / 2 + 1);
  }
  n.items.forEach((it, i) => {
    const ry = n.y + CHECK_HEAD + i * ROW;
    const bx = n.x + 12, by = ry + 4;
    rr(g, bx, by, 13, 13, 2);
    g.fillStyle = it.done ? '#6DAA24' : '#FFFFFF';
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = it.done ? '#1E4A00' : '#1A1A1A';
    g.stroke();
    if (it.done) {
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(bx + 3, by + 6.5); g.lineTo(bx + 5.5, by + 9.5); g.lineTo(bx + 10, by + 3.5); g.stroke();
    }
    if (!hideText && scale > 0.22) {
      g.font = F.check;
      g.fillStyle = it.done ? '#5A5A5A' : '#111111';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      const tx = n.x + 32, ty = ry + ROW / 2 + 1;
      g.fillText(it.t, tx, ty, n.w - 42);
      if (it.done) {
        const tw = Math.min(g.measureText(it.t).width, n.w - 42);
        g.strokeStyle = '#5A5A5A'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + tw, ty); g.stroke();
      }
    }
  });
  if (!n.items.length && !hideText) {
    g.font = F.check; g.fillStyle = '#555'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('(duplo clique para adicionar itens)', n.x + 12, n.y + CHECK_HEAD + ROW / 2 + 1, n.w - 24);
  }
}

function drawIdea(g, n, isSel, scale, hideText) {
  if (isFormed(n)) return drawFormIdea(g, n, isSel, scale, hideText);
  const { S, C, K } = palette(n, isSel);
  drawBody(g, n, C, isSel, scale);
  const { lw, rw } = compGeom(n);
  if (!hideText && scale > 0.22) {
    const L = wrap(ideaText(n), F.idea, textMax(n));
    g.font = F.idea;
    g.fillStyle = C.io;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const y0 = n.y + n.h / 2 - (L.length - 1) * LH.idea / 2 + 0.5;
    L.forEach((l, i) => g.fillText(l, n.x + lw + (n.w - lw - rw) / 2, y0 + i * LH.idea));
  }
  drawIO(g, n, C, scale);
}

function drawPanel(g, n, isSel, scale, hideText) {
  g.save();
  shadow(g, scale);
  rr(g, n.x, n.y, n.w, n.h, 3);
  g.fillStyle = n.color;
  g.fill();
  g.restore();
  if (isSel) { g.fillStyle = 'rgba(110,170,36,0.22)'; g.fill(); }
  g.lineWidth = isSel ? 2 : 1;
  g.strokeStyle = isSel ? SEL.edge : '#4A4A36';
  g.stroke();
  // faixa superior
  g.fillStyle = 'rgba(0,0,0,0.06)';
  g.fillRect(n.x + 1, n.y + 1, n.w - 2, 4);
  if (!hideText && scale > 0.22) {
    g.save();
    g.beginPath();
    g.rect(n.x + 4, n.y + 4, n.w - 8, n.h - 8);
    g.clip();
    g.font = F.panel;
    g.fillStyle = '#1A1A1A';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    const L = wrap(n.text || '', F.panel, n.w - 16);
    L.forEach((l, i) => g.fillText(l, n.x + 8, n.y + 8 + i * LH.panel));
    g.restore();
  }
  // alça de redimensionar
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = 1;
  g.beginPath();
  for (const k of [4, 8]) { g.moveTo(n.x + n.w - k - 2, n.y + n.h - 2); g.lineTo(n.x + n.w - 2, n.y + n.h - k - 2); }
  g.stroke();
}

function drawScribble(g, n, isSel, scale, hideText) {
  if (!hideText) {
    g.font = F.scribble;
    g.fillStyle = '#2B2B2B';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    wrap(n.text || ' ', F.scribble, 0).forEach((l, i) => g.fillText(l, n.x + 4, n.y + 4 + i * LH.scribble));
  }
  if (isSel) {
    g.setLineDash([5 / scale * dpr, 3 / scale * dpr]);
    g.lineWidth = 1.5;
    g.strokeStyle = SEL.edge;
    g.strokeRect(n.x - 2, n.y - 2, n.w + 4, n.h + 4);
    g.setLineDash([]);
  }
}

function drawGroup(g, n, isSel, scale, hideText) {
  const geo = groupGeo.get(n.id);
  if (!geo) return;
  g.fillStyle = hexA(n.color, 0.55);
  g.fill(geo.fill);
  if (isSel) g.setLineDash([6, 3]);
  g.lineWidth = isSel ? 1.8 : 1;
  g.strokeStyle = isSel ? SEL.edge : darken(n.color, 0.4);
  g.stroke(geo.stroke);
  g.setLineDash([]);
  // etiqueta com o nome
  const t = groupTag(n, geo);
  if (t && !hideText && scale > 0.18) {
    g.beginPath();
    g.moveTo(t.x, t.y); g.lineTo(t.x + t.w, t.y); g.lineTo(t.x + t.w, t.y + t.h);
    g.lineTo(t.ax + 4, t.y + t.h); g.lineTo(t.ax, t.y + t.h + 5); g.lineTo(t.ax - 4, t.y + t.h);
    g.lineTo(t.x, t.y + t.h); g.closePath();
    g.fillStyle = '#FFFFFF';
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = isSel ? SEL.edge : '#222222';
    g.stroke();
    g.font = F.tag;
    g.fillStyle = '#111111';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(n.text, t.x + t.w / 2, t.y + t.h / 2 + 0.5);
  }
}

const DRAW = { idea: drawIdea, panel: drawPanel, scribble: drawScribble, group: drawGroup, comp: drawComp, link: drawLink, image: drawImage, check: drawCheck, shape: drawShape, draw: drawDraw };

function drawScene(g, o) {
  const { selection, wireSel, scale, editId, only } = o;
  const vis = n => !isHidden(n) && (!only || only.has(n.id));
  for (const n of doc.nodes) if (n.type === 'group' && vis(n)) drawGroup(g, n, selection.has(n.id), scale, n.id === editId);
  for (const w of doc.wires) {
    const a = byId(w.from), b = byId(w.to);
    if (!a || !b || !vis(a) || !vis(b)) continue;
    const hl = wireSel === w.id || selection.has(a.id) || selection.has(b.id);
    drawWire(g, wirePts(a, b, w), hl, a.state === 'disabled' || b.state === 'disabled' || a.locked || b.locked, scale, w);
  }
  for (const n of doc.nodes) {
    if (n.type === 'group' || !vis(n)) continue;
    if (hasGrips(n)) drawGrips(g, n, n.state === 'disabled' || n.locked ? '#8C8C8C' : '#111111');
    const fade = n.locked && !['idea', 'comp', 'link'].includes(n.type);
    if (fade) { g.save(); g.globalAlpha = 0.45; }
    DRAW[n.type](g, n, selection.has(n.id), scale, n.id === editId);
    if (fade) g.restore();
    if (n.votes) drawVotes(g, n);
  }
  if (o.zui) { const fc = folderCounts(); if (fc.size) for (const n of doc.nodes) if (n.type === 'idea' && !isHidden(n) && n.id !== currentFolder && fc.get(n.id)) drawFolderBadge(g, n, fc.get(n.id)); }
  if (o.zui && cloud.comments.length) for (const n of doc.nodes) if (n.type !== 'group' && !isHidden(n)) drawCommentBadge(g, n);
  if (o.zui) for (const n of doc.nodes) if (WIDE.includes(n.type) && selection.has(n.id) && !n.locked && !isHidden(n) && canEdit() && !anchorEdit) drawWidthGrip(g, n);
  if (o.zui) for (const n of doc.nodes) if (zuiVisible(n)) drawZui(g, n);
  if (o.zui && anchorEdit) drawAnchorEdit(g);
  if (o.zui) drawAlign(g);
}

function drawWidthGrip(g, n) {
  const k = 1 / view.z, x = n.x + n.w - 3 * k, y = n.y + n.h - 3 * k;
  g.save();
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.2 * k; g.lineCap = 'round';
  g.beginPath();
  for (const d of [4, 8]) { g.moveTo(x - d * k, y); g.lineTo(x, y - d * k); }
  g.stroke();
  g.restore();
}

function draw() {
  raf = 0;
  if (!doc || !W) return;
  updateGroups(doc.nodes);
  computeHidden();
  if (anchorEdit && !anchorNode()) endAnchorEdit();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  if (settings.grid && !presenting) drawGrid(ctx, view, W, H);
  ctx.setTransform(dpr * view.z, 0, 0, dpr * view.z, dpr * view.x, dpr * view.y);
  drawScene(ctx, { selection: sel, wireSel: selWire, scale: view.z * dpr, editId: editing && !editing.field && editing.node.id, zui: !presenting });

  drawPeers(ctx);
  const gs = gesture;
  if (gs && gs.moved && gs.mode === 'box') {
    const r = boxRect(gs);
    const crossing = gs.cur.x < gs.wx;
    ctx.fillStyle = 'rgba(122,181,46,0.12)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash(crossing ? [6 / view.z, 4 / view.z] : []);
    ctx.lineWidth = 1 / view.z;
    ctx.strokeStyle = WIRE_SEL;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);
  }
  if (gs && gs.moved && gs.mode === 'wire') {
    const t = gs.target;
    let p;
    if (gs.side === 'out') {
      const p0 = gripOut(gs.node, gs.idx), p3 = t ? gripIn(t, gs.tidx) : gs.cur;
      p = curve(p0, p3);
    } else {
      const p3 = gripIn(gs.node, gs.idx), p0 = t ? gripOut(t, gs.tidx) : gs.cur;
      p = curve(p0, p3);
    }
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
    ctx.setLineDash([8 / view.z, 5 / view.z]);
    ctx.lineWidth = Math.max(2.5, 1.5 / view.z);
    ctx.strokeStyle = WIRE_SEL;
    ctx.stroke();
    ctx.setLineDash([]);
    if (t) {
      rr(ctx, t.x - 3, t.y - 3, t.w + 6, t.h + 6, 8);
      ctx.lineWidth = 2 / view.z;
      ctx.strokeStyle = WIRE_SEL;
      ctx.stroke();
    }
  }
  if (pendingWire && byId(pendingWire.node.id)) {
    const q = pendingWire, p = q.side === 'out' ? curve(gripOut(q.node, q.idx), q.at) : curve(q.at, gripIn(q.node, q.idx));
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
    ctx.setLineDash([8 / view.z, 5 / view.z]);
    ctx.lineWidth = Math.max(2.5, 1.5 / view.z);
    ctx.strokeStyle = WIRE_SEL;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (gs && gs.moved && gs.mode === 'move' && gs.guides) {
    const gd = gs.guides;
    ctx.save();
    ctx.setLineDash([6 / view.z, 4 / view.z]);
    ctx.lineWidth = 1 / view.z;
    ctx.strokeStyle = WIRE_SEL;
    ctx.beginPath();
    if (gd.x != null) { ctx.moveTo(gd.x, -view.y / view.z); ctx.lineTo(gd.x, (H - view.y) / view.z); }
    if (gd.y != null) { ctx.moveTo(-view.x / view.z, gd.y); ctx.lineTo((W - view.x) / view.z, gd.y); }
    ctx.stroke();
    ctx.restore();
  }
  if (gs && gs.mode === 'draw' && gs.pts) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = settings.penColor; ctx.lineWidth = settings.penWidth;
    ctx.beginPath(); strokePts(ctx, gs.pts, 0, 0); ctx.stroke(); ctx.restore();
  }
  if (!presenting) drawCompass();
  if (editing) positionEditor();
  const zp = Math.round(view.z * 100) + '%';
  $('#stZoom').textContent = zp;
  const zo = $('#zoomSel').options[0];
  if (zo && zo.textContent !== zp) zo.textContent = zp;
}

// ---------------------------------------------------------------- bússola
// Como a bússola do Grasshopper: marcas na borda apontam para objetos fora da tela.
const COMPASS_R = 20;
function compassCenter() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  return { x: W - COMPASS_R - 14 - (coarse ? 72 : 0), y: H - COMPASS_R - 14 };
}
function compassHit(p) {
  const c = compassCenter();
  return dist(p.x, p.y, c.x, c.y) <= COMPASS_R + 6;
}
// objetos fora da tela, com o ângulo a partir do centro da vista
function offscreen() {
  const c = viewCenter();
  const vx0 = -view.x / view.z, vy0 = -view.y / view.z, vx1 = (W - view.x) / view.z, vy1 = (H - view.y) / view.z;
  const out = [];
  for (const n of doc.nodes) {
    if (n.type === 'group' || isHidden(n)) continue;
    if (n.x + n.w >= vx0 && n.x <= vx1 && n.y + n.h >= vy0 && n.y <= vy1) continue;
    const nx = n.x + n.w / 2, ny = n.y + n.h / 2;
    out.push({ n, a: Math.atan2(ny - c.y, nx - c.x), d: Math.hypot(nx - c.x, ny - c.y) });
  }
  return out;
}
function drawCompass() {
  if (!doc.nodes.length) return;
  const c = compassCenter(), R = COMPASS_R;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // marcas (triângulos pretos) na borda, apontando para fora
  ctx.fillStyle = '#111';
  for (const o of offscreen()) {
    const ca = Math.cos(o.a), sa = Math.sin(o.a);
    const r0 = R + 1, r1 = R + 7, hw = 3.2;
    ctx.beginPath();
    ctx.moveTo(c.x + ca * r1, c.y + sa * r1);
    ctx.lineTo(c.x + ca * r0 - sa * hw, c.y + sa * r0 + ca * hw);
    ctx.lineTo(c.x + ca * r0 + sa * hw, c.y + sa * r0 - ca * hw);
    ctx.closePath();
    ctx.fill();
  }
  // disco
  const gr = ctx.createRadialGradient(c.x - 6, c.y - 8, 2, c.x, c.y, R);
  gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.7, '#E2E2E2'); gr.addColorStop(1, '#B9B9B9');
  ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
  ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = '#222'; ctx.stroke();
  ctx.beginPath(); ctx.arc(c.x, c.y, R - 5, 0, Math.PI * 2);
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(c.x, c.y, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = '#555'; ctx.fill();
}
function compassClick(p) {
  const c = compassCenter();
  const dx = p.x - c.x, dy = p.y - c.y;
  if (Math.hypot(dx, dy) < 8) return fitView();
  const a = Math.atan2(dy, dx);
  const diff = o => Math.abs(Math.atan2(Math.sin(o.a - a), Math.cos(o.a - a)));
  const cand = offscreen().filter(o => diff(o) < 0.45).sort((u, v) => u.d - v.d)[0];
  if (cand) {
    const n = cand.n;
    animateView({ z: view.z, x: W / 2 - (n.x + n.w / 2) * view.z, y: H / 2 - (n.y + n.h / 2) * view.z });
  } else {
    animateView({ z: view.z, x: view.x - Math.cos(a) * W * 0.6, y: view.y - Math.sin(a) * H * 0.6 });
  }
}

// ---------------------------------------------------------------- vista
function toWorld(sx, sy) { return { x: (sx - view.x) / view.z, y: (sy - view.y) / view.z }; }
function local(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function zoomAt(sx, sy, z) {
  z = clamp(z, ZMIN, ZMAX);
  const w = toWorld(sx, sy);
  view.z = z;
  view.x = sx - w.x * z;
  view.y = sy - w.y * z;
  render();
  scheduleSave(true);
}
function fitView(animate = true, nodes = doc.nodes) {
  const bb = bbox(nodes);
  if (!W) { needFit = true; return; }
  if (!bb) { view = { x: W / 2, y: H / 2, z: 1 }; render(); return; }
  const z = clamp(Math.min((W - 60) / (bb.w + 40), (H - 60) / (bb.h + 40), 1.25), ZMIN, ZMAX);
  const target = { z, x: W / 2 - (bb.x + bb.w / 2) * z, y: H / 2 - (bb.y + bb.h / 2) * z };
  animateView(target, animate);
}
function animateView(target, animate = true) {
  if (!animate) { view = target; render(); scheduleSave(true); return; }
  const from = { ...view }, t0 = performance.now(), dur = 220;
  const step = now => {
    const t = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - t, 3);
    view = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, z: from.z + (target.z - from.z) * e };
    draw();
    if (t < 1) requestAnimationFrame(step); else scheduleSave(true);
  };
  requestAnimationFrame(step);
}
function ensureVisible(n) {
  const sx = n.x * view.z + view.x, sy = n.y * view.z + view.y;
  const m = 40;
  if (sx < m || sy < m || sx + n.w * view.z > W - m || sy + n.h * view.z > H - m) {
    animateView({ z: view.z, x: W / 2 - (n.x + n.w / 2) * view.z, y: H / 2 - (n.y + n.h / 2) * view.z });
  }
}
function viewCenter() { return toWorld(W / 2, H / 2); }

// ---------------------------------------------------------------- comandos de edição
function addNodeAt(type, wx, wy, text = '', edit = true) {
  if (editing) commitEdit();
  checkpoint();
  const n = makeNode(type, wx, wy, text);
  n.x = wx - n.w / 2; n.y = wy - n.h / 2;
  snapNode(n);
  if (type === 'group') doc.nodes.unshift(n); else doc.nodes.push(n);
  sel = new Set([n.id]); selWire = null;
  changed();
  if (edit && type !== 'group') startEdit(n, true);
  return n;
}
function children(n) {
  return doc.wires.filter(w => w.from === n.id).map(w => byId(w.to)).filter(Boolean);
}
function parentOf(n) {
  const w = doc.wires.find(w => w.to === n.id);
  return w ? byId(w.from) : null;
}
function addChild(parent) {
  if (!parent || !hasGrips(parent)) return toast('Selecione uma ideia ou painel');
  if (!portCount(parent, 'out')) return toast('Esse componente não tem saídas');
  if (editing) commitEdit();
  checkpoint();
  const kids = children(parent);
  const n = makeNode('idea', 0, 0, '');
  n.x = parent.x + parent.w + 70;
  if (kids.length) {
    const last = kids.reduce((a, b) => (b.y + b.h > a.y + a.h ? b : a));
    n.y = last.y + last.h + 16;
    n.x = Math.min(...kids.map(k => k.x));
  } else n.y = parent.y + parent.h / 2 - n.h / 2;
  avoidOverlap(n);
  doc.nodes.push(n);
  doc.wires.push({ id: uid(), from: parent.id, to: n.id, fp: 0, tp: 0 });
  sel = new Set([n.id]); selWire = null;
  changed();
  ensureVisible(n);
  startEdit(n, true);
}
function addSibling(n) {
  if (!n) return toast('Selecione uma ideia');
  const p = parentOf(n);
  if (p) return addChild(p);
  if (editing) commitEdit();
  checkpoint();
  const s = makeNode('idea', n.x, 0, '');
  s.y = n.y + n.h + 24;
  avoidOverlap(s);
  doc.nodes.push(s);
  sel = new Set([s.id]);
  changed();
  ensureVisible(s);
  startEdit(s, true);
}
// empurra um nó recém-criado para baixo até não sobrepor outro
function avoidOverlap(n) {
  const m = 10;
  for (let i = 0; i < 300; i++) {
    const hit = doc.nodes.find(o => o !== n && o.type !== 'group' &&
      n.x < o.x + o.w + m && n.x + n.w + m > o.x && n.y < o.y + o.h + m && n.y + n.h + m > o.y);
    if (!hit) return;
    n.y = hit.y + hit.h + 14;
  }
}
function addWire(a, b, fp = 0, tp = 0) {
  if (!a || !b || a === b) return false;
  if (doc.wires.some(w => w.from === a.id && w.to === b.id && (w.fp | 0) === fp && (w.tp | 0) === tp)) { toast('Essa conexão já existe'); return false; }
  checkpoint();
  doc.wires.push({ id: uid(), from: a.id, to: b.id, fp, tp });
  changed();
  return true;
}

// ---------- nós especiais
// then(n): chamado logo depois de criar (ex.: ligar no fio que foi solto no vazio)
function createSpecial(type, at, text = '', then = null) {
  if (editing) commitEdit();
  const done = (n, edit) => { if (then) then(n); if (edit) startEdit(n, true); return n; };
  if (type === 'image') {
    pickImage((src, iw, ih) => {
      const n = addNodeAt('image', at.x, at.y, text, false);
      n.src = src;
      n.h = n.w * ih / iw;
      n.y = at.y - n.h / 2;
      changed();
      done(n);
    });
    return;
  }
  if (type === 'link') {
    const looksUrl = /^(https?:\/\/|www\.|mailto:)|^[\w-]+\.[a-z]{2,}(\/|$)/i.test(text);
    const raw = prompt('Endereço do link (site, e-mail ou telefone):', looksUrl ? text : 'https://');
    if (raw == null) return;
    const url = safeUrl(raw);
    if (!url) return toast('Endereço inválido');
    const n = addNodeAt('link', at.x, at.y, looksUrl ? '' : text, false);
    n.url = url;
    measure(n);
    n.x = at.x - n.w / 2;
    changed();
    done(n);
    return;
  }
  if (type === 'check') {
    done(addNodeAt('check', at.x, at.y, text, false));
    toast('Duplo clique para editar: 1ª linha é o título, uma tarefa por linha');
    return;
  }
  if (type === 'comp') { done(addNodeAt('comp', at.x, at.y, text || 'Componente', false), !text); return; }
  if (type === 'group') return groupSelection();
  done(addNodeAt(type, at.x, at.y, text, false), !text);
}
function pickImage(cb) {
  const inp = $('#imageFile');
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    inp.value = '';
    if (!f) return;
    const url = URL.createObjectURL(f);
    try {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const s = Math.min(1, 720 / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * s));
      c.height = Math.max(1, Math.round(im.naturalHeight * s));
      const g = c.getContext('2d');
      const png = f.type === 'image/png' || f.type === 'image/gif';
      if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(im, 0, 0, c.width, c.height);
      let data = png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.82);
      if (data.length > 400000) data = c.toDataURL('image/jpeg', 0.75);
      cb(data, c.width, c.height);
    } catch { toast('Não foi possível abrir essa imagem'); }
    finally { URL.revokeObjectURL(url); }
  };
  inp.click();
}
function replaceImage(n) {
  pickImage((src, iw, ih) => {
    checkpoint();
    n.src = src;
    n.h = n.w * ih / iw;
    changed();
  });
}
function editLinkUrl(n) {
  const raw = prompt('Endereço do link:', n.url || 'https://');
  if (raw == null) return;
  const url = safeUrl(raw);
  if (!url) return toast('Endereço inválido');
  checkpoint();
  n.url = url;
  measure(n);
  changed();
}
function openLink(n) {
  if (!n.url) return editLinkUrl(n);
  window.open(n.url, '_blank', 'noopener');
}
function toggleItem(n, i) {
  if (!n.items[i]) return;
  checkpoint();
  n.items[i].done = !n.items[i].done;
  changed();
}
function deleteSelection() {
  if (editing) return;
  if (selWire) {
    checkpoint();
    doc.wires = doc.wires.filter(w => w.id !== selWire);
    selWire = null;
    return changed();
  }
  if (!sel.size) return;
  const del = new Set([...sel].filter(id => { const n = byId(id); return n && !n.locked; }));
  if (!del.size) return toast('Objetos travados não podem ser excluídos');
  const before = del.size;
  withFolderContents(del);
  checkpoint();
  doc.nodes = doc.nodes.filter(n => !del.has(n.id));
  doc.wires = doc.wires.filter(w => !del.has(w.from) && !del.has(w.to));
  sel.clear();
  changed();
  if (del.size > before) toast(`Pasta apagada com ${del.size - before} ${del.size - before > 1 ? 'itens' : 'item'} dentro — Ctrl+Z desfaz`);
}
function disconnect() {
  if (!sel.size) return toast('Selecione objetos');
  const before = doc.wires.length;
  const keep = doc.wires.filter(w => !sel.has(w.from) && !sel.has(w.to));
  if (keep.length === before) return toast('Nenhuma conexão na seleção');
  checkpoint();
  doc.wires = keep;
  changed();
}
function setState(s) {
  const ideas = selectedNodes().filter(n => STATEFUL.includes(n.type));
  if (!ideas.length) return toast('Selecione ideias, componentes ou links');
  checkpoint();
  ideas.forEach(n => (n.state = s));
  changed();
}
function setColor(c) {
  const ns = selectedNodes().filter(n => ['panel', 'group', 'shape', 'draw'].includes(n.type));
  if (!ns.length) return;
  checkpoint();
  ns.forEach(n => (n.color = c));
  changed();
}
function groupSelection() {
  if (editing) commitEdit();
  const ns = selectedNodes();
  if (!ns.length) return toast('Selecione os objetos que quer agrupar');
  checkpoint();
  const g = makeNode('group', 0, 0, '', { members: ns.map(n => n.id) });
  const first = Math.min(...ns.map(n => doc.nodes.indexOf(n)));
  doc.nodes.splice(first, 0, g);
  sel = new Set([g.id]); selWire = null;
  changed();
  toast('Grupo criado — botão direito para estilo, cor e nome');
}
function ungroup(g) {
  checkpoint();
  doc.nodes = doc.nodes.filter(n => n !== g);
  sel = new Set(g.members);
  changed();
}
function addToGroup(g) {
  const add = [...sel].filter(id => id !== g.id && !g.members.includes(id) && !groupMembersDeep(byId(id) && byId(id).type === 'group' ? byId(id) : { members: [] }).has(g.id));
  if (!add.length) return toast('Selecione também os objetos que quer acrescentar');
  checkpoint();
  g.members.push(...add);
  changed();
}
function removeFromGroup(g) {
  const rem = [...sel].filter(id => g.members.includes(id));
  if (!rem.length) return toast('Selecione membros do grupo para remover');
  checkpoint();
  g.members = g.members.filter(id => !rem.includes(id));
  changed();
}
function setGroupStyle(g, style) {
  checkpoint();
  for (const n of selectedNodes()) if (n.type === 'group') n.style = style;
  g.style = style;
  changed();
}
function pickColor(initial, cb) {
  const inp = $('#colorPick');
  inp.value = initial;
  inp.onchange = () => cb(inp.value);
  inp.click();
}
function selectAll() { sel = new Set(doc.nodes.filter(n => !isHidden(n)).map(n => n.id)); selWire = null; updateStatus(); render(); }

function copySel(cut = false) {
  const ns = withMembers(selectedNodes());
  if (!ns.length) return;
  const ids = new Set(ns.map(n => n.id));
  clip = JSON.parse(JSON.stringify({ nodes: ns, wires: doc.wires.filter(w => ids.has(w.from) && ids.has(w.to)) }));
  saveJSON('mm.clip', clip);
  if (cut) deleteSelection(); else toast(`${ns.length} ${ns.length > 1 ? 'objetos copiados' : 'objeto copiado'}`);
}
function paste(data = clip, at = null) {
  if (!data || !data.nodes || !data.nodes.length) return toast('Área de transferência vazia');
  if (editing) commitEdit();
  checkpoint();
  const map = new Map();
  const nodes = normalize({ nodes: data.nodes, wires: [] }).nodes.map(n => { const c = { ...n, id: uid() }; map.set(n.id, c.id); return c; });
  for (const n of nodes) { const pid = n.parent && map.get(n.parent); if (pid) n.parent = pid; else if (currentFolder) n.parent = currentFolder; else delete n.parent; }
  const top = nodes.filter(n => !n.parent || n.parent === currentFolder);
  const bb = bbox(top.length ? top : nodes);
  const target = at || (lastMouse && lastMouse.inside ? lastMouse.w : viewCenter());
  const dx = target.x - (bb.x + bb.w / 2), dy = target.y - (bb.y + bb.h / 2);
  nodes.forEach(n => { n.x += dx; n.y += dy; if (n.members) n.members = n.members.map(id => map.get(id)).filter(Boolean); });
  const groups = nodes.filter(n => n.type === 'group'), rest = nodes.filter(n => n.type !== 'group');
  doc.nodes.unshift(...groups);
  doc.nodes.push(...rest);
  for (const w of data.wires || []) if (map.has(w.from) && map.has(w.to)) doc.wires.push({ ...wireStyleOf(w), id: uid(), from: map.get(w.from), to: map.get(w.to), fp: w.fp | 0, tp: w.tp | 0 });
  sel = new Set(top.map(n => n.id)); selWire = null;
  changed();
}
// ao copiar um grupo, leva junto os membros
function withMembers(ns) {
  const ids = new Set(ns.map(n => n.id));
  for (const n of ns) if (n.type === 'group') groupMembersDeep(n, ids);
  withFolderContents(ids);
  return doc.nodes.filter(n => ids.has(n.id));
}
function duplicate() {
  const ns = withMembers(selectedNodes());
  if (!ns.length) return;
  const ids = new Set(ns.map(n => n.id));
  const bb = bbox(ns);
  paste(JSON.parse(JSON.stringify({ nodes: ns, wires: doc.wires.filter(w => ids.has(w.from) && ids.has(w.to)) })), { x: bb.x + bb.w / 2 + 30, y: bb.y + bb.h / 2 + 30 });
}
function snapNode(n) {
  if (!settings.snap) return;
  n.x = Math.round(n.x / GRID) * GRID;
  n.y = Math.round(n.y / GRID) * GRID;
}

// organização automática em árvore (raízes à esquerda, filhos à direita)
function layoutTrees() {
  const ns = doc.nodes.filter(n => hasGrips(n) && !isHidden(n));
  const out = new Map(), indeg = new Map();
  for (const w of doc.wires) {
    const a = byIdLocal(w.from), b = byIdLocal(w.to);
    if (!a || !b || !hasGrips(a) || !hasGrips(b) || isHidden(a) || isHidden(b)) continue;
    if (!out.has(a.id)) out.set(a.id, []);
    out.get(a.id).push(b);
    indeg.set(b.id, (indeg.get(b.id) || 0) + 1);
  }
  function byIdLocal(id) { return doc.nodes.find(n => n.id === id); }
  let roots = ns.filter(n => !indeg.get(n.id) && out.has(n.id));
  if (!roots.length) roots = ns.filter(n => out.has(n.id)).slice(0, 1);
  if (!roots.length) return false;
  roots.sort((a, b) => a.y - b.y);
  const visited = new Set();
  const colW = [];
  function build(n, d) {
    visited.add(n.id);
    colW[d] = Math.max(colW[d] || 0, n.w);
    const kids = (out.get(n.id) || []).filter(k => !visited.has(k.id)).sort((a, b) => a.y - b.y);
    kids.forEach(k => visited.add(k.id));
    return { n, d, kids: kids.map(k => build(k, d + 1)) };
  }
  const trees = roots.filter(r => !visited.has(r.id)).map(r => build(r, 0));
  const baseX = Math.min(...roots.map(r => r.x));
  const colX = [baseX];
  for (let i = 1; i < colW.length; i++) colX[i] = colX[i - 1] + colW[i - 1] + 70;
  let cy = Math.min(...roots.map(r => r.y));
  function place(t) {
    t.n.x = colX[t.d];
    if (!t.kids.length) { t.n.y = cy; cy += t.n.h + 14; return; }
    t.kids.forEach(place);
    const f = t.kids[0].n, l = t.kids[t.kids.length - 1].n;
    t.n.y = (f.y + f.h / 2 + l.y + l.h / 2) / 2 - t.n.h / 2;
  }
  for (const t of trees) { place(t); cy += 36; }
  return true;
}
function arrange() {
  const before = snapshot();
  if (!layoutTrees()) return toast('Conecte ideias com fios para organizar');
  past.push(before); future = [];
  changed();
  fitView();
}

// ---------------------------------------------------------------- edição de texto
let ignoreBlur = false;
const portList = (n, side) => (side === 'in' ? n.inputs : n.outputs);
function startEdit(n, isNew = false, field = null) {
  if (!canEdit() && !isNew) return readOnlyToast();
  if (n.type === 'draw') return;
  if (n.locked && !isNew) return toast('Objeto travado — destrave para editar (Ctrl+L)');
  hideMenus();
  if (editing) commitEdit();
  if (!isNew) checkpoint();
  editing = {
    node: n, isNew, field, orig: textKey(n), origText: n.text,
    origItems: n.items ? n.items.map(i => ({ ...i })) : null,
    origPorts: n.inputs ? [[...n.inputs], [...n.outputs]] : null,
  };
  editor.value = field ? portList(n, field.side)[field.idx] : getNodeText(n);
  editor.wrap = field || ['scribble', 'group', 'comp', 'image'].includes(n.type) ? 'off' : 'soft';
  editor.style.display = 'block';
  positionEditor();
  editor.focus({ preventScroll: true });
  editor.select();
  render();
}
function positionEditor() {
  const n = editing.node, z = view.z;
  let x = n.x, y = n.y, w = n.w, h = n.h, type = n.type, align = 'left', bg = '#fff', pt = 0, color = '#111';
  const { lw, rw } = n.inputs ? compGeom(n) : { lw: SIDE, rw: SIDE };
  const f = editing.field;
  if (f) {
    const zone = f.side === 'in' ? lw : rw;
    const cx = f.side === 'in' ? n.x + lw / 2 : n.x + n.w - rw / 2;
    const p = (f.side === 'in' ? gripIn : gripOut)(n, f.idx);
    w = Math.max(64, zone + 8); h = 16;
    x = cx - w / 2; y = p.y - h / 2;
    const s = editor.style;
    s.left = x * z + view.x + 'px'; s.top = y * z + view.y + 'px';
    s.width = w * z + 'px'; s.height = h * z + 'px';
    s.fontSize = 10 * z + 'px'; s.lineHeight = h * z + 'px'; s.fontWeight = '600';
    s.textAlign = 'center'; s.paddingTop = '0px';
    s.background = '#fff'; s.color = '#111'; s.caretColor = '#111';
    return;
  }
  if (type === 'idea' && isFormed(n)) {
    const lines = wrap(n.text || ' ', F.idea, textMax(n)).length;
    w = textMax(n) + 12; h = lines * LH.idea + 8; x = n.x + n.w / 2 - w / 2; y = n.y + n.h * FORM_K[n.form].ty - h / 2;
    align = 'center'; pt = 4; bg = '#FFFFFF'; color = '#111111';
  } else if (type === 'idea') {
    x += lw; y += 4; w -= lw + rw; h -= 8; align = 'center';
    const lines = wrap(n.text || ' ', F.idea, textMax(n)).length;
    pt = Math.max(0, (h - lines * LH.idea) / 2);
    const S = STATES[n.state] || STATES.normal;
    bg = '#FFFFFF'; color = '#111111';
  } else if (type === 'panel') { x += 8; y += 8; w -= 16; h -= 16; bg = n.color; }
  else if (type === 'scribble') { x += 4; y += 4; w += 60; bg = 'rgba(255,255,255,0.75)'; }
  else if (type === 'group') { const geo = groupGeo.get(n.id); const tp = geo ? geo.top : { x: n.x + n.w / 2, y: n.y }; w = 140; h = 18; x = tp.x - w / 2; y = tp.y - h - 6; align = 'center'; pt = 1; }
  else if (type === 'shape') {
    const tb = shapeTextBox(n), tw = shapeTextWidth(n);
    const lines = wrap(n.text || ' ', F.shape, tw).length;
    w = tw; x = n.x + (n.w - tw) / 2; y = tb.y; h = tb.h; align = 'center';
    pt = Math.max(0, (h - lines * LH.shape) / 2); bg = 'transparent'; color = shapeTextColor(n);
  }
  else if (type === 'link') {
    x += lw; y += 4; w -= lw + rw + LINK_OPEN; h -= 8; align = 'center';
    const lines = wrap(linkLabel(n), F.link, textMax(n, LINK_OPEN)).length;
    pt = Math.max(0, (h - lines * LH.link) / 2);
    bg = '#FFFFFF'; color = '#0B4F9E';
  } else if (type === 'comp') {
    w = Math.max(150, n.w); x = n.x + n.w / 2 - w / 2; h = LH.comp + 6; y = n.y + n.h / 2 - h / 2;
    align = 'center'; bg = '#FFFFFF'; color = '#111111'; pt = 3;
  } else if (type === 'image') { w = Math.max(160, n.w); x = n.x + n.w / 2 - w / 2; y = n.y + n.h + 3; h = CAPTION; align = 'center'; pt = 2; }
  else if (type === 'check') { x += 6; y += 4; w -= 12; h = Math.max(h - 8, CHECK_HEAD + 2 * ROW); pt = 2; }
  const s = editor.style;
  s.left = x * z + view.x + 'px';
  s.top = y * z + view.y + 'px';
  s.width = w * z + 'px';
  s.height = h * z + 'px';
  s.fontSize = FS[type] * z + 'px';
  s.lineHeight = LH[type] * z + 'px';
  s.fontWeight = type === 'comp' ? '600' : '400';
  s.textAlign = align;
  s.paddingTop = pt * z + 'px';
  s.background = bg;
  s.color = color;
  s.caretColor = color;
}
editor.addEventListener('input', () => {
  if (!editing) return;
  const f = editing.field;
  if (f) portList(editing.node, f.side)[f.idx] = editor.value.replace(/\n/g, ' ').slice(0, 20);
  else setNodeText(editing.node, editor.value, editing.origItems);
  measure(editing.node);
  render();
});
editor.addEventListener('keydown', e => {
  if (!editing) return;
  const t = editing.node.type;
  if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitEdit(); }
  else if (e.key === 'Enter' && editing.field) { e.preventDefault(); commitEdit(); }
  else if (e.key === 'Tab' && editing.field) { e.preventDefault(); commitEdit(); }
  else if (e.key === 'Enter' && !e.shiftKey && t !== 'panel' && t !== 'check') {
    e.preventDefault();
    const n = editing.node;
    commitEdit();
    if (t === 'idea' && byId(n.id)) { sel = new Set([n.id]); render(); }
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const n = editing.node;
    commitEdit();
    if (byId(n.id) && hasGrips(n)) e.shiftKey ? addSibling(n) : addChild(n);
  }
  e.stopPropagation();
});
editor.addEventListener('blur', () => { if (!ignoreBlur && editing) commitEdit(); });

function closeEditor() {
  editing = null;
  ignoreBlur = true;
  editor.blur();
  ignoreBlur = false;
  editor.style.display = 'none';
}
function commitEdit() {
  if (!editing) return;
  const { node, isNew, orig, origItems, field } = editing;
  closeEditor();
  if (field) {
    const v = editor.value.replace(/\s+/g, ' ').trim().slice(0, 20);
    portList(node, field.side)[field.idx] = v;
    measure(node);
    // entrada/saída pode ficar sem texto: continua existindo (para apagar, use "Remover" ou o botão −)
    if (!isNew && textKey(node) === orig) past.pop();
    changed();
    return;
  }
  setNodeText(node, editor.value.replace(/\s+$/, t => (node.type === 'panel' ? t : '')), origItems);
  measure(node);
  const keepEmpty = ['group', 'check', 'image', 'shape'].includes(node.type);
  if (isNew && !node.text.trim() && !keepEmpty) { restore(past.pop()); return; }
  if (!isNew && textKey(node) === orig) past.pop();
  changed();
}
function cancelEdit() {
  if (!editing) return;
  const { node, isNew, origText, origItems, origPorts } = editing;
  closeEditor();
  if (isNew) { restore(past.pop()); return; }
  node.text = origText;
  if (origItems) node.items = origItems;
  if (origPorts) { node.inputs = origPorts[0]; node.outputs = origPorts[1]; }
  measure(node);
  past.pop();
  render();
}

// ---------------------------------------------------------------- ponteiros (mouse, toque, caneta)
const ptrs = new Map();
// Guias de alinhamento ao arrastar: encaixa quando as bordas/centros de dois objetos quase se alinham
// e, principalmente, quando o fio entre dois objetos fica reto (saída e entrada na mesma altura).
function alignSnap(g, ddx, ddy, touch) {
  const th = (touch ? 10 : 7) / view.z;
  const moving = g.starts;
  const others = doc.nodes.filter(n => !moving.has(n.id) && !isHidden(n) && n.type !== 'draw' && n.type !== 'group');
  let bx = null, by = null, wy = null;
  for (const [id, s] of moving) {
    const n = byId(id);
    if (!n || n.type === 'draw') continue;
    const x0 = s.x + ddx, y0 = s.y + ddy;
    const xs = [x0, x0 + n.w / 2, x0 + n.w], ys = [y0, y0 + n.h / 2, y0 + n.h];
    for (const o of others) {
      const oxs = [o.x, o.x + o.w / 2, o.x + o.w], oys = [o.y, o.y + o.h / 2, o.y + o.h];
      for (const a of xs) for (const b of oxs) { const d = b - a; if (Math.abs(d) < th && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, at: b }; }
      for (const a of ys) for (const b of oys) { const d = b - a; if (Math.abs(d) < th && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, at: b }; }
    }
  }
  // fio reto: um lado do fio se move, o outro fica parado
  for (const w of doc.wires) {
    const a = byId(w.from), b = byId(w.to);
    if (!a || !b) continue;
    const am = moving.has(a.id), bm = moving.has(b.id);
    if (am === bm) continue;
    const mov = am ? a : b, fix = am ? b : a, s = moving.get(mov.id);
    const pm = (am ? gripOut(mov, w.fp | 0) : gripIn(mov, w.tp | 0)).y - mov.y + s.y + ddy;
    const pf = (am ? gripIn(fix, w.tp | 0) : gripOut(fix, w.fp | 0)).y;
    const d = pf - pm;
    if (Math.abs(d) < th && (!wy || Math.abs(d) < Math.abs(wy.d))) wy = { d, at: pf };
  }
  const yy = wy || by;
  g.guides = bx || yy ? { x: bx ? bx.at : null, y: yy ? yy.at : null } : null;
  return { dx: bx ? bx.d : 0, dy: yy ? yy.d : 0 };
}
let gesture = null, pinch = null, longTimer = null;
let lastTap = { t: 0, x: 0, y: 0 };

// ---------- Lixeira: aparece ao arrastar; soltar em cima apaga o que está sendo arrastado
const trashEl = () => $('#trash');
function updateTrash(p, g) {
  const t = trashEl();
  if (!t || presenting || !g.starts || !g.starts.size) return;
  t.hidden = false;
  const tr = t.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
  const cx = tr.left + tr.width / 2 - cr.left, cy = tr.top + tr.height / 2 - cr.top;
  g.overTrash = dist(p.x, p.y, cx, cy) <= Math.max(tr.width, 56) * 0.85;
  t.classList.toggle('hot', g.overTrash);
}
function hideTrash() { const t = trashEl(); if (t) { t.hidden = true; t.classList.remove('hot'); } }
function dropInTrash(g) {
  const ids = withFolderContents(new Set(g.starts.keys()));
  // volta tudo para o lugar original: o Ctrl+Z restaura o estado de antes do arraste
  for (const [id, st] of g.starts) { const n = byId(id); if (n) { n.x = st.x; n.y = st.y; } }
  doc.nodes = doc.nodes.filter(n => !ids.has(n.id));
  doc.wires = doc.wires.filter(w => !ids.has(w.from) && !ids.has(w.to));
  sel.clear(); selWire = null;
  changed();
  if (navigator.vibrate) navigator.vibrate(15);
  toast(`${ids.size} ${ids.size > 1 ? 'objetos apagados' : 'objeto apagado'} — Ctrl+Z desfaz`);
}
function boxRect(g) {
  return { x: Math.min(g.wx, g.cur.x), y: Math.min(g.wy, g.cur.y), w: Math.abs(g.cur.x - g.wx), h: Math.abs(g.cur.y - g.wy) };
}
function moveSet() {
  const ids = new Set(sel);
  for (const g of doc.nodes) {
    if (g.type !== 'group' || !sel.has(g.id) || g.locked) continue;
    groupMembersDeep(g, ids);
  }
  return new Map([...ids].map(id => byId(id)).filter(n => n && !n.locked).map(n => [n.id, { x: n.x, y: n.y }]));
}

// iPhone: às vezes o "dedo levantou" (pointerup/cancel) se perde e o app fica achando que há dedos na tela
// (parece zoom travado, e tocar no fundo não desseleciona). Aqui o estado dos dedos é restaurado.
function resetPointers() {
  clearTimeout(longTimer);
  const g = gesture;
  if (g && g.moved && (g.mode === 'move' || g.mode === 'resize' || g.mode === 'width' || g.mode === 'anchor')) changed();
  hideTrash();
  ptrs.clear(); pinch = null; gesture = null;
  render();
}
document.addEventListener('touchend', e => { if (!e.touches.length) setTimeout(() => { if (ptrs.size) resetPointers(); }, 80); }, { passive: true });
document.addEventListener('touchcancel', e => { if (!e.touches.length) setTimeout(() => { if (ptrs.size) resetPointers(); }, 80); }, { passive: true });
window.addEventListener('blur', () => { if (ptrs.size) resetPointers(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && ptrs.size) resetPointers(); });
canvas.addEventListener('lostpointercapture', e => { if (e.pointerType !== 'mouse') setTimeout(() => { if (ptrs.has(e.pointerId)) endPointer(e, true); }, 80); });
canvas.addEventListener('pointerdown', e => {
  hideMenus();
  // um toque "primário" é sempre o primeiro dedo: se ainda há dedos registrados, são restos de um toque que se perdeu
  if (e.isPrimary && e.pointerType !== 'mouse' && ptrs.size) resetPointers();
  if (editing) commitEdit();
  canvas.focus({ preventScroll: true });
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  const p = local(e);
  ptrs.set(e.pointerId, p);
  if (ptrs.size === 2) return startPinch();
  if (ptrs.size > 2) return;
  const w = toWorld(p.x, p.y);
  const touch = e.pointerType !== 'mouse';
  const g = gesture = { id: e.pointerId, sx: p.x, sy: p.y, wx: w.x, wy: w.y, moved: false, touch, button: e.button, add: e.shiftKey || e.ctrlKey || e.metaKey };
  const h = g.hit = compassHit(p) ? { kind: 'compass' } : hitTest(w.x, w.y, touch);
  if (anchorEdit && e.button === 0 && h.kind !== 'anchor' && h.kind !== 'compass' && !(h.node && h.node.id === anchorEdit.id)) endAnchorEdit();
  if (e.button === 0 && presenting) { g.mode = 'pan'; g.vx = view.x; g.vy = view.y; g.present = true; return; }
  if (e.button === 0 && tool === 'pen' && canEdit() && h.kind !== 'compass') { g.mode = 'draw'; g.pts = [[w.x, w.y]]; render(); return; }
  if (e.button === 0 && voteMode && h.node && h.node.type !== 'group' && h.kind !== 'compass') { g.mode = 'vote'; return; }

  if (e.button === 1 || e.button === 2) { e.preventDefault(); g.mode = 'pan'; g.vx = view.x; g.vy = view.y; return; }
  if (touch) {
    clearTimeout(longTimer);
    longTimer = setTimeout(() => {
      if (gesture === g && !g.moved && ptrs.size === 1) {
        gesture = null;
        if (navigator.vibrate) navigator.vibrate(12);
        openContextMenu(g.sx, g.sy, g.hit, { x: g.wx, y: g.wy });
      }
    }, 550);
  }
  switch (h.kind) {
    case 'out': case 'in':
      g.mode = 'wire'; g.node = h.node; g.side = h.kind; g.idx = h.idx || 0; g.cur = w; break;
    case 'anchor':
      g.mode = 'anchor'; g.node = h.node; g.idx = h.idx; break;
    case 'width': {
      g.mode = 'width'; g.node = h.node; g.w0 = h.node.w;
      g.targets = [...sel].map(byId).filter(n => n && WIDE.includes(n.type) && !n.locked && !isHidden(n));
      selWire = null; break;
    }
    case 'resize':
      if (h.node.locked) { sel = new Set([h.node.id]); g.mode = 'none'; break; }
      g.mode = 'resize'; g.node = h.node; g.w0 = h.node.w; g.h0 = h.node.h;
      sel = new Set([h.node.id]); selWire = null; break;
    case 'compass':
    case 'align':
      g.mode = 'none'; break;
    case 'zui':
      sel = new Set([h.node.id]); selWire = null; g.mode = 'none'; break;
    case 'node': case 'open': case 'toggle': case 'param': {
      const n = h.node;
      selWire = null;
      if (g.add) {
        if (sel.has(n.id)) { sel.delete(n.id); g.mode = 'none'; break; }
        sel.add(n.id);
      } else if (!sel.has(n.id)) sel = new Set([n.id]);
      g.mode = 'move';
      g.starts = moveSet();
      g.anchor = n;
      break;
    }
    case 'wire':
      sel.clear(); selWire = h.wire.id; g.mode = 'none'; break;
    default:
      if (touch && !settings.selectMode) { g.mode = 'pan'; g.vx = view.x; g.vy = view.y; }
      else {
        g.mode = 'box';
        if (!g.add) { sel.clear(); selWire = null; }
        g.base = new Set(sel);
        g.cur = w;
      }
  }
  if (!canEdit() && ['move', 'resize', 'width', 'anchor', 'wire'].includes(g.mode)) g.mode = 'none';
  updateStatus();
  render();
});

canvas.addEventListener('pointermove', e => {
  const p = local(e);
  lastMouse = { inside: true, w: toWorld(p.x, p.y) };
  if (cloud.channel) trackPresence(lastMouse.w);
  if (!ptrs.has(e.pointerId)) {
    if (e.pointerType === 'mouse') updateHover(p);
    return;
  }
  ptrs.set(e.pointerId, p);
  if (pinch) return updatePinch();
  const g = gesture;
  if (!g || g.id !== e.pointerId) return;
  const dx = p.x - g.sx, dy = p.y - g.sy;
  if (!g.moved) {
    if (Math.hypot(dx, dy) < (g.touch ? 8 : 3)) return;
    g.moved = true;
    clearTimeout(longTimer);
    if (g.mode === 'move' || g.mode === 'resize' || g.mode === 'width' || g.mode === 'anchor') checkpoint();
  }
  const w = toWorld(p.x, p.y);
  switch (g.mode) {
    case 'draw': {
      const last = g.pts[g.pts.length - 1];
      if (dist(w.x, w.y, last[0], last[1]) > 1.5 / view.z) g.pts.push([w.x, w.y]);
      break;
    }
    case 'pan':
      view.x = g.vx + dx; view.y = g.vy + dy; break;
    case 'move': {
      let ddx = w.x - g.wx, ddy = w.y - g.wy;
      if (settings.snap && g.starts.has(g.anchor.id)) {
        const s = g.starts.get(g.anchor.id);
        ddx = Math.round((s.x + ddx) / GRID) * GRID - s.x;
        ddy = Math.round((s.y + ddy) / GRID) * GRID - s.y;
      }
      if (!e.altKey && g.starts.size) { const a = alignSnap(g, ddx, ddy, g.touch); ddx += a.dx; ddy += a.dy; } else g.guides = null;
      for (const [id, s] of g.starts) { const n = byId(id); if (n) { n.x = s.x + ddx; n.y = s.y + ddy; } }
      broadcastMove(g.starts);
      updateTrash(p, g);
      break;
    }
    case 'anchor': {
      const n = g.node;
      if (n.anchors && n.anchors[g.idx]) n.anchors[g.idx] = projectOutline(n, w.x, w.y);
      break;
    }
    case 'width': {
      // todas as selecionadas ficam com a mesma largura
      let nw = g.w0 + (w.x - g.wx);
      if (settings.snap) nw = Math.round((g.node.x + nw) / GRID) * GRID - g.node.x;
      nw = Math.max(40, Math.round(nw));
      for (const t of g.targets) { t.fw = nw; measure(t); }
      break;
    }
    case 'resize': {
      const n = g.node;
      let nw = g.w0 + (w.x - g.wx), nh = g.h0 + (w.y - g.wy);
      if (settings.snap) { nw = Math.round((n.x + nw) / GRID) * GRID - n.x; nh = Math.round((n.y + nh) / GRID) * GRID - n.y; }
      n.w = Math.max(80, nw);
      n.h = Math.max(n.type === 'group' ? 50 : 40, nh);
      break;
    }
    case 'wire':
      g.cur = w;
      {
        const need = g.side === 'out' ? 'in' : 'out';
        g.target = nodeAtForWire(w, g.node, need);
        g.tidx = g.target ? nearestPort(g.target, need, w) : 0;
      }
      break;
    case 'box': {
      g.cur = w;
      const r = boxRect(g), crossing = g.cur.x < g.wx;
      sel = new Set(g.base);
      for (const n of doc.nodes) if (!isHidden(n) && (crossing ? intersects(n, r) : inside(n, r))) sel.add(n.id);
      updateStatus();
      break;
    }
  }
  render();
});

function endPointer(e, cancelled) {
  clearTimeout(longTimer);
  const p = ptrs.get(e.pointerId) || local(e);
  ptrs.delete(e.pointerId);
  if (pinch) {
    if (ptrs.size < 2) { pinch = null; scheduleSave(true); }
    return;
  }
  const g = gesture;
  if (!g || g.id !== e.pointerId) return;
  gesture = null;
  const w = toWorld(p.x, p.y);
  if (cancelled) {
    hideTrash();
    if (g.moved && (g.mode === 'move' || g.mode === 'resize' || g.mode === 'width' || g.mode === 'anchor')) changed();
    return render();
  }
  if (g.mode === 'draw') { finishStroke(g); return; }
  if (g.present) { if (!g.moved) goFrame(presenting.i + 1); return; }
  if (g.mode === 'vote') { if (!g.moved) castVote(g.hit.node, e.shiftKey); return; }
  if (g.button === 2 && !g.moved) return openContextMenu(p.x, p.y, g.hit, w);
  hideTrash();
  if (g.mode === 'move' && g.moved && g.overTrash) { dropInTrash(g); updateStatus(); return; }
  if (g.moved) {
    if (g.mode === 'move' || g.mode === 'resize' || g.mode === 'width' || g.mode === 'anchor') changed();
    else if (g.mode === 'pan') scheduleSave(true);
    else if (g.mode === 'wire') finishWire(g, w, p);
  } else if (g.button === 0) {
    if (g.mode === 'pan') { sel.clear(); selWire = null; }
    if (g.mode === 'move' && !g.add) sel = new Set([g.hit.node.id]);
    if (g.hit.kind === 'compass') { lastTap.t = 0; compassClick(p); return; }
    if (g.hit.kind === 'align') { lastTap.t = 0; doAlign(g.hit.act); return; }
    if (g.hit.kind === 'zui') { lastTap.t = 0; (g.hit.minus ? removePort : addPort)(g.hit.node, g.hit.side, g.hit.at); return; }
    if (g.hit.kind === 'open') { lastTap.t = 0; openLink(g.hit.node); updateStatus(); return render(); }
    if (g.hit.kind === 'toggle') { lastTap.t = 0; toggleItem(g.hit.node, g.hit.idx); return; }
    const now = performance.now();
    // 3º clique quando a edição não abriu (ideia travada ou só leitura)
    if (lastDouble && now - lastDouble.t < 550 && g.hit.node && g.hit.node.id === lastDouble.id && g.hit.node.type === 'idea') { lastDouble = null; lastTap.t = 0; enterFolder(g.hit.node); return; }
    if (now - lastTap.t < 380 && dist(p.x, p.y, lastTap.x, lastTap.y) < (g.touch ? 28 : 8)) {
      lastTap.t = 0;
      onDoubleTap(p, w, g.hit);
    } else lastTap = { t: now, x: p.x, y: p.y };
  }
  updateStatus();
  render();
}
canvas.addEventListener('pointerup', e => endPointer(e, false));
canvas.addEventListener('pointercancel', e => endPointer(e, true));
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ptrs.size) { lastMouse = lastMouse && { ...lastMouse, inside: false }; if (hover || hoverNode) { hover = null; hoverNode = null; render(); } } });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function updateHover(p) {
  const w = toWorld(p.x, p.y);
  const h = compassHit(p) ? { kind: 'compass' } : hitTest(w.x, w.y, false);
  const hn = h.node || null;
  if (hn !== hoverNode) { hoverNode = hn; if (view.z >= ZUI_ZOOM) render(); }
  const nh = h.kind === 'in' || h.kind === 'out' || h.kind === 'anchor' ? { node: h.node, kind: h.kind, idx: h.idx } : null;
  if ((nh && (!hover || hover.node !== nh.node || hover.kind !== nh.kind || hover.idx !== nh.idx)) || (!nh && hover)) { hover = nh; render(); }
  canvas.style.cursor = h.kind === 'in' || h.kind === 'out' ? 'crosshair' : h.kind === 'resize' ? 'nwse-resize' : h.kind === 'width' ? 'ew-resize' : h.kind === 'anchor' ? 'grab'
    : h.kind === 'node' ? 'move' : h.kind === 'param' ? 'text' : ['wire', 'open', 'toggle', 'zui', 'align', 'compass'].includes(h.kind) ? 'pointer' : 'default';
  const zuiHint = h.kind === 'zui' ? (h.minus
    ? `Remover ${h.side === 'in' ? 'entrada' : 'saída'} "${portList(h.node, h.side)[h.at]}"`
    : `Acrescentar ${h.side === 'in' ? 'entrada' : 'saída'}`) : null;
  const hint = zuiHint ? zuiHint : h.kind === 'compass' ? 'Bússola: clique na direção de uma marca para ir até ela · centro: ajustar à tela' : h.kind === 'align' ? ALIGN_LABEL[h.act] : h.kind === 'anchor' ? 'Arraste para mover a bolinha pela borda · duplo clique remove' : h.kind === 'width' ? 'Arraste para mudar a largura · com várias selecionadas, todas ficam com a mesma largura' : 'Duplo clique no fundo para criar · arraste das bolinhas para conectar';
  if ($('#stHint').textContent !== hint) $('#stHint').textContent = hint;
  if (tool === 'pen') canvas.style.cursor = 'crosshair';
  else if (voteMode && h.node && h.node.type !== 'group') canvas.style.cursor = 'copy';
}

function startPinch() {
  hideTrash();
  clearTimeout(longTimer);
  if (gesture && gesture.moved && (gesture.mode === 'move' || gesture.mode === 'resize' || gesture.mode === 'width' || gesture.mode === 'anchor')) changed();
  gesture = null;
  const [a, b] = [...ptrs.values()];
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  pinch = { d0: Math.max(10, dist(a.x, a.y, b.x, b.y)), z0: view.z, w0: toWorld(m.x, m.y) };
}
function updatePinch() {
  const [a, b] = [...ptrs.values()];
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  view.z = clamp(pinch.z0 * dist(a.x, a.y, b.x, b.y) / pinch.d0, ZMIN, ZMAX);
  view.x = m.x - pinch.w0.x * view.z;
  view.y = m.y - pinch.w0.y * view.z;
  render();
}

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  hideMenus();
  const p = local(e);
  let dy = e.deltaY;
  if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 100;
  zoomAt(p.x, p.y, view.z * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
}, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());

function finishWire(g, w, sp) {
  const need = g.side === 'out' ? 'in' : 'out';
  const t = nodeAtForWire(w, g.node, need);
  if (t) {
    const ti = nearestPort(t, need, w);
    g.side === 'out' ? addWire(g.node, t, g.idx, ti) : addWire(t, g.node, ti, g.idx);
    return;
  }
  // soltou no vazio: pergunta o que criar ali, já conectado (o fio fica tracejado esperando)
  if (editing) commitEdit();
  const src = g.node, side = g.side, idx = g.idx, at = { x: w.x, y: w.y };
  const connect = n => {
    if (!n || !byId(n.id) || !byId(src.id)) return;
    measure(n);
    n.y = at.y - n.h / 2;
    n.x = side === 'out' ? at.x : at.x - n.w;
    snapNode(n);
    doc.wires.push(side === 'out' ? { id: uid(), from: src.id, to: n.id, fp: idx, tp: 0 } : { id: uid(), from: n.id, to: src.id, fp: 0, tp: idx });
    changed();
  };
  const opt = (label, type) => ({ label, action: () => createSpecial(type, at, '', connect) });
  showMenu(sp.x, sp.y, [
    opt('💡 Ideia', 'idea'),
    opt('☑ Lista de tarefas', 'check'),
    opt('📝 Painel de notas', 'panel'),
    opt('🔗 Link', 'link'),
    opt('🖼 Imagem', 'image'),
  ]);
  pendingWire = { node: src, side, idx, at };
}


function onDoubleTap(p, w, hit) {
  const an = anchorEdit && anchorNode();
  if (an) {
    if (hit.kind === 'anchor') return removeAnchor(an, hit.idx);
    const q = projectOutline(an, w.x, w.y);
    if (dist(w.x, w.y, an.x + q[0] * an.w, an.y + q[1] * an.h) <= 14 / view.z) return addAnchors(an, [q]);
  }
  if (hit.kind === 'node') { lastDouble = { t: performance.now(), id: hit.node.id }; return startEdit(hit.node); }
  if (hit.kind === 'param') return startEdit(hit.node, false, { side: hit.side, idx: hit.idx });
  if (hit.kind === 'wire') return editWireLabel(hit.wire);
  if (hit.kind === 'none') return openSearch(p, w);
}

// ---------------------------------------------------------------- busca rápida (duplo clique)
let searchAt = null, searchIdx = 0, searchItems = [], searchTap = 0;
const KEYWORDS = {
  panel: /^(painel|panel|nota)\b/i, scribble: /^(rabisco|scribble|texto)\b/i, group: /^(grupo|group)\b/i,
  comp: /^(componente|comp)\b/i, check: /^(checklist|check|lista)\b/i, image: /^(imagem|image|foto)\b/i,
  link: /^(link|url)\b/i,
};
const URL_RE = /^(https?:\/\/|www\.|mailto:)\S+$|^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/\S*)?$/i;
// no celular o teclado cobre parte da tela: a busca fica "encaixada" no topo da área visível
const vvp = window.visualViewport;
const touchUI = matchMedia('(pointer: coarse)').matches;
function placeSearch(p) {
  if (searchBox.style.display !== 'block') return;
  if (touchUI && vvp) {
    searchBox.classList.add('docked');
    searchBox.style.left = searchBox.style.top = '';
    searchBox.style.top = Math.round(vvp.offsetTop + 6) + 'px';
    const room = vvp.height - searchInput.offsetHeight - 16;
    searchList.style.maxHeight = Math.max(90, Math.round(room)) + 'px';
  } else if (p) {
    const bw = searchBox.offsetWidth, bh = 200;
    searchBox.style.left = clamp(p.x - 20, 8, W - bw - 8) + 'px';
    searchBox.style.top = clamp(p.y - 18, 8, Math.max(8, H - bh)) + 'px';
  }
}
if (vvp) ['resize', 'scroll'].forEach(ev => vvp.addEventListener(ev, () => placeSearch()));
function openSearch(p, w) {
  hideMenus();
  searchAt = w;
  searchInput.value = '';
  searchBox.style.display = 'block';
  placeSearch(p);
  updateSearch();
  searchInput.focus({ preventScroll: true });
  if (touchUI) setTimeout(placeSearch, 350); // depois que o teclado terminou de subir
}
function updateSearch() {
  const q = searchInput.value.trim();
  let types = ['idea', 'panel', 'comp', 'check', 'link', 'image', 'scribble', 'group'];
  for (const [t, re] of Object.entries(KEYWORDS)) if (re.test(q)) types = [t, ...types.filter(x => x !== t)];
  if (URL_RE.test(q)) types = ['link', ...types.filter(x => x !== 'link')];
  searchItems = types.map(t => ({ type: t, text: KEYWORDS[t] && KEYWORDS[t].test(q) ? q.replace(KEYWORDS[t], '').replace(/^[:\s]+/, '') : q }));
  searchIdx = 0;
  searchList.innerHTML = '';
  searchItems.forEach((it, i) => {
    const li = el('li');
    li.innerHTML = ICON[it.type === 'idea' ? 'idea' : it.type] + `<strong>${TYPE_LABEL[it.type]}</strong>` + (it.text ? `<em>${esc(it.text)}</em>` : '');
    li.className = i === searchIdx ? 'active' : '';
    // "Imagem" abre o seletor de arquivos, que o celular só permite dentro de um toque completo (click),
    // não no início do toque (pointerdown); por isso essa opção espera o click
    li.addEventListener('pointerdown', ev => { ev.preventDefault(); searchIdx = i; if (it.type !== 'image') acceptSearch(); else { li._at = searchAt; searchTap = Date.now(); } });
    li.addEventListener('click', () => { if (it.type === 'image') { searchIdx = i; acceptSearch(li._at); } });
    searchList.append(li);
  });
}
function acceptSearch(atOverride) {
  const it = searchItems[searchIdx];
  const at = atOverride || searchAt;
  closeSearch();
  if (!it || !at) return;
  createSpecial(it.type, at, it.text);
}
function closeSearch() {
  searchBox.style.display = 'none';
  searchBox.classList.remove('docked');
  searchAt = null;
  if (document.activeElement === searchInput) canvas.focus({ preventScroll: true });
}
searchInput.addEventListener('input', updateSearch);
searchInput.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); closeSearch(); canvas.focus(); }
  else if (e.key === 'Enter') { e.preventDefault(); acceptSearch(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    searchIdx = (searchIdx + (e.key === 'ArrowDown' ? 1 : -1) + searchItems.length) % searchItems.length;
    [...searchList.children].forEach((li, i) => li.classList.toggle('active', i === searchIdx));
  }
});
searchInput.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== searchInput && Date.now() - searchTap > 1500) closeSearch(); }, 120));

// ---------------------------------------------------------------- menu de contexto
function hideMenus() {
  menu.style.display = 'none';
  if (pendingWire) { pendingWire = null; render(); }
  if (searchBox.style.display === 'block') closeSearch();
}
function fillMenu(menu, items) {
  menu.innerHTML = '';
  for (const it of items) {
    if (!it) continue;
    if (it === '-') { menu.append(el('div', 'sep')); continue; }
    if (it.swatches) {
      const row = el('div', 'swrow');
      row.append(el('span', 'swl', it.label));
      for (const s of it.swatches) {
        const b = el('button', 'sw');
        b.style.background = s.color || '#fff';
        if (s.text) { b.textContent = s.text; b.classList.add('emo'); }
        b.title = s.title || '';
        b.addEventListener('click', () => { hideMenus(); s.action(); });
        row.append(b);
      }
      menu.append(row);
      continue;
    }
    const b = el('button', 'mi' + (it.danger ? ' danger' : ''));
    b.innerHTML = `<span>${esc(it.label)}</span>${it.key ? `<kbd>${esc(it.key)}</kbd>` : ''}`;
    b.disabled = !!it.disabled;
    b.addEventListener('click', () => { hideMenus(); it.action(); });
    menu.append(b);
  }
}
function showMenu(sx, sy, items) {
  fillMenu(menu, items);
  menu.style.display = 'block';
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = clamp(sx + 4, 4, W - mw - 4) + 'px';
  menu.style.top = clamp(sy + 4, 4, Math.max(4, H - mh - 4)) + 'px';
}
// itens de menu para entradas/saídas (renomear, acrescentar, remover)
function paramItems(n, hit) {
  if (!n.inputs || isFormed(n)) return [];
  const items = [];
  const side = hit.kind === 'param' ? hit.side : hit.kind === 'in' || hit.kind === 'out' ? hit.kind : null;
  if (side) {
    const idx = hit.idx || 0, nome = side === 'in' ? 'entrada' : 'saída';
    const lbl = portList(n, side)[idx];
    items.push(
      { label: `Renomear ${nome} "${lbl}"`, action: () => startEdit(n, false, { side, idx }) },
      { label: `Acrescentar ${nome} abaixo`, action: () => addPort(n, side, idx + 1) },
      { label: `Remover ${nome} "${lbl}"`, danger: true, action: () => removePort(n, side, idx) },
      '-',
    );
  } else {
    items.push(
      { label: 'Acrescentar entrada', action: () => addPort(n, 'in', n.inputs.length) },
      { label: 'Acrescentar saída', action: () => addPort(n, 'out', n.outputs.length) },
    );
  }
  return items;
}
function openContextMenu(sx, sy, hit, w) {
  if (['node', 'in', 'out', 'resize', 'width', 'anchor', 'open', 'toggle', 'param', 'zui'].includes(hit.kind)) {
    const n = hit.node;
    // no grupo, mantém a seleção atual (para "Adicionar seleção ao grupo")
    if (!sel.has(n.id)) { if (n.type === 'group') sel.add(n.id); else sel = new Set([n.id]); selWire = null; }
    render(); updateStatus();
    const multi = sel.size > 1;
    const ns = selectedNodes();
    showMenu(sx, sy, [
      { label: { group: 'Renomear grupo', comp: 'Renomear componente', image: 'Editar legenda', check: 'Editar lista', link: 'Editar texto do link' }[n.type] || 'Editar texto', key: 'F2', action: () => startEdit(n) },
      ...paramItems(n, hit),
      n.type === 'link' && { label: 'Abrir link', disabled: !n.url, action: () => openLink(n) },
      n.type === 'link' && { label: 'Editar endereço…', action: () => editLinkUrl(n) },
      n.type === 'image' && { label: 'Trocar imagem…', action: () => replaceImage(n) },
      n.type === 'check' && n.items.some(i => i.done) && { label: 'Desmarcar todos', action: () => { checkpoint(); n.items.forEach(i => (i.done = false)); changed(); } },
      hasGrips(n) && portCount(n, 'out') > 0 && { label: 'Adicionar ideia filha', key: 'Tab', action: () => addChild(n) },
      n.type === 'idea' && { label: 'Adicionar ideia irmã', key: 'Enter', action: () => addSibling(n) },
      n.type === 'idea' && { label: '📂 Abrir como pasta', key: '3 cliques', action: () => enterFolder(n) },
      n.type === 'idea' && { label: '✨ Expandir com IA', action: () => aiExpand(n) },
      CLOUD_ON && n.type !== 'group' && { label: '💬 Comentar…', action: () => openComments(n.id) },
      '-',
      ...extraNodeItems(n),
      ns.some(x => STATEFUL.includes(x.type)) && { label: 'Estado', swatches: Object.entries(STATES).map(([k, s]) => ({ color: s.bot, title: s.label, action: () => setState(k) })) },
      n.type === 'panel' && { label: 'Cor', swatches: PANEL_COLORS.map(c => ({ color: c, action: () => setColor(c) })) },
      ...(n.type === 'group' ? [
        { label: 'Selecionar membros', action: () => { sel = groupMembersDeep(n); sel.add(n.id); updateStatus(); render(); } },
        '-',
        ...Object.entries(GROUP_STYLES).map(([k, lbl]) => ({ label: (n.style === k ? '✓ ' : ' ') + lbl, action: () => setGroupStyle(n, k) })),
        '-',
        { label: 'Desagrupar', action: () => ungroup(n) },
        { label: 'Adicionar seleção ao grupo', disabled: ![...sel].some(id => id !== n.id && !n.members.includes(id)), action: () => addToGroup(n) },
        { label: 'Remover seleção do grupo', disabled: ![...sel].some(id => n.members.includes(id)), action: () => removeFromGroup(n) },
        '-',
        { label: 'Cor', swatches: GROUP_COLORS.map(c => ({ color: c, action: () => setColor(c) })) },
        { label: 'Cor personalizada…', action: () => pickColor(n.color, c => setColor(c)) },
        { label: 'Tornar cor padrão', action: () => { settings.groupColor = n.color; saveJSON('mm.settings', settings); toast('Novos grupos usarão esta cor'); } },
        '-',
      ] : []),
      n.type === 'panel' && { label: 'Cor personalizada…', action: () => pickColor(n.color, c => setColor(c)) },
      { label: 'Duplicar', key: 'Ctrl+D', action: duplicate },
      { label: 'Copiar', key: 'Ctrl+C', action: () => copySel() },
      multi && { label: 'Agrupar seleção', key: 'Ctrl+G', action: groupSelection },
      { label: 'Desconectar fios', action: disconnect },
      '-',
      { label: multi ? `Excluir ${sel.size} objetos` : n.type === 'group' ? 'Excluir grupo (mantém membros)' : 'Excluir', key: 'Del', danger: true, action: deleteSelection },
    ]);
  } else if (hit.kind === 'wire') {
    selWire = hit.wire.id; sel.clear(); render(); updateStatus();
    showMenu(sx, sy, [
      { label: 'Inverter direção', action: () => { checkpoint(); const x = doc.wires.find(v => v.id === selWire); if (x) { [x.from, x.to, x.fp, x.tp] = [x.to, x.from, x.tp | 0, x.fp | 0]; if (x.fp >= portCount(byId(x.from), 'out')) x.fp = 0; if (x.tp >= portCount(byId(x.to), 'in')) x.tp = 0; } changed(); } },
      ...wireItems(hit.wire),
      { label: 'Excluir conexão', key: 'Del', danger: true, action: deleteSelection },
    ]);
  } else {
    showMenu(sx, sy, [
      { label: 'Nova ideia aqui', action: () => addNodeAt('idea', w.x, w.y) },
      { label: 'Novo painel aqui', action: () => addNodeAt('panel', w.x, w.y) },
      { label: 'Novo rabisco aqui', action: () => addNodeAt('scribble', w.x, w.y) },
      { label: 'Desenhar com o lápis', key: 'P', action: () => togglePen(true) },
      { label: 'Novo componente aqui', action: () => createSpecial('comp', w) },
      { label: 'Nova checklist aqui', action: () => createSpecial('check', w) },
      { label: 'Novo link aqui…', action: () => createSpecial('link', w) },
      { label: 'Nova imagem aqui…', action: () => createSpecial('image', w) },
      { label: 'Colar aqui', key: 'Ctrl+V', disabled: !clip, action: () => paste(clip, w) },
      '-',
      currentFolder && { label: '← Sair da pasta', key: 'Esc', action: folderUp },
      { label: 'Selecionar tudo', key: 'Ctrl+A', action: selectAll },
      { label: 'Organizar mapa', action: arrange },
      { label: 'Ajustar à tela', key: 'F', action: () => fitView() },
    ]);
  }
}

// ---------------------------------------------------------------- teclado
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && openMenuBtn) { closeDrop(); return; }
  if (presenting) {
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) goFrame(presenting.i + 1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) goFrame(presenting.i - 1);
    else if (k === 'Escape') endPresentation();
    else return;
    e.preventDefault();
    return;
  }
  if (editing || e.target.closest('input, textarea') || !$('#drawer').hidden || !$('#modal').hidden) {
    if (e.key === 'Escape') { closeOverlay('#drawer'); closeOverlay('#modal'); }
    return;
  }
  const mod = e.ctrlKey || e.metaKey, k = e.key, kl = k.toLowerCase();
  const n = single();
  let handled = true;
  if (mod && kl === 'z') e.shiftKey ? redo() : undo();
  else if (mod && kl === 'y') redo();
  else if (mod && kl === 'c') copySel();
  else if (mod && kl === 'x') copySel(true);
  else if (mod && kl === 'v') paste();
  else if (mod && kl === 'd') duplicate();
  else if (mod && kl === 'a') selectAll();
  else if (mod && kl === 'g') groupSelection();
  else if (mod && kl === 's') { flushSave(); toast('Salvo neste dispositivo'); }
  else if (mod && kl === 'f') openFind();
  else if (mod && kl === 'l') toggleLock();
  else if (mod) handled = false;
  else if (k === 'Delete' || k === 'Backspace') deleteSelection();
  else if (k === 'Tab') { if (n) e.shiftKey ? addSibling(n) : addChild(n); }
  else if (k === 'Enter') { if (n) n.type === 'idea' ? addSibling(n) : startEdit(n); }
  else if (k === 'F2') { if (n) startEdit(n); }
  else if (k === 'Escape' && anchorEdit) endAnchorEdit();
  else if (k === 'Escape' && currentFolder && !sel.size && !selWire && tool !== 'pen' && !voteMode) folderUp();
  else if (k === 'Escape') { if (tool === 'pen') togglePen(false); if (voteMode) toggleVote(false); sel.clear(); selWire = null; hideMenus(); render(); updateStatus(); }
  else if (e.altKey) handled = false;
  else if (kl === 'n') createAt('panel');
  else if (kl === 't') createAt('scribble');
  else if (kl === 'i') createAt('idea');
  else if (kl === 'p') togglePen();
  else if (kl === 'f') fitView(true, sel.size ? selectedNodes() : doc.nodes);
  else if (k === '+' || k === '=') zoomAt(W / 2, H / 2, view.z * 1.25);
  else if (k === '-' || k === '_') zoomAt(W / 2, H / 2, view.z / 1.25);
  else if (k === '0') zoomAt(W / 2, H / 2, 1);
  else if (k.startsWith('Arrow') && sel.size) {
    const step = e.shiftKey ? GRID : 2;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[k];
    checkpoint();
    for (const [id] of moveSet()) { const m = byId(id); m.x += d[0]; m.y += d[1]; }
    changed();
  } else handled = false;
  if (handled) e.preventDefault();
});

// ---------------------------------------------------------------- ícones e ribbon
const comp = (f, x = 4, y = 7, w = 16, h = 10, edge = '#222') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.4" fill="${f}" stroke="${edge}" stroke-width="1.1"/>` +
  `<rect x="${x + 2.6}" y="${y + 1.8}" width="${w - 5.2}" height="${h - 3.6}" rx="1.2" fill="#353535" stroke="#000" stroke-width=".5"/>` +
  `<circle cx="${x}" cy="${y + h / 2}" r="1.7" fill="#fff" stroke="${edge}" stroke-width=".9"/>` +
  `<circle cx="${x + w}" cy="${y + h / 2}" r="1.7" fill="#fff" stroke="${edge}" stroke-width=".9"/>`;
const svg = s => `<svg viewBox="0 0 24 24" aria-hidden="true">${s}</svg>`;
const arrowTray = up => `<path d="M4 14v6h16v-6" fill="none" stroke="#333" stroke-width="1.6"/>` +
  (up ? `<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="#3D8B0A" stroke-width="2"/>` : `<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" fill="none" stroke="#3D8B0A" stroke-width="2"/>`);
const ICON = {
  new: svg(`<path d="M6 2.5h8l4 4v15H6z" fill="#fff" stroke="#333"/><path d="M14 2.5v4h4" fill="none" stroke="#333"/><path d="M12 10v8M8 14h8" stroke="#3D8B0A" stroke-width="2"/>`),
  pen: svg(`<path d="M4 20l1.2-4.4L16.5 4.3a1.8 1.8 0 0 1 2.6 0l.6.6a1.8 1.8 0 0 1 0 2.6L8.4 18.8z" fill="#F2C94C" stroke="#333" stroke-width="1.1"/><path d="M4 20l1.2-4.4 3.2 3.2z" fill="#333"/>`),
  templates: svg(`<rect x="3" y="3" width="8" height="8" rx="1" fill="#CDE3FF" stroke="#333"/><rect x="13" y="3" width="8" height="8" rx="1" fill="#D9F2B3" stroke="#333"/><rect x="3" y="13" width="8" height="8" rx="1" fill="#FFF9A6" stroke="#333"/><rect x="13" y="13" width="8" height="8" rx="1" fill="#FFD7D7" stroke="#333"/>`),
  textmap: svg(`<path d="M2.5 5h8M4.5 9h6M4.5 13h6M2.5 17h8" stroke="#333" stroke-width="1.4"/><rect x="14.5" y="3.5" width="7" height="4" rx="1" fill="#C8C8C8" stroke="#222"/><rect x="14.5" y="10" width="7" height="4" rx="1" fill="#9BD04A" stroke="#222"/><rect x="14.5" y="16.5" width="7" height="4" rx="1" fill="#C8C8C8" stroke="#222"/>`),
  find: svg(`<circle cx="10" cy="10" r="6" fill="#fff" stroke="#333" stroke-width="1.8"/><path d="M14.5 14.5 20 20" stroke="#333" stroke-width="2.4"/>`),
  exportPdf: svg(`<path d="M6 2.5h8l4 4v15H6z" fill="#fff" stroke="#333"/><path d="M14 2.5v4h4" fill="none" stroke="#333"/><rect x="3.5" y="11" width="17" height="7" rx="1" fill="#C92A2A"/><text x="12" y="16.6" text-anchor="middle" font-size="5.6" font-weight="700" fill="#fff" font-family="Arial, sans-serif">PDF</text>`),
  history: svg(`<circle cx="12.5" cy="12.5" r="8" fill="#fff" stroke="#333" stroke-width="1.6"/><path d="M12.5 8v4.5l3.2 2" fill="none" stroke="#3D8B0A" stroke-width="1.8"/><path d="M2.5 4.5v4h4" fill="none" stroke="#333" stroke-width="1.4"/>`),
  lock: svg(`<rect x="5" y="10.5" width="14" height="10" rx="1.5" fill="#F2C94C" stroke="#333"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#333" stroke-width="1.8"/>`),
  layers: svg(`<path d="M12 3 21 8l-9 5-9-5z" fill="#CDE3FF" stroke="#333"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5" fill="none" stroke="#333"/>`),
  present: svg(`<rect x="2.5" y="4" width="19" height="12" rx="1" fill="#fff" stroke="#333"/><path d="M10 7.5v5l4.5-2.5z" fill="#3D8B0A"/><path d="M12 16v4M8 20.5h8" stroke="#333" stroke-width="1.4"/>`),
  timer: svg(`<circle cx="12" cy="13" r="8" fill="#fff" stroke="#333" stroke-width="1.6"/><path d="M12 13V8.5M12 13l3 2" stroke="#C92A2A" stroke-width="1.6"/><path d="M9.5 2.5h5M12 2.5v2.5" stroke="#333" stroke-width="1.6"/>`),
  vote: svg(`<circle cx="7.5" cy="9" r="3.5" fill="#D23A2A"/><circle cx="16.5" cy="9" r="3.5" fill="#D23A2A"/><circle cx="12" cy="16.5" r="3.5" fill="#D23A2A"/>`),
  'ai-gen': svg(`<path d="M12 2.5l1.6 4.6 4.6 1.6-4.6 1.6L12 15l-1.6-4.7L5.8 8.7l4.6-1.6z" fill="#F2C94C" stroke="#7A5A10" stroke-width=".8"/><path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="#9BD04A" stroke="#2F6B06" stroke-width=".6"/><rect x="2.5" y="16" width="9" height="5" rx="1" fill="#C8C8C8" stroke="#222"/>`),
  'ai-expand': svg(`<rect x="1.5" y="9.5" width="8" height="5" rx="1" fill="#C8C8C8" stroke="#222"/><path d="M9.5 12h3M12.5 6v12M12.5 6h2M12.5 12h2M12.5 18h2" stroke="#222" fill="none"/><path d="M19 3l.9 2.4 2.4.9-2.4.9L19 9.6l-.9-2.4-2.4-.9 2.4-.9z" fill="#F2C94C" stroke="#7A5A10" stroke-width=".6"/><rect x="15" y="10" width="7" height="4" rx="1" fill="#9BD04A" stroke="#222"/><rect x="15" y="16" width="7" height="4" rx="1" fill="#9BD04A" stroke="#222"/>`),
  'ai-sum': svg(`<rect x="3" y="4" width="14" height="17" rx="1" fill="#E5D5FF" stroke="#555"/><path d="M6 9h8M6 12h8M6 15h5" stroke="#555"/><path d="M19 2.5l.9 2.4 2.4.9-2.4.9L19 9.1l-.9-2.4-2.4-.9 2.4-.9z" fill="#F2C94C" stroke="#7A5A10" stroke-width=".6"/>`),
  'ai-group': svg(`<rect x="2" y="6" width="9" height="14" rx="2" fill="#A98BEA88" stroke="#5E4A9A"/><rect x="13" y="6" width="9" height="14" rx="2" fill="#96A58788" stroke="#4E5E40"/><rect x="3.5" y="9" width="6" height="3.5" fill="#FFF9A6" stroke="#555" stroke-width=".6"/><rect x="3.5" y="14" width="6" height="3.5" fill="#FFF9A6" stroke="#555" stroke-width=".6"/><rect x="14.5" y="9" width="6" height="3.5" fill="#FFF9A6" stroke="#555" stroke-width=".6"/><path d="M12 1.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="#F2C94C" stroke="#7A5A10" stroke-width=".5"/>`),
  'ai-cfg': svg(`<circle cx="8" cy="14" r="4.5" fill="#F2C94C" stroke="#333" stroke-width="1.3"/><circle cx="8" cy="14" r="1.6" fill="#fff" stroke="#333"/><path d="M11.3 11 19 3.5M16 6.5l2 2M17.5 5l2 2" stroke="#333" stroke-width="1.6" fill="none"/>`),
  saveNow: svg(`<path d="M3.5 3.5h14l3 3v14h-17z" fill="#3C6FB4" stroke="#1F3F66"/><rect x="7" y="4" width="9" height="5" fill="#E8EEF6"/><rect x="6.5" y="13" width="11" height="7" fill="#fff"/>`),
  open: svg(`<path d="M2.5 5.5h6.5l2 2h10.5v12h-19z" fill="#F2D27A" stroke="#7A5A10"/><path d="M2.5 9.5h19" stroke="#7A5A10"/>`),
  import: svg(arrowTray(false)),
  exportJson: svg(arrowTray(true)),
  exportPng: svg(`<rect x="2.5" y="4.5" width="19" height="15" rx="1.5" fill="#fff" stroke="#333"/><path d="M4.5 17.5l5-6 4 4 2-2 4 4z" fill="#7AB52E"/><circle cx="16" cy="9" r="1.8" fill="#F0A020"/>`),
  idea: svg(comp('#C8C8C8')),
  child: svg(`<path d="M10 8c5 0 3 8 7 8" fill="none" stroke="#222" stroke-width="1.3"/>` + comp('#C8C8C8', 1.5, 4, 9, 8) + comp('#9BD04A', 14, 12, 8.5, 8)),
  sibling: svg(`<path d="M3 6c-2 0-2 12 2 12" fill="none" stroke="#222"/>` + comp('#C8C8C8', 5, 2.5, 15, 7) + comp('#9BD04A', 5, 14.5, 15, 7)),
  panel: svg(`<rect x="3" y="4" width="18" height="16" rx="1" fill="#FFF59A" stroke="#555"/><path d="M6 9h10M6 12h12M6 15h7" stroke="#666"/><circle cx="3" cy="12" r="1.7" fill="#fff" stroke="#222"/><circle cx="21" cy="12" r="1.7" fill="#fff" stroke="#222"/>`),
  comp: svg(`<rect x="4" y="3" width="16" height="18" rx="2.5" fill="#C8C8C8" stroke="#222" stroke-width="1.1"/><rect x="10" y="5" width="4.5" height="14" rx="1.2" fill="#353535"/><circle cx="4" cy="8" r="1.7" fill="#fff" stroke="#222" stroke-width=".9"/><circle cx="4" cy="16" r="1.7" fill="#fff" stroke="#222" stroke-width=".9"/><circle cx="20" cy="12" r="1.7" fill="#fff" stroke="#222" stroke-width=".9"/><path d="M6.5 8h2M6.5 16h2M16 12h2" stroke="#222"/>`),
  check: svg(`<rect x="3" y="2.5" width="18" height="19" rx="2.5" fill="#C8C8C8" stroke="#222" stroke-width="1.1"/><rect x="4.5" y="4" width="15" height="4" rx="1" fill="#353535"/><rect x="6" y="10" width="4" height="4" rx=".8" fill="#6DAA24" stroke="#1E4A00" stroke-width=".8"/><path d="M6.8 12l1 1.2 1.6-2" stroke="#fff" fill="none" stroke-width="1"/><rect x="6" y="16" width="4" height="4" rx=".8" fill="#fff" stroke="#222" stroke-width=".8"/><path d="M12 12h6M12 18h6" stroke="#333"/>`),
  link: svg(`<rect x="2.5" y="7" width="19" height="10" rx="2.4" fill="#C8C8C8" stroke="#222" stroke-width="1.1"/><rect x="5" y="8.8" width="14" height="6.4" rx="1.2" fill="#1F3F66"/><path d="M8.5 13.5l2.5-3M9.5 10.5h1.5v1.5M13 12h4" stroke="#CFE6FF" fill="none" stroke-width="1"/>`),
  image: svg(`<rect x="3" y="3" width="18" height="18" rx="2.5" fill="#C8C8C8" stroke="#222" stroke-width="1.1"/><rect x="5" y="5" width="14" height="11" fill="#2E2E2E"/><path d="M5.5 15.5l4-5 3 3 2-2 4 4z" fill="#7AB52E"/><circle cx="15.5" cy="8" r="1.4" fill="#F0A020"/><path d="M8 18.5h8" stroke="#333"/>`),
  scribble: svg(`<text x="12" y="17.5" text-anchor="middle" font-size="15" font-family="Georgia, serif" font-style="italic" fill="#333">Aa</text>`),
  group: svg(`<rect x="2" y="4" width="20" height="16" rx="3" fill="#96A58766" stroke="#4E5E40" stroke-dasharray="3 2"/>` + comp('#C8C8C8', 6, 10, 12, 6)),
  undo: svg(`<path d="M8 4 3.5 8.5 8 13" fill="none" stroke="#333" stroke-width="1.8"/><path d="M4 8.5h10a5.5 5.5 0 0 1 0 11h-4" fill="none" stroke="#333" stroke-width="1.8"/>`),
  redo: svg(`<path d="M16 4l4.5 4.5L16 13" fill="none" stroke="#333" stroke-width="1.8"/><path d="M20 8.5H10a5.5 5.5 0 0 0 0 11h4" fill="none" stroke="#333" stroke-width="1.8"/>`),
  dup: svg(comp('#C8C8C8', 2, 4, 13, 8) + comp('#9BD04A', 9, 12, 13, 8)),
  del: svg(`<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14" fill="none" stroke="#333" stroke-width="1.6"/><path d="M10 10v7M14 10v7" stroke="#B01414" stroke-width="1.4"/>`),
  disconnect: svg(`<path d="M2 17c4 0 4-5 7-6M15 13c3-1 3-6 7-6" fill="none" stroke="#222" stroke-width="1.6"/><path d="M10 8l4 8M14 8l-4 8" stroke="#B01414" stroke-width="1.6"/>`),
  'st-normal': svg(comp('#BDBDBD')),
  'st-warning': svg(comp('#F49A2A', 4, 7, 16, 10, '#5A2A00')),
  'st-error': svg(comp('#C42020', 4, 7, 16, 10, '#3C0000')),
  'st-disabled': svg(comp('#D8D8D8', 4, 7, 16, 10, '#999')),
  arrange: svg(`<path d="M8 12h3M11 6v12M11 6h3M11 12h3M11 18h3" stroke="#222" fill="none" stroke-width="1.2"/><rect x="1.5" y="9.5" width="6.5" height="5" rx="1" fill="#9BD04A" stroke="#222"/><rect x="14" y="3.5" width="8" height="5" rx="1" fill="#C8C8C8" stroke="#222"/><rect x="14" y="9.5" width="8" height="5" rx="1" fill="#C8C8C8" stroke="#222"/><rect x="14" y="15.5" width="8" height="5" rx="1" fill="#C8C8C8" stroke="#222"/>`),
  fit: svg(`<path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" fill="none" stroke="#333" stroke-width="1.8"/>` + comp('#C8C8C8', 7, 9, 10, 6)),
  zin: svg(`<circle cx="10" cy="10" r="6.5" fill="#fff" stroke="#333" stroke-width="1.8"/><path d="M15 15l6 6" stroke="#333" stroke-width="2.4"/><path d="M10 7v6M7 10h6" stroke="#3D8B0A" stroke-width="1.8"/>`),
  zout: svg(`<circle cx="10" cy="10" r="6.5" fill="#fff" stroke="#333" stroke-width="1.8"/><path d="M15 15l6 6" stroke="#333" stroke-width="2.4"/><path d="M7 10h6" stroke="#3D8B0A" stroke-width="1.8"/>`),
  grid: svg(`<rect x="3" y="3" width="18" height="18" fill="#D4D0C8" stroke="#333"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="#777"/>`),
  snap: svg(`<path d="M5.5 3v9a6.5 6.5 0 0 0 13 0V3h-4.5v9a2 2 0 0 1-4 0V3z" fill="#C42020" stroke="#5A0000"/><path d="M5.5 3H10v3.5H5.5zM14 3h4.5v3.5H14z" fill="#E4E4E4" stroke="#555"/>`),
  select: svg(`<rect x="2.5" y="2.5" width="14" height="12" fill="#7AB52E22" stroke="#3D8B0A" stroke-dasharray="2.5 2"/><path d="M11 9l10 4.5-4.3 1.5L15 19.5z" fill="#fff" stroke="#222"/>`),
  'f-rect': svg(comp('#C8C8C8')),
  'f-square': svg(`<rect x="4" y="4" width="16" height="16" rx="2" fill="#C8C8C8" stroke="#222" stroke-width="1.2"/>`),
  'f-circle': svg(`<circle cx="12" cy="12" r="8.5" fill="#C8C8C8" stroke="#222" stroke-width="1.2"/>`),
  'f-triangle': svg(`<path d="M12 3.5l9 16H3z" fill="#C8C8C8" stroke="#222" stroke-width="1.2" stroke-linejoin="round"/>`),
  'f-diamond': svg(`<path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z" fill="#C8C8C8" stroke="#222" stroke-width="1.2" stroke-linejoin="round"/>`),
  'f-star': svg(`<path d="M12 2.5l2.7 6.1 6.6.6-5 4.4 1.5 6.5L12 16.7l-5.8 3.4 1.5-6.5-5-4.4 6.6-.6z" fill="#C8C8C8" stroke="#222" stroke-width="1.1" stroke-linejoin="round"/>`),
  'f-edit': svg(`<circle cx="12" cy="12" r="7" fill="#C8C8C8" stroke="#222" stroke-width="1.1"/><circle cx="12" cy="5" r="2.3" fill="#9BD04A" stroke="#222"/><circle cx="19" cy="12" r="2.3" fill="#9BD04A" stroke="#222"/><circle cx="12" cy="19" r="2.3" fill="#9BD04A" stroke="#222"/><circle cx="5" cy="12" r="2.3" fill="#9BD04A" stroke="#222"/>`),
};
const RIBBON = {
  criar: { label: 'Criar', groups: [
    ['Ideias', [['idea', 'Ideia', 'Nova ideia (I · duplo clique no fundo)'], ['child', 'Filha', 'Nova ideia conectada (Tab)'], ['sibling', 'Irmã', 'Nova ideia irmã (Enter)']]],
    ['Especiais', [['comp', 'Componente', 'Componente com várias entradas e saídas'], ['check', 'Checklist', 'Lista de tarefas com caixas de marcar'], ['link', 'Link', 'Link para site, e-mail ou telefone'], ['image', 'Imagem', 'Imagem ou foto do aparelho']]],
    ['Anotações', [['panel', 'Painel', 'Painel de notas (N)'], ['scribble', 'Rabisco', 'Texto solto no canvas (T)'], ['pen', 'Lápis', 'Lápis: desenho livre (P)'], ['group', 'Grupo', 'Agrupar seleção (Ctrl+G)']]],
    ['Modelos', [['templates', 'Modelos', 'Inserir um modelo pronto'], ['textmap', 'Texto→mapa', 'Transformar uma lista de texto em mapa']]],
    ['IA', [['ai-gen', 'Gerar mapa', 'Gerar um mapa mental com IA'], ['ai-expand', 'Expandir', 'Sugerir ideias filhas para a ideia selecionada (IA)'], ['ai-sum', 'Resumir', 'Resumir o mapa ou a seleção num painel (IA)'], ['ai-group', 'Agrupar', 'Agrupar notas por tema (IA)'], ['ai-cfg', 'Chave IA', 'Configurar sua chave de API']]],
  ] },
  editar: { label: 'Editar', groups: [
    ['Histórico', [['undo', 'Desfazer', 'Desfazer (Ctrl+Z)'], ['redo', 'Refazer', 'Refazer (Ctrl+Y)'], ['history', 'Versões', 'Histórico de versões']]],
    ['Seleção', [['dup', 'Duplicar', 'Duplicar (Ctrl+D)'], ['disconnect', 'Desconectar', 'Remover fios da seleção'], ['del', 'Excluir', 'Excluir (Delete)'], ['lock', 'Travar', 'Travar / destravar (Ctrl+L)'], ['find', 'Buscar', 'Buscar no mapa (Ctrl+F)']]],
    ['Formato', [['f-rect', 'Padrão', 'Formato padrão (Grasshopper)'], ['f-square', 'Quadrado'], ['f-circle', 'Círculo'], ['f-triangle', 'Triângulo'], ['f-diamond', 'Losango'], ['f-star', 'Estrela'], ['f-edit', 'Bolinhas', 'Editar as bolinhas de conexão da pilha ou imagem selecionada']]],
    ['Estado', [['st-normal', 'Normal'], ['st-warning', 'Aviso'], ['st-error', 'Erro'], ['st-disabled', 'Desativ.', 'Desativado']]],
    ['Mapa', [['arrange', 'Organizar', 'Organizar ideias em árvore']]],
  ] },
  exibir: { label: 'Exibir', groups: [
    ['Navegar', [['fit', 'Ajustar', 'Ajustar à tela (F)'], ['zin', 'Zoom +', 'Aproximar (+)'], ['zout', 'Zoom −', 'Afastar (−)']]],
    ['Canvas', [['grid', 'Grade', 'Mostrar grade'], ['snap', 'Encaixar', 'Encaixar na grade'], ['select', 'Seleção', 'No toque: arrastar o fundo seleciona em vez de mover'], ['layers', 'Camadas', 'Mostrar / ocultar grupos']]],
    ['Reunião', [['present', 'Apresentar', 'Apresentação grupo a grupo'], ['timer', 'Timer', 'Cronômetro regressivo'], ['vote', 'Votação', 'Votação com pontinhos']]],
  ] },
};
const CMD = {
  new: () => newMap(),
  open: openDrawer,
  import: () => $('#importFile').click(),
  exportJson, exportPng,
  idea: () => { const c = viewCenter(); addNodeAt('idea', c.x, c.y); },
  child: () => addChild(single()),
  sibling: () => addSibling(single()),
  panel: () => { const c = viewCenter(); addNodeAt('panel', c.x, c.y); },
  scribble: () => { const c = viewCenter(); addNodeAt('scribble', c.x, c.y); },
  group: groupSelection,
  comp: () => createSpecial('comp', viewCenter()),
  check: () => createSpecial('check', viewCenter()),
  link: () => createSpecial('link', viewCenter()),
  image: () => createSpecial('image', viewCenter()),
  undo, redo, dup: duplicate, del: deleteSelection, disconnect,
  'f-rect': () => formCmd(''), 'f-square': () => formCmd('square'), 'f-circle': () => formCmd('circle'),
  'f-triangle': () => formCmd('triangle'), 'f-diamond': () => formCmd('diamond'), 'f-star': () => formCmd('star'),
  'f-edit': () => {
    // com várias selecionadas, edita a primeira; as outras ficam prontas para "Aplicar a…"
    const ideas = selectedNodes().filter(n => n.type === 'idea' || n.type === 'image');
    if (!ideas.length) return toast('Selecione uma ideia ou imagem para editar as bolinhas');
    const n = ideas.find(canAnchor);
    if (!n) return toast('Primeiro escolha um formato (quadrado, círculo, triângulo, losango ou estrela)');
    startAnchorEdit(n);
  },
  'st-normal': () => setState('normal'), 'st-warning': () => setState('warning'),
  'st-error': () => setState('error'), 'st-disabled': () => setState('disabled'),
  arrange,
  fit: () => fitView(),
  zin: () => zoomAt(W / 2, H / 2, view.z * 1.25),
  zout: () => zoomAt(W / 2, H / 2, view.z / 1.25),
  grid: () => toggleSetting('grid'),
  snap: () => toggleSetting('snap'),
  select: () => toggleSetting('selectMode'),
  saveNow: () => { flushSave(); toast('Salvo neste dispositivo'); },
  pen: () => togglePen(),
  templates: () => showTemplates(), textmap: () => showTextMap(),
  find: () => openFind(), exportPdf: () => exportPdf(), history: () => showHistory(),
  lock: () => toggleLock(), layers: () => showLayers(),
  present: () => startPresentation(), timer: b => openTimerMenu(b), vote: () => toggleVote(),
  'ai-gen': () => aiGenerate(), 'ai-expand': () => aiExpand(), 'ai-sum': () => aiSummarize(),
  'ai-group': () => aiGroupNotes(), 'ai-cfg': () => showAiSettings(),
  share: () => showShare(), comments: () => openComments(),
  selectAll: () => selectAll(),
  help: showHelp,
  installHelp: showInstallHelp,
  version: async () => {
    let sw = '—';
    try { const k = (await caches.keys()).find(x => x.startsWith('mapa-mental-')); if (k) sw = k.replace('mapa-mental-', ''); } catch {}
    toast(`Versão do app: ${APP_VERSION} · cache offline: ${sw}`);
  },
};
// menus em texto (como a barra de menus do Grasshopper)
const MENUS = {
  Arquivo: [['new', 'Novo mapa'], ['open', 'Abrir meus mapas…'], ['share', 'Compartilhar…'], ['comments', 'Comentários'], '-', ['saveNow', 'Salvar', 'Ctrl+S'], ['history', 'Histórico de versões…'], '-', ['templates', 'Inserir modelo…'], ['textmap', 'Texto → mapa…'], '-', ['import', 'Importar…'], ['exportJson', 'Exportar .json'], ['exportPng', 'Exportar imagem PNG (seleção ou tudo)'], ['exportPdf', 'Exportar PDF (seleção ou tudo)'], '-', ['installHelp', 'Instalar o app…']],
  Editar: [['undo', 'Desfazer', 'Ctrl+Z'], ['redo', 'Refazer', 'Ctrl+Y'], '-', ['dup', 'Duplicar', 'Ctrl+D'], ['del', 'Excluir', 'Del'], ['disconnect', 'Desconectar fios'], ['lock', 'Travar / destravar', 'Ctrl+L'], '-', ['selectAll', 'Selecionar tudo', 'Ctrl+A'], ['find', 'Buscar…', 'Ctrl+F'], ['group', 'Agrupar seleção', 'Ctrl+G'], ['arrange', 'Organizar em árvore']],
  Exibir: [['fit', 'Ajustar à tela', 'F'], ['zin', 'Aproximar', '+'], ['zout', 'Afastar', '−'], '-', ['grid', 'Grade'], ['snap', 'Encaixar na grade'], ['select', 'Seleção por toque'], ['layers', 'Camadas (grupos)…'], '-', ['pen', 'Lápis', 'P'], ['present', 'Apresentar'], ['timer', 'Timer…'], ['vote', 'Votação']],
  IA: [['ai-gen', 'Gerar mapa…'], ['ai-expand', 'Expandir ideia selecionada'], ['ai-sum', 'Resumir (seleção ou mapa)'], ['ai-group', 'Agrupar notas por tema'], '-', ['ai-cfg', 'Configurar chave de API…']],
  Ajuda: [['help', 'Atalhos e dicas'], ['installHelp', 'Como instalar'], '-', ['version', 'Versão ' + APP_VERSION]],
};
let openMenuBtn = null;
function closeDrop() { $('#dropmenu').style.display = 'none'; if (openMenuBtn) openMenuBtn.classList.remove('open'); openMenuBtn = null; }
function openDrop(btn, name) {
  hideMenus();
  if (openMenuBtn) openMenuBtn.classList.remove('open');
  const drop = $('#dropmenu');
  const toggleOn = { grid: settings.grid, snap: settings.snap, select: settings.selectMode, pen: tool === 'pen', vote: voteMode };
  fillMenu(drop, MENUS[name].map(it => it === '-' ? '-' : {
    label: (it[0] in toggleOn ? (toggleOn[it[0]] ? '✓ ' : ' ') : '') + it[1], key: it[2],
    disabled: (it[0] === 'undo' && !past.length) || (it[0] === 'redo' && !future.length),
    action: () => { closeDrop(); if (editing) commitEdit(); CMD[it[0]](); },
  }));
  const r = btn.getBoundingClientRect();
  drop.style.display = 'block';
  drop.style.left = Math.max(4, Math.min(r.left, innerWidth - drop.offsetWidth - 4)) + 'px';
  drop.style.top = r.bottom + 'px';
  btn.classList.add('open');
  openMenuBtn = btn;
}
function buildMenus() {
  const nav = $('#menus');
  for (const name of Object.keys(MENUS)) {
    const b = el('button', null, name);
    b.addEventListener('click', e => { e.stopPropagation(); openMenuBtn === b ? closeDrop() : openDrop(b, name); });
    b.addEventListener('mouseenter', () => { if (openMenuBtn && openMenuBtn !== b) openDrop(b, name); });
    nav.append(b);
  }
  document.addEventListener('pointerdown', e => { if (openMenuBtn && !e.target.closest('#dropmenu, #menus')) closeDrop(); });
}
function showHelp() {
  $('#modalTitle').textContent = 'Atalhos e dicas';
  $('#modalBody').innerHTML = '<ul style="padding-left:18px;margin:0">' + [
    ['Duplo clique no fundo', 'criar (busca rápida)'], ['Arrastar da bolinha', 'conectar ou criar já conectado'],
    ['Tab / Enter', 'ideia filha / irmã'], ['F2 ou duplo clique', 'editar texto ou etiqueta'],
    ['Botão direito / segurar', 'menu do objeto'], ['Aproximar o zoom', 'botões + para entradas e saídas'],
    ['Selecionar 2 ou mais', 'controles de alinhar e distribuir'], ['Bússola (canto inferior direito)', 'ir até objetos fora da tela'],
    ['N / T / I', 'nova nota (painel) / texto / ideia'], ['P', 'lápis de desenho (Esc sai)'],
    ['Ctrl+F', 'buscar no mapa'], ['Ctrl+L', 'travar / destravar'], ['Duplo clique no fio', 'rótulo do fio'],
    ['Menu IA', 'gerar, expandir, resumir e agrupar com a sua chave de API'],
    ['Entrar / Compartilhar', 'sincronizar entre aparelhos, convidar por link e editar junto'],
    ['💬 Comentar', 'botão direito num objeto; use @ para mencionar alguém'],
    ['3 cliques numa ideia', 'entra nela como pasta (Esc ou ← Sair volta)'],
    ['Ctrl+Z / Ctrl+Y', 'desfazer / refazer'], ['Ctrl+G', 'agrupar'], ['F', 'ajustar à tela'],
  ].map(([k, v]) => `<li><b>${k}</b>: ${v}</li>`).join('') + '</ul>';
  openOverlay('#modal');
}
function showInstallHelp() {
  if (installPrompt) return installBtn.click();
  $('#modalTitle').textContent = 'Instalar o app';
  $('#modalBody').innerHTML = isIOS
    ? '<ol><li>Abra esta página no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b>.</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li></ol>'
    : isStandalone() ? 'O app já está instalado neste aparelho.'
      : 'No Chrome ou Edge, use o ícone de instalar na barra de endereço ou o menu ⋮ → <b>Instalar app</b>. No celular, o app precisa estar publicado em um endereço HTTPS.';
  openOverlay('#modal');
}
function toggleSetting(k) {
  settings[k] = !settings[k];
  saveJSON('mm.settings', settings);
  syncToggles();
  render();
  if (k === 'selectMode') toast(settings.selectMode ? 'Toque e arraste no fundo para selecionar' : 'Toque e arraste no fundo para mover o canvas');
}
function syncToggles() {
  for (const [cmd, k] of [['grid', 'grid'], ['snap', 'snap'], ['select', 'selectMode']])
    document.querySelectorAll(`[data-cmd="${cmd}"]`).forEach(b => b.classList.toggle('on', !!settings[k]));
  document.querySelectorAll('[data-cmd="pen"]').forEach(b => b.classList.toggle('on', tool === 'pen'));
  document.querySelectorAll('[data-cmd="vote"]').forEach(b => b.classList.toggle('on', voteMode));
}
function buildRibbon() {
  const tabs = $('#tabs'), panels = $('#panels');
  for (const [key, { label, groups }] of Object.entries(RIBBON)) {
    const tb = el('button', null, label);
    tb.dataset.tab = key;
    tb.addEventListener('click', () => setTab(key));
    tabs.append(tb);
    const p = el('div', 'panel');
    p.dataset.panel = key;
    for (const [gl, btns] of groups) {
      const g = el('div', 'rgroup'), b = el('div', 'btns');
      for (const [cmd, lbl, tip] of btns) {
        const bt = el('button', 'rb');
        bt.dataset.cmd = cmd;
        bt.title = tip || lbl;
        bt.innerHTML = (ICON[cmd] || '') + `<span>${esc(lbl)}</span>`;
        b.append(bt);
      }
      g.append(b, el('div', 'label', gl));
      p.append(g);
    }
    panels.append(p);
  }
  const addQuick = (box, list) => {
    for (const q of list) {
      if (q === '|') { box.append(el('span', 'sepv')); continue; }
      const b = el('button', 'qb');
      b.dataset.cmd = q[0];
      b.title = q[1];
      b.setAttribute('aria-label', q[1]);
      b.innerHTML = ICON[q[0]];
      box.append(b);
    }
  };
  addQuick($('#quickL'), [['open', 'Abrir meus mapas'], ['saveNow', 'Salvar (Ctrl+S)']]);
  addQuick($('#quickM'), [['fit', 'Ajustar à tela (F)'], ['zin', 'Aproximar (+)'], ['zout', 'Afastar (−)'], '|', ['undo', 'Desfazer (Ctrl+Z)'], ['redo', 'Refazer (Ctrl+Y)']]);
  addQuick($('#quickR'), [['find', 'Buscar (Ctrl+F)'], ['arrange', 'Organizar em árvore'], '|', ['pen', 'Lápis (P)'], ['grid', 'Grade'], ['snap', 'Encaixar na grade'], ['select', 'Seleção por toque'], '|', ['present', 'Apresentar'], ['exportPng', 'Exportar imagem PNG'], ['exportPdf', 'Exportar PDF']]);
  // caixa de zoom (como a do Grasshopper)
  const zs = $('#zoomSel');
  for (const v of ['cur', 10, 25, 50, 75, 100, 150, 200, 300, 400, 'fit']) {
    const o = el('option', null, v === 'cur' ? '100%' : v === 'fit' ? 'Ajustar à tela' : v + '%');
    o.value = v;
    zs.append(o);
  }
  zs.addEventListener('change', () => {
    const v = zs.value;
    zs.value = 'cur';
    if (v === 'fit') fitView(); else if (v !== 'cur') zoomAt(W / 2, H / 2, +v / 100);
    canvas.focus({ preventScroll: true });
  });
  buildMenus();
  setTab(loadJSON('mm.tab', 'criar'));
  syncToggles();
}
function setTab(key) {
  if (!RIBBON[key]) key = 'criar';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === key));
  document.querySelectorAll('#panels .panel').forEach(p => p.classList.toggle('active', p.dataset.panel === key));
  saveJSON('mm.tab', key);
}
document.addEventListener('mousedown', e => { if (e.target.closest('.rb, .qb, .docdrop, #tabs button, #menus button, #dropmenu, #fab')) e.preventDefault(); });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cmd]');
  if (b && !b.disabled && CMD[b.dataset.cmd]) {
    if (editing) commitEdit();
    hideMenus();
    CMD[b.dataset.cmd](b);
  }
  if (e.target.closest('[data-close]') || e.target.classList.contains('overlay')) {
    closeOverlay('#' + e.target.closest('.overlay').id);
  }
});
$('#fab').addEventListener('click', () => {
  if (editing) commitEdit();
  const n = single();
  if (n && hasGrips(n)) addChild(n); else { const c = viewCenter(); addNodeAt('idea', c.x, c.y); }
});

// ---------------------------------------------------------------- status
function updateStatus() {
  if (!doc) return;
  if (cloud.channel) trackPresence();
  document.title = 'Mapa Mental - ' + doc.name;
  const n = doc.nodes.length, w = doc.wires.length;
  $('#stCount').textContent = `${n} ${n === 1 ? 'objeto' : 'objetos'} · ${w} ${w === 1 ? 'fio' : 'fios'}`;
  $('#stSel').textContent = sel.size ? `${sel.size} selecionado${sel.size > 1 ? 's' : ''}` : selWire ? '1 fio selecionado' : '';
  document.querySelectorAll('[data-cmd="undo"]').forEach(b => (b.disabled = !past.length));
  document.querySelectorAll('[data-cmd="redo"]').forEach(b => (b.disabled = !future.length));
}

// ---------------------------------------------------------------- mapas (gaveta)
function openOverlay(sel_) { $(sel_).hidden = false; }
function closeOverlay(sel_) { $(sel_).hidden = true; }

$('#mapName').addEventListener('input', e => { doc.name = e.target.value.trim() || 'Mapa sem nome'; document.title = 'Mapa Mental - ' + doc.name; scheduleSave(); cloudAfterChange(); });
$('#mapName').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); });

// ---------------------------------------------------------------- importar / exportar
function safeName(s) { return (s || 'mapa').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 60) || 'mapa'; }
async function downloadBlob(blob, filename) {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (err) { if (err && err.name === 'AbortError') return; }
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function exportJson() {
  flushSave();
  const data = { app: 'mapa-mental', version: 1, name: doc.name, nodes: persistNodes(), wires: doc.wires };
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), safeName(doc.name) + '.json');
}
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || !Array.isArray(d.nodes)) throw new Error('formato');
    flushSave();
    const m = normalize({ ...d, id: uid(), view: null, name: d.name || f.name.replace(/\.json$/i, '') });
    doc = m; idMap = null; past = []; future = []; sel.clear(); selWire = null;
    $('#mapName').value = doc.name;
    fitView(false);
    saveNow();
    if (me && sb) cloudOnNew(); else cloudOnOpen();
    updateStatus();
    closeOverlay('#drawer');
    toast('Mapa importado');
  } catch { toast('Arquivo inválido — use um .json exportado por este app'); }
});

// ---------------------------------------------------------------- instalação (PWA)
let installPrompt = null;
const installBtn = $('#installBtn');
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; installBtn.hidden = false; });
window.addEventListener('appinstalled', () => { installBtn.hidden = true; installPrompt = null; toast('App instalado!'); });
if (isIOS && !isStandalone()) installBtn.hidden = false;
installBtn.addEventListener('click', async () => {
  if (installPrompt) {
    installPrompt.prompt();
    const r = await installPrompt.userChoice.catch(() => null);
    if (r && r.outcome === 'accepted') installBtn.hidden = true;
    installPrompt = null;
    return;
  }
  $('#modalTitle').textContent = 'Instalar no iPhone / iPad';
  $('#modalBody').innerHTML = '<ol><li>Abra esta página no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b> (quadrado com seta para cima).</li><li>Escolha <b>Adicionar à Tela de Início</b> e confirme.</li></ol>O app abre em tela cheia e funciona sem internet.';
  openOverlay('#modal');
});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ================================================================ ETAPA 1
// Caneta, formas, estilos de fio, ícones, modelos, texto→mapa, busca, PDF,
// histórico de versões, travar, camadas, apresentação, timer e votação.

let tool = 'select';          // 'select' | 'pen'
let voteMode = false;
let presenting = null;        // { frames, i, view0, fs }
let hiddenSet = new Set();

const SHAPES = { rect: 'Retângulo', ellipse: 'Elipse', diamond: 'Losango', arrow: 'Seta', bubble: 'Balão' };
const SHAPE_COLORS = ['#FFFFFF', '#CDE3FF', '#D9F2B3', '#FFF9A6', '#FFD7D7', '#E5D5FF', '#C8C8C8', '#3A3A3A'];
const PEN_COLORS = ['#1A1A1A', '#C92A2A', '#1864AB', '#2B8A3E', '#E67700', '#7048E8', '#FFFFFF'];
const PEN_WIDTHS = [2, 4, 8, 14];
const BRANCH_COLORS = ['#C92A2A', '#E67700', '#2B8A3E', '#1864AB', '#7048E8', '#C2255C', '#495057'];
const ICONS_EMO = ['💡', '⭐', '❗', '❓', '✅', '⚠️', '🔥', '📌', '🚀', '❤️'];

const pointerOrCenter = () => (lastMouse && lastMouse.inside ? lastMouse.w : viewCenter());
const isHidden = n => hiddenSet.has(n.id);
function computeHidden() {
  idMap = null;
  hiddenSet = new Set();
  for (const g of doc.nodes) if (g.type === 'group' && g.hidden) { hiddenSet.add(g.id); groupMembersDeep(g, hiddenSet); }
  const vis = folderVisibleSet();
  for (const n of doc.nodes) if (!vis.has(n.id)) hiddenSet.add(n.id);
}
function ideaText(n) { return n.icon ? n.icon + ' ' + (n.text || '') : (n.text || ' '); }
function wireStyleOf(w) {
  const o = {};
  if (isHex(w.color)) o.color = w.color;
  if (w.dash) o.dash = true;
  if (w.arrow) o.arrow = true;
  if (w.label) o.label = String(w.label).slice(0, 80);
  return o;
}
function modal(title, html) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  openOverlay('#modal');
  return $('#modalBody');
}

// ---------------------------------------------------------------- formas
function lum(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; }
function shapeTextColor(n) { return lum(n.color) < 0.5 ? '#FFFFFF' : '#111111'; }
function shapeTextBox(n) {
  if (n.shape === 'bubble') return { y: n.y + 6, h: n.h * 0.8 - 12 };
  if (n.shape === 'arrow') return { y: n.y + n.h * 0.22, h: n.h * 0.56 };
  return { y: n.y + 6, h: n.h - 12 };
}
function shapeTextWidth(n) {
  if (n.shape === 'diamond') return Math.max(20, n.w * 0.55);
  if (n.shape === 'ellipse') return Math.max(20, n.w * 0.75);
  if (n.shape === 'arrow') return Math.max(20, n.w * 0.6);
  return Math.max(20, n.w - 24);
}
function shapePath(g, n) {
  const { x, y, w, h } = n;
  switch (n.shape) {
    case 'ellipse': g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); break;
    case 'diamond': g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w, y + h / 2); g.lineTo(x + w / 2, y + h); g.lineTo(x, y + h / 2); g.closePath(); break;
    case 'arrow': {
      const hw = Math.min(w * 0.4, h), t = h * 0.22;
      g.beginPath();
      g.moveTo(x, y + t); g.lineTo(x + w - hw, y + t); g.lineTo(x + w - hw, y); g.lineTo(x + w, y + h / 2);
      g.lineTo(x + w - hw, y + h); g.lineTo(x + w - hw, y + h - t); g.lineTo(x, y + h - t); g.closePath();
      break;
    }
    case 'bubble': {
      const bh = h * 0.8, r = Math.min(12, bh / 2);
      g.beginPath();
      g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
      g.lineTo(x + w, y + bh - r); g.arcTo(x + w, y + bh, x + w - r, y + bh, r);
      g.lineTo(x + w * 0.34, y + bh); g.lineTo(x + w * 0.14, y + h); g.lineTo(x + w * 0.2, y + bh);
      g.lineTo(x + r, y + bh); g.arcTo(x, y + bh, x, y + bh - r, r);
      g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
      break;
    }
    default: rr(g, x, y, w, h, 6);
  }
}
function drawShape(g, n, isSel, scale, hideText) {
  g.save();
  shadow(g, scale);
  shapePath(g, n);
  g.fillStyle = n.color;
  g.fill();
  g.restore();
  shapePath(g, n);
  g.lineWidth = isSel ? 2 : 1.2;
  g.strokeStyle = isSel ? SEL.edge : '#1A1A1A';
  g.stroke();
  if (!hideText && scale > 0.22 && n.text) {
    const tb = shapeTextBox(n);
    const L = wrap(n.text, F.shape, shapeTextWidth(n));
    g.save();
    g.beginPath(); g.rect(n.x + 2, tb.y, n.w - 4, tb.h); g.clip();
    g.font = F.shape;
    g.fillStyle = shapeTextColor(n);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const y0 = tb.y + tb.h / 2 - (L.length - 1) * LH.shape / 2 + 0.5;
    L.forEach((l, i) => g.fillText(l, n.x + n.w / 2, y0 + i * LH.shape));
    g.restore();
  }
  if (isSel && !n.locked) {
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    for (const k of [4, 8]) { g.moveTo(n.x + n.w - k - 2, n.y + n.h - 2); g.lineTo(n.x + n.w - 2, n.y + n.h - k - 2); }
    g.stroke();
  }
}
function createShape(kind, at = pointerOrCenter()) {
  if (editing) commitEdit();
  checkpoint();
  const n = makeNode('shape', 0, 0, '', { shape: kind });
  if (kind === 'ellipse' || kind === 'diamond') { n.w = 150; n.h = 110; }
  if (kind === 'arrow') { n.w = 170; n.h = 80; }
  if (kind === 'bubble') { n.w = 170; n.h = 100; }
  n.x = at.x - n.w / 2; n.y = at.y - n.h / 2;
  snapNode(n);
  doc.nodes.push(n);
  sel = new Set([n.id]); selWire = null;
  changed();
  startEdit(n, true);
}
function createAt(type) {
  if (type === 'shape') return createShape('rect');
  const at = pointerOrCenter();
  addNodeAt(type, at.x, at.y);
}

// ---------------------------------------------------------------- caneta
function strokePts(g, p, ox, oy) {
  g.moveTo(ox + p[0][0], oy + p[0][1]);
  if (p.length === 1) { g.lineTo(ox + p[0][0] + 0.01, oy + p[0][1]); return; }
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
    g.quadraticCurveTo(ox + p[i][0], oy + p[i][1], ox + mx, oy + my);
  }
  const l = p[p.length - 1];
  g.lineTo(ox + l[0], oy + l[1]);
}
function drawDraw(g, n, isSel) {
  if (!n.pts || !n.pts.length) return;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = n.color;
  g.lineWidth = n.width;
  g.beginPath();
  strokePts(g, n.pts, n.x, n.y);
  g.stroke();
  g.restore();
  if (isSel) {
    g.setLineDash([5, 3]);
    g.lineWidth = 1.2;
    g.strokeStyle = SEL.edge;
    g.strokeRect(n.x - 3, n.y - 3, n.w + 6, n.h + 6);
    g.setLineDash([]);
  }
}
function drawHit(n, wx, wy, tol) {
  if (wx < n.x - tol || wx > n.x + n.w + tol || wy < n.y - tol || wy > n.y + n.h + tol) return false;
  const p = n.pts, r = n.width / 2 + tol;
  if (p.length === 1) return dist(wx, wy, n.x + p[0][0], n.y + p[0][1]) <= r;
  for (let i = 1; i < p.length; i++) {
    if (segDist(wx, wy, { x: n.x + p[i - 1][0], y: n.y + p[i - 1][1] }, { x: n.x + p[i][0], y: n.y + p[i][1] }) <= r) return true;
  }
  return false;
}
function finishStroke(g) {
  const p = g.pts;
  if (!p || !p.length) return render();
  const wd = settings.penWidth, pad = wd / 2 + 2;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const ox = x0 - pad, oy = y0 - pad;
  const n = makeNode('draw', ox, oy, '', {
    color: settings.penColor, width: wd,
    pts: p.map(([x, y]) => [Math.round((x - ox) * 10) / 10, Math.round((y - oy) * 10) / 10]),
  });
  n.w = x1 - x0 + 2 * pad; n.h = y1 - y0 + 2 * pad;
  checkpoint();
  doc.nodes.push(n);
  changed();
}
function togglePen(force) {
  const on = force === undefined ? tool !== 'pen' : force;
  tool = on ? 'pen' : 'select';
  if (on && voteMode) toggleVote(false);
  if (on) { sel.clear(); selWire = null; }
  $('#penbar').hidden = !on;
  syncPenbar();
  syncToggles();
  canvas.style.cursor = on ? 'crosshair' : 'default';
  if (on) toast('Lápis: arraste para desenhar · Esc para sair');
  render();
}
function buildPenbar() {
  const bar = $('#penbar');
  bar.append(el('span', 'lbl', 'Lápis'));
  for (const c of PEN_COLORS) {
    const b = el('button', 'pc');
    b.style.background = c;
    b.title = c;
    b.dataset.pc = c;
    b.addEventListener('click', () => { settings.penColor = c; saveJSON('mm.settings', settings); syncPenbar(); });
    bar.append(b);
  }
  bar.append(el('span', 'sepv'));
  for (const wd of PEN_WIDTHS) {
    const b = el('button', 'pw');
    b.innerHTML = `<i style="width:${Math.min(14, wd + 2)}px;height:${Math.min(14, wd + 2)}px"></i>`;
    b.title = 'Espessura ' + wd;
    b.dataset.pw = wd;
    b.addEventListener('click', () => { settings.penWidth = wd; saveJSON('mm.settings', settings); syncPenbar(); });
    bar.append(b);
  }
  bar.append(el('span', 'sepv'));
  const x = el('button', null, 'Sair (Esc)');
  x.addEventListener('click', () => togglePen(false));
  bar.append(x);
}
function syncPenbar() {
  document.querySelectorAll('#penbar .pc').forEach(b => b.classList.toggle('on', b.dataset.pc === settings.penColor));
  document.querySelectorAll('#penbar .pw').forEach(b => b.classList.toggle('on', +b.dataset.pw === settings.penWidth));
}

// ---------------------------------------------------------------- travar, ícones, ramos, fios
function toggleLock() {
  const ns = selectedNodes();
  if (!ns.length) return toast('Selecione objetos para travar');
  const lock = ns.some(n => !n.locked);
  checkpoint();
  ns.forEach(n => { if (lock) n.locked = true; else delete n.locked; });
  changed();
  toast(lock ? 'Travado — não move, não edita, não apaga' : 'Destravado');
}
function drawLock(g, n) {
  const x = n.x + n.w - 11, y = n.y + 3;
  g.save();
  g.beginPath(); g.arc(x + 4.5, y + 4.5, 3, Math.PI, 0);
  g.lineWidth = 1.5; g.strokeStyle = '#222'; g.stroke();
  g.fillStyle = '#F2C94C';
  g.fillRect(x, y + 4.5, 9, 6.5);
  g.lineWidth = 1; g.strokeRect(x, y + 4.5, 9, 6.5);
  g.restore();
}
function drawVotes(g, n) {
  const cx = n.x + 2, cy = n.y + 2;
  g.save();
  g.beginPath(); g.arc(cx, cy, 9.5, 0, Math.PI * 2);
  g.fillStyle = '#D23A2A'; g.fill();
  g.lineWidth = 1.6; g.strokeStyle = '#FFFFFF'; g.stroke();
  g.fillStyle = '#FFFFFF';
  g.font = `700 11px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n.votes), cx, cy + 0.5);
  g.restore();
}
function setIcon(t) {
  const ns = selectedNodes().filter(n => n.type === 'idea');
  if (!ns.length) return;
  checkpoint();
  ns.forEach(n => { if (t) n.icon = t; else delete n.icon; measure(n); });
  changed();
}
function colorBranch(n, c) {
  checkpoint();
  const seen = new Set([n.id]), queue = [n.id];
  while (queue.length) {
    const id = queue.shift();
    for (const w of doc.wires) {
      if (w.from !== id) continue;
      if (c) w.color = c; else delete w.color;
      if (!seen.has(w.to)) { seen.add(w.to); queue.push(w.to); }
    }
  }
  changed();
}
function styleWire(w, patch) {
  checkpoint();
  for (const [k, v] of Object.entries(patch)) { if (v === null || v === false) delete w[k]; else w[k] = v; }
  changed();
}
function editWireLabel(w) {
  const v = prompt('Rótulo do fio:', w.label || '');
  if (v == null) return;
  styleWire(w, { label: v.trim() ? v.trim().slice(0, 80) : null });
}
function extraNodeItems(n) {
  const items = [];
  if (n.type === 'idea') {
    items.push({ label: 'Ícone', swatches: ICONS_EMO.slice(0, 5).map(t => ({ text: t, title: t, action: () => setIcon(t) })) });
    items.push({ label: '', swatches: ICONS_EMO.slice(5).map(t => ({ text: t, title: t, action: () => setIcon(t) })) });
    if (n.icon) items.push({ label: 'Remover ícone', action: () => setIcon(null) });
    items.push({ label: 'Formato', swatches: Object.keys(FORM_ICON).map(k => ({ text: FORM_ICON[k], title: k ? FORMS[k] : 'Padrão (Grasshopper)', action: () => setForm(k) })) });
    if (isFormed(n)) items.push({ label: '⦿ Editar bolinhas…', action: () => startAnchorEdit(n) });
  }
  if (n.type === 'image') items.push({ label: '⦿ Editar bolinhas…', action: () => startAnchorEdit(n) });
  if (doc.wires.some(w => w.from === n.id)) {
    items.push({ label: 'Cor do ramo', swatches: BRANCH_COLORS.map(c => ({ color: c, action: () => colorBranch(n, c) })) });
    items.push({ label: 'Limpar cor do ramo', action: () => colorBranch(n, null) });
  }
  if (n.type === 'shape') {
    items.push('-', ...Object.entries(SHAPES).map(([k, l]) => ({
      label: (n.shape === k ? '✓ ' : ' ') + l,
      action: () => { checkpoint(); for (const m of selectedNodes()) if (m.type === 'shape') m.shape = k; changed(); },
    })));
    items.push({ label: 'Cor', swatches: SHAPE_COLORS.map(c => ({ color: c, action: () => setColor(c) })) });
    items.push({ label: 'Cor personalizada…', action: () => pickColor(n.color, c => setColor(c)) });
  }
  if (n.type === 'draw') {
    items.push({ label: 'Cor', swatches: PEN_COLORS.map(c => ({ color: c, action: () => setColor(c) })) });
    items.push(...PEN_WIDTHS.map(wd => ({
      label: (n.width === wd ? '✓ ' : ' ') + 'Espessura ' + wd,
      action: () => { checkpoint(); for (const m of selectedNodes()) if (m.type === 'draw') m.width = wd; changed(); },
    })));
  }
  if (n.type === 'group') items.push({ label: 'Ocultar grupo', action: () => setGroupHidden(n, true) });
  if (n.votes) items.push({ label: `Remover voto (${n.votes})`, action: () => castVote(n, true) });
  {
    const wide = [...sel].map(byId).filter(m => m && WIDE.includes(m.type) && !m.locked);
    if (wide.length > 1) items.push({ label: 'Igualar largura', action: () => setWidths(wide, Math.max(...wide.map(m => m.w))) });
    if (wide.some(m => m.fw)) items.push({ label: 'Largura automática', action: () => setWidths(wide, 0) });
  }
  items.push({ label: n.locked ? 'Destravar' : 'Travar', key: 'Ctrl+L', action: toggleLock });
  items.push('-');
  return items;
}
function setWidths(ns, fw) {
  checkpoint();
  for (const m of ns) { if (fw) m.fw = Math.round(fw); else delete m.fw; measure(m); }
  changed();
}
function wireItems(w) {
  return [
    { label: 'Cor', swatches: [...BRANCH_COLORS, '#1C1C1C'].map(c => ({ color: c, title: c === '#1C1C1C' ? 'Padrão' : c, action: () => styleWire(w, { color: c === '#1C1C1C' ? null : c }) })) },
    { label: (w.dash ? '✓ ' : ' ') + 'Tracejado', action: () => styleWire(w, { dash: !w.dash }) },
    { label: (w.arrow ? '✓ ' : ' ') + 'Seta na ponta', action: () => styleWire(w, { arrow: !w.arrow }) },
    { label: w.label ? 'Editar rótulo…' : 'Adicionar rótulo…', action: () => editWireLabel(w) },
    w.label && { label: 'Remover rótulo', action: () => styleWire(w, { label: null }) },
    '-',
  ];
}

// ---------------------------------------------------------------- modelos
function tpl() {
  const T = { nodes: [], wires: [] };
  let k = 0;
  T.add = (type, x, y, text, extra = {}) => { const id = 'tp' + k++; T.nodes.push({ id, type, x, y, w: 0, h: 0, text, ...extra }); return id; };
  T.wire = (a, b) => T.wires.push({ id: 'tw' + k++, from: a, to: b, fp: 0, tp: 0 });
  T.group = (members, text, color, style = 'box') => { const id = 'tp' + k++; T.nodes.unshift({ id, type: 'group', text, color, style, members }); return id; };
  return T;
}
const TEMPLATES = {
  mindmap: { label: 'Mapa mental', desc: 'Tema central com 4 ramos', build() {
    const T = tpl();
    const r = T.add('idea', 0, -18, 'Tema central');
    ['Objetivos', 'Ideias', 'Recursos', 'Próximos passos'].forEach((b, i) => {
      const y = (i - 1.5) * 130 - 18;
      const id = T.add('idea', 260, y, b);
      T.wire(r, id);
      for (let j = 0; j < 2; j++) T.wire(id, T.add('idea', 500, y - 28 + j * 56, `Item ${j + 1}`));
    });
    return T;
  } },
  swot: { label: 'Análise SWOT', desc: 'Forças, fraquezas, oportunidades e ameaças', build() {
    const T = tpl();
    [['Forças', '#D9F2B3', '#96A587'], ['Fraquezas', '#FFD7D7', '#D47A7A'], ['Oportunidades', '#CDE3FF', '#8AA0C8'], ['Ameaças', '#FFF9A6', '#E8D85A']]
      .forEach(([name, pc, gc], i) => {
        const p = T.add('panel', (i % 2) * 340, Math.floor(i / 2) * 260, '• \n• \n• ', { w: 280, h: 180, color: pc });
        T.group([p], name, gc, 'rect');
      });
    return T;
  } },
  retro: { label: 'Retrospectiva', desc: 'O que foi bem, o que melhorar, ações', build() {
    const T = tpl();
    [['O que foi bem', '#D9F2B3', '#96A587'], ['O que pode melhorar', '#FFD7D7', '#D47A7A'], ['Ações', '#CDE3FF', '#8AA0C8']]
      .forEach(([name, pc, gc], i) => {
        const a = T.add('panel', i * 320, 0, '', { w: 240, h: 110, color: pc });
        const b = T.add('panel', i * 320, 140, '', { w: 240, h: 110, color: pc });
        T.group([a, b], name, gc, 'box');
      });
    return T;
  } },
  roadmap: { label: 'Roadmap', desc: '4 trimestres com metas e entregas', build() {
    const T = tpl();
    let prev = null;
    for (let i = 0; i < 4; i++) {
      const q = T.add('idea', i * 300, 0, `Trimestre ${i + 1}`);
      if (prev) T.wire(prev, q);
      prev = q;
      const c = T.add('check', i * 300, 90, 'Entregas', { items: [{ t: 'Meta', done: false }, { t: 'Entrega', done: false }, { t: 'Revisão', done: false }] });
      T.wire(q, c);
    }
    return T;
  } },
  journey: { label: 'Jornada do usuário', desc: 'Etapas com ações e dores', build() {
    const T = tpl();
    let prev = null;
    ['Descoberta', 'Consideração', 'Compra', 'Uso', 'Fidelização'].forEach((s, i) => {
      const id = T.add('idea', i * 260, 0, s);
      if (prev) T.wire(prev, id);
      prev = id;
      T.wire(id, T.add('panel', i * 260, 90, 'Ações:\n\nDores:\n\nOportunidades:', { w: 210, h: 130, color: '#FFFFFF' }));
    });
    return T;
  } },
  kanban: { label: 'Kanban', desc: 'A fazer, fazendo, feito', build() {
    const T = tpl();
    [['A fazer', '#B0B0B0'], ['Fazendo', '#E0A060'], ['Feito', '#96A587']].forEach(([name, gc], i) => {
      const ps = [0, 1, 2].map(k => T.add('panel', i * 290, k * 95, 'Tarefa', { w: 220, h: 70, color: '#FFF9A6' }));
      T.group(ps, name, gc, 'rect');
    });
    return T;
  } },
  brainstorm: { label: 'Brainstorm', desc: 'Pergunta central e notas em volta', build() {
    const T = tpl();
    T.add('scribble', -130, -20, 'Qual é a pergunta?');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      T.add('panel', Math.cos(a) * 330 - 85, Math.sin(a) * 220 - 45, '', { w: 170, h: 90, color: PANEL_COLORS[i % 4] });
    }
    return T;
  } },
};
function showTemplates() {
  const body = modal('Modelos', '<div class="tplgrid">' + Object.entries(TEMPLATES).map(([k, t]) =>
    `<button class="tpl" data-tpl="${k}"><b>${esc(t.label)}</b><small>${esc(t.desc)}</small></button>`).join('') +
    '</div><p class="muted">O modelo é inserido no centro da tela.</p>');
  body.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => {
    closeOverlay('#modal');
    paste(TEMPLATES[b.dataset.tpl].build(), viewCenter());
    fitView(true, selectedNodes());
    toast('Modelo inserido');
  }));
}

// ---------------------------------------------------------------- texto → mapa
function textToTree(text) {
  const roots = [], stack = [];
  for (const raw of String(text).split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let ind = raw.match(/^\s*/)[0].replace(/\t/g, '    ').length;
    let t = raw.trim();
    const h = t.match(/^(#{1,6})\s+/);
    if (h) { ind = h[1].length - 7; t = t.slice(h[0].length); }
    t = t.replace(/^([-*•+]|\d+[.)])\s+/, '').trim();
    if (!t) continue;
    const node = { t, kids: [] };
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
    if (stack.length) stack[stack.length - 1].node.kids.push(node); else roots.push(node);
    stack.push({ ind, node });
  }
  return roots;
}
function insertTree(roots) {
  const T = tpl();
  const pos = new Map();
  let leaf = 0, count = 0;
  const place = (node, depth) => {
    if (count++ >= 400) return null;
    const kids = node.kids.map(k => place(k, depth + 1)).filter(Boolean);
    const y = kids.length ? (pos.get(kids[0]) + pos.get(kids[kids.length - 1])) / 2 : (leaf++) * 56;
    const id = T.add('idea', depth * 250, y, node.t.slice(0, 200));
    pos.set(id, y);
    kids.forEach(k => T.wire(id, k));
    return id;
  };
  for (const r of roots) { place(r, 0); leaf += 0.6; }
  paste(T, viewCenter());
  fitView(true, selectedNodes());
  toast(`${Math.min(count, 400)} ideias criadas`);
}
function showTextMap() {
  const body = modal('Texto → mapa',
    '<p class="muted">Cole uma lista. Cada nível de recuo (espaços, tab, marcadores ou títulos #) vira um ramo.</p>' +
    '<textarea id="tmText" rows="10" class="ta" placeholder="Projeto&#10;  Pesquisa&#10;    Entrevistas&#10;  Design&#10;  Lançamento"></textarea>' +
    '<div class="row-end"><button class="btn primary" id="tmGo">Criar mapa</button></div>');
  const ta = body.querySelector('#tmText');
  setTimeout(() => ta.focus(), 50);
  body.querySelector('#tmGo').addEventListener('click', () => {
    const roots = textToTree(ta.value);
    if (!roots.length) return toast('Cole algum texto primeiro');
    closeOverlay('#modal');
    insertTree(roots);
  });
}

// ---------------------------------------------------------------- busca
let findHits = [], findIdx = -1;
const normTxt = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nodeSearchText = n => [n.text, n.url, n.icon, ...(n.items || []).map(i => i.t), ...(n.inputs || []), ...(n.outputs || [])].join(' ');
function openFind() {
  const fb = $('#findbar');
  fb.hidden = false;
  const inp = fb.querySelector('input');
  inp.focus();
  inp.select();
  runFind();
}
function closeFind() { $('#findbar').hidden = true; canvas.focus({ preventScroll: true }); }
function runFind() {
  const q = normTxt($('#findbar input').value.trim());
  findHits = q ? doc.nodes.filter(n => !isHidden(n) && normTxt(nodeSearchText(n)).includes(q)) : [];
  findIdx = -1;
  $('#findbar .cnt').textContent = q ? (findHits.length ? `0/${findHits.length}` : 'nada') : '';
  if (findHits.length) findStep(1);
}
function findStep(d) {
  if (!findHits.length) return;
  findIdx = (findIdx + d + findHits.length) % findHits.length;
  const n = findHits[findIdx];
  sel = new Set([n.id]); selWire = null;
  const z = Math.max(view.z, 0.9);
  animateView({ z, x: W / 2 - (n.x + n.w / 2) * z, y: H / 2 - (n.y + n.h / 2) * z });
  $('#findbar .cnt').textContent = `${findIdx + 1}/${findHits.length}`;
  updateStatus();
}

// ---------------------------------------------------------------- exportar (seleção ou tudo) e PDF
function renderExport(bg = null) {
  const part = sel.size > 0;
  const nodes = (part ? withMembers(selectedNodes()) : doc.nodes).filter(n => !isHidden(n));
  if (!nodes.length) { toast('Nada para exportar'); return null; }
  updateGroups(doc.nodes);
  const bb = bbox(nodes);
  const pad = 24, bw = bb.w + pad * 2, bh = bb.h + pad * 2;
  const s = Math.min(2, 6000 / bw, 6000 / bh);
  const c = document.createElement('canvas');
  c.width = Math.ceil(bw * s); c.height = Math.ceil(bh * s);
  const g = c.getContext('2d');
  // sem grade e sem o fundo cinza: só os objetos e os fios (PNG transparente; PDF em fundo branco)
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  const v = { x: (pad - bb.x) * s, y: (pad - bb.y) * s, z: s };
  g.setTransform(s, 0, 0, s, v.x, v.y);
  drawScene(g, { selection: new Set(), wireSel: null, scale: s, editId: null, only: part ? new Set(nodes.map(n => n.id)) : null });
  return { c, s, part };
}
function exportPng() {
  const r = renderExport();
  if (!r) return;
  r.c.toBlob(b => b ? downloadBlob(b, safeName(doc.name) + (r.part ? '-selecao' : '') + '.png') : toast('Falha ao gerar imagem'), 'image/png');
}
function makePdf(jpeg, pxW, pxH, ptW, ptH) {
  const enc = new TextEncoder(), parts = [], off = [];
  let len = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (i, body) => { off[i] = len; push(`${i} 0 obj\n${body}\nendobj\n`); };
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  off[4] = len;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push('\nendstream\nendobj\n');
  const content = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  let x = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) x += String(off[i]).padStart(10, '0') + ' 00000 n \n';
  push(x);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
function exportPdf() {
  const r = renderExport('#FFFFFF');
  if (!r) return;
  r.c.toBlob(async b => {
    if (!b) return toast('Falha ao gerar PDF');
    const jpeg = new Uint8Array(await b.arrayBuffer());
    const k = 0.75 / r.s; // pixels da imagem → pontos (1 px do mapa = 0,75 pt)
    const pdf = makePdf(jpeg, r.c.width, r.c.height, +(r.c.width * k).toFixed(2), +(r.c.height * k).toFixed(2));
    downloadBlob(pdf, safeName(doc.name) + (r.part ? '-selecao' : '') + '.pdf');
  }, 'image/jpeg', 0.92);
}

// ---------------------------------------------------------------- histórico de versões
const HIST_EVERY = 10 * 60 * 1000, HIST_MAX = 15;
const histLast = {};
const histKey = id => 'mm.hist.' + id;
function recordVersion(force = false) {
  if (!doc) return;
  if (!force && histLast[doc.id] && Date.now() - histLast[doc.id] < HIST_EVERY) return;
  const list = loadJSON(histKey(doc.id), []);
  const data = snapshot();
  if (list.length && list[0].data === data) { histLast[doc.id] = list[0].t; if (force) toast('Nenhuma mudança desde a última versão'); return; }
  if (!force && list.length && Date.now() - list[0].t < HIST_EVERY) { histLast[doc.id] = list[0].t; return; }
  list.unshift({ t: Date.now(), n: doc.nodes.length, data });
  while (list.length > HIST_MAX) list.pop();
  while (list.length && !saveJSON(histKey(doc.id), list)) list.pop();
  histLast[doc.id] = Date.now();
  if (force) toast('Versão salva');
}
function showHistory() {
  flushSave();
  const list = loadJSON(histKey(doc.id), []);
  const rows = list.map((v, i) => `<div class="hrow"><span><b>${new Date(v.t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</b> · ${v.n} objetos</span><button class="btn" data-v="${i}">Restaurar</button></div>`).join('');
  const body = modal('Histórico de versões',
    '<p class="muted">Uma versão é guardada automaticamente a cada 10 minutos de edição (até 15).</p>' +
    (rows || '<p>Nenhuma versão guardada ainda.</p>') +
    '<div class="row-end"><button class="btn primary" id="hsSave">Salvar versão agora</button></div>');
  body.querySelector('#hsSave').addEventListener('click', () => { recordVersion(true); showHistory(); });
  body.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => {
    const v = list[+b.dataset.v];
    if (!v) return;
    checkpoint();
    restore(v.data);
    closeOverlay('#modal');
    toast('Versão restaurada — Ctrl+Z desfaz');
  }));
}

// ---------------------------------------------------------------- camadas (mostrar/ocultar grupos)
function setGroupHidden(g, hidden) {
  checkpoint();
  if (hidden) g.hidden = true; else delete g.hidden;
  computeHidden();
  for (const id of [...sel]) if (hiddenSet.has(id)) sel.delete(id);
  changed();
}
function showLayers() {
  const gs = doc.nodes.filter(n => n.type === 'group');
  const rows = gs.map((g, i) => `<div class="hrow"><label><input type="checkbox" data-g="${i}" ${g.hidden ? '' : 'checked'}> ${esc(g.text || 'Grupo sem nome')} <small class="muted">(${g.members.length} objetos)</small></label><button class="btn" data-go="${i}">Ir</button></div>`).join('');
  const body = modal('Camadas (grupos)', rows || '<p>Nenhum grupo neste mapa. Selecione objetos e use Ctrl+G para agrupar.</p>');
  body.querySelectorAll('[data-g]').forEach(c => c.addEventListener('change', () => setGroupHidden(gs[+c.dataset.g], !c.checked)));
  body.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
    const g = gs[+b.dataset.go];
    if (g.hidden) setGroupHidden(g, false);
    closeOverlay('#modal');
    fitView(true, [g]);
  }));
}

// ---------------------------------------------------------------- apresentação
function startPresentation() {
  if (editing) commitEdit();
  const groups = doc.nodes.filter(n => n.type === 'group' && !isHidden(n))
    .sort((a, b) => (Math.round(a.y / 150) - Math.round(b.y / 150)) || (a.x - b.x));
  const frames = groups.length ? groups.map(g => ({ name: g.text || '', nodes: [g] }))
    : [{ name: doc.name, nodes: doc.nodes.filter(n => !isHidden(n)) }];
  if (!frames[0].nodes.length) return toast('O mapa está vazio');
  if (tool === 'pen') togglePen(false);
  if (voteMode) toggleVote(false);
  presenting = { frames, i: 0, view0: { ...view }, fs: false };
  sel.clear(); selWire = null;
  document.body.classList.add('presenting');
  $('#presentbar').hidden = false;
  const de = document.documentElement;
  if (de.requestFullscreen) de.requestFullscreen().then(() => { if (presenting) presenting.fs = true; }).catch(() => {});
  setTimeout(() => goFrame(0), 120);
  if (!groups.length) toast('Dica: crie grupos para apresentar parte por parte');
}
function goFrame(i) {
  if (!presenting) return;
  const f = presenting.frames;
  presenting.i = clamp(i, 0, f.length - 1);
  const fr = f[presenting.i];
  fitView(true, fr.nodes);
  $('#presentbar .cnt').textContent = `${presenting.i + 1} / ${f.length}${fr.name ? ' — ' + fr.name : ''}`;
}
function endPresentation() {
  if (!presenting) return;
  const v = presenting.view0;
  presenting = null;
  document.body.classList.remove('presenting');
  $('#presentbar').hidden = true;
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  setTimeout(() => { resize(); animateView(v); }, 120);
}
document.addEventListener('fullscreenchange', () => {
  if (!presenting) return;
  if (!document.fullscreenElement && presenting.fs) return endPresentation();
  setTimeout(() => goFrame(presenting.i), 150);
});

// ---------------------------------------------------------------- timer
let timerT = null, timerEnd = 0, timerLeft = 0, timerPaused = false;
const fmtTime = ms => { const s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function startTimer(min) {
  clearInterval(timerT);
  timerLeft = min * 60000;
  timerEnd = Date.now() + timerLeft;
  timerPaused = false;
  const t = $('#timer');
  t.hidden = false;
  t.classList.remove('done');
  t.querySelector('[data-t="pause"]').textContent = '⏸';
  timerT = setInterval(tickTimer, 250);
  tickTimer();
}
function tickTimer() {
  const left = timerPaused ? timerLeft : Math.max(0, timerEnd - Date.now());
  $('#timer .time').textContent = fmtTime(left);
  if (!timerPaused && left <= 0) {
    clearInterval(timerT); timerT = null;
    $('#timer').classList.add('done');
    beep();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    toast('Tempo esgotado!');
  }
}
function pauseTimer() {
  if (!timerT && !timerPaused) return;
  if (timerPaused) { timerEnd = Date.now() + timerLeft; timerPaused = false; timerT = setInterval(tickTimer, 250); }
  else { timerLeft = Math.max(0, timerEnd - Date.now()); timerPaused = true; clearInterval(timerT); timerT = null; }
  $('#timer [data-t="pause"]').textContent = timerPaused ? '▶' : '⏸';
  tickTimer();
}
function stopTimer() { clearInterval(timerT); timerT = null; timerPaused = false; $('#timer').hidden = true; }
function beep() {
  try {
    const A = window.AudioContext || window.webkitAudioContext;
    const ac = new A();
    [0, 0.35, 0.7].forEach(t => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.25);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.3);
    });
    setTimeout(() => ac.close(), 1500);
  } catch {}
}
function openPopup(anchor, items) {
  hideMenus();
  const drop = $('#dropmenu');
  fillMenu(drop, items.map(it => (it && it !== '-' ? { ...it, action: () => { closeDrop(); it.action(); } } : it)));
  drop.style.display = 'block';
  const r = (anchor && anchor.getBoundingClientRect) ? anchor.getBoundingClientRect() : null;
  const sr = stage.getBoundingClientRect();
  drop.style.left = Math.max(4, Math.min(r ? r.left : sr.right - drop.offsetWidth - 8, innerWidth - drop.offsetWidth - 4)) + 'px';
  drop.style.top = (r ? r.bottom : sr.top + 8) + 'px';
  if (openMenuBtn) openMenuBtn.classList.remove('open');
  openMenuBtn = (anchor && anchor.classList) ? anchor : el('span');
}
function openTimerMenu(anchor) {
  openPopup(anchor, [
    ...[1, 3, 5, 10, 15, 30].map(m => ({ label: `${m} minuto${m > 1 ? 's' : ''}`, action: () => startTimer(m) })),
    { label: 'Outro…', action: () => { const v = prompt('Minutos:', '20'); if (v && +v > 0) startTimer(Math.min(600, +v)); } },
    (timerT || timerPaused) && '-',
    (timerT || timerPaused) && { label: 'Parar timer', action: stopTimer },
  ]);
}

// ---------------------------------------------------------------- votação
function toggleVote(force) {
  voteMode = force === undefined ? !voteMode : force;
  if (voteMode && tool === 'pen') togglePen(false);
  $('#votebar').hidden = !voteMode;
  syncToggles();
  if (voteMode) toast('Votação: clique nos objetos para votar');
}
function castVote(n, remove) {
  if (!n || n.type === 'group') return;
  checkpoint();
  n.votes = Math.max(0, (n.votes || 0) + (remove ? -1 : 1));
  if (!n.votes) delete n.votes;
  changed();
}
function clearVotes() {
  if (!doc.nodes.some(n => n.votes)) return toast('Não há votos');
  checkpoint();
  doc.nodes.forEach(n => delete n.votes);
  changed();
  toast('Votos zerados');
}
function voteResults() {
  const ns = doc.nodes.filter(n => n.votes).sort((a, b) => b.votes - a.votes);
  const label = n => esc(n.icon ? n.icon + ' ' : '') + esc((n.text || '').split('\n')[0] || TYPE_LABEL[n.type] || 'Objeto');
  modal('Resultado da votação', ns.length
    ? '<ol class="votes">' + ns.map(n => `<li><b>${n.votes}</b> — ${label(n)}</li>`).join('') + '</ol>'
    : '<p>Nenhum voto ainda.</p>');
}
function buildVotebar() {
  const bar = $('#votebar');
  bar.append(el('span', 'lbl', 'Votação: clique para votar · Shift+clique remove'));
  for (const [t, fn] of [['Resultado', voteResults], ['Zerar', clearVotes], ['Encerrar', () => toggleVote(false)]]) {
    const b = el('button', null, t);
    b.addEventListener('click', fn);
    bar.append(b);
  }
}

// ---------------------------------------------------------------- ligação dos controles flutuantes
function buildFloatbars() {
  buildPenbar();
  buildVotebar();
  const fb = $('#findbar'), fi = fb.querySelector('input');
  fi.addEventListener('input', runFind);
  fi.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  });
  fb.querySelector('[data-f="prev"]').addEventListener('click', () => findStep(-1));
  fb.querySelector('[data-f="next"]').addEventListener('click', () => findStep(1));
  fb.querySelector('[data-f="close"]').addEventListener('click', closeFind);
  $('#timer [data-t="pause"]').addEventListener('click', pauseTimer);
  $('#timer .time').addEventListener('click', pauseTimer);
  $('#timer [data-t="close"]').addEventListener('click', stopTimer);
  $('#presentbar [data-p="prev"]').addEventListener('click', () => goFrame(presenting.i - 1));
  $('#presentbar [data-p="next"]').addEventListener('click', () => goFrame(presenting.i + 1));
  $('#presentbar [data-p="close"]').addEventListener('click', endPresentation);
}

// ================================================================ IA (chave de API de cada pessoa)
// A chave fica só neste aparelho (localStorage 'mm.ai') e vai direto para a API da Anthropic.
// Nunca é exportada com o mapa.

const AI_SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.13.0/+esm';
const AI_MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 — melhor qualidade (padrão)'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 — equilíbrio entre qualidade e custo'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 — mais rápido e mais barato'],
];
let aiSdk = null, aiBusy = false, aiAbort = null;

const aiCfg = () => Object.assign({ key: '', model: AI_MODELS[0][0] }, loadJSON('mm.ai', {}));
class AiMsg extends Error { constructor(m) { super(m); this.aiMsg = m; } }

async function aiClient() {
  const cfg = aiCfg();
  if (!cfg.key) { showAiSettings(); throw new AiMsg(''); }
  if (!aiSdk) {
    try { aiSdk = await import(AI_SDK_URL); }
    catch { throw new AiMsg('Não foi possível carregar a biblioteca da IA. Verifique a internet.'); }
  }
  const Anthropic = aiSdk.default;
  return { client: new Anthropic({ apiKey: cfg.key, dangerouslyAllowBrowser: true }), Anthropic, model: cfg.model };
}

// Uma chamada à API. Com schema, a resposta vem em JSON estruturado (output_config.format).
async function aiCall({ system, user, schema, maxTokens = 16000 }) {
  const { client, Anthropic, model } = await aiClient();
  const params = { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] };
  if (schema) params.output_config = { format: { type: 'json_schema', schema } };
  aiAbort = new AbortController();
  const opts = { signal: aiAbort.signal };
  // Se a IA recusar por segurança, a API tenta de novo em outro modelo (fallback no servidor).
  // O Haiku 5.5 não tem esse recurso.
  const withFallback = model !== 'claude-haiku-5-5';
  let res;
  try {
    res = withFallback
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, opts)
      : await client.messages.create(params, opts);
  } catch (e) {
    if (withFallback && e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) res = await client.messages.create(params, opts);
    else throw e;
  }
  if (res.stop_reason === 'refusal') throw new AiMsg('A IA não quis atender este pedido. Tente reformular.');
  if (res.stop_reason === 'max_tokens') throw new AiMsg('A resposta ficou longa demais. Tente um pedido menor.');
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (!schema) return text;
  try { return JSON.parse(text); } catch { throw new AiMsg('A resposta veio num formato inesperado. Tente de novo.'); }
}

function aiErrorMessage(e) {
  const A = aiSdk && aiSdk.default;
  if (e && e.name === 'AbortError') return null;
  if (A) {
    if (A.APIUserAbortError && e instanceof A.APIUserAbortError) return null;
    if (e instanceof A.AuthenticationError) return 'Chave de API inválida. Confira em IA → Configurar.';
    if (e instanceof A.PermissionDeniedError) return 'Sua chave não tem permissão para usar este modelo.';
    if (e instanceof A.NotFoundError) return 'Modelo não encontrado para a sua chave. Escolha outro em IA → Configurar.';
    if (e instanceof A.RateLimitError) return 'Limite de uso atingido. Espere um pouco e tente de novo.';
    if (e instanceof A.APIConnectionError) return 'Sem conexão com a Anthropic. Verifique a internet.';
    if (e instanceof A.APIError) {
      if (/credit balance/i.test(e.message)) return 'Sua conta da Anthropic está sem créditos. Adicione créditos em console.anthropic.com.';
      return `A API respondeu com erro (${e.status || '?'}): ${e.message}`;
    }
  }
  if (e && 'aiMsg' in e) return e.aiMsg || null;
  return 'Erro: ' + (e && e.message ? e.message : e);
}

async function runAi(label, fn) {
  if (aiBusy) return toast('A IA ainda está trabalhando…');
  if (editing) commitEdit();
  aiBusy = true;
  const bar = $('#aibar');
  bar.querySelector('.lbl').textContent = '✨ ' + label;
  bar.hidden = false;
  try { await fn(); }
  catch (e) {
    const m = aiErrorMessage(e);
    if (m) modal('Inteligência artificial', `<p>${esc(m)}</p>`);
  } finally {
    aiBusy = false; aiAbort = null;
    bar.hidden = true;
  }
}

// ---------- texto do mapa para a IA (estrutura de tópicos)
function mapOutline(nodes) {
  const ids = new Set(nodes.map(n => n.id));
  const kids = new Map(), hasParent = new Set();
  for (const w of doc.wires) {
    if (!ids.has(w.from) || !ids.has(w.to)) continue;
    if (!kids.has(w.from)) kids.set(w.from, []);
    kids.get(w.from).push(w.to);
    hasParent.add(w.to);
  }
  const label = n => {
    const t = (n.type === 'check' ? [n.text, ...n.items.map(i => (i.done ? '[x] ' : '[ ] ') + i.t)].join('; ') : n.text || n.url || '');
    return (n.icon ? n.icon + ' ' : '') + String(t).replace(/\s+/g, ' ').trim().slice(0, 200);
  };
  const lines = [], seen = new Set();
  const walk = (id, depth) => {
    if (seen.has(id) || lines.length > 400) return;
    seen.add(id);
    const n = byId(id);
    const t = label(n);
    if (t) lines.push('  '.repeat(depth) + '- ' + t);
    for (const k of kids.get(id) || []) walk(k, depth + (t ? 1 : 0));
  };
  const items = nodes.filter(n => n.type !== 'group' && n.type !== 'draw' && n.type !== 'image');
  for (const n of items) if (!hasParent.has(n.id)) walk(n.id, 0);
  for (const n of items) if (!seen.has(n.id)) walk(n.id, 0);
  return lines.join('\n');
}

// ---------- 1. gerar mapa a partir de um tema
function aiGenerate() {
  const body = modal('Gerar mapa com IA',
    '<p class="muted">Descreva o tema. A IA cria um mapa mental com ramos e sub-ramos.</p>' +
    '<input type="text" id="aiTopic" class="ta" placeholder="Ex.: plano de lançamento de um app" maxlength="300">' +
    '<div class="row-end"><button class="btn primary" id="aiGo">Gerar</button></div>');
  const inp = body.querySelector('#aiTopic');
  setTimeout(() => inp.focus(), 50);
  const go = () => {
    const topic = inp.value.trim();
    if (!topic) return toast('Escreva um tema');
    closeOverlay('#modal');
    runAi('Gerando mapa…', async () => {
      const out = await aiCall({
        system: 'Você cria mapas mentais claros em português do Brasil. Responda apenas com o JSON pedido.',
        user: `Crie um mapa mental sobre: ${topic}\n\nRegras: um único nó raiz (parent = ""), de 4 a 7 ramos principais e de 2 a 4 subitens em cada ramo. Textos curtos (até 6 palavras). Cada nó tem um id único e o id do pai em "parent".`,
        schema: {
          type: 'object', additionalProperties: false, required: ['nodes'],
          properties: {
            nodes: { type: 'array', items: {
              type: 'object', additionalProperties: false, required: ['id', 'parent', 'text'],
              properties: { id: { type: 'string' }, parent: { type: 'string' }, text: { type: 'string' } },
            } },
          },
        },
      });
      const roots = flatToTree(out.nodes || []);
      if (!roots.length) throw new AiMsg('A IA não devolveu nenhuma ideia. Tente outro tema.');
      insertTree(roots);
    });
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); e.stopPropagation(); });
  body.querySelector('#aiGo').addEventListener('click', go);
}
function flatToTree(list) {
  const map = new Map();
  for (const n of list.slice(0, 300)) {
    const t = String(n.text || '').trim().slice(0, 200);
    if (t && n.id != null && !map.has(String(n.id))) map.set(String(n.id), { t, kids: [], parent: String(n.parent ?? '') });
  }
  const roots = [];
  for (const [id, n] of map) {
    // pai inexistente ou ciclo → vira raiz
    let p = map.get(n.parent), guard = 0, cyc = false;
    for (let q = p; q && guard < 300; q = map.get(q.parent), guard++) if (q === n) { cyc = true; break; }
    if (p && !cyc && p !== n) p.kids.push(n); else roots.push(n);
  }
  return roots;
}

// ---------- 2. expandir uma ideia com novas ideias filhas
function aiExpand(n = single()) {
  if (!n || n.type !== 'idea') return toast('Selecione uma ideia para expandir');
  runAi('Pensando em novas ideias…', async () => {
    const path = [];
    for (let p = n, guard = 0; p && guard < 20; p = parentOf(p), guard++) path.unshift(p.text || '');
    const existing = children(n).map(k => k.text).filter(Boolean);
    const out = await aiCall({
      system: 'Você ajuda a desenvolver mapas mentais em português do Brasil. Responda apenas com o JSON pedido.',
      user: `Mapa mental (caminho até a ideia): ${path.join(' → ')}\n` +
        (existing.length ? `Ideias filhas que já existem: ${existing.join('; ')}\n` : '') +
        `\nSugira de 3 a 6 novas ideias filhas para "${n.text}", curtas (até 6 palavras), sem repetir as que já existem.`,
      schema: {
        type: 'object', additionalProperties: false, required: ['ideas'],
        properties: { ideas: { type: 'array', items: { type: 'string' } } },
      },
    });
    const ideas = (out.ideas || []).map(s => String(s).trim().slice(0, 200)).filter(Boolean).slice(0, 8);
    if (!ideas.length) throw new AiMsg('A IA não sugeriu nenhuma ideia nova.');
    if (!byId(n.id)) return;
    checkpoint();
    const kids = children(n);
    let y = kids.length ? Math.max(...kids.map(k => k.y + k.h)) + 16 : n.y + n.h / 2 - (ideas.length * 52) / 2;
    const x = kids.length ? Math.min(...kids.map(k => k.x)) : n.x + n.w + 80;
    const made = [];
    for (const t of ideas) {
      const c = makeNode('idea', x, y, t);
      avoidOverlap(c);
      doc.nodes.push(c);
      doc.wires.push({ id: uid(), from: n.id, to: c.id, fp: 0, tp: 0 });
      made.push(c);
      y = c.y + c.h + 14;
    }
    sel = new Set(made.map(c => c.id)); selWire = null;
    changed();
    fitView(true, [n, ...made]);
    toast(`${made.length} ideias sugeridas — Ctrl+Z desfaz`);
  });
}

// ---------- 3. resumir o mapa (ou a seleção) num painel
function aiSummarize() {
  const part = sel.size > 0;
  const nodes = (part ? withMembers(selectedNodes()) : doc.nodes).filter(n => !isHidden(n));
  const outline = mapOutline(nodes);
  if (!outline.trim()) return toast('Não há texto para resumir');
  runAi('Resumindo…', async () => {
    const text = await aiCall({
      system: 'Você resume mapas mentais em português do Brasil, de forma objetiva. Responda só com o resumo, em texto simples (sem markdown, sem títulos), usando "• " no início de cada tópico.',
      user: `Resuma este mapa mental em até 8 tópicos curtos, destacando as ideias principais e as conclusões:\n\n${outline}`,
      maxTokens: 4000,
    });
    if (!text) throw new AiMsg('A IA devolveu um resumo vazio.');
    const bb = bbox(nodes.length ? nodes : doc.nodes) || { x: 0, y: 0, w: 0, h: 0 };
    checkpoint();
    const body = 'Resumo (IA)\n' + text.replace(/\*\*/g, '');
    const lines = wrap(body, F.panel, 300 - 16).length;
    const p = makeNode('panel', bb.x + bb.w + 60, bb.y, body, { w: 300, h: Math.min(600, lines * LH.panel + 20), color: '#E5D5FF' });
    doc.nodes.push(p);
    sel = new Set([p.id]); selWire = null;
    changed();
    fitView(true, [p]);
    toast('Resumo criado' + (part ? ' a partir da seleção' : ''));
  });
}

// ---------- 4. agrupar notas soltas por tema
function aiGroupNotes() {
  const pool = (sel.size ? selectedNodes() : doc.nodes)
    .filter(n => ['panel', 'scribble', 'idea', 'shape', 'check', 'link'].includes(n.type) && !isHidden(n) && !n.locked);
  const inGroup = new Set(doc.nodes.filter(g => g.type === 'group').flatMap(g => g.members));
  const items = (sel.size ? pool : pool.filter(n => n.type === 'panel' && !inGroup.has(n.id))).filter(n => (n.text || '').trim());
  if (items.length < 2) return toast(sel.size ? 'Selecione pelo menos 2 notas com texto' : 'Não há painéis soltos com texto para agrupar (ou selecione as notas)');
  runAi('Agrupando por tema…', async () => {
    const list = items.slice(0, 120).map((n, i) => `${i + 1}. ${String(n.text).replace(/\s+/g, ' ').slice(0, 200)}`).join('\n');
    const out = await aiCall({
      system: 'Você organiza notas por tema em português do Brasil. Responda apenas com o JSON pedido.',
      user: `Agrupe estas notas por tema, em 2 a 6 grupos com nomes curtos. Cada nota deve ficar em exatamente um grupo; use os números das notas.\n\n${list}`,
      schema: {
        type: 'object', additionalProperties: false, required: ['groups'],
        properties: { groups: { type: 'array', items: {
          type: 'object', additionalProperties: false, required: ['name', 'notes'],
          properties: { name: { type: 'string' }, notes: { type: 'array', items: { type: 'integer' } } },
        } } },
      },
    });
    const used = new Set();
    const groups = (out.groups || []).map(g => ({
      name: String(g.name || 'Grupo').slice(0, 60),
      ms: (g.notes || []).map(k => items[(k | 0) - 1]).filter(n => n && !used.has(n.id) && used.add(n.id)),
    })).filter(g => g.ms.length);
    if (!groups.length) throw new AiMsg('A IA não conseguiu agrupar as notas.');
    checkpoint();
    const bb = bbox(groups.flatMap(g => g.ms));
    let x = bb.x;
    for (const g of groups) {
      const colW = Math.max(...g.ms.map(n => n.w));
      let y = bb.y;
      for (const n of g.ms) { n.x = x; n.y = y; y += n.h + 16; }
      x += colW + 110;
      doc.nodes.unshift(makeNode('group', 0, 0, g.name, { members: g.ms.map(n => n.id) }));
    }
    sel = new Set(groups.flatMap(g => g.ms.map(n => n.id))); selWire = null;
    changed();
    fitView(true, selectedNodes());
    toast(`${groups.length} grupos criados — Ctrl+Z desfaz`);
  });
}

// ---------- configuração da chave
function showAiSettings() {
  const cfg = aiCfg();
  const body = modal('IA — sua chave de API',
    '<p>A IA usa a <b>sua própria chave de API da Anthropic</b>. Ela fica salva só neste aparelho e é enviada direto para a Anthropic, nunca para outro lugar. Você paga só o que usar.</p>' +
    '<ol><li>Crie uma conta em <b>console.anthropic.com</b> (é separada da assinatura Claude Pro).</li><li>Adicione créditos e gere uma chave em <b>API Keys</b>.</li><li>Cole a chave abaixo.</li></ol>' +
    '<label class="fld">Chave de API<input type="password" id="aiKey" class="ta" autocomplete="off" spellcheck="false" placeholder="sk-ant-…"></label>' +
    '<label class="fld">Modelo<select id="aiModel" class="ta">' + AI_MODELS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('') + '</select></label>' +
    '<p class="muted">Quem usar este aparelho também poderá usar a chave salva. Em aparelhos compartilhados, remova a chave depois de usar.</p>' +
    '<p class="muted" id="aiStatus"></p>' +
    '<div class="row-end" style="gap:8px"><button class="btn" id="aiDel">Remover chave</button><button class="btn" id="aiTest">Testar</button><button class="btn primary" id="aiSave">Salvar</button></div>');
  const k = body.querySelector('#aiKey'), m = body.querySelector('#aiModel'), st = body.querySelector('#aiStatus');
  k.value = cfg.key;
  m.value = cfg.model;
  const save = () => saveJSON('mm.ai', { key: k.value.trim(), model: m.value });
  body.querySelector('#aiSave').addEventListener('click', () => {
    save(); closeOverlay('#modal');
    toast(k.value.trim() ? 'Chave salva neste aparelho' : 'Sem chave: os recursos de IA ficam desligados');
  });
  body.querySelector('#aiDel').addEventListener('click', () => { k.value = ''; saveJSON('mm.ai', { key: '', model: m.value }); st.textContent = 'Chave removida deste aparelho.'; });
  body.querySelector('#aiTest').addEventListener('click', async () => {
    if (!k.value.trim()) { st.textContent = 'Cole uma chave primeiro.'; return; }
    save();
    st.textContent = 'Testando…';
    try {
      const { client } = await aiClient();
      await client.models.retrieve(m.value); // não gera texto e não tem custo
      st.textContent = '✅ Chave válida e modelo disponível.';
    } catch (e) {
      st.textContent = '❌ ' + (aiErrorMessage(e) || 'Teste cancelado.');
    }
  });
}

function buildAi() {
  $('#aibar [data-ai="cancel"]').addEventListener('click', () => { if (aiAbort) aiAbort.abort(); });
}

// ================================================================ NUVEM (Supabase)
// Login por e-mail (link mágico), sincronização, compartilhamento por link,
// edição em tempo real com cursores e comentários com @menções.
// Tudo é opcional: sem configuração (config.js) o app continua 100% local.

const CLOUD_CFG = window.MM_CONFIG || {};
const CLOUD_ON = !!(CLOUD_CFG.supabaseUrl && CLOUD_CFG.supabaseKey);
const SB_SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
const ROLE_LABEL = { owner: 'Dono', editor: 'Pode editar', commenter: 'Pode comentar', viewer: 'Só pode ver' };
const PEER_COLORS = ['#E8590C', '#1971C2', '#C2255C', '#2B8A3E', '#7048E8', '#0C8599', '#E67700', '#5C940D'];

let sb = null;                 // cliente do Supabase
let me = null;                 // { id, email, name }
const cloud = {
  channel: null, channelMap: null, peers: new Map(),
  last: null,                  // { nodes: Map(id→json), wires: Map(id→json), name }
  saveT: null, saving: false, online: true,
  comments: [], people: [], commentsSub: null,
};
class ReadOnlyError extends Error { constructor() { super('Somente leitura'); } }

const peerColor = id => PEER_COLORS[Math.abs([...String(id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % PEER_COLORS.length];
const isCloudMap = () => !!(doc && doc.cloud);
const myRole = () => (isCloudMap() ? doc.role || 'owner' : 'owner');
const canEdit = () => ['owner', 'editor'].includes(myRole());
const canComment = () => isCloudMap() && ['owner', 'editor', 'commenter'].includes(myRole());

// ---------------------------------------------------------------- somente leitura
window.addEventListener('error', e => {
  if (e.error instanceof ReadOnlyError) { e.preventDefault(); readOnlyToast(); }
});
window.addEventListener('unhandledrejection', e => {
  if (e.reason instanceof ReadOnlyError) { e.preventDefault(); readOnlyToast(); }
});
let roToastT = 0;
function readOnlyToast() {
  if (Date.now() - roToastT < 1500) return;
  roToastT = Date.now();
  toast(myRole() === 'commenter' ? 'Você pode comentar, mas não editar este mapa' : 'Este mapa é somente para visualização');
}
function guardEdit() { if (!canEdit()) throw new ReadOnlyError(); }

// ---------------------------------------------------------------- início
async function cloudInit() {
  const join = new URLSearchParams(location.search).get('entrar');
  if (join) {
    sessionStorage.setItem('mm.join', join);
    history.replaceState(null, '', location.pathname);
  }
  // link de "Esqueci minha senha": o Supabase manda type=recovery na URL (e a limpa logo depois),
  // então guardamos isso antes de criar o cliente para não depender do momento do evento
  const hashP = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (hashP.get('type') === 'recovery' || new URLSearchParams(location.search).get('type') === 'recovery') {
    sessionStorage.setItem('mm.recovery', '1');
  }
  updateCloudUi();
  if (!CLOUD_ON) return;
  try {
    const mod = await import(SB_SDK_URL);
    sb = mod.createClient(CLOUD_CFG.supabaseUrl, CLOUD_CFG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      // keepalive deixa o envio terminar mesmo que a aba/app seja fechado logo em seguida (limite de ~64 KB)
      global: { fetch: (url, opts = {}) => fetch(url, typeof opts.body === 'string' && opts.body.length < 60000 ? { ...opts, keepalive: true } : opts) },
    });
  } catch {
    cloud.online = false;
    updateCloudUi();
    return;
  }
  sb.auth.onAuthStateChange((event, session) => {
    // chamadas ao Supabase fora do callback (recomendação da biblioteca)
    setTimeout(() => onAuth(event, session), 0);
  });
  window.addEventListener('online', () => { cloud.online = true; updateCloudUi(); if (isCloudMap()) cloudReopen(); });
  window.addEventListener('offline', () => { cloud.online = false; updateCloudUi(); });
}

// abre "Criar senha nova" uma única vez quando a pessoa veio do link de recuperação
function askNewPassword() {
  if (!sessionStorage.getItem('mm.recovery')) return;
  sessionStorage.removeItem('mm.recovery');
  setTimeout(() => showSetPassword(true), 400);
}
async function onAuth(event, session) {
  const user = session && session.user;
  const was = me && me.id;
  if (event === 'PASSWORD_RECOVERY') sessionStorage.setItem('mm.recovery', '1');
  const recovering = !!sessionStorage.getItem('mm.recovery');
  if (!user) {
    me = null;
    leaveChannel();
    updateCloudUi();
    if (sessionStorage.getItem('mm.join')) showLogin('Entre para abrir o mapa que compartilharam com você.');
    return;
  }
  if (was === user.id && event !== 'USER_UPDATED') { updateCloudUi(); askNewPassword(); return; }
  me = { id: user.id, email: user.email, name: (user.email || '').split('@')[0] };
  const { data: prof } = await sb.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
  if (prof && prof.display_name) me.name = prof.display_name;
  updateCloudUi();
  if (sb.realtime && sb.realtime.setAuth) { try { await sb.realtime.setAuth(session.access_token); } catch {} }
  const token = sessionStorage.getItem('mm.join');
  if (token) {
    sessionStorage.removeItem('mm.join');
    const { data: mapId, error } = await sb.rpc('join_map_by_link', { link_token: token });
    if (error) modal('Link de compartilhamento', `<p>${esc(error.message || 'Não foi possível entrar no mapa.')}</p>`);
    else { await openCloudMap(mapId); toast('Mapa compartilhado aberto'); }
  } else if (!was && !recovering) {
    offerUpload();
    if (isCloudMap()) cloudReopen();
  }
  askNewPassword();
  if (!recovering) checkMentions();
}

// ---------------------------------------------------------------- interface (botões do topo)
function updateCloudUi() {
  const acc = $('#accountBtn'), share = $('#shareBtn'), cb = $('#commentsBtn');
  if (!acc) return;
  acc.hidden = share.hidden = cb.hidden = !CLOUD_ON;
  if (!CLOUD_ON) return;
  acc.textContent = me ? (me.name || 'Conta').slice(0, 18) : 'Entrar';
  acc.title = me ? `Conectado como ${me.email}` : 'Entrar para sincronizar e compartilhar';
  acc.classList.toggle('in', !!me);
  cb.hidden = !isCloudMap();
  $('#syncBtn').hidden = !isCloudMap() || !me;
  const role = myRole();
  $('#roleBadge').hidden = !isCloudMap() || role === 'owner';
  $('#roleBadge').textContent = ROLE_LABEL[role] || '';
  if (isCloudMap() && cloud.saving === false && $('#saveState').textContent === 'Salvo') $('#saveState').textContent = cloud.online ? 'Salvo na nuvem' : 'Salvo no aparelho';
  renderPeersUi();
  updateCommentsBadge();
}
function accountMenu(btn) {
  if (!me) return showLogin();
  openPopup(btn, [
    { label: me.email, disabled: true, action: () => {} },
    '-',
    { label: 'Nome de exibição…', action: renameMe },
    { label: 'Definir / trocar senha…', action: () => showSetPassword() },
    { label: 'Enviar mapas deste aparelho para a nuvem…', action: () => offerUpload(true) },
    '-',
    { label: 'Sair da conta', action: async () => { await sb.auth.signOut(); toast('Você saiu da conta'); } },
  ]);
}
async function renameMe() {
  const v = prompt('Seu nome (aparece para quem você convidar):', me.name || '');
  if (v == null) return;
  const name = v.trim().slice(0, 60);
  if (!name) return;
  const { error } = await sb.from('profiles').upsert({ id: me.id, display_name: name, updated_at: new Date().toISOString() });
  if (error) return toast('Não foi possível salvar o nome');
  me.name = name;
  updateCloudUi();
  trackPresence();
}

// Tela de entrada: senha (padrão), criar conta, esqueci a senha e link por e-mail.
// As senhas vão direto para o Supabase (nunca são guardadas pelo app).
const AUTH_ERRORS = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos. Se você sempre entrou pelo link do e-mail, use "Esqueci minha senha" para criar uma.'],
  [/email not confirmed/i, 'Confirme o seu e-mail primeiro: abra o link que enviamos quando a conta foi criada.'],
  [/already registered|already been registered|user already exists/i, 'Este e-mail já tem conta. Entre com a senha ou use "Esqueci minha senha".'],
  [/password should be at least|weak password|password is too short/i, 'A senha é fraca: use pelo menos 8 caracteres, misturando letras e números.'],
  [/rate limit|too many requests|security purposes/i, 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'],
  [/unable to validate email|invalid email/i, 'Digite um e-mail válido.'],
  [/new password should be different/i, 'A nova senha precisa ser diferente da atual.'],
];
const authMsg = err => {
  const m = String((err && err.message) || err || '');
  for (const [re, txt] of AUTH_ERRORS) if (re.test(m)) return txt;
  return 'Não foi possível concluir: ' + m;
};
function showLogin(msg, mode = 'senha') {
  if (!CLOUD_ON) return;
  if (!sb) return toast('Sem conexão com a nuvem');
  const tabs = [['senha', 'Entrar'], ['criar', 'Criar conta'], ['esqueci', 'Esqueci a senha'], ['link', 'Link por e-mail']];
  const pwField = (id, label, ac) => `<label class="fld">${label}<span class="pw"><input type="password" id="${id}" class="ta" autocomplete="${ac}" minlength="8" required><button type="button" class="eye" data-eye="${id}" title="Mostrar senha" aria-label="Mostrar senha">👁</button></span></label>`;
  const form = {
    senha: pwField('lgPass', 'Senha', 'current-password'),
    criar: pwField('lgPass', 'Crie uma senha (mínimo 8 caracteres)', 'new-password') + pwField('lgPass2', 'Repita a senha', 'new-password'),
    esqueci: '<p class="muted">Enviamos um link para você criar uma senha nova.</p>',
    link: '<p class="muted">Enviamos um link de acesso; não precisa de senha.</p>',
  }[mode];
  const btn = { senha: 'Entrar', criar: 'Criar conta', esqueci: 'Enviar link para nova senha', link: 'Enviar link de acesso' }[mode];
  const body = modal('Entrar',
    (msg ? `<p><b>${esc(msg)}</b></p>` : '') +
    '<div class="lgtabs">' + tabs.map(([k, l]) => `<button type="button" data-lg="${k}" class="${k === mode ? 'on' : ''}">${l}</button>`).join('') + '</div>' +
    '<form id="lgForm" autocomplete="on">' +
    `<label class="fld">E-mail<input type="email" id="lgEmail" name="email" class="ta" autocomplete="${mode === 'criar' ? 'email' : 'username'}" placeholder="voce@exemplo.com" required></label>` +
    form +
    '<p class="muted" id="lgStatus"></p>' +
    `<div class="row-end"><button type="submit" class="btn primary" id="lgGo">${btn}</button></div>` +
    '</form>');
  const email = body.querySelector('#lgEmail'), st = body.querySelector('#lgStatus'), go = body.querySelector('#lgGo');
  const last = localStorage.getItem('mm.lastEmail');
  if (last) email.value = last;
  setTimeout(() => (email.value && body.querySelector('#lgPass') ? body.querySelector('#lgPass') : email).focus(), 50);
  body.querySelectorAll('[data-lg]').forEach(b => b.addEventListener('click', () => {
    if (email.value) localStorage.setItem('mm.lastEmail', email.value.trim());
    showLogin(msg, b.dataset.lg);
  }));
  body.querySelectorAll('[data-eye]').forEach(b => b.addEventListener('click', () => {
    const i = body.querySelector('#' + b.dataset.eye);
    i.type = i.type === 'password' ? 'text' : 'password';
  }));
  body.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));
  body.querySelector('#lgForm').addEventListener('submit', async e => {
    e.preventDefault();
    const em = email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(em)) { st.textContent = 'Digite um e-mail válido.'; return; }
    localStorage.setItem('mm.lastEmail', em);
    const redirect = location.origin + location.pathname;
    go.disabled = true;
    st.textContent = 'Aguarde…';
    let res, ok = '';
    if (mode === 'senha') {
      res = await sb.auth.signInWithPassword({ email: em, password: body.querySelector('#lgPass').value });
      if (!res.error) { closeOverlay('#modal'); toast('Bem-vindo de volta!'); return; }
    } else if (mode === 'criar') {
      const p1 = body.querySelector('#lgPass').value, p2 = body.querySelector('#lgPass2').value;
      if (p1.length < 8) { go.disabled = false; st.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
      if (p1 !== p2) { go.disabled = false; st.textContent = 'As duas senhas não são iguais.'; return; }
      res = await sb.auth.signUp({ email: em, password: p1, options: { emailRedirectTo: redirect } });
      if (!res.error && res.data && res.data.session) { closeOverlay('#modal'); toast('Conta criada!'); return; }
      // Supabase não revela se o e-mail já existe: sem "identities" = já cadastrado
      if (!res.error && res.data && res.data.user && Array.isArray(res.data.user.identities) && !res.data.user.identities.length) {
        res = { error: { message: 'User already registered' } };
      }
      ok = '✅ Conta criada! Abra o e-mail de confirmação que enviamos e clique no link. Depois é só entrar com a sua senha.';
    } else if (mode === 'esqueci') {
      res = await sb.auth.resetPasswordForEmail(em, { redirectTo: redirect });
      ok = '✅ Se existir uma conta com este e-mail, enviamos um link para criar uma senha nova (confira também o spam).';
    } else {
      res = await sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: redirect } });
      ok = '✅ Pronto! Abra o e-mail que enviamos e clique no link para entrar (confira também o spam).';
    }
    go.disabled = false;
    st.textContent = res.error ? authMsg(res.error) : ok;
  });
}
// Definir ou trocar a senha (também usado ao voltar do link "Esqueci minha senha")
function showSetPassword(fromRecovery = false) {
  if (!sb || !me) return;
  const body = modal(fromRecovery ? 'Criar senha nova' : 'Definir senha',
    `<p>${fromRecovery ? 'Escolha a sua senha nova.' : 'Com uma senha você entra direto, sem precisar do link por e-mail.'}</p>` +
    '<form id="pwForm">' +
    `<input type="email" autocomplete="username" value="${esc(me.email || '')}" hidden>` +
    '<label class="fld">Senha nova (mínimo 8 caracteres)<input type="password" id="pw1" class="ta" autocomplete="new-password" minlength="8" required></label>' +
    '<label class="fld">Repita a senha<input type="password" id="pw2" class="ta" autocomplete="new-password" minlength="8" required></label>' +
    '<p class="muted" id="pwStatus"></p>' +
    '<div class="row-end"><button type="submit" class="btn primary">Salvar senha</button></div></form>');
  const st = body.querySelector('#pwStatus');
  setTimeout(() => body.querySelector('#pw1').focus(), 50);
  body.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));
  body.querySelector('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const p1 = body.querySelector('#pw1').value, p2 = body.querySelector('#pw2').value;
    if (p1.length < 8) { st.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
    if (p1 !== p2) { st.textContent = 'As duas senhas não são iguais.'; return; }
    st.textContent = 'Salvando…';
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) { st.textContent = authMsg(error); return; }
    closeOverlay('#modal');
    toast('Senha salva! Da próxima vez, entre com e-mail e senha.');
  });
}

// ---------------------------------------------------------------- enviar mapas locais
function localOnlyMaps() {
  const idx = loadJSON(IDX, {});
  return Object.keys(idx).map(id => loadJSON('mm.map.' + id, null)).filter(d => d && !d.cloud);
}
function offerUpload(force = false) {
  if (!me) return;
  const maps = localOnlyMaps();
  const key = 'mm.uploadAsked.' + me.id;
  if (!maps.length) { if (force) toast('Todos os mapas deste aparelho já estão na nuvem'); return; }
  if (!force && localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  const body = modal('Enviar mapas para a nuvem',
    `<p>Você tem ${maps.length} ${maps.length > 1 ? 'mapas' : 'mapa'} só neste aparelho. Enviar para a nuvem para acessar de outros aparelhos e poder compartilhar?</p>` +
    '<ul>' + maps.map(m => `<li>${esc(m.name || 'Mapa sem nome')}</li>`).join('') + '</ul>' +
    '<div class="row-end" style="gap:8px"><button class="btn" id="upNo">Agora não</button><button class="btn primary" id="upYes">Enviar</button></div>');
  body.querySelector('#upNo').addEventListener('click', () => closeOverlay('#modal'));
  body.querySelector('#upYes').addEventListener('click', async () => {
    closeOverlay('#modal');
    let ok = 0;
    for (const m of maps) if (await uploadLocalMap(m)) ok++;
    toast(`${ok} de ${maps.length} mapas enviados para a nuvem`);
    updateCloudUi();
  });
}
async function uploadLocalMap(m) {
  const { error } = await sb.from('maps').insert({ id: m.id, owner: me.id, name: m.name || 'Mapa sem nome', data: { nodes: m.nodes || [], wires: m.wires || [] } });
  if (error) return false;
  m.cloud = true; m.role = 'owner'; m.dirty = null;
  saveJSON('mm.map.' + m.id, m);
  if (doc && doc.id === m.id) { doc.cloud = true; doc.role = 'owner'; doc.dirty = null; cloudReopen(); }
  return true;
}
async function ensureCloud() {
  if (!CLOUD_ON) { toast('A nuvem não está configurada'); return false; }
  if (!me) { showLogin('Entre para salvar este mapa na nuvem.'); return false; }
  if (isCloudMap()) return true;
  flushSave();
  const ok = await uploadLocalMap(doc);
  if (!ok) toast('Não foi possível enviar o mapa para a nuvem');
  return ok;
}

// ---------------------------------------------------------------- sincronização (salvar / abrir)
const entJson = o => JSON.stringify(o);
function snapshotState() {
  return {
    nodes: new Map(persistNodes().map(n => [n.id, entJson(n)])),
    wires: new Map(doc.wires.map(w => [w.id, entJson(w)])),
    name: doc.name,
  };
}
// Diferença entre o estado atual e o último sincronizado → operações
function diffOps() {
  const L = cloud.last || { nodes: new Map(), wires: new Map(), name: doc.name };
  const ops = { un: [], dn: [], uw: [], dw: [], name: null };
  const seenN = new Set(), seenW = new Set();
  for (const n of persistNodes()) { seenN.add(n.id); if (L.nodes.get(n.id) !== entJson(n)) ops.un.push(n); }
  for (const id of L.nodes.keys()) if (!seenN.has(id)) ops.dn.push(id);
  for (const w of doc.wires) { seenW.add(w.id); if (L.wires.get(w.id) !== entJson(w)) ops.uw.push(w); }
  for (const id of L.wires.keys()) if (!seenW.has(id)) ops.dw.push(id);
  if (L.name !== doc.name) ops.name = doc.name;
  const empty = !ops.un.length && !ops.dn.length && !ops.uw.length && !ops.dw.length && ops.name == null;
  return empty ? null : ops;
}
function markDirty(ops) {
  const d = doc.dirty || (doc.dirty = { n: [], w: [], dn: [], dw: [] });
  const add = (arr, ids) => { for (const id of ids) if (!arr.includes(id)) arr.push(id); };
  add(d.n, ops.un.map(n => n.id)); add(d.w, ops.uw.map(w => w.id)); add(d.dn, ops.dn); add(d.dw, ops.dw);
  if (ops.name != null) d.name = true;
}
// chamado depois de toda mudança local (via changed())
function cloudAfterChange() {
  if (!isCloudMap() || cloud.applyingRemote) return;
  if (!canEdit()) return;
  const ops = diffOps();
  if (!ops) return;
  cloud.last = snapshotState();
  markDirty(ops);
  if (cloud.channel && cloud.channelMap === doc.id) {
    cloud.channel.send({ type: 'broadcast', event: 'ops', payload: { from: me && me.id, ops } });
  }
  scheduleCloudSave();
}
function scheduleCloudSave() {
  clearTimeout(cloud.saveT);
  cloud.saveT = setTimeout(cloudSave, 1200);
}
async function cloudSave() {
  if (!isCloudMap() || !sb || !me || !canEdit() || cloud.saving) return;
  if (!doc.dirty) return;
  // o envio grava o mapa inteiro: se outro aparelho salvou algo que ainda não chegou aqui,
  // junta primeiro (senão as mudanças dele seriam apagadas)
  if (cloud.serverAt && navigator.onLine) {
    const id0 = doc.id;
    const { data: h } = await sb.from('maps').select('updated_at').eq('id', id0).maybeSingle();
    if (!doc || doc.id !== id0 || cloud.saving) return;
    if (h && h.updated_at !== cloud.serverAt) {
      if (editing || gesture || pinch || pulling) { scheduleCloudSave(); return; }   // termina de mexer e tenta de novo
      await cloudPull();
      if (!doc || doc.id !== id0 || cloud.saving || !doc.dirty) return;
      if (cloud.serverAt !== h.updated_at) { scheduleCloudSave(); return; }       // não conseguiu juntar ainda
    }
  }
  const target = doc;
  const sentKey = JSON.stringify(target.dirty); // o que estava pendente quando o envio começou
  cloud.saving = true;
  setSaveState('Salvando na nuvem…');
  const payload = { name: target.name, data: { nodes: target === doc ? persistNodes() : target.nodes, wires: target.wires } };
  const q = target.role === 'owner'
    ? sb.from('maps').upsert({ id: target.id, owner: me.id, ...payload })
    : sb.from('maps').update(payload).eq('id', target.id);
  const { data: saved, error } = await q.select('updated_at');
  cloud.saving = false;
  if (!error && saved && saved[0] && doc === target) cloud.serverAt = saved[0].updated_at;
  if (error) {
    setSaveState(navigator.onLine ? 'Erro ao salvar na nuvem (salvo no aparelho)' : 'Sem internet — salvo no aparelho');
    clearTimeout(cloud.saveT);
    cloud.saveT = setTimeout(cloudSave, 8000);
    return;
  }
  if (doc === target) {
    if (JSON.stringify(doc.dirty) === sentKey) { doc.dirty = null; saveJSON('mm.map.' + doc.id, doc); setSaveState('Salvo na nuvem'); }
    else { scheduleCloudSave(); } // houve mudanças durante o envio: manda de novo
  }
}
// ao sair da tela/app: não espera o intervalo normal
function flushCloud() {
  if (!isCloudMap() || !sb || !me || !canEdit() || !doc.dirty) return;
  clearTimeout(cloud.saveT);
  cloudSave();
}

// Mapas da nuvem (meus + compartilhados comigo)
async function cloudList() {
  if (!sb || !me) return [];
  const { data: maps } = await sb.from('maps').select('id,name,owner,updated_at').order('updated_at', { ascending: false });
  const { data: mem } = await sb.from('map_members').select('map_id,role').eq('user_id', me.id);
  const roles = new Map((mem || []).map(m => [m.map_id, m.role]));
  return (maps || []).map(m => ({ id: m.id, name: m.name, updated: Date.parse(m.updated_at), role: m.owner === me.id ? 'owner' : roles.get(m.id) || 'viewer' }));
}
// Abre um mapa da nuvem: versão do servidor + edições locais ainda não enviadas
async function openCloudMap(id) {
  if (!sb || !me) return false;
  const { data, error } = await sb.from('maps').select('id,name,owner,data,updated_at').eq('id', id).maybeSingle();
  if (error || !data) {
    // mostra o motivo real e, se o mapa é seu e ainda não chegou na nuvem, tenta enviar a cópia do aparelho
    const why = error ? (error.message || error.code || 'erro de rede') : 'mapa ainda não está na nuvem';
    console.warn('openCloudMap', id, error || 'sem linha');
    toast('Não foi possível abrir o mapa da nuvem: ' + String(why).slice(0, 90));
    if (!error && doc && doc.id === id && doc.role === 'owner') { doc.dirty = doc.dirty || { n: doc.nodes.map(x => x.id), w: doc.wires.map(x => x.id), dn: [], dw: [], name: true }; scheduleCloudSave(); }
    return false;
  }
  let role = 'owner';
  if (data.owner !== me.id) {
    const { data: mm } = await sb.from('map_members').select('role').eq('map_id', id).eq('user_id', me.id).maybeSingle();
    role = (mm && mm.role) || 'viewer';
  }
  const local = loadJSON('mm.map.' + id, null);
  const merged = mergeWithLocal(data, local);
  const d = { ...(local || {}), id, name: merged.name, nodes: merged.nodes, wires: merged.wires, cloud: true, role, dirty: merged.dirty, updated: Date.now() };
  saveJSON('mm.map.' + id, d);
  const idx = loadJSON(IDX, {});
  idx[id] = { name: d.name, updated: d.updated };
  saveJSON(IDX, idx);
  openMap(id);
  cloud.serverAt = data.updated_at;
  if (merged.dirty && canEdit()) scheduleCloudSave();
  return true;
}
function mergeWithLocal(server, local) {
  const sd = server.data || {};
  let nodes = Array.isArray(sd.nodes) ? sd.nodes : [], wires = Array.isArray(sd.wires) ? sd.wires : [];
  let name = server.name;
  const dirty = local && local.dirty;
  if (dirty) {
    const ln = new Map((local.nodes || []).map(n => [n.id, n])), lw = new Map((local.wires || []).map(w => [w.id, w]));
    const nm = new Map(nodes.map(n => [n.id, n])), wm = new Map(wires.map(w => [w.id, w]));
    for (const id of dirty.n || []) if (ln.has(id)) nm.set(id, ln.get(id));
    for (const id of dirty.dn || []) nm.delete(id);
    for (const id of dirty.w || []) if (lw.has(id)) wm.set(id, lw.get(id));
    for (const id of dirty.dw || []) wm.delete(id);
    nodes = [...nm.values()]; wires = [...wm.values()];
    if (dirty.name) name = local.name;
  }
  return { nodes, wires, name, dirty: dirty || null };
}
// Ao abrir qualquer mapa (chamado por openMap/newMap)
function cloudOnOpen() {
  leaveChannel();
  cloud.serverAt = null;
  cloud.comments = []; cloud.people = [];
  closeComments();
  cloud.last = isCloudMap() ? snapshotState() : null;
  if (isCloudMap() && doc.dirty) { /* conferido ao salvar */ }
  updateCloudUi();
  if (isCloudMap() && sb && me) joinChannel();
}
async function cloudReopen() {
  if (!isCloudMap() || !sb || !me) return;
  flushSave();
  await openCloudMap(doc.id);
}
// Busca a versão da nuvem sem reabrir o mapa (mantém pasta, zoom e seleção).
// O tempo real só entrega o que acontece enquanto o app está conectado; isto cobre
// o que foi feito em outro aparelho enquanto este estava dormindo, minimizado ou sem internet.
let pulling = false;
async function cloudPull(manual = false) {
  if (!isCloudMap() || !sb || !me) { if (manual) toast(me ? 'Este mapa está só neste aparelho' : 'Entre na sua conta para sincronizar'); return; }
  if (pulling) return;
  if (!manual && (editing || gesture || pinch || cloud.saving)) return;   // não atrapalha quem está mexendo
  const id = doc.id;
  pulling = true;
  try {
    if (!manual) {
      const { data: h, error: he } = await sb.from('maps').select('updated_at').eq('id', id).maybeSingle();
      if (he || !h || h.updated_at === cloud.serverAt) return;
    }
    if (manual) setSaveState('Atualizando…');
    const { data, error } = await sb.from('maps').select('name,data,updated_at').eq('id', id).maybeSingle();
    if (error || !data) { if (manual) { setSaveState('Sem conexão com a nuvem'); toast('Não foi possível atualizar agora'); } return; }
    if (!doc || doc.id !== id) return;
    if (!manual && (editing || gesture || pinch)) return;                 // começou a mexer enquanto buscava: tenta na próxima
    if (manual && editing) commitEdit();
    cloud.serverAt = data.updated_at;
    const merged = mergeWithLocal(data, { nodes: persistNodes(), wires: doc.wires, name: doc.name, dirty: doc.dirty });
    const nd = normalize({ id, name: merged.name, nodes: merged.nodes, wires: merged.wires });
    // nada de novo? (posições originais dos dois lados, mesmo dentro de uma pasta)
    if (JSON.stringify([nd.nodes, nd.wires, nd.name]) === JSON.stringify([persistNodes(), doc.wires, doc.name])) {
      if (manual) { setSaveState(doc.dirty ? 'Salvando na nuvem…' : 'Salvo na nuvem'); toast('Já está tudo atualizado'); }
      return;
    }
    cloud.applyingRemote = true;
    try {
      doc.nodes = nd.nodes; doc.wires = nd.wires;
      if (doc.name !== nd.name) { doc.name = nd.name; $('#mapName').value = doc.name; }
      if (editing && !byId(editing.node.id)) cancelEdit();
      changed();
      cloud.last = snapshotState();
    } finally { cloud.applyingRemote = false; }
    if (doc.dirty && canEdit()) scheduleCloudSave();
    else setSaveState('Salvo na nuvem');
    if (manual) toast('Mapa atualizado com as mudanças da nuvem');
  } catch (e) {
    if (manual) toast('Não foi possível atualizar agora');
  } finally { pulling = false; }
}
// ao voltar para o app/janela, e de tempos em tempos enquanto ele está à vista
let lastPull = 0;
function pullSoon() {
  if (document.hidden || Date.now() - lastPull < 3000) return;
  lastPull = Date.now();
  cloudPull();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) pullSoon(); });
window.addEventListener('focus', pullSoon);
window.addEventListener('pageshow', pullSoon);
setInterval(() => { if (!document.hidden) { lastPull = Date.now(); cloudPull(); } }, 20000);
// Lista "Meus mapas": mapas deste aparelho + da nuvem (meus e compartilhados comigo)
async function openDrawer() {
  flushSave();
  const list = $('#drawer .list');
  const rows = new Map();
  const idx = loadJSON(IDX, {});
  for (const [id, m] of Object.entries(idx)) {
    const d = loadJSON('mm.map.' + id, null);
    rows.set(id, { id, name: m.name, updated: m.updated, local: true, cloud: !!(d && d.cloud), role: d && d.role });
  }
  const paint = () => {
    list.innerHTML = '';
    const items = [...rows.values()].sort((a, b) => b.updated - a.updated);
    if (!items.length) list.append(el('div', 'maprow', 'Nenhum mapa salvo.'));
    for (const m of items) {
      const row = el('div', 'maprow' + (doc && m.id === doc.id ? ' current' : ''));
      const nm = el('div', 'nm');
      const where = m.cloud ? (m.role && m.role !== 'owner' ? '👥 Compartilhado comigo · ' + ROLE_LABEL[m.role] : '☁ Na nuvem') : 'Só neste aparelho';
      nm.append(el('strong', null, m.name || 'Mapa sem nome'),
        el('small', null, where + ' · ' + new Date(m.updated).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })));
      const del = el('button', 'del', m.cloud && m.role && m.role !== 'owner' ? 'Sair' : 'Excluir');
      del.addEventListener('click', ev => { ev.stopPropagation(); removeMap(m); });
      row.append(nm, del);
      row.addEventListener('click', async () => {
        const ok = m.cloud && me && sb ? await openCloudMap(m.id) : openMap(m.id);
        if (ok) closeOverlay('#drawer'); else toast('Não foi possível abrir');
      });
      list.append(row);
    }
  };
  paint();
  openOverlay('#drawer');
  if (me && sb) {
    for (const c of await cloudList()) {
      const r = rows.get(c.id);
      rows.set(c.id, { ...(r || {}), id: c.id, name: c.name, updated: Math.max(c.updated || 0, r ? r.updated : 0), cloud: true, role: c.role, local: !!r });
    }
    paint();
  }
}
async function removeMap(m) {
  const shared = m.cloud && m.role && m.role !== 'owner';
  const msg = shared ? `Sair do mapa "${m.name}"?\nVocê perde o acesso até receber um novo convite.`
    : m.cloud ? `Excluir o mapa "${m.name}" da nuvem e deste aparelho?\nIsso apaga o mapa para todas as pessoas com acesso e não pode ser desfeito.`
      : `Excluir o mapa "${m.name}"?\nEsta ação não pode ser desfeita.`;
  if (!confirm(msg)) return;
  if (m.cloud) {
    if (!sb || !me) return toast('Entre na sua conta para excluir um mapa da nuvem');
    const q = shared ? sb.from('map_members').delete().eq('map_id', m.id).eq('user_id', me.id) : sb.from('maps').delete().eq('id', m.id);
    const { error } = await q;
    if (error) return toast('Não foi possível excluir na nuvem');
  }
  const idx = loadJSON(IDX, {});
  delete idx[m.id];
  saveJSON(IDX, idx);
  try { localStorage.removeItem('mm.map.' + m.id); localStorage.removeItem('mm.hist.' + m.id); } catch {}
  if (doc.id === m.id) {
    clearTimeout(saveT); saveT = null;
    const next = Object.entries(idx).sort((a, b) => b[1].updated - a[1].updated)[0];
    if (!next || !openMap(next[0])) newMap();
  }
  openDrawer();
}
// Mapas novos criados com a conta aberta já nascem na nuvem
function cloudOnNew() {
  if (!CLOUD_ON || !sb || !me) return;
  doc.cloud = true; doc.role = 'owner';
  doc.dirty = { n: doc.nodes.map(n => n.id), w: doc.wires.map(w => w.id), dn: [], dw: [], name: true };
  saveJSON('mm.map.' + doc.id, doc);
  cloudOnOpen();
  cloudSave();
}

// ---------------------------------------------------------------- tempo real (canal do mapa)
function joinChannel(rejoin = false) {
  if (!sb || !me || !isCloudMap()) return;
  const id = doc.id;
  const ch = sb.channel('map:' + id, { config: { private: true, presence: { key: me.id }, broadcast: { self: false } } });
  cloud.channel = ch; cloud.channelMap = id;
  ch.wasDown = rejoin;
  ch.on('broadcast', { event: 'ops' }, ({ payload }) => applyRemoteOps(id, payload && payload.ops))
    .on('broadcast', { event: 'move' }, ({ payload }) => applyRemoteMove(id, payload))
    .on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState();
      cloud.peers = new Map();
      for (const [key, arr] of Object.entries(st)) if (key !== me.id && arr && arr[0]) cloud.peers.set(key, arr[arr.length - 1]);
      renderPeersUi();
      render();
    })
    .subscribe(status => {
      if (cloud.channel !== ch) return;
      if (status === 'SUBSCRIBED') {
        trackPresence(); setSaveState(doc.dirty ? 'Salvando na nuvem…' : 'Salvo na nuvem');
        if (ch.wasDown) cloudPull();          // reconectou: busca o que passou enquanto estava fora
        ch.wasDown = false;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        ch.wasDown = true;
        setSaveState('Tempo real indisponível — salvando na nuvem');
        // tenta entrar de novo no canal daqui a pouco
        clearTimeout(cloud.rejoinT);
        cloud.rejoinT = setTimeout(() => {
          if (cloud.channel !== ch || !isCloudMap() || doc.id !== id) return;
          cloud.channel = null;
          try { sb.removeChannel(ch); } catch {}
          joinChannel(true);
        }, 5000);
      }
    });
  if (!rejoin) loadComments();
}
function leaveChannel() {
  clearTimeout(cloud.rejoinT);
  const old = cloud.channel;
  cloud.channel = null;
  if (old && sb) { try { sb.removeChannel(old); } catch {} }
  cloud.channel = null; cloud.channelMap = null; cloud.peers = new Map();
  if (cloud.commentsSub && sb) { try { sb.removeChannel(cloud.commentsSub); } catch {} }
  cloud.commentsSub = null;
  renderPeersUi();
}
function applyRemoteOps(mapId, ops) {
  if (!ops || !doc || doc.id !== mapId) return;
  cloud.applyingRemote = true;
  try {
    // grupos chegam à parte (a normalização sozinha descartaria membros que não vieram juntos)
    const incoming = (ops.un || []).filter(n => n && n.id && TYPES.includes(n.type));
    const groups = incoming.filter(n => n.type === 'group').map(g => {
      const o = { id: String(g.id), type: 'group', x: 0, y: 0, w: 0, h: 0, text: String(g.text ?? '').slice(0, 200),
        color: isHex(g.color) ? g.color : GROUP_COLORS[0], style: GROUP_STYLES[g.style] ? g.style : 'box',
        members: Array.isArray(g.members) ? g.members.map(String) : [] };
      if (g.hidden) o.hidden = true;
      if (g.locked) o.locked = true;
      if (g.parent) o.parent = String(g.parent).slice(0, 64);
      return o;
    });
    const clean = [...groups, ...normalize({ nodes: incoming.filter(n => n.type !== 'group'), wires: [] }).nodes];
    const byIdLocal = new Map(doc.nodes.map((n, i) => [n.id, i]));
    for (const n of clean) {
      if (byIdLocal.has(n.id)) doc.nodes[byIdLocal.get(n.id)] = n;
      else if (n.type === 'group') doc.nodes.unshift(n); else doc.nodes.push(n);
    }
    const del = new Set(ops.dn || []);
    if (del.size) doc.nodes = doc.nodes.filter(n => !del.has(n.id));
    const wm = new Map(doc.wires.map((w, i) => [w.id, i]));
    for (const w of ops.uw || []) {
      if (!w || !w.id || !w.from || !w.to) continue;
      const o = { ...wireStyleOf(w), id: String(w.id), from: String(w.from), to: String(w.to), fp: w.fp | 0, tp: w.tp | 0 };
      if (wm.has(o.id)) doc.wires[wm.get(o.id)] = o; else doc.wires.push(o);
    }
    const dw = new Set(ops.dw || []);
    if (dw.size) doc.wires = doc.wires.filter(w => !dw.has(w.id));
    if (ops.name != null) { doc.name = String(ops.name).slice(0, 80); $('#mapName').value = doc.name; }
    if (editing && !byId(editing.node.id)) cancelEdit();
    changed();
    cloud.last = snapshotState();
  } finally { cloud.applyingRemote = false; }
}
function applyRemoteMove(mapId, p) {
  if (!p || !doc || doc.id !== mapId || !Array.isArray(p.pos)) return;
  for (const [id, x, y] of p.pos) { const n = byId(id); if (n && isFinite(x) && isFinite(y)) { n.x = x; n.y = y; } }
  render();
}
let moveSendT = 0;
function broadcastMove(starts) {
  if (!cloud.channel || !canEdit() || Date.now() - moveSendT < 60) return;
  moveSendT = Date.now();
  const pos = [];
  for (const [id] of starts) { const n = byId(id); if (n && !folderSwap.has(id)) pos.push([id, Math.round(n.x * 10) / 10, Math.round(n.y * 10) / 10]); }
  cloud.channel.send({ type: 'broadcast', event: 'move', payload: { pos } });
}
let presT = 0, presCursor = null;
function trackPresence(cursor) {
  if (cursor) presCursor = cursor;
  if (!cloud.channel || !me) return;
  const now = Date.now();
  if (now - presT < 70) return;
  presT = now;
  cloud.channel.track({ id: me.id, name: me.name, color: peerColor(me.id), x: presCursor ? presCursor.x : null, y: presCursor ? presCursor.y : null, sel: [...sel].slice(0, 50), folder: currentFolder, t: now }).catch(() => {});
}
function renderPeersUi() {
  const box = $('#peers');
  if (!box) return;
  box.innerHTML = '';
  for (const [id, p] of cloud.peers) {
    const s = el('span', 'peer', (p.name || '?').slice(0, 1).toUpperCase());
    s.style.background = p.color || peerColor(id);
    s.title = (p.name || 'Alguém') + ' está neste mapa';
    box.append(s);
  }
}
// cursores e seleções das outras pessoas (desenhados por cima do mapa)
function drawPeers(g) {
  if (!cloud.peers.size) return;
  const z = view.z;
  for (const [id, p] of cloud.peers) {
    if ((p.folder || null) !== (currentFolder || null)) continue;
    const col = p.color || peerColor(id);
    for (const sid of p.sel || []) {
      const n = byId(sid);
      if (!n || isHidden(n)) continue;
      g.setLineDash([6 / z, 4 / z]);
      g.lineWidth = 2 / z;
      g.strokeStyle = col;
      g.strokeRect(n.x - 4 / z, n.y - 4 / z, n.w + 8 / z, n.h + 8 / z);
      g.setLineDash([]);
    }
    if (p.x == null || p.y == null) continue;
    g.save();
    g.translate(p.x, p.y);
    g.scale(1 / z, 1 / z);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(0, 16); g.lineTo(4.5, 12); g.lineTo(8, 19); g.lineTo(10.5, 18); g.lineTo(7, 11); g.lineTo(12.5, 11); g.closePath();
    g.fillStyle = col; g.fill();
    g.lineWidth = 1.2; g.strokeStyle = '#fff'; g.stroke();
    g.font = `600 11px ${FONT}`;
    const label = (p.name || 'Alguém').slice(0, 24), tw = g.measureText(label).width + 10;
    g.fillStyle = col;
    g.fillRect(12, 16, tw, 17);
    g.fillStyle = '#fff';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(label, 17, 25);
    g.restore();
  }
}

// ---------------------------------------------------------------- compartilhar
async function showShare() {
  if (!CLOUD_ON) return toast('A nuvem não está configurada');
  if (!me) return showLogin('Entre para compartilhar este mapa.');
  if (!isCloudMap()) {
    const body = modal('Compartilhar', '<p>Este mapa está só neste aparelho. Para compartilhar, ele precisa ir para a nuvem.</p><div class="row-end"><button class="btn primary" id="shUp">Salvar na nuvem e compartilhar</button></div>');
    body.querySelector('#shUp').addEventListener('click', async () => { if (await ensureCloud()) showShare(); });
    return;
  }
  const role = myRole();
  const body = modal('Compartilhar “' + doc.name + '”', '<p class="muted">Carregando…</p>');
  const { data: people } = await sb.rpc('map_people', { m: doc.id });
  cloud.people = people || [];
  let html = '<h4 class="sh">Pessoas com acesso</h4>';
  html += (cloud.people || []).map(p => {
    const you = p.user_id === me.id ? ' (você)' : '';
    const ctl = role === 'owner' && p.role !== 'owner'
      ? `<select data-p="${p.user_id}">${['viewer', 'commenter', 'editor'].map(r => `<option value="${r}" ${r === p.role ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select><button class="btn" data-rm="${p.user_id}">Remover</button>`
      : `<span class="muted">${ROLE_LABEL[p.role] || p.role}</span>`;
    return `<div class="hrow"><span><b>${esc(p.display_name || 'Pessoa')}</b>${you}</span><span class="ctl">${ctl}</span></div>`;
  }).join('');
  if (role === 'owner') {
    const { data: links } = await sb.from('map_links').select('token,role,created_at').eq('map_id', doc.id).eq('revoked', false).order('created_at');
    html += '<h4 class="sh">Links de convite</h4><p class="muted">Quem abrir o link e entrar com o e-mail ganha o acesso escolhido.</p>';
    html += (links || []).map(l => `<div class="hrow"><span>${ROLE_LABEL[l.role]}</span><span class="ctl"><button class="btn" data-copy="${l.token}">Copiar link</button><button class="btn" data-rev="${l.token}">Desativar</button></span></div>`).join('') || '<p class="muted">Nenhum link ativo.</p>';
    html += '<div class="row-end" style="gap:8px"><select id="shRole"><option value="viewer">Só pode ver</option><option value="commenter">Pode comentar</option><option value="editor" selected>Pode editar</option></select><button class="btn primary" id="shNew">Criar link</button></div>';
  } else {
    html += `<p>Você tem acesso como <b>${ROLE_LABEL[role]}</b>.</p><div class="row-end"><button class="btn" id="shLeave">Sair deste mapa</button></div>`;
  }
  body.innerHTML = html;
  const linkUrl = t => location.origin + location.pathname + '?entrar=' + t;
  const copy = async t => {
    try { await navigator.clipboard.writeText(linkUrl(t)); toast('Link copiado'); }
    catch { prompt('Copie o link:', linkUrl(t)); }
  };
  body.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => copy(b.dataset.copy)));
  body.querySelectorAll('[data-rev]').forEach(b => b.addEventListener('click', async () => {
    await sb.from('map_links').update({ revoked: true }).eq('token', b.dataset.rev);
    toast('Link desativado'); showShare();
  }));
  body.querySelectorAll('[data-p]').forEach(s => s.addEventListener('change', async () => {
    const { error } = await sb.from('map_members').update({ role: s.value }).eq('map_id', doc.id).eq('user_id', s.dataset.p);
    toast(error ? 'Não foi possível alterar' : 'Acesso alterado');
  }));
  body.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Remover o acesso desta pessoa?')) return;
    await sb.from('map_members').delete().eq('map_id', doc.id).eq('user_id', b.dataset.rm);
    showShare();
  }));
  const nb = body.querySelector('#shNew');
  if (nb) nb.addEventListener('click', async () => {
    const r = body.querySelector('#shRole').value;
    const { data, error } = await sb.from('map_links').insert({ map_id: doc.id, role: r, created_by: me.id }).select('token').single();
    if (error) return toast('Não foi possível criar o link');
    await copy(data.token);
    showShare();
  });
  const lv = body.querySelector('#shLeave');
  if (lv) lv.addEventListener('click', async () => {
    if (!confirm('Sair deste mapa? Você perde o acesso até receber um novo convite.')) return;
    await sb.from('map_members').delete().eq('map_id', doc.id).eq('user_id', me.id);
    closeOverlay('#modal');
    const id = doc.id;
    const idx = loadJSON(IDX, {}); delete idx[id]; saveJSON(IDX, idx);
    localStorage.removeItem('mm.map.' + id);
    newMap();
    toast('Você saiu do mapa');
  });
}

// ---------------------------------------------------------------- comentários e @menções
async function loadComments() {
  if (!sb || !me || !isCloudMap()) return;
  const id = doc.id;
  const [{ data: cs }, { data: people }] = await Promise.all([
    sb.from('comments').select('*').eq('map_id', id).order('created_at'),
    sb.rpc('map_people', { m: id }),
  ]);
  if (!doc || doc.id !== id) return;
  cloud.comments = cs || [];
  cloud.people = people || [];
  if (cloud.commentsSub) { try { sb.removeChannel(cloud.commentsSub); } catch {} }
  cloud.commentsSub = sb.channel('comments:' + id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: 'map_id=eq.' + id }, payload => {
      if (!doc || doc.id !== id) return;
      const row = payload.new && payload.new.id ? payload.new : null;
      const oldId = payload.old && payload.old.id;
      if (payload.eventType === 'DELETE') cloud.comments = cloud.comments.filter(c => c.id !== oldId);
      else if (row) {
        const i = cloud.comments.findIndex(c => c.id === row.id);
        if (i >= 0) cloud.comments[i] = row; else cloud.comments.push(row);
        if (payload.eventType === 'INSERT' && row.author !== me.id && (row.mentions || []).includes(me.id)) toast('💬 Você foi mencionado num comentário');
      }
      renderComments(); updateCommentsBadge(); render();
    })
    .subscribe();
  renderComments(); updateCommentsBadge(); render();
}
const personName = uidv => { const p = cloud.people.find(x => x.user_id === uidv); return p ? p.display_name || 'Pessoa' : 'Pessoa'; };
function commentCount(nodeId) { let k = 0; for (const c of cloud.comments) if (c.node_id === nodeId && !c.resolved) k++; return k; }
function drawCommentBadge(g, n) {
  const k = commentCount(n.id);
  if (!k) return;
  const x = n.x + n.w - 2, y = n.y + n.h - 2;
  g.save();
  g.beginPath();
  rr(g, x - 11, y - 9, 22, 16, 4);
  g.fillStyle = '#FFD43B'; g.fill();
  g.lineWidth = 1; g.strokeStyle = '#7A5A10'; g.stroke();
  g.beginPath(); g.moveTo(x - 6, y + 7); g.lineTo(x - 3, y + 11); g.lineTo(x - 1, y + 7); g.fillStyle = '#FFD43B'; g.fill();
  g.fillStyle = '#3A2A00'; g.font = `700 10px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(k), x, y - 0.5);
  g.restore();
}
const seenKey = () => 'mm.mentionsSeen.' + (me ? me.id : '') + '.' + (doc ? doc.id : '');
function unreadMentions() {
  if (!me) return 0;
  const seen = +localStorage.getItem(seenKey()) || 0;
  return cloud.comments.filter(c => c.author !== me.id && (c.mentions || []).includes(me.id) && Date.parse(c.created_at) > seen).length;
}
function updateCommentsBadge() {
  const b = $('#commentsBtn');
  if (!b) return;
  const open = cloud.comments.filter(c => !c.resolved).length, unread = unreadMentions();
  b.querySelector('b').textContent = open ? String(open) : '';
  b.classList.toggle('alert', unread > 0);
  b.title = unread ? `${unread} menção(ões) nova(s) para você` : 'Comentários';
}
async function checkMentions() {
  if (!sb || !me) return;
  const since = localStorage.getItem('mm.mentionsGlobal.' + me.id) || new Date(0).toISOString();
  const { data } = await sb.from('comments').select('id,map_id,created_at').contains('mentions', [me.id]).neq('author', me.id).gt('created_at', since).limit(50);
  localStorage.setItem('mm.mentionsGlobal.' + me.id, new Date().toISOString());
  if (data && data.length) toast(`💬 Você foi mencionado em ${data.length} comentário(s)`);
}

let cmFilter = 'open', cmTarget = null, cmMentions = new Map();
function openComments(target) {
  if (!isCloudMap()) {
    if (!CLOUD_ON) return toast('A nuvem não está configurada');
    return me ? showShare() : showLogin('Entre e salve o mapa na nuvem para usar comentários.');
  }
  cmTarget = target !== undefined ? target : (single() ? single().id : null);
  $('#comments').hidden = false;
  localStorage.setItem(seenKey(), String(Date.now()));
  renderComments();
  updateCommentsBadge();
  if (canComment()) setTimeout(() => $('#cmText').focus(), 50);
}
function closeComments() { const p = $('#comments'); if (p) p.hidden = true; hideMentionList(); }
function renderComments() {
  const panel = $('#comments');
  if (!panel || panel.hidden) return;
  const list = panel.querySelector('.cmlist');
  list.innerHTML = '';
  let cs = cloud.comments.slice();
  if (cmFilter === 'open') cs = cs.filter(c => !c.resolved);
  if (cmFilter === 'me') cs = cs.filter(c => me && (c.mentions || []).includes(me.id));
  if (!cs.length) list.append(el('p', 'muted', cmFilter === 'me' ? 'Nenhuma menção a você.' : 'Nenhum comentário ainda.'));
  for (const c of cs) {
    const item = el('div', 'cm' + (c.resolved ? ' done' : '') + (me && (c.mentions || []).includes(me.id) ? ' mine' : ''));
    const n = c.node_id ? byId(c.node_id) : null;
    const head = el('div', 'cmh');
    head.append(el('b', null, personName(c.author)), el('small', null, new Date(c.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })));
    item.append(head);
    if (c.node_id) {
      const a = el('button', 'cmon', '↳ ' + (n ? (n.text || TYPE_LABEL[n.type] || 'objeto').split('\n')[0].slice(0, 40) : 'objeto apagado'));
      if (n) a.addEventListener('click', () => { sel = new Set([n.id]); const z = Math.max(view.z, 0.9); animateView({ z, x: W / 2 - (n.x + n.w / 2) * z, y: H / 2 - (n.y + n.h / 2) * z }); updateStatus(); });
      item.append(a);
    }
    const body = el('div', 'cmb');
    // destaca as @menções
    const names = (c.mentions || []).map(personName);
    let html = esc(c.body);
    for (const nm of names) html = html.split('@' + esc(nm)).join(`<span class="at">@${esc(nm)}</span>`);
    body.innerHTML = html;
    item.append(body);
    const acts = el('div', 'cma');
    const mine = me && c.author === me.id;
    if (mine || ['owner', 'editor'].includes(myRole())) {
      const r = el('button', null, c.resolved ? 'Reabrir' : '✓ Resolver');
      r.addEventListener('click', async () => { await sb.from('comments').update({ resolved: !c.resolved }).eq('id', c.id); });
      acts.append(r);
    }
    if (mine || myRole() === 'owner') {
      const d = el('button', null, 'Excluir');
      d.addEventListener('click', async () => { if (confirm('Excluir este comentário?')) await sb.from('comments').delete().eq('id', c.id); });
      acts.append(d);
    }
    item.append(acts);
    list.append(item);
  }
  const t = cmTarget ? byId(cmTarget) : null;
  panel.querySelector('.cmtarget').textContent = t ? 'Sobre: ' + ((t.text || TYPE_LABEL[t.type] || 'objeto').split('\n')[0].slice(0, 40)) : 'Comentário geral do mapa';
  panel.querySelector('.cmnew').hidden = !canComment();
  panel.querySelectorAll('[data-cf]').forEach(b => b.classList.toggle('on', b.dataset.cf === cmFilter));
}
async function sendComment() {
  const ta = $('#cmText');
  const text = ta.value.trim();
  if (!text) return;
  if (!canComment()) return toast('Você não pode comentar neste mapa');
  const mentions = [...cmMentions.entries()].filter(([name]) => text.includes('@' + name)).map(([, id]) => id);
  const { error } = await sb.from('comments').insert({ map_id: doc.id, node_id: cmTarget, author: me.id, body: text.slice(0, 4000), mentions: [...new Set(mentions)] });
  if (error) return toast('Não foi possível enviar o comentário');
  ta.value = '';
  cmMentions = new Map();
  hideMentionList();
}
// lista de @menções enquanto digita
function onCommentInput() {
  const ta = $('#cmText');
  const before = ta.value.slice(0, ta.selectionStart);
  const m = before.match(/@([^\s@]{0,30})$/);
  if (!m) return hideMentionList();
  const q = normTxt(m[1]);
  const opts = cloud.people.filter(p => p.user_id !== me.id && normTxt(p.display_name).includes(q)).slice(0, 6);
  const box = $('#cmMention');
  box.innerHTML = '';
  if (!opts.length) return hideMentionList();
  for (const p of opts) {
    const b = el('button', null, '@' + (p.display_name || 'Pessoa'));
    b.addEventListener('mousedown', e => {
      e.preventDefault();
      const name = p.display_name || 'Pessoa';
      const start = ta.selectionStart - m[0].length;
      ta.value = ta.value.slice(0, start) + '@' + name + ' ' + ta.value.slice(ta.selectionStart);
      ta.selectionStart = ta.selectionEnd = start + name.length + 2;
      cmMentions.set(name, p.user_id);
      hideMentionList();
      ta.focus();
    });
    box.append(b);
  }
  box.hidden = false;
}
function hideMentionList() { const b = $('#cmMention'); if (b) b.hidden = true; }

function buildCloud() {
  $('#accountBtn').addEventListener('click', e => accountMenu(e.currentTarget));
  $('#shareBtn').addEventListener('click', showShare);
  $('#commentsBtn').addEventListener('click', () => ($('#comments').hidden ? openComments() : closeComments()));
  $('#syncBtn').addEventListener('click', () => { flushSave(); cloudPull(true); });
  const p = $('#comments');
  p.querySelector('[data-cx]').addEventListener('click', closeComments);
  p.querySelectorAll('[data-cf]').forEach(b => b.addEventListener('click', () => { cmFilter = b.dataset.cf; renderComments(); }));
  p.querySelector('.cmtarget').addEventListener('click', () => { cmTarget = null; renderComments(); });
  const ta = $('#cmText');
  ta.addEventListener('input', onCommentInput);
  ta.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendComment(); }
    if (e.key === 'Escape') hideMentionList();
  });
  $('#cmSend').addEventListener('click', sendComment);
}

// ================================================================ PASTAS
// Cada ideia pode funcionar como pasta: 3 cliques (ou menu) entram nela.
// Lá dentro aparecem só o CAMINHO até ela (ideias ligadas antes dela, no mesmo
// nível) e o CONTEÚDO dela (objetos com n.parent = id da ideia). O que é criado
// lá dentro ganha n.parent automaticamente. Pastas podem ter pastas dentro.
let currentFolder = null;          // id da ideia-pasta aberta (null = mapa principal)
let folderViews = {};              // vista (zoom/posição) guardada por nível
let lastDouble = null;             // { t, id } do último duplo clique numa ideia

const folderOf = n => (n && n.parent && byId(n.parent) ? n.parent : null);
function folderVisibleSet() {
  if (currentFolder && !byId(currentFolder)) { currentFolder = null; updateCrumbs(); }
  const vis = new Set();
  if (!currentFolder) {
    for (const n of doc.nodes) if (!folderOf(n)) vis.add(n.id);
    return vis;
  }
  const f = byId(currentFolder);
  vis.add(f.id);
  for (const n of doc.nodes) if (n.parent === f.id) vis.add(n.id);
  // caminho: tudo o que leva até a pasta por fios, no mesmo nível dela
  const lvl = folderOf(f);
  const stack = [f.id];
  while (stack.length) {
    const id = stack.pop();
    for (const w of doc.wires) {
      if (w.to !== id) continue;
      const a = byId(w.from);
      if (a && folderOf(a) === lvl && !vis.has(a.id)) { vis.add(a.id); stack.push(a.id); }
    }
  }
  return vis;
}
// conteúdo de uma pasta, incluindo pastas dentro de pastas
function folderContentsDeep(id, acc = new Set()) {
  for (const n of doc.nodes) if (n.parent === id && !acc.has(n.id)) { acc.add(n.id); folderContentsDeep(n.id, acc); }
  return acc;
}
function withFolderContents(ids) {
  for (const id of [...ids]) folderContentsDeep(id, ids);
  return ids;
}
function folderCounts() {
  const m = new Map();
  for (const n of doc.nodes) if (n.parent) m.set(n.parent, (m.get(n.parent) || 0) + 1);
  return m;
}
function drawFolderBadge(g, n, k) {
  const x = n.x + 3, y = n.y + n.h - 3;
  g.save();
  g.beginPath();
  g.moveTo(x - 9, y - 6); g.lineTo(x - 3, y - 6); g.lineTo(x - 1, y - 4); g.lineTo(x + 10, y - 4);
  g.lineTo(x + 10, y + 7); g.lineTo(x - 9, y + 7); g.closePath();
  g.fillStyle = '#F2C94C'; g.fill();
  g.lineWidth = 1; g.strokeStyle = '#7A5A10'; g.stroke();
  g.fillStyle = '#3A2A00'; g.font = `700 9px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(k > 99 ? '99+' : String(k), x + 0.5, y + 2);
  g.restore();
}

function saveFolderView() { folderViews[currentFolder || ''] = { ...view }; }
function goToFolder(id, focus) {
  if (editing) commitEdit();
  hideMenus();
  saveFolderView();
  restoreSwap();
  currentFolder = id || null;
  sel = new Set(focus ? [focus] : []); selWire = null;
  computeHidden();
  syncFolderLayout();
  updateCrumbs();
  const saved = folderViews[currentFolder || ''];
  if (saved) animateView(saved);
  else {
    const vis = doc.nodes.filter(n => !isHidden(n));
    if (vis.length) fitView(true, vis);
  }
  updateStatus();
  render();
  if (cloud.channel) trackPresence();
}
function enterFolder(n) {
  if (!n || n.type !== 'idea') return toast('Só ideias funcionam como pasta');
  goToFolder(n.id);
  if (!doc.nodes.some(m => m.parent === n.id)) toast(`Pasta “${(n.text || 'ideia').split('\n')[0].slice(0, 30)}” vazia — o que você criar aqui fica dentro dela`);
}
function folderUp() {
  if (!currentFolder) return;
  const f = byId(currentFolder);
  goToFolder(folderOf(f), f && f.id);
}
// trilha no topo: 🏠 Mapa › Pasta › Subpasta   [← Sair]
function updateCrumbs() {
  const bar = $('#crumbs');
  if (!bar) return;
  document.body.classList.toggle('infolder', !!currentFolder);
  bar.hidden = !currentFolder;
  if (!currentFolder) return;
  const chain = [];
  for (let f = byId(currentFolder), guard = 0; f && guard < 50; f = byId(folderOf(f)), guard++) chain.unshift(f);
  bar.innerHTML = '';
  const home = el('button', 'crumb', '🏠 ' + (doc.name || 'Mapa'));
  home.addEventListener('click', () => goToFolder(null, chain[0] && chain[0].id));
  bar.append(home);
  chain.forEach((f, i) => {
    bar.append(el('span', 'sep', '›'));
    const b = el('button', 'crumb' + (i === chain.length - 1 ? ' here' : ''), '📂 ' + ((f.text || 'ideia').split('\n')[0].slice(0, 24)));
    if (i < chain.length - 1) b.addEventListener('click', () => goToFolder(f.id, chain[i + 1].id));
    bar.append(b);
  });
  const out = el('button', 'crumb out', '← Sair');
  out.title = 'Sair da pasta (Esc)';
  out.addEventListener('click', folderUp);
  bar.append(out);
}

// ---------- Arrumação própria de cada pasta
// As ideias do CAMINHO (que pertencem ao nível de fora) podem ser reposicionadas
// e travadas/destravadas dentro da pasta sem mudar o mapa de fora: a pasta guarda
// pasta.layout = { id: [x, y, travado(1/0)] }. Enquanto a pasta está aberta, essas
// ideias são alteradas só na memória; tudo o que é salvo/enviado usa o ORIGINAL.
let folderSwap = new Map();        // id → { obj, x, y, locked }  (estado original)
function setLock(n, v) { if (v) n.locked = true; else delete n.locked; }
function persistNodes() {
  if (!folderSwap.size) return doc.nodes;
  return doc.nodes.map(n => {
    const e = folderSwap.get(n.id);
    if (!e || e.obj !== n) return n;
    const o = { ...n, x: e.x, y: e.y }; setLock(o, e.locked); return o;
  });
}
function restoreSwap() {
  for (const [id, e] of folderSwap) { const n = byId(id); if (n && n === e.obj) { n.x = e.x; n.y = e.y; setLock(n, e.locked); } }
  folderSwap = new Map();
}
function syncFolderLayout() {
  const F = currentFolder && byId(currentFolder);
  if (!F) { if (folderSwap.size) restoreSwap(); return; }
  const lay = F.layout || {};
  const keep = new Set();
  for (const n of doc.nodes) {
    if (isHidden(n) || n.parent === F.id) continue;   // só o caminho (nível de fora)
    keep.add(n.id);
    const e = folderSwap.get(n.id);
    const q = lay[n.id];
    if (!e || e.obj !== n) {
      // entrando (ou o objeto foi trocado por desfazer/nuvem): guarda o original e aplica o estado da pasta
      folderSwap.set(n.id, { obj: n, x: n.x, y: n.y, locked: !!n.locked });
      if (q) { n.x = q[0]; n.y = q[1]; if (q.length > 2) setLock(n, !!q[2]); }
    } else {
      // já estava aplicado: se mudou aqui dentro (lugar ou trava), grava na pasta
      const cx = q ? q[0] : e.x, cy = q ? q[1] : e.y, cl = q && q.length > 2 ? !!q[2] : e.locked;
      if (Math.abs(n.x - cx) > 0.01 || Math.abs(n.y - cy) > 0.01 || !!n.locked !== cl) {
        if (!F.layout) F.layout = {};
        F.layout[n.id] = [Math.round(n.x * 10) / 10, Math.round(n.y * 10) / 10, n.locked ? 1 : 0];
      }
    }
  }
  // o que deixou de ser caminho volta ao original
  for (const [id, e] of [...folderSwap]) {
    if (keep.has(id)) continue;
    const n = byId(id);
    if (n && n === e.obj) { n.x = e.x; n.y = e.y; setLock(n, e.locked); }
    folderSwap.delete(id);
  }
}

// 3º clique: o 2º clique abriu a edição do texto; o 3º cai na caixa de edição
editor.addEventListener('pointerdown', e => {
  if (!editing || !lastDouble) return;
  if (performance.now() - lastDouble.t < 550 && editing.node.id === lastDouble.id && editing.node.type === 'idea') {
    e.preventDefault();
    const n = editing.node;
    lastDouble = null;
    cancelEdit();
    enterFolder(n);
  }
});

// ---------------------------------------------------------------- início
buildRibbon();
buildFloatbars();
buildAi();
buildCloud();
const curId = (() => { try { return localStorage.getItem(CUR); } catch { return null; } })();
if (!(curId && openMap(curId))) {
  const idx = loadJSON(IDX, {});
  const first = Object.entries(idx).sort((a, b) => b[1].updated - a[1].updated)[0];
  if (!(first && openMap(first[0]))) newMap(true);
}
new ResizeObserver(resize).observe(stage);
window.addEventListener('resize', resize);
// ao sair da tela ou do app: confirma o texto que está sendo digitado, salva no aparelho e sincroniza com a nuvem
function saveEverything() { if (editing) commitEdit(); flushSave(); flushCloud(); }
window.addEventListener('pagehide', saveEverything);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveEverything(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { wrapCache.clear(); doc.nodes.forEach(measure); render(); });
canvas.tabIndex = 0;
updateStatus();
cloudInit();
})();
