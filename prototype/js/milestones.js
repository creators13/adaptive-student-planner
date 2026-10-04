/* Milestone editor: an editable list (title + minutes, optional "already done" checkbox)
   plus a chat with the placeholder assistant. Used when adding an assignment, when
   breaking a milestone into smaller ones, and when adding milestones to unfinished work. */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const { h, icon, btn } = PF.ui;
  const U = PF.util;

  /* opts: { list, showDone, chatOpen, hint, onChange } -> { el, get, set } */
  PF.ui.milestoneEditor = function (opts) {
    let items = (opts.list || []).map((m) => Object.assign({}, m));
    const rowsEl = h('div', { class: 'ms-rows' });
    const totalEl = h('div', { class: 'ms-total muted' });
    const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });

    const emit = () => { renderTotal(); if (opts.onChange) opts.onChange(get()); };
    const get = () => items.map((m) => Object.assign({}, m, { estMin: Math.max(5, Math.round(Number(m.estMin) || 0)) }));

    function renderTotal() {
      const open = items.filter((m) => !m.done);
      const minutes = open.reduce((s, m) => s + (Number(m.estMin) || 0), 0);
      totalEl.textContent = items.length
        ? U.plural(open.length, 'open milestone') + ' · ' + U.fmtDur(minutes) + ' remaining' + (items.length > open.length ? ' · ' + (items.length - open.length) + ' done' : '')
        : 'No milestones yet.';
    }

    function row(m, i) {
      return h('div', { class: 'ms-row' + (m.done ? ' is-done' : '') },
        opts.showDone ? h('input', { type: 'checkbox', checked: m.done, 'aria-label': 'Already done: ' + m.title, onchange: (e) => { m.done = e.target.checked; renderRows(); emit(); } }) : null,
        h('input', { type: 'text', class: 'ms-title', value: m.title, 'aria-label': 'Milestone ' + (i + 1) + ' title', oninput: (e) => { m.title = e.target.value; emit(); } }),
        h('input', { type: 'number', class: 'ms-min', min: 5, step: 5, value: m.estMin, 'aria-label': 'Minutes for milestone ' + (i + 1), oninput: (e) => { m.estMin = Number(e.target.value); emit(); } }),
        h('span', { class: 'muted ms-unit', text: 'min' }),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove milestone ' + (i + 1), onclick: () => { items.splice(i, 1); renderRows(); emit(); } }, icon('x', 14)));
    }
    function renderRows() { rowsEl.replaceChildren(...items.map(row)); renderTotal(); }

    // add row
    const addTitle = h('input', { type: 'text', placeholder: 'Add a milestone…', 'aria-label': 'New milestone title' });
    const addMin = h('input', { type: 'number', min: 5, step: 5, value: 30, class: 'ms-min', 'aria-label': 'Minutes for new milestone' });
    const add = () => {
      const t = addTitle.value.trim();
      if (!t) return;
      items.push({ id: U.uid('m'), title: t, estMin: Number(addMin.value) || 30, done: false });
      addTitle.value = '';
      renderRows(); emit();
    };
    addTitle.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

    // chat
    const say = (who, text) => { log.append(h('div', { class: 'bubble bubble-' + who, text })); log.scrollTop = log.scrollHeight; };
    const input = h('input', { type: 'text', placeholder: 'Ask for a change, e.g. “break it into smaller steps”', 'aria-label': 'Message to the assistant' });
    const send = (text) => {
      text = (text || input.value).trim();
      if (!text) return;
      input.value = '';
      say('me', text);
      const r = PF.assistant.reply(text, items);
      items = r.list;
      renderRows();
      say('bot', r.message);
      emit();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    say('bot', 'Hi, I help turn an assignment into milestones. I am a placeholder with no real model behind me, so I only understand a few requests: split into smaller steps, add or remove a milestone, make times shorter or longer.');
    const chips = ['Break it into smaller steps', 'Add a milestone for proofreading', 'These take too long'].map((c) => h('button', { type: 'button', class: 'chip', text: c, onclick: () => send(c) }));
    const chat = h('details', { class: 'chat' }, h('summary', {}, icon('sparkle', 14), ' Work it out with the assistant ', h('span', { class: 'tag', text: 'placeholder' })),
      log, h('div', { class: 'chips' }, chips), h('div', { class: 'chat-input' }, input, btn('', { icon: 'send', aria: 'Send', onclick: () => send() })));
    if (opts.chatOpen) chat.open = true;

    const el = h('div', { class: 'ms' },
      opts.hint ? h('p', { class: 'hint', text: opts.hint }) : null,
      rowsEl,
      h('div', { class: 'ms-row ms-add' }, addTitle, addMin, h('span', { class: 'muted ms-unit', text: 'min' }), btn('Add', { small: true, onclick: add })),
      totalEl, chat);
    renderRows();
    return { el, get, set: (l) => { items = l.map((m) => Object.assign({}, m)); renderRows(); emit(); } };
  };
})();
