'use strict';
/*
 * Jeu d'icônes maison — style trait 1,75 px, grille 24×24.
 * Chaque icône est une liste de tracés SVG séparés par « | ».
 * Les icônes sont construites avec createElementNS (aucun innerHTML).
 */
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5|M5 9.5V21h14V9.5|M10 21v-6h4v6',
  calendar: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M3 10h18|M8 2v4|M16 2v4',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z|M8.5 14 7 22l5-3 5 3-1.5-8',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z|M14 3v5h5|M9 13h6|M9 17h6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7v5l3 2',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z|M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  exam: 'M9 3h6v3H9z|M15 4.5h2a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2|M9 13l2 2 4-4',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4|M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z|M16 14.5h.01',
  inbox: 'M3 13h5l1.5 3h5l1.5-3h5|M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z',
  flag: 'M4 21V4|M4 4h13l-2.5 4L17 12H4',
  message: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z|M10 19a2 2 0 0 0 4 0',
  megaphone: 'M3 10v4h3l8 4.5V5.5L6 10z|M18 9a3.5 3.5 0 0 1 0 6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M4 21a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M2 21a7 7 0 0 1 14 0|M16 3.5a4 4 0 0 1 0 7|M18 14a6 6 0 0 1 4 7',
  userCheck: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M2 21a7 7 0 0 1 14 0|M16 11l2 2 4-4',
  settings: 'M4 6h9|M17 6h3|M15 4v4|M4 12h3|M11 12h9|M9 10v4|M4 18h11|M19 18h1|M17 16v4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z|M20 20l-4-4',
  check: 'M5 12.5l4.5 4.5L19 7',
  checks: 'M2 12.5l4.5 4.5L15 8|M11 16l1 1 9-10',
  x: 'M6 6l12 12|M18 6 6 18',
  plus: 'M12 5v14|M5 12h14',
  minus: 'M5 12h14',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  arrowUp: 'M12 19V5|M6 11l6-6 6 6',
  arrowDown: 'M12 5v14|M6 13l6 6 6-6',
  arrowRight: 'M5 12h14|M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5|M11 6l-6 6 6 6',
  logout: 'M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3|M16 17l5-5-5-5|M21 12H9',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M12 2v2|M12 20v2|M4.9 4.9l1.4 1.4|M17.7 17.7l1.4 1.4|M2 12h2|M20 12h2|M4.9 19.1l1.4-1.4|M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18|M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9|M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6|M9.9 9.9a3 3 0 0 0 4.2 4.2',
  lock: 'M5 11h14v10H5z|M8 11V7a4 4 0 0 1 8 0v4',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z|M9 12l2 2 4-4',
  download: 'M12 4v11|M7 10l5 5 5-5|M5 20h14',
  upload: 'M12 20V9|M7 14l5-5 5 5|M5 4h14',
  printer: 'M7 9V3h10v6|M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2|M7 14h10v7H7z',
  paperclip: 'M21 11.5l-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.3 3.3 0 0 1 4.7 4.7L10.2 17.7a1.7 1.7 0 0 1-2.4-2.4L15.5 7.6',
  send: 'M22 2 11 13|M22 2l-7 20-4-9-9-4z',
  qr: 'M3 3h7v7H3z|M14 3h7v7h-7z|M3 14h7v7H3z|M14 14h3v3h-3z|M20 14v.01|M14 20v.01|M18 18h3v3h-3z|M6 6.5h.01|M17.5 6.5h.01|M6 17.5h.01',
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z',
  mail: 'M3 6h18v12H3z|M3 6l9 7 9-7',
  smartphone: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z|M11 18h2',
  card: 'M2 6h20v12H2z|M2 10h20|M6 15h4',
  cash: 'M2 7h20v10H2z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M6 12h.01|M18 12h.01',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z|M12 9v4|M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 16v-4|M12 8h.01',
  checkCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M8 12l3 3 5-6',
  xCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M15 9l-6 6|M9 9l6 6',
  wifiOff: 'M2 2l20 20|M8.5 16.5a5 5 0 0 1 7 0|M5 13a10 10 0 0 1 5.2-2.8|M19 13a10 10 0 0 0-2.1-1.5|M2 8.8A15 15 0 0 1 6.3 6|M22 8.8A15 15 0 0 0 11.6 5|M12 20h.01',
  leaf: 'M20 4c-8 0-14 4-14 12v4h4c8 0 10-8 10-16z|M4 20 14 10',
  door: 'M4 21h16|M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17|M14 12h.01',
  layers: 'M12 3 2 8l10 5 10-5z|M2 12.5l10 5 10-5|M2 17l10 5 10-5',
  scale: 'M12 3v18|M6 21h12|M4 7h16|M7 7l-3 7a3 3 0 0 0 6 0z|M17 7l-3 7a3 3 0 0 0 6 0z',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8|M3 3v5h5|M12 7v5l3 2',
  key: 'M15.5 14.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z|M11.5 12.5 3 21|M6 18l2 2|M8.5 15.5l2 2',
  grid: 'M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z',
  more: 'M5 12h.01|M12 12h.01|M19 12h.01',
  menu: 'M4 6h16|M4 12h16|M4 18h16',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  edit: 'M4 20h4L19 9l-4-4L4 16z|M13 7l4 4',
  trash: 'M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3',
  video: 'M3 6h12v12H3z|M15 10l6-3v10l-6-3z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1|M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  slides: 'M3 4h18|M4 4v11h16V4|M12 15v5|M8 20h8',
  pin: 'M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z|M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  refresh: 'M20 11A8 8 0 0 0 5.6 6.4L3 9|M3 4v5h5|M4 13a8 8 0 0 0 14.4 4.6L21 15|M21 20v-5h-5',
  chart: 'M3 3v18h18|M7 15l4-4 3 3 6-6',
  bars: 'M4 20V10|M10 20V4|M16 20v-7|M22 20H2',
  graduation: 'M2 9l10-5 10 5-10 5z|M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5|M22 9v6',
  pen: 'M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  building: 'M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16|M14 9h5a1 1 0 0 1 1 1v11|M2 21h20|M8 8h2|M8 12h2|M8 16h2',
  external: 'M14 4h6v6|M20 4l-9 9|M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  calc: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z|M8 7h8v3H8z|M8.5 14h.01|M12 14h.01|M15.5 14h.01|M8.5 17.5h.01|M12 17.5h.01|M15.5 17.5h.01',
  briefcase: 'M3 7h18v13H3z|M8 7V4h8v3|M3 13h18',
  tag: 'M3 12V4h8l10 10-8 8z|M7.5 8.5h.01',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  copy: 'M9 9h11v11H9z|M5 15H4V4h11v1',
  sms: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z|M8 12h.01|M12 12h.01|M16 12h.01',
  monitor: 'M3 4h18v12H3z|M8 21h8|M12 16v5',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M2 12h20|M12 2a15 15 0 0 1 0 20|M12 2a15 15 0 0 0 0 20'
};

/** Construit un nœud <svg> pour l'icône demandée (aucun innerHTML). */
function icon(name, size = 20, extraClass = '') {
  const NS = 'http://www.w3.org/2000/svg';
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', '1.75');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('focusable', 'false');
  el.setAttribute('class', ('icon ' + extraClass).trim());
  const def = ICONS[name] || ICONS.info;
  def.split('|').forEach((d) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    el.appendChild(p);
  });
  return el;
}
