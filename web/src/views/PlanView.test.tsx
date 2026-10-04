import { describe, expect, test } from 'vitest';
import { emptyState, renderApp } from '../test/helpers';

const bandsOfFirstDay = () => [...document.querySelectorAll('.cal-col')][0].querySelectorAll<HTMLElement>('.cal-off');

describe('Weekly Plan shading outside work hours', () => {
  test('9 AM to 8 PM shades before 9 AM and after 8 PM', () => {
    renderApp(emptyState());
    expect([...bandsOfFirstDay()].map((b) => [b.style.top, b.style.height])).toEqual([['0px', 468 + 'px'], [20 * 52 + 'px', 4 * 52 + 'px']]);
  });

  test('work hours that end at midnight leave the evening unshaded (the plain-JS prototype shaded the whole day)', () => {
    const s = emptyState();
    s.prefs.workEnd = '00:00';
    renderApp(s);
    expect([...bandsOfFirstDay()].map((b) => [b.style.top, b.style.height])).toEqual([['0px', 468 + 'px']]);
  });

  test('work hours past midnight shade only the gap between the end and the start', () => {
    const s = emptyState();
    s.prefs.workStart = '10:00';
    s.prefs.workEnd = '03:00';
    renderApp(s);
    expect([...bandsOfFirstDay()].map((b) => [b.style.top, b.style.height])).toEqual([[3 * 52 + 'px', 7 * 52 + 'px']]);
  });
});
