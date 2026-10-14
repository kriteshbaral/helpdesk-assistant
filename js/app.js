/* Harbourline IT Help: page logic. Depends on kb.js, training.js and nlp.js. */
(function () {
  "use strict";
  const { SearchIndex, assessPriority, classify, evaluate, trainModel, SLA } = window.NLP;
  const KB = window.KB;
  const EXAMPLES = window.TRAINING_EXAMPLES;

  // ---------- Models (trained once, in the browser, on page load) ----------
  const model = trainModel(EXAMPLES, KB);
  const index = new SearchIndex(KB, (d) => `${d.title} ${d.keywords} ${d.keywords} ${d.steps.join(" ")}`);
  const MIN_SEARCH_SCORE = 2.0; // below this, no article is a convincing match
  const LOW_CONFIDENCE = 0.5;

  const CATEGORIES = [...new Set(KB.map((d) => d.category))];
  const PRIORITIES = Object.keys(SLA);
  const SITES = ["Darwin CBD", "Palmerston", "Katherine", "Alice Springs"];

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pcode = (p) => p.slice(0, 2); // "P1 - Critical" -> "P1"
  const pct = (x) => Math.round(x * 100) + "%";
  const HOUR = 3600e3, MIN = 60e3;

  function duration(ms) {
    const m = Math.round(Math.abs(ms) / MIN);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 48) return r ? `${h}h ${r}m` : `${h}h`;
    return `${Math.round(h / 24)}d`;
  }
  function timeLabel(ts) {
    return new Date(ts).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }

  // ---------- Storage (per browser; the page works without it) ----------
  const STORE_KEY = "harbourline-helpdesk-v1";
  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage blocked: keep in memory */ }
  }

  function sampleTickets() {
    const now = Date.now();
    const mk = (n, agoMin, text, requester, site, category, priority, status = "New") => {
      const created = now - agoMin * MIN;
      return { id: "INC" + (200000 + n), created, due: created + SLA[priority].resolveHours * HOUR, text, requester, site, category, priority, status, sample: true };
    };
    return [
      mk(1, 50, "Whole Katherine office has no internet, nobody can work", "Priya S.", "Katherine", "Network & Wi-Fi", "P1 - Critical", "In progress"),
      mk(2, 25, "I clicked a link in an email about my payslip and entered my password", "Daniel W.", "Palmerston", "Security", "P2 - High"),
      mk(3, 1500, "Laptop won't turn on even when plugged in", "Mei L.", "Alice Springs", "Hardware", "P3 - Medium", "In progress"),
      mk(4, 300, "Printer at reception keeps jamming", "Tom R.", "Darwin CBD", "Printing", "P4 - Low"),
      mk(5, 1300, "New starter in finance on Monday needs laptop and accounts", "Grace H. (manager)", "Darwin CBD", "Onboarding", "P3 - Medium"),
      mk(6, 2900, "Need Power BI Pro licence for reporting", "Ahmed K.", "Darwin CBD", "Software", "P4 - Low", "Resolved"),
    ];
  }

  let state = load() || { tickets: sampleTickets(), next: 200101, deflected: 0 };

  // ---------- Tabs ----------
  const TABS = [["help", "tab-help", "view-help"], ["queue", "tab-queue", "view-queue"], ["how", "tab-how", "view-how"]];
  function showTab(name) {
    for (const [n, tab, view] of TABS) {
      const on = n === name;
      $(tab).setAttribute("aria-selected", on);
      $(view).hidden = !on;
    }
    if (name === "queue") renderQueue();
    if (name === "how") renderHow();
    try { history.replaceState(null, "", name === "help" ? location.pathname : "#" + name); } catch { /* ignore */ }
  }
  for (const [n, tab] of TABS) $(tab).addEventListener("click", () => showTab(n));

  // ---------- Get help ----------
  const EXAMPLE_PROBLEMS = [
    "Outlook won't send, emails stuck in outbox",
    "I forgot my password",
    "Wi-Fi keeps dropping out",
    "The whole office has no internet and we can't work",
    "I clicked a link in a suspicious email",
    "New starter joining Monday needs a laptop",
  ];
  $("examples").innerHTML = EXAMPLE_PROBLEMS.map((t) => `<button type="button" class="chip">${esc(t)}</button>`).join("");
  $("examples").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    $("issue").value = b.textContent;
    ask();
  });

  let current = null; // the last analysis

  function analyse(text) {
    const matches = index.search(text, 4);
    const prediction = classify(model, text);
    const priority = assessPriority(text, prediction.category);
    const why = model.explain(text, prediction.category);
    return { text, matches, prediction, priority, why };
  }

  function ask() {
    const text = $("issue").value.trim();
    if (!text) { $("issue").focus(); return; }
    current = analyse(text);
    $("ticketForm").hidden = true;
    $("toast").hidden = true;
    renderResult(current.matches[0] && current.matches[0].score >= MIN_SEARCH_SCORE ? current.matches[0].doc : null);
  }

  function renderTriage(a) {
    const p = a.prediction, pr = a.priority;
    const low = p.confidence < LOW_CONFIDENCE && !p.overriddenFrom;
    const whyText = p.overriddenFrom
      ? esc(p.overrideReason)
      : a.why.length ? "Key words: " + a.why.map((w) => `“${esc(w.word)}”`).join(", ") : "Few known words";
    return `
      <span>Category <b>${esc(p.category)}</b> <span class="conf">${p.overriddenFrom ? "safety rule" : pct(p.confidence) + " confident"}</span>${low ? ' <span class="flag">· please check</span>' : ""}</span>
      <span>Priority <span class="pill ${pcode(pr.priority)}">${esc(pr.priority)}</span> <span class="conf">${esc(pr.impact)} impact · ${esc(pr.urgency)} urgency</span></span>
      <span class="why">${whyText}</span>`;
  }

  function renderResult(doc) {
    const a = current;
    $("result").hidden = false;
    $("triage").innerHTML = renderTriage(a);
    const fix = $("result").querySelector(".fix");
    if (!doc) {
      fix.innerHTML = `<div class="none"><h2>No matching fix article</h2>
        <p class="muted">The assistant couldn't find a confident match. Log a ticket and the service desk will help.</p>
        <div class="decision"><span></span><button class="btn primary" id="ticketBtn2">Log a ticket</button></div></div>`;
      $("ticketBtn2").addEventListener("click", openForm);
      return;
    }
    fix.innerHTML = `
      <div class="fix-head"><span class="kb-id">${esc(doc.id)} · ${esc(doc.category)}</span><h2>${esc(doc.title)}</h2></div>
      <ol class="steps">${doc.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <p class="escalate">${esc(doc.escalate)}</p>
      <div class="others"></div>
      <div class="decision"><span>Did this fix it?</span>
        <button class="btn" id="fixedBtn">Yes, it's fixed</button>
        <button class="btn primary" id="ticketBtn">No, log a ticket</button></div>`;
    const others = a.matches.filter((m) => m.doc.id !== doc.id && m.score >= MIN_SEARCH_SCORE / 2);
    const o = fix.querySelector(".others");
    if (others.length) {
      o.innerHTML = "Other articles: " + others.map((m) => `<button type="button" data-id="${m.doc.id}">${esc(m.doc.title)}</button>`).join(" · ");
      o.addEventListener("click", (e) => {
        const id = e.target.dataset && e.target.dataset.id;
        if (id) renderResult(KB.find((d) => d.id === id));
      });
    }
    $("fixedBtn").addEventListener("click", () => {
      state.deflected++;
      save();
      $("result").hidden = true;
      toast("Great, glad that worked. No ticket needed.");
      $("issue").value = "";
    });
    $("ticketBtn").addEventListener("click", openForm);
  }

  // ---------- Ticket form ----------
  $("fCategory").innerHTML = CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join("");
  $("fPriority").innerHTML = PRIORITIES.map((p) => `<option>${esc(p)}</option>`).join("");
  $("fSite").innerHTML = SITES.map((s) => `<option>${esc(s)}</option>`).join("");

  function openForm() {
    const a = current;
    $("fCategory").value = a.prediction.category;
    $("fPriority").value = a.priority.priority;
    $("fDesc").value = a.text;
    $("ticketForm").hidden = false;
    $("fName").focus();
  }
  $("cancelTicket").addEventListener("click", () => { $("ticketForm").hidden = true; });

  $("ticketForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const priority = $("fPriority").value;
    const created = Date.now();
    const t = {
      id: "INC" + state.next++,
      created,
      due: created + SLA[priority].resolveHours * HOUR,
      text: $("fDesc").value.trim(),
      requester: $("fName").value.trim(),
      site: $("fSite").value,
      category: $("fCategory").value,
      priority,
      status: "New",
      sample: false,
      predicted: { category: current.prediction.category, priority: current.priority.priority },
    };
    state.tickets.unshift(t);
    save();
    $("ticketForm").hidden = true;
    $("result").hidden = true;
    $("issue").value = "";
    const r = SLA[priority];
    toast(`Ticket ${t.id} logged as ${priority}. First response within ${duration(r.responseMin * MIN)}, resolution target ${r.resolveHours}h.`);
    updateCount();
  });

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
  }

  $("askBtn").addEventListener("click", ask);
  $("issue").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
  });

  // ---------- Queue ----------
  function slaStatus(t, now) {
    if (t.status === "Resolved") return { cls: "ok", label: "Resolved", rank: 3 };
    const left = t.due - now;
    const window = SLA[t.priority].resolveHours * HOUR;
    if (left < 0) return { cls: "late", label: `Overdue ${duration(left)}`, rank: 0 };
    if (left < window * 0.25) return { cls: "warn", label: `Due in ${duration(left)}`, rank: 1 };
    return { cls: "ok", label: `Due in ${duration(left)}`, rank: 2 };
  }

  function updateCount() {
    const open = state.tickets.filter((t) => t.status !== "Resolved").length;
    $("queueCount").textContent = open;
  }

  function renderQueue() {
    const now = Date.now();
    const filter = $("qFilter").value;
    const rows = state.tickets
      .map((t) => ({ t, s: slaStatus(t, now) }))
      .filter(({ t, s }) => filter === "all" || (filter === "open" ? t.status !== "Resolved" : s.rank < 2))
      .sort((a, b) => a.s.rank - b.s.rank || a.t.due - b.t.due);

    const open = state.tickets.filter((t) => t.status !== "Resolved");
    const atRisk = open.filter((t) => slaStatus(t, now).rank < 2).length;
    const urgent = open.filter((t) => /^P[12]/.test(t.priority)).length;
    $("queueKpis").innerHTML = [
      ["Open tickets", open.length],
      ["At risk or overdue", atRisk],
      ["Open P1 / P2", urgent],
      ["Fixed by self-service", state.deflected],
    ].map(([l, v]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");

    $("queueTable").innerHTML = `<thead><tr><th>Ticket</th><th>Issue</th><th>Category</th><th>Priority</th><th>SLA</th><th>Status</th></tr></thead><tbody>` +
      (rows.length ? rows.map(({ t, s }) => `<tr>
        <td class="mono">${esc(t.id)}${t.sample ? '<span class="sample">sample</span>' : ""}<div class="meta">${esc(timeLabel(t.created))}</div></td>
        <td><div class="desc">${esc(t.text)}</div><div class="meta">${esc(t.requester)} · ${esc(t.site)}</div></td>
        <td>${esc(t.category)}</td>
        <td><span class="pill ${pcode(t.priority)}">${esc(t.priority)}</span></td>
        <td><span class="pill ${s.cls}">${esc(s.label)}</span></td>
        <td class="row-actions"><select data-id="${esc(t.id)}" aria-label="Status for ${esc(t.id)}">
          ${["New", "In progress", "Resolved"].map((o) => `<option${o === t.status ? " selected" : ""}>${o}</option>`).join("")}
        </select></td></tr>`).join("")
        : `<tr><td colspan="6" class="muted">No tickets match this view.</td></tr>`) + `</tbody>`;
    updateCount();
  }

  $("queueTable").addEventListener("change", (e) => {
    const id = e.target.dataset && e.target.dataset.id;
    const t = state.tickets.find((x) => x.id === id);
    if (!t) return;
    t.status = e.target.value;
    save();
    renderQueue();
  });
  $("qFilter").addEventListener("change", renderQueue);
  $("resetQueue").addEventListener("click", () => {
    state = { tickets: sampleTickets(), next: 200101, deflected: 0 };
    save();
    renderQueue();
  });
  setInterval(() => { if (!$("view-queue").hidden) renderQueue(); }, 60e3);

  // ---------- How it works ----------
  let evalCache = null;
  function renderHow() {
    if (!evalCache) evalCache = { withNet: evaluate(EXAMPLES, KB, 4, { safetyNet: true }), modelOnly: evaluate(EXAMPLES, KB, 4, { safetyNet: false }) };
    const r = evalCache.withNet, m = evalCache.modelOnly;
    $("evalSummary").innerHTML = `Measured with 4-fold cross-validation on ${r.total} labelled tickets: each ticket is predicted by a model that never saw it. ` +
      `The model alone gets <b>${pct(m.accuracy)}</b> right; with the security safety net, <b>${pct(r.accuracy)}</b>. Guessing at random would score 13%.`;
    const mByCat = Object.fromEntries(m.rows.map((x) => [x.category, x]));
    $("evalTable").innerHTML = `<thead><tr><th>Category</th><th class="num">Tickets</th><th class="num">Precision</th><th class="num">Recall</th><th><span class="sr-only">Recall bar</span></th><th class="num">Model only</th></tr></thead><tbody>` +
      r.rows.map((x) => `<tr><td>${esc(x.category)}</td><td class="num">${x.testCount}</td><td class="num">${pct(x.precision)}</td><td class="num">${pct(x.recall)}</td>
        <td><div class="bar"><span style="width:${Math.round(x.recall * 100)}%"></span></div></td><td class="num">${pct(mByCat[x.category].recall)}</td></tr>`).join("") + `</tbody>`;
    $("evalNote").textContent = "Precision: when the model says a category, how often it's right. Recall: of the tickets that really belong to a category, how many it finds. " +
      "The safety-net words were written after reading the examples, so on brand-new tickets its benefit will likely be smaller than shown.";
    const lv = ["High", "Medium", "Low"];
    const M = { High: { High: "P1", Medium: "P2", Low: "P3" }, Medium: { High: "P2", Medium: "P3", Low: "P4" }, Low: { High: "P3", Medium: "P4", Low: "P4" } };
    $("matrixTable").className = "matrix";
    $("matrixTable").innerHTML = `<thead><tr><th>Impact ↓ / Urgency →</th>${lv.map((u) => `<th>${u}</th>`).join("")}</tr></thead><tbody>` +
      lv.map((i) => `<tr><td><b>${i}</b></td>${lv.map((u) => `<td><span class="pill ${M[i][u]}">${M[i][u]}</span></td>`).join("")}</tr>`).join("") + `</tbody>`;
  }

  // ---------- Start ----------
  updateCount();
  const start = (location.hash || "").replace("#", "");
  showTab(["queue", "how"].includes(start) ? start : "help");
})();
