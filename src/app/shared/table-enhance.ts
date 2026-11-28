/**
 * Makes every data table in the app sortable, searchable and paged, without touching each page.
 * Click a column header to sort (again to reverse); a search box filters rows; 25 rows per page.
 * Tables with fewer than 8 rows get sorting only. Add class "plain" to a table to opt out.
 */
const PAGE_SIZES = [10, 25, 50, 100];
interface State { sortCol: number; dir: 1 | -1; q: string; page: number; size: number; bar?: HTMLElement }
const states = new WeakMap<HTMLTableElement, State>();

function cellVal(tr: HTMLTableRowElement, i: number) {
  const t = (tr.cells[i]?.innerText ?? '').trim();
  const n = t.replace(/[₹,\s]|Rs|hrs?|min/gi, '');
  if (/^-?\d+(\.\d+)?$/.test(n)) return Number(n);
  const d = Date.parse(t);
  if (/\d{4}-\d{2}-\d{2}|\d{1,2} \w{3}/.test(t) && !isNaN(d)) return d;
  return t.toLowerCase();
}

function parts(table: HTMLTableElement) {
  const rows = Array.from(table.rows);
  const head = rows.find((r) => r.querySelector('th') && !r.querySelector('td'));
  const data = rows.filter((r) => r !== head && r.querySelector('td') && !r.querySelector('th') && r.cells.length > 1);
  return { head, data };
}

function apply(table: HTMLTableElement) {
  const st = states.get(table)!;
  const { head, data } = parts(table);
  if (!head) return;
  head.querySelectorAll('th').forEach((th, i) => {
    th.classList.toggle('sort-asc', st.sortCol === i && st.dir === 1);
    th.classList.toggle('sort-desc', st.sortCol === i && st.dir === -1);
  });
  let rows = data;
  if (st.sortCol >= 0) {
    rows = [...data].sort((a, b) => {
      const x = cellVal(a, st.sortCol), y = cellVal(b, st.sortCol);
      return (x < y ? -1 : x > y ? 1 : 0) * st.dir;
    });
    const parent = data[0]?.parentElement;
    const anchor = data[data.length - 1]?.nextSibling ?? null;
    if (parent && rows.some((r, i) => r !== data[i])) rows.forEach((r) => parent.insertBefore(r, anchor));
  }
  const q = st.q.toLowerCase();
  const shown = rows.filter((r) => !q || r.innerText.toLowerCase().includes(q));
  const paged = data.length >= 8;
  const pages = Math.max(1, Math.ceil(shown.length / st.size));
  st.page = Math.min(st.page, pages);
  const from = (st.page - 1) * st.size;
  for (const r of rows) {
    const i = shown.indexOf(r);
    r.style.display = i < 0 || (paged && (i < from || i >= from + st.size)) ? 'none' : '';
  }
  if (!st.bar) return;
  st.bar.style.display = paged ? '' : 'none';
  const info = st.bar.querySelector<HTMLElement>('.tinfo')!;
  info.textContent = shown.length ? `${from + 1}–${Math.min(from + st.size, shown.length)} of ${shown.length}` : 'No matches';
  (st.bar.querySelector('.tprev') as HTMLButtonElement).disabled = st.page <= 1;
  (st.bar.querySelector('.tnext') as HTMLButtonElement).disabled = st.page >= pages;
}

function enhance(table: HTMLTableElement) {
  if (table.classList.contains('plain') || table.closest('.no-enh')) return;
  let st = states.get(table);
  if (!st) {
    const { head } = parts(table);
    if (!head) return;
    st = { sortCol: -1, dir: 1, q: '', page: 1, size: 25 };
    states.set(table, st);
    head.querySelectorAll('th').forEach((th, i) => {
      if (!th.innerText.trim()) return;
      th.classList.add('sortable');
      th.addEventListener('click', () => {
        st!.dir = st!.sortCol === i ? (st!.dir === 1 ? -1 : 1) : 1; st!.sortCol = i; apply(table);
      });
    });
    const bar = document.createElement('div');
    bar.className = 'tbar';
    bar.innerHTML = `<input class="tsearch" type="search" placeholder="Filter rows…">
      <span class="tsp"></span><select class="tsize">${PAGE_SIZES.map((n) => `<option ${n === 25 ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <span class="tinfo"></span><button type="button" class="s tprev">‹</button><button type="button" class="s tnext">›</button>`;
    const host = table.closest('.wrap') ?? table;
    host.parentElement?.insertBefore(bar, host);
    bar.querySelector('.tsearch')!.addEventListener('input', (e) => { st!.q = (e.target as HTMLInputElement).value; st!.page = 1; apply(table); });
    bar.querySelector('.tsize')!.addEventListener('change', (e) => { st!.size = +(e.target as HTMLSelectElement).value; st!.page = 1; apply(table); });
    bar.querySelector('.tprev')!.addEventListener('click', () => { st!.page--; apply(table); });
    bar.querySelector('.tnext')!.addEventListener('click', () => { st!.page++; apply(table); });
    st.bar = bar;
  }
  apply(table);
}

/** Phone card view: each cell carries its column name, shown by CSS on small screens. */
function label(table: HTMLTableElement) {
  const { head } = parts(table);
  if (!head) return;
  const names = Array.from(head.cells).map((c) => c.innerText.replace(/[⇅▲▼]/g, '').trim());
  table.classList.add('cardable');
  for (const r of Array.from(table.rows)) {
    if (r === head) continue;
    let col = 0;
    for (const c of Array.from(r.cells)) {
      const n = names[col] ?? '';
      if (c.getAttribute('data-label') !== n) c.setAttribute('data-label', n);
      col += c.colSpan || 1;
    }
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
export function startTableEnhancer(root: HTMLElement = document.body) {
  const run = () => {
    busy = true;
    root.querySelectorAll<HTMLTableElement>('.wrap > table, table.enh').forEach(enhance);
    root.querySelectorAll<HTMLTableElement>('.wrap > table').forEach(label);
    // the bar of a table Angular removed goes with it
    root.querySelectorAll<HTMLElement>('.tbar').forEach((b) => { if (!b.nextElementSibling?.querySelector?.('table') && b.nextElementSibling?.tagName !== 'TABLE') b.remove(); });
    setTimeout(() => (busy = false));
  };
  new MutationObserver(() => { if (busy) return; clearTimeout(timer); timer = setTimeout(run, 60); })
    .observe(root, { childList: true, subtree: true, characterData: true });
  run();
}
