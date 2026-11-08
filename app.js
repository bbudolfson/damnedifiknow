/* Recipe data lives in data/recipes.json so it can be edited separately. */
(async () => {
const res = await fetch("data/recipes.json");
const DATA = await res.json();

/* Photo links are not wired up yet. When they are, return a URL for a Google Photos ID here. */
const photoUrl = (photoId) => null;

const $ = (s, r = document) => r.querySelector(s);
const byId = new Map(DATA.map(e => [e.id, e]));
const TYPE_LABEL = { recipe: "Recipe", journal: "Journal & menu", note: "Page note" };
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const FLAG_INFO = {
  category: ["Category corrected", "The automatic sort put these under the wrong category (Brisket under Cookies & Bars because of “bar-b-que”, Halibut under Drinks, Veal Scallopini under Seafood). They are shown under the category in the note; the original value is still in the data. Sauces, gravies, marinades and barbecue sauces had nowhere to go, so they are gathered under a new “Sauces & Condiments” category."],
  split: ["Ingredients and method not separated", "The ingredient/method split missed these. Most are clippings or short notes where the ingredients sit inside the method text. The card shows the text in order, so nothing is lost, but the ingredient list is empty."],
  title: ["Title split at a comma", "The title was cut at a comma, with the rest pushed into the title note. The page rejoins them for display."],
  continuation: ["Runs across entries or pages", "These recipes or stories continue on another page or entry. The card links to the continuation where the page number is known."],
  date: ["Journal year inferred", "No year is written on these journal entries. The timeline uses the year of the surrounding entries."],
  people: ["Name mentioned but not tagged", "These names appear in the text but not in people_mentioned. Mama, Mother, Dot Seale and Dorothy Seale look like the same person (Sudie writes “Mama (Dot Seale)” and “Dorothy Seale (Mother)”), as may Kaitlyn and Katie, and Emmy Lou and Emma Lou Hucks. The tags are left as they are."],
  photo: ["Missing photo ID", "The photo_id field reads “(unrecorded)”."],
  order: ["Out of page order", "These sit one page out of order in the data."]
};

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let terms = [];

function hl(raw) {
  if (!terms.length) return raw;
  let out = raw;
  const f = fold(raw);
  const marks = [];
  for (const t of terms) {
    let i = 0;
    while ((i = f.indexOf(t, i)) !== -1) { marks.push([i, i + t.length]); i += t.length; }
  }
  if (!marks.length) return raw;
  marks.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const m of marks) { const l = merged[merged.length - 1]; if (l && m[0] <= l[1]) l[1] = Math.max(l[1], m[1]); else merged.push([...m]); }
  out = "";
  let p = 0;
  for (const [a, b] of merged) { out += raw.slice(p, a) + "\u0001" + raw.slice(a, b) + "\u0002"; p = b; }
  return out + raw.slice(p);
}
/* Escape, then mark [?] words, editorial [brackets] and search hits. */
function fmt(raw) {
  let s = esc(hl(String(raw)));
  s = s.replace(/(\S+?)\s?\[\?\]/g, '<span class="unc" title="Uncertain reading">$1</span><span class="unc-q" aria-label="uncertain">?</span>');
  s = s.replace(/\[([^\[\]]+)\]/g, '<span class="ed">[$1]</span>');
  return s.replace(/\u0001/g, "<mark>").replace(/\u0002/g, "</mark>");
}
const pageText = e => e.page != null ? "p. " + e.page : e.page_label;

function dateLabel(e) {
  const d = e.date || {};
  if (!d.y) return "Undated";
  let s = d.m ? MONTHS[d.m - 1] + (d.d ? " " + d.d : "") + ", " : "";
  return s + d.y + (d.inferred ? "?" : "");
}

/* ---------- search index ---------- */
for (const e of DATA) {
  e._hay = fold([e.t_main, e.t_sub, e.t_note, e.page_label, e.cat, (e.people_mentioned || []).join(" "),
    ...e.ingredients, ...e.instructions, ...e.notes].join(" \n "));
}

/* ---------- filters ---------- */
const state = { view: "book", q: "", cat: "", type: "", src: "", person: "", flag: false, shown: 120 };
const CAT_ORDER = ["Appetizers & Spreads","Soups & Stews","Salads & Dressings","Meat","Poultry","Seafood","Vegetables & Sides","Breads & Biscuits","Sauces & Condiments","Preserves & Pickles","Drinks","Cakes","Pies & Tarts","Cookies & Bars","Desserts","Other","Journal / Menus","Page notes"];
function fillSelect(el, label, items) {
  el.innerHTML = `<option value="">${esc(label)}</option>` + items.map(([v, t, n]) => `<option value="${esc(v)}">${esc(t)} (${n})</option>`).join("");
}
function counts(key) {
  const m = new Map();
  for (const e of DATA) for (const v of [].concat(key(e))) m.set(v, (m.get(v) || 0) + 1);
  return m;
}
const catCounts = counts(e => e.cat);
fillSelect($("#f-cat"), "All categories", [...catCounts].sort((a, b) => CAT_ORDER.indexOf(a[0]) - CAT_ORDER.indexOf(b[0])).map(([k, n]) => [k, k, n]));
const typeCounts = counts(e => e.type);
fillSelect($("#f-type"), "All types", ["recipe", "journal", "note"].map(k => [k, TYPE_LABEL[k], typeCounts.get(k)]));
const srcCounts = counts(e => e.source_type);
fillSelect($("#f-src"), "Handwritten & clippings", [["handwritten", "Handwritten", srcCounts.get("handwritten")], ["clipping", "Clipping", srcCounts.get("clipping")]]);
const pplCounts = counts(e => e.people_mentioned || []);
const FAMILY = ["Randy", "Patrick", "Preston", "Erin", "Mama", "Mammy", "Nannie"];
const famOpts = FAMILY.filter(p => pplCounts.has(p)).map(p => [p, p, pplCounts.get(p)]);
const otherOpts = [...pplCounts].filter(([p]) => !FAMILY.includes(p)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p, n]) => [p, p, n]);
$("#f-person").innerHTML = `<option value="">Everyone</option><optgroup label="Family">${famOpts.map(([v, t, n]) => `<option value="${esc(v)}">${esc(t)} (${n})</option>`).join("")}</optgroup><optgroup label="Others">${otherOpts.map(([v, t, n]) => `<option value="${esc(v)}">${esc(t)} (${n})</option>`).join("")}</optgroup>`;

function matches(e, ignore = {}) {
  if (state.cat && !ignore.cat && e.cat !== state.cat) return false;
  if (state.type && !ignore.type && e.type !== state.type) return false;
  if (state.src && e.source_type !== state.src) return false;
  if (state.person && !(e.people_mentioned || []).includes(state.person)) return false;
  if (state.flag && !e.flags.length) return false;
  for (const t of terms) if (!e._hay.includes(t)) return false;
  return true;
}

/* ---------- snippets ---------- */
function snippet(e) {
  if (!terms.length) return "";
  const fields = [...e.ingredients, ...e.instructions, ...e.notes, e.t_note];
  for (const f of fields) {
    const ff = fold(f);
    const i = ff.indexOf(terms[0]);
    if (i === -1) continue;
    if (fold(e.t_main).includes(terms[0]) && f !== e.t_note) continue;
    const a = Math.max(0, i - 50), b = Math.min(f.length, i + 90);
    return (a > 0 ? "…" : "") + f.slice(a, b) + (b < f.length ? "…" : "");
  }
  return "";
}

/* ---------- list cards ---------- */
function cardHTML(e, opts = {}) {
  const ppl = (e.people_mentioned || []).join(", ");
  const sn = snippet(e);
  const chips = [];
  if (e.type !== "recipe") chips.push(`<span class="chip">${TYPE_LABEL[e.type]}</span>`);
  if (e.type === "recipe") chips.push(`<span class="chip">${esc(e.cat)}</span>`);
  if (e.source_type === "clipping") chips.push(`<span class="chip clip">Clipping</span>`);
  if (e.flags.length) chips.push(`<span class="chip flag" title="${esc(e.flags.map(f => f.t).join(" "))}">Review</span>`);
  const title = e.type === "journal" && opts.timeline ? "" : `<span class="t">${fmt(e.t_main)}</span>`;
  if (opts.timeline) {
    const menu = e.instructions.filter(x => !/^guests?:/i.test(x)).slice(0, 2).join(" · ") || e.notes.slice(0, 1).join("");
    return `<button class="card journal" data-id="${e.id}">
      <span class="date">${esc(dateLabel(e))}</span><span class="pg">${esc(pageText(e))}</span>
      <span class="occ">${fmt(e.t_note || e.t_main)}</span>
      ${menu ? `<span class="menu">${fmt(menu.length > 160 ? menu.slice(0, 160) + "…" : menu)}</span>` : ""}
      ${sn ? `<span class="snip">${fmt(sn)}</span>` : ""}
      <span class="meta">${ppl ? `<span class="people">${esc(ppl)}</span>` : ""}${chips.slice(1).join("")}</span>
    </button>`;
  }
  const sub = e.type === "journal" ? e.t_note : e.t_sub;
  return `<button class="card ${e.type}" data-id="${e.id}">
    ${title}<span class="pg">${esc(e.page != null ? "p. " + e.page : "")}</span>
    ${sub ? `<span class="s">${fmt(sub)}</span>` : ""}
    ${sn ? `<span class="snip">${fmt(sn)}</span>` : ""}
    <span class="meta">${chips.join("")}${ppl ? `<span class="people">${esc(ppl)}</span>` : ""}</span>
  </button>`;
}

/* ---------- views ---------- */
function renderBook() {
  const rows = DATA.filter(e => matches(e));
  $("#count").textContent = `${rows.length} of ${DATA.length} entries`;
  if (!rows.length) return `<p class="empty">Nothing in the book matches that. Try fewer words or clear the filters.</p>`;
  let html = "", last = null;
  for (const e of rows.slice(0, state.shown)) {
    const key = e.page != null ? "p" + e.page : e.page_label;
    if (key !== last) {
      const lbl = e.page != null ? e.page_label.replace(/^\d+\s*/, "").replace(/^\((.*)\)$/, "$1") : "";
      html += `<div class="pagemark"><b>${e.page != null ? "PAGE " + e.page : esc(e.page_label.toUpperCase())}</b>${lbl ? `<span>${fmt(lbl)}</span>` : ""}</div>`;
      last = key;
    }
    html += cardHTML(e);
  }
  if (rows.length > state.shown) html += `<button class="more" id="more">Show the next ${Math.min(120, rows.length - state.shown)} of ${rows.length - state.shown} remaining</button>`;
  return `<div class="list">${html}</div>`;
}

function sortKey(e) { const d = e.date || {}; return d.y ? d.y * 10000 + (d.m || 0) * 100 + (d.d || 0) : 99999999; }
function renderJournal() {
  const rows = DATA.filter(e => e.type === "journal" && matches(e, { cat: true, type: true })).sort((a, b) => sortKey(a) - sortKey(b) || a.id - b.id);
  $("#count").textContent = `${rows.length} of ${typeCounts.get("journal")} journal & menu entries, 1963–2012`;
  if (!rows.length) return `<p class="empty">No journal entries match. Try another name or word.</p>`;
  const groups = new Map();
  for (const e of rows) { const y = e.date && e.date.y ? e.date.y : "Undated"; if (!groups.has(y)) groups.set(y, []); groups.get(y).push(e); }
  const decades = new Map();
  for (const y of groups.keys()) { const k = y === "Undated" ? y : Math.floor(y / 10) * 10 + "s"; if (!decades.has(k)) decades.set(k, y); }
  let html = `<nav class="decades" aria-label="Jump to">${[...decades].map(([k, y]) => `<a href="#journal" data-jump="y-${y}">${k}</a>`).join("")}</nav><div class="tl">`;
  for (const [y, list] of groups) {
    html += `<h3 class="yr" id="y-${y}">${y}<small>${list.length} ${list.length === 1 ? "entry" : "entries"}</small></h3>`;
    html += list.map(e => cardHTML(e, { timeline: true })).join("");
  }
  return html + "</div>";
}

function renderReview() {
  const rows = DATA.filter(e => matches(e) && e.flags.length);
  $("#count").textContent = `${rows.length} entries with something to check`;
  let html = `<p class="rev-intro">Things that looked wrong while building this page. Nothing in the original data was changed; the page only corrects how a few entries are shown. Open a group to see each entry.</p>`;
  for (const [k, [name, desc]] of Object.entries(FLAG_INFO)) {
    const items = [];
    for (const e of rows) for (const f of e.flags) if (f.k === k) items.push([e, f]);
    if (!items.length) continue;
    html += `<details class="rev-group"><summary><b>${esc(name)}</b><span>${items.length}</span></summary><p>${esc(desc)}</p><ul>${items.map(([e, f]) => `<li><button data-id="${e.id}"><span class="p">${esc(e.page != null ? "p. " + e.page : "loose")}</span><span>${fmt(e.type === "journal" ? e.t_main + (e.t_note ? " · " + e.t_note : "") : e.t_main)}<span class="m">${esc(f.t)}</span></span></button></li>`).join("")}</ul></details>`;
  }
  return html;
}

function render() {
  terms = fold(state.q).split(/\s+/).filter(Boolean);
  const v = state.view;
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.view === v)));
  $("#f-cat").parentElement.hidden = v === "journal";
  $("#f-type").parentElement.hidden = v === "journal";
  $("#view").innerHTML = v === "journal" ? renderJournal() : v === "review" ? renderReview() : renderBook();
  $("#clear").hidden = !(state.q || state.cat || state.type || state.src || state.person || state.flag);
}

/* ---------- entry detail ---------- */
function isHeader(x) { return /^\s*--.*--\s*$/.test(x) || /^\s*[A-Z][A-Za-z &]+:\s*$/.test(x); }
function lineItems(list, cls) {
  return list.map(x => {
    if (isHeader(x)) return `<li class="hd">${fmt(x.replace(/^\s*-+\s*|\s*-+\s*$/g, "").replace(/:\s*$/, ""))}</li>`;
    if (cls === "ing" && /^\s*(serves|yield|makes)\b/i.test(x)) return `<li class="yield">${fmt(x)}</li>`;
    return `<li>${fmt(x)}</li>`;
  }).join("");
}
function notesHTML(notes) {
  return notes.map(n => {
    const m = n.match(/^\s*(STORY|NOTE|Note \([^)]*\)|Note)\s*:\s*/);
    return `<p>${m ? `<span class="story-k">${esc(m[1].toUpperCase())}</span>` : ""}${fmt(m ? n.slice(m[0].length) : n)}</p>`;
  }).join("");
}
function continuations(e) {
  const out = [];
  const text = [e.t_sub, e.t_note, e.page_label, ...e.notes.slice(-1)].join(" ");
  const m = text.match(/contin\w*\s+on\s+p(?:g|age)?\.?\s*(\d+)/i);
  if (m) {
    const pg = +m[1];
    const target = DATA.find(x => x.page === pg && x.id !== e.id && (/continued/i.test(x.t_main + x.t_sub) || x.type === "note")) || DATA.find(x => x.page === pg && x.id !== e.id);
    if (target) out.push([target.id, `Continues on p. ${pg}`]);
  }
  if (/continued/i.test(e.t_main + " " + e.t_sub)) {
    const base = e.t_main.replace(/\s*\(continued\)/i, "");
    const prev = [...DATA].filter(x => x.id < e.id && x.t_main.startsWith(base) && !/continued/i.test(x.t_sub + x.t_main)).pop();
    if (prev) out.push([prev.id, `Starts on p. ${prev.page}`]);
  }
  return out;
}

let returnFocus = null;
function openEntry(id, push = true) {
  const e = byId.get(id);
  if (!e) return;
  const i = DATA.indexOf(e);
  const prev = DATA[i - 1], next = DATA[i + 1];
  const ppl = (e.people_mentioned || []).join(", ");
  const url = photoUrl(e.photo_id);
  const recorded = !e.photo_id.startsWith("(");
  let body = "";
  if (e.type === "recipe") {
    const hasIng = e.ingredients.length > 0;
    const method = e.instructions.length ? `<section class="sec"><h3>${hasIng ? "Method" : "Recipe"}</h3>${hasIng ? "" : `<p class="nosplit">Ingredients are written into the text on this card.</p>`}<ol class="steps${e.instructions.length < 2 ? " plain" : ""}">${lineItems(e.instructions, "steps")}</ol></section>` : "";
    const ing = hasIng ? `<section class="sec"><h3>Ingredients</h3><ul class="ing">${lineItems(e.ingredients, "ing")}</ul></section>` : "";
    body += hasIng && method ? `<div class="cols">${ing}${method}</div>` : ing + method;
  } else if (e.type === "journal") {
    if (e.instructions.length) body += `<section class="sec"><h3>Who came &amp; what was served</h3><ul class="menu-list">${e.instructions.map(x => `<li>${fmt(x)}</li>`).join("")}</ul></section>`;
  } else {
    if (e.instructions.length) body += `<section class="sec"><h3>On this page</h3><div class="ruled">${notesHTML(e.instructions)}</div></section>`;
  }
  if (e.notes.length) body += `<section class="sec"><h3>${e.type === "journal" ? "More from this page" : "Sudie’s notes &amp; stories"}</h3><div class="ruled">${notesHTML(e.notes)}</div></section>`;
  const conts = continuations(e);
  if (conts.length) body += `<div class="cont">${conts.map(([cid, t]) => `<button data-go="${cid}">${esc(t)} →</button>`).join("")}</div>`;
  if (e.flags.length) body += `<aside class="flags sec"><h3>Transcription review</h3><ul>${e.flags.map(f => `<li>${esc(f.t)}</li>`).join("")}</ul></aside>`;

  const heading = e.type === "journal" ? dateLabel(e) === "Undated" ? e.t_main : esc(dateLabel(e)) : e.type === "note" ? "Page notes" : e.t_main;
  const sub = e.type === "journal" ? (dateLabel(e) === "Undated" ? "" : e.t_main) : e.type === "note" ? e.page_label : e.t_sub;
  const hnote = e.type === "journal" ? e.t_note : e.t_note;
  $("#entry").className = "entry " + e.type;
  $("#entry").innerHTML = `
    <div class="bar"><span class="where">${esc(pageText(e))}<span class="of"> · entry ${e.id} of ${DATA.length}</span></span>
      <button data-go="${prev ? prev.id : ""}" ${prev ? "" : "disabled"} aria-label="Previous entry in the book">← Prev</button>
      <button data-go="${next ? next.id : ""}" ${next ? "" : "disabled"} aria-label="Next entry in the book">Next →</button>
      <button id="close" aria-label="Close">Close</button></div>
    <div class="ebody">
      <header>
        <h2 id="e-title">${e.type === "journal" && dateLabel(e) !== "Undated" ? heading : fmt(heading)}</h2>
        ${sub ? `<p class="sub">${fmt(sub)}</p>` : ""}
        ${hnote ? `<p class="hnote">${fmt(hnote)}</p>` : ""}
        <div class="tags"><span class="chip">${esc(TYPE_LABEL[e.type])}</span>${e.type === "recipe" ? `<span class="chip">${esc(e.cat)}${e.cat !== e.category ? " · corrected" : ""}</span>` : ""}<span class="chip${e.source_type === "clipping" ? " clip" : ""}">${e.source_type === "clipping" ? "Clipping" : "Handwritten"}</span>${ppl ? `<span class="people">${esc(ppl)}</span>` : ""}</div>
      </header>
      ${body}
      <section class="source">
        <dl><dt>Page</dt><dd>${fmt(e.page_label)}</dd><dt>Photo ID</dt><dd id="pid">${esc(e.photo_id)}</dd></dl>
        <div class="acts">
          ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">Open source photo</a>` : `<span>Source photo link not connected yet</span>`}
          ${recorded ? `<button id="copy-pid">Copy photo ID</button>` : ""}
        </div>
      </section>
    </div>`;
  const ov = $("#overlay");
  if (!ov.classList.contains("open")) returnFocus = document.activeElement;
  ov.classList.add("open"); ov.setAttribute("aria-hidden", "false"); ov.scrollTop = 0;
  document.body.style.overflow = "hidden";
  $("#close").focus({ preventScroll: true });
  if (push) setHash("entry-" + id);
}
function closeEntry(push = true) {
  const ov = $("#overlay");
  if (!ov.classList.contains("open")) return;
  ov.classList.remove("open"); ov.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (push) setHash(state.view);
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
}

/* ---------- routing (#book, #journal, #review, #entry-123) ---------- */
let ignoreHash = false;
function setHash(h) { if (location.hash.slice(1) !== h) { ignoreHash = true; location.hash = h; } }
function route() {
  if (ignoreHash) { ignoreHash = false; return; }
  const h = location.hash.slice(1);
  const m = h.match(/^entry-(\d+)$/);
  if (m) { openEntry(+m[1], false); return; }
  closeEntry(false);
  if (["book", "journal", "review"].includes(h) && h !== state.view) { state.view = h; state.shown = 120; render(); }
}

/* ---------- events ---------- */
let qTimer;
$("#q").addEventListener("input", ev => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = ev.target.value; state.shown = 120; render(); }, 120); });
for (const [id, key] of [["f-cat", "cat"], ["f-type", "type"], ["f-src", "src"], ["f-person", "person"]])
  $("#" + id).addEventListener("change", ev => { state[key] = ev.target.value; state.shown = 120; render(); });
$("#f-flag").addEventListener("change", ev => { state.flag = ev.target.checked; state.shown = 120; render(); });
$("#clear").addEventListener("click", () => {
  Object.assign(state, { q: "", cat: "", type: "", src: "", person: "", flag: false, shown: 120 });
  $("#q").value = ""; ["f-cat", "f-type", "f-src", "f-person"].forEach(i => $("#" + i).value = ""); $("#f-flag").checked = false;
  render();
});
document.querySelector(".tabs").addEventListener("click", ev => {
  const b = ev.target.closest("button[data-view]"); if (!b) return;
  state.view = b.dataset.view; state.shown = 120; render(); setHash(state.view);
});
$("#view").addEventListener("click", ev => {
  const j = ev.target.closest("[data-jump]");
  if (j) { ev.preventDefault(); const t = document.getElementById(j.dataset.jump); if (t) t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); return; }
  if (ev.target.id === "more") { state.shown += 120; render(); return; }
  const c = ev.target.closest("[data-id]"); if (c) openEntry(+c.dataset.id);
});
$("#overlay").addEventListener("click", async ev => {
  if (ev.target.id === "overlay" || ev.target.id === "close") { closeEntry(); return; }
  const g = ev.target.closest("[data-go]"); if (g && g.dataset.go) { openEntry(+g.dataset.go); return; }
  if (ev.target.id === "copy-pid") {
    const b = ev.target;
    try { await navigator.clipboard.writeText($("#pid").textContent); b.textContent = "Copied"; }
    catch { const r = document.createRange(); r.selectNodeContents($("#pid")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected, press Copy"; }
  }
});
document.addEventListener("keydown", ev => {
  if (!$("#overlay").classList.contains("open")) return;
  if (ev.key === "Escape") closeEntry();
  if (ev.target.tagName === "INPUT") return;
  if (ev.key === "ArrowLeft") { const b = $('#entry .bar [data-go]'); if (b && b.dataset.go) openEntry(+b.dataset.go); }
  if (ev.key === "ArrowRight") { const b = $$('#entry .bar [data-go]')[1]; if (b && b.dataset.go) openEntry(+b.dataset.go); }
});
const $$ = (s) => [...document.querySelectorAll(s)];
window.addEventListener("hashchange", route);

/* ---------- start ---------- */
$("#tally").textContent = `${typeCounts.get("recipe")} recipes · ${typeCounts.get("journal")} journal & menu entries · ${typeCounts.get("note")} page notes · ${DATA.filter(e => e.source_type === "clipping").length} pasted clippings`;
$("#n-book").textContent = DATA.length;
$("#n-journal").textContent = typeCounts.get("journal");
$("#n-review").textContent = DATA.filter(e => e.flags.length).length;
{
  const h = location.hash.slice(1);
  if (["book", "journal", "review"].includes(h)) state.view = h;
  render();
  const m = h.match(/^entry-(\d+)$/);
  if (m) openEntry(+m[1], false);
}
})().catch(err => {
  console.error(err);
  document.getElementById("view").textContent = "Sorry, the recipes couldn't be loaded. Try refreshing the page.";
});
