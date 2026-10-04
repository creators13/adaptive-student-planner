/* Small UI toolkit: element builder, icons, modal dialogs, toasts.
   All text goes through textContent, so student-entered titles are never parsed as HTML. */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const SVGNS = 'http://www.w3.org/2000/svg';

  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
    tasks: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    waves: '<path d="M2 7c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 13c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 19c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    // Inflow mark: three streams merging into one point (incoming tasks consolidating into one plan).
    inflow: '<path d="M3 5.5c6 0 7.5 6.5 12 6.5"/><path d="M3 12h12"/><path d="M3 18.5c6 0 7.5-6.5 12-6.5"/><circle cx="19" cy="12" r="2.5" fill="currentColor" stroke="none"/>',
    anchor: '<circle cx="12" cy="5" r="3"/><path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bell: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    upload: '<path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v5M12 18h.01"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  };

  function icon(name, size) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size || 16);
    s.setAttribute('height', size || 16);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
  }

  // h('div', { class: 'x', onclick: fn, text: 'hi' }, child, child)
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    const late = {};
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' || k === 'checked' || k === 'selected') late[k] = v;
      else if (k === 'disabled' || k === 'hidden') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    append(el, kids);
    for (const [k, v] of Object.entries(late)) el[k] = v; // after options exist
    return el;
  }

  function btn(label, opts) {
    opts = opts || {};
    const b = h('button', {
      type: 'button',
      class: 'btn btn-' + (opts.kind || 'secondary') + (opts.small ? ' btn-sm' : ''),
      onclick: opts.onclick,
      disabled: opts.disabled,
      title: opts.title,
      id: opts.id,
    }, opts.icon ? icon(opts.icon, 15) : null, label ? h('span', { text: label }) : null);
    if (opts.aria) b.setAttribute('aria-label', opts.aria);
    return b;
  }

  // A labelled form field. `control` is any input element.
  function field(label, control, hint) {
    const id = control.id || (control.id = PF.util.uid('f'));
    return h('div', { class: 'field' }, h('label', { for: id, text: label }), control, hint ? h('div', { class: 'hint', text: hint }) : null);
  }

  /* ---------- modal dialogs ---------- */

  const stack = [];

  function modal(opts) {
    const prevFocus = document.activeElement;
    const titleId = PF.util.uid('mt');
    const api = { dismissible: opts.dismissible !== false };
    const closeBtn = api.dismissible
      ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => api.close('dismissed') }, icon('x'))
      : null;
    const head = h('div', { class: 'modal-head' },
      h('div', {},
        opts.eyebrow ? h('div', { class: 'eyebrow', text: opts.eyebrow }) : null,
        h('h2', { id: titleId, text: opts.title }),
        opts.subtitle ? h('p', { class: 'muted', text: opts.subtitle }) : null),
      closeBtn);
    const bodyEl = h('div', { class: 'modal-body' }, opts.body);
    const footEl = h('div', { class: 'modal-foot' }, opts.actions || []);
    const dlg = h('div', { class: 'modal ' + (opts.size || ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' }, head, bodyEl, footEl);
    const overlay = h('div', { class: 'overlay' }, dlg);
    let resolve;
    api.promise = new Promise((r) => { resolve = r; });
    api.el = dlg;
    api.body = bodyEl;
    api.foot = footEl;
    api.setBody = (n) => bodyEl.replaceChildren(...[].concat(n));
    api.setActions = (a) => { footEl.replaceChildren(...a); footEl.hidden = !a.length; };
    api.setHead = (o) => {
      if (o.title != null) head.querySelector('h2').textContent = o.title;
      const sub = head.querySelector('p');
      if (o.subtitle != null && sub) sub.textContent = o.subtitle;
      const eb = head.querySelector('.eyebrow');
      if (o.eyebrow != null && eb) eb.textContent = o.eyebrow;
    };
    api.close = (result) => {
      if (!overlay.isConnected) return;
      overlay.remove();
      stack.splice(stack.indexOf(api), 1);
      document.body.classList.toggle('modal-open', stack.length > 0);
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
      resolve(result);
    };
    footEl.hidden = !(opts.actions || []).length;
    document.body.append(overlay);
    document.body.classList.add('modal-open');
    stack.push(api);
    requestAnimationFrame(() => {
      const first = dlg.querySelector('[autofocus]') || dlg.querySelector('input:not([type=hidden]),select,textarea');
      (first || dlg).focus();
    });
    return api;
  }

  document.addEventListener('keydown', (e) => {
    if (!stack.length) return;
    const top = stack[stack.length - 1];
    if (e.key === 'Escape' && top.dismissible) { e.stopPropagation(); top.close('dismissed'); }
    if (e.key === 'Tab') {
      const f = [...top.el.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === top.el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Promise<boolean>
  function confirmDialog(o) {
    return new Promise((res) => {
      const m = modal({
        title: o.title, subtitle: o.message, size: 'sm',
        actions: [
          btn(o.cancelLabel || 'Cancel', { onclick: () => { res(false); m.close(); } }),
          btn(o.confirmLabel || 'Confirm', { kind: o.danger ? 'danger' : 'primary', onclick: () => { res(true); m.close(); } }),
        ],
      });
      m.promise.then(() => res(false));
    });
  }

  /* ---------- toasts ---------- */

  function toast(message, o) {
    o = o || {};
    const host = document.getElementById('toasts');
    const t = h('div', { class: 'toast toast-' + (o.tone || 'info'), role: 'status' },
      h('span', { text: message }),
      o.action ? h('button', { type: 'button', class: 'toast-action', text: o.action.label, onclick: () => { t.remove(); o.action.onClick(); } }) : null,
      h('button', { type: 'button', class: 'icon-btn toast-x', 'aria-label': 'Dismiss', onclick: () => t.remove() }, icon('x', 14)));
    host.append(t);
    while (host.children.length > 3) host.firstChild.remove(); // keep the stack short
    setTimeout(() => t.remove(), o.ms || 7000);
    return t;
  }

  PF.ui = Object.assign(PF.ui || {}, { h, icon, btn, field, modal, confirm: confirmDialog, toast, ICONS });
})();
