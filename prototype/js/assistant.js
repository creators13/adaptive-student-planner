/* PLACEHOLDER for the LLM. There is no model behind this: it fakes milestone
   extraction and the refinement chat with keyword rules so the UI flows can be shown.
   Uploaded files and links are NOT read. Swap this module for a real backend call later;
   the two functions below are the whole contract. */
(function (root) {
  'use strict';
  const PF = (root.PF = root.PF || {});
  const U = PF.util;
  const A = (PF.assistant = {});

  const ms = (title, estMin) => ({ id: U.uid('m'), title, estMin, done: false });
  const round5 = (m) => Math.max(5, Math.round(m / 5) * 5);

  const TEMPLATES = [
    { re: /lab report/i, steps: [['Analyze the data', 60], ['Make figures and tables', 50], ['Write results and discussion', 60], ['Citations and proofread', 30]] },
    { re: /problem ?set|homework|pset|exercises/i, steps: [['Read the problems and plan', 30], ['Problems 1–2', 50], ['Problems 3–4', 50], ['Check answers and write up', 40]] },
    { re: /essay|paper|draft|reflection|write-?up/i, steps: [['Outline', 40], ['First draft', 90], ['Revise', 50], ['Citations and proofread', 30]] },
    { re: /lab|experiment/i, steps: [['Read the protocol', 25], ['Run the experiment', 90], ['Record results', 30]] },
    { re: /read|chapter|article/i, steps: [['Skim and outline', 20], ['Read closely', 60], ['Notes and questions', 25]] },
    { re: /review|exam|midterm|final|quiz|study/i, steps: [['Gather notes and topics', 30], ['Practice problems', 60], ['Review mistakes', 45], ['Summary sheet', 30]] },
  ];
  const FALLBACK = [['Understand the task', 25], ['First pass', 60], ['Review and polish', 35]];

  // Pull "1. ...", "- ...", "Part 2: ..." style lines out of pasted instructions.
  function parseList(text) {
    const out = [];
    for (const line of String(text || '').split('\n')) {
      const m = line.match(/^\s*(?:\d+[.)]|[-*•]|(?:part|problem|question|section)\s*\d+[.:)]?)\s*(.+)$/i);
      if (m && m[1].trim().length > 2) out.push(m[1].trim().slice(0, 60));
    }
    return out;
  }

  // Propose milestones, each with a time estimate, from the title and any pasted text.
  A.generate = ({ title, text }) => {
    const items = parseList(text);
    if (items.length >= 2) return items.slice(0, 8).map((t) => ms(t, 45));
    const tpl = TEMPLATES.find((t) => t.re.test((title || '') + ' ' + (text || '')));
    return (tpl ? tpl.steps : FALLBACK).map(([t, m]) => ms(t, m));
  };

  // PLACEHOLDER: a total estimate from the instructions when the student skips milestones.
  // A real model would read the instructions; this sums the template's milestone times.
  A.estimate = ({ title, text }) => A.generate({ title, text }).reduce((n, m) => n + m.estMin, 0);

  const target = (text, list) => {
    const n = text.match(/(?:milestone|step|#)\s*(\d+)|\b(\d+)(?:st|nd|rd|th)\b/i);
    if (n) { const i = Number(n[1] || n[2]) - 1; if (list[i]) return list[i]; }
    const lower = text.toLowerCase();
    return list.find((m) => m.title.length > 3 && lower.includes(m.title.toLowerCase())) || null;
  };

  // One chat turn. Returns the new list and a reply. Never mutates `list`.
  A.reply = (input, list) => {
    const text = String(input || '').trim();
    const items = list.map((m) => Object.assign({}, m));
    const open = items.filter((m) => !m.done);
    let m;
    if (/smaller|split|break|finer|more steps|chunks/i.test(text)) {
      const one = target(text, items);
      const pool = one ? [one] : /current|first/i.test(text) ? open.slice(0, 1) : open;
      let count = 0;
      const out = [];
      for (const it of items) {
        if (pool.includes(it) && !it.done && it.estMin >= 30) {
          const a = round5(it.estMin / 2);
          out.push(ms(it.title + ' (part 1)', a), ms(it.title + ' (part 2)', Math.max(5, it.estMin - a)));
          count++;
        } else out.push(it);
      }
      return { list: out, message: count ? 'I split ' + U.plural(count, 'milestone') + ' into two smaller steps each. Edit anything that looks off.' : 'Nothing left that is big enough to split.' };
    }
    if ((m = text.match(/^(?:please )?(?:add|include)\s+(?:a |another )?(?:milestone|step)?\s*(?:for|to|called|:)?\s*(.+)$/i))) {
      const title = m[1].replace(/[.!]+$/, '').slice(0, 60);
      items.push(ms(title.charAt(0).toUpperCase() + title.slice(1), 30));
      return { list: items, message: 'Added “' + title + '” at 30 minutes. Change the time if that is off.' };
    }
    if ((m = text.match(/^(?:remove|drop|delete)\s+(.+)$/i))) {
      const gone = target(m[1], items) || target(text, items);
      if (gone && !gone.done) return { list: items.filter((x) => x !== gone), message: 'Removed “' + gone.title + '”.' };
      return { list: items, message: 'Tell me which one, for example “remove milestone 2”.' };
    }
    if (/merge|combine/i.test(text) && open.length >= 2) {
      const [a, b] = open;
      const merged = ms(a.title + ' + ' + b.title, a.estMin + b.estMin);
      const out = [];
      for (const it of items) { if (it === a) out.push(merged); else if (it !== b) out.push(it); }
      return { list: out, message: 'Merged the first two open milestones.' };
    }
    if (/too long|shorter|less time|faster|quicker/i.test(text)) {
      items.forEach((it) => { if (!it.done) it.estMin = round5(it.estMin * 0.8); });
      return { list: items, message: 'Cut the open estimates by about 20%.' };
    }
    if (/longer|more time|slower|too short/i.test(text)) {
      items.forEach((it) => { if (!it.done) it.estMin = round5(it.estMin * 1.25); });
      return { list: items, message: 'Raised the open estimates by about 25%.' };
    }
    return { list: items, message: 'I can split milestones into smaller steps, add or remove one, or adjust the time. Try “break it into smaller steps” or “add a milestone for proofreading”.' };
  };
})(typeof window !== 'undefined' ? window : globalThis);
