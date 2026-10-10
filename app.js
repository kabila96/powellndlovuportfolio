/* ==========================================================================
   Site behaviour: header, mobile menu, active links, scroll reveal
   ========================================================================== */
(() => {
	const header = document.getElementById('header');
	const hamburger = document.querySelector('.hamburger');
	const menu = document.getElementById('menu');
	const menuLinks = menu.querySelectorAll('a');

	const setMenu = (open) => {
		hamburger.classList.toggle('active', open);
		menu.classList.toggle('active', open);
		hamburger.setAttribute('aria-expanded', String(open));
		hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
		document.body.style.overflow = open ? 'hidden' : '';
		document.body.classList.toggle('menu-open', open);
	};
	hamburger.addEventListener('click', () => setMenu(!menu.classList.contains('active')));
	menuLinks.forEach((a) => a.addEventListener('click', () => setMenu(false)));
	document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('active')) setMenu(false); });

	const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
	onScroll();
	document.addEventListener('scroll', onScroll, { passive: true });

	// Highlight the nav link for the section in view
	const sections = [...document.querySelectorAll('main section[id]')];
	const sectionObserver = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			menuLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
		});
	}, { rootMargin: '-45% 0px -50% 0px' });
	sections.forEach((s) => sectionObserver.observe(s));

	// Reveal content as it scrolls into view
	const revealTargets = document.querySelectorAll('.section-head, .service-item, .project-card, .live-head, .dash-card, .process-steps li, .col-left, .col-right, .contact-item, .contact-form');
	revealTargets.forEach((el) => el.classList.add('reveal'));
	const revealObserver = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				entry.target.classList.add('visible');
				revealObserver.unobserve(entry.target);
			}
		});
	}, { threshold: 0.12 });
	revealTargets.forEach((el) => revealObserver.observe(el));

	document.getElementById('year').textContent = new Date().getFullYear();
})();

/* =====================================================================
   GeoAI ASSISTANT — embedded chat widget
   Talks to the Flask/RAG backend on Render. No API keys live here.
   Entry points: floating radar button, nav link, hero button,
   "Ask AI" on every project card, highlight-any-text-to-ask, and the "/" key.
   ===================================================================== */
(() => {
  "use strict";

  const API_BASE = "https://powell-geoai-chatbot.onrender.com";
  const CONTACT_EMAIL = "powellndlovu@gmail.com";
  const STORE_KEY = "pa-geoai-chat-v1";
  const MAX_CHARS = 1000;
  const MAX_HISTORY = 12;

  let history = load();
  let busy = false;
  let health = "unknown"; // unknown | waking | online | offline
  let healthPromise = null;
  let lastQuestion = "";

  /* ------------------------------------------------------------ helpers */
  function load() {
    try { const v = JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]"); return Array.isArray(v) ? v : []; }
    catch { return []; }
  }
  function save() { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-30))); } catch {} }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);

  function md(text) {
    const inline = (line) => {
      let h = esc(line);
      h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
      h = h.replace(/\[S(\d{1,2})\]/g, '<span class="pa-cite" title="Source $1">S$1</span>');
      return h;
    };
    const out = []; let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const raw of String(text).split("\n")) {
      const line = raw.trim();
      const b = line.match(/^[-*•]\s+(.*)$/), n = line.match(/^\d+[.)]\s+(.*)$/);
      if (b || n) {
        const t = b ? "ul" : "ol";
        if (list !== t) { close(); out.push(`<${t}>`); list = t; }
        out.push(`<li>${inline((b || n)[1])}</li>`);
      } else if (!line) close();
      else { close(); const hd = line.match(/^#{1,4}\s+(.*)$/); out.push(`<p>${hd ? `<strong>${inline(hd[1])}</strong>` : inline(line)}</p>`); }
    }
    close();
    return out.join("");
  }

  /* ------------------------------------------------------------ build the widget */
  const contourPaths = Array.from({ length: 7 }, (_, i) => {
    const y = 12 + i * 16, a = 6 + (i % 3) * 4;
    return `<path d="M-20 ${y} C 60 ${y - a}, 120 ${y + a}, 200 ${y} S 340 ${y - a}, 440 ${y}" fill="none" stroke="#fff" stroke-width="1"/>`;
  }).join("");

  const launcher = document.createElement("button");
  launcher.className = "pa-launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open Powell's GeoAI assistant");
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "pa-panel");
  launcher.innerHTML = `
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".9"/>
      <circle cx="20" cy="20" r="10" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".55"/>
      <path d="M4 20h32M20 4v32" stroke="currentColor" stroke-width=".9" opacity=".35"/>
      <g class="pa-sweep"><path d="M20 20 L20 4 A16 16 0 0 1 33 11 Z" fill="currentColor" opacity=".35"/></g>
      <circle cx="27" cy="13" r="2.2" fill="currentColor"/>
      <circle cx="12" cy="25" r="1.6" fill="currentColor" opacity=".8"/>
    </svg>
    <span class="pa-launcher-badge">AI</span>`;

  const teaser = document.createElement("div");
  teaser.className = "pa-teaser";
  teaser.setAttribute("role", "status");
  teaser.innerHTML = `<button class="pa-teaser-x" type="button" aria-label="Dismiss">×</button>
    Hi! I'm Powell's <strong>GeoAI assistant</strong>. Ask me about his projects, skills or how to hire him.`;

  const panel = document.createElement("section");
  panel.className = "pa-panel";
  panel.id = "pa-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "GeoAI assistant chat");
  panel.innerHTML = `
    <header class="pa-head">
      <svg class="pa-contours" viewBox="0 0 420 130" preserveAspectRatio="none" aria-hidden="true">${contourPaths}</svg>
      <div class="pa-head-row">
        <div class="pa-avatar" aria-hidden="true">
          <img src="powell.jpg" alt="" onerror="this.remove()">
          <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="none" stroke="#fff" stroke-width="1.6"/>
            <ellipse cx="20" cy="20" rx="6" ry="14" fill="none" stroke="#fff" stroke-width="1.2" opacity=".8"/>
            <path d="M6 20h28M8.5 13h23M8.5 27h23" stroke="#fff" stroke-width="1" opacity=".6"/></svg>
        </div>
        <div class="pa-title">
          <strong>GeoAI Assistant</strong>
          <span class="pa-status" data-state="unknown"><i></i><span class="pa-status-text">Ready to connect</span></span>
        </div>
        <button class="pa-icon-btn pa-new" type="button" title="New conversation" aria-label="New conversation">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
        <button class="pa-icon-btn pa-expand" type="button" title="Expand" aria-label="Expand chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>
        <button class="pa-icon-btn pa-close" type="button" title="Close (Esc)" aria-label="Close chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="pa-hud" aria-hidden="true"><span>Layer: Portfolio + Profile</span><span class="pa-clock">--:--:-- UTC</span></div>
      <div class="pa-scanbar" aria-hidden="true"></div>
    </header>
    <div class="pa-body" role="log" aria-live="polite"></div>
    <footer class="pa-foot">
      <form class="pa-form">
        <label class="pa-sr" for="pa-input">Ask the GeoAI assistant</label>
        <textarea id="pa-input" rows="1" maxlength="${MAX_CHARS}" placeholder="Ask about projects, skills, services…"></textarea>
        <button class="pa-send" type="submit" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.5 21 3l-8.5 18-2-7.5z"/></svg></button>
      </form>
      <div class="pa-foot-meta"><span>Answers cite Powell's profile &amp; portfolio</span><span><kbd>/</kbd> open · <kbd>Esc</kbd> close</span></div>
    </footer>`;

  document.body.append(teaser, panel, launcher);

  const bodyEl = $(".pa-body", panel);
  const input = $("#pa-input", panel);
  const form = $(".pa-form", panel);
  const sendBtn = $(".pa-send", panel);
  const statusEl = $(".pa-status", panel);
  const statusText = $(".pa-status-text", panel);

  /* ------------------------------------------------------------ welcome screen */
  const MISSIONS = [
    ["Explore projects", [
      "How does Powell map land cover from satellite imagery?",
      "Which live dashboards can I try?",
      "Can you monitor crop or vegetation health for my farm?",
    ]],
    ["Skills & credentials", [
      "What are Powell's qualifications?",
      "Which remote sensing tools does he use?",
    ]],
    ["Work with Powell", [
      "What consulting services do you offer?",
      "Can you build a dashboard or chatbot for my organisation?",
      "How are prices and timelines agreed?",
    ]],
  ];

  function renderWelcome() {
    const wrap = document.createElement("div");
    wrap.className = "pa-welcome";
    wrap.innerHTML = `<h4>Interrogate the portfolio.</h4>
      <p>I answer from Powell's consultancy profile, CV and portfolio sites, and I show my sources. Pick a mission or ask your own question.</p>
      <div class="pa-missions">${MISSIONS.map(([label, qs]) =>
        `<div class="pa-mission-label">${esc(label)}</div><div class="pa-chips">${qs.map((q) =>
          `<button type="button" class="pa-chip">${esc(q)}</button>`).join("")}</div>`).join("")}</div>`;
    wrap.addEventListener("click", (e) => { const c = e.target.closest(".pa-chip"); if (c) ask(c.textContent); });
    bodyEl.appendChild(wrap);
  }

  function needsCTA(text) { return /quot|consult|contact|pric|cost|fee|budget|timeline|availab|hire|get in touch/i.test(text); }

  function addMsg(role, text, opts = {}) {
    const row = document.createElement("div");
    row.className = `pa-msg ${role === "user" ? "pa-user" : "pa-bot"}${opts.error ? " pa-error" : ""}`;
    const bubble = document.createElement("div");
    bubble.className = "pa-bubble";
    if (role === "user") bubble.textContent = text;
    else {
      bubble.innerHTML = md(text);
      const sources = opts.sources || [];
      if (sources.length) {
        bubble.insertAdjacentHTML("beforeend", `<div class="pa-sources">${sources.map((s) => {
          const label = esc(s.type === "document" ? "Consultancy profile" : s.title) + (s.section ? ` · ${esc(s.section)}` : "");
          return /^https?:\/\//.test(s.url)
            ? `<a class="pa-source" href="${esc(s.url)}" target="_blank" rel="noopener" title="${label}"><b>${esc(s.id)}</b>${label}</a>`
            : `<span class="pa-source" title="${label}"><b>${esc(s.id)}</b>${label}</span>`;
        }).join("")}</div>`);
      }
      if (opts.cta) {
        const subject = encodeURIComponent("Consultation enquiry from your portfolio");
        const bodyTxt = encodeURIComponent(`Hi Powell,\n\nI was chatting with your GeoAI assistant about: "${opts.cta}"\n\n`);
        bubble.insertAdjacentHTML("beforeend", `<div class="pa-cta-row">
          <a class="pa-cta" href="mailto:${CONTACT_EMAIL}?subject=${subject}&body=${bodyTxt}">✉ Email Powell</a>
          <a class="pa-cta pa-to-form" href="#contact">→ Send via contact form</a></div>`);
        const toForm = bubble.querySelector(".pa-to-form");
        toForm.addEventListener("click", (e) => { e.preventDefault(); handOffToForm(opts.cta); });
      }
    }
    if (opts.retry) {
      const b = document.createElement("button");
      b.className = "pa-retry"; b.type = "button"; b.textContent = "Try again";
      b.addEventListener("click", () => { row.remove(); ask(opts.retry, true); });
      bubble.appendChild(b);
    }
    row.appendChild(bubble);
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return row;
  }

  const THINKING = ["Scanning profile layers…", "Querying the portfolio index…", "Cross-checking sources…", "Composing a grounded answer…"];
  function showTyping() {
    const row = document.createElement("div");
    row.className = "pa-msg pa-bot pa-typing";
    row.innerHTML = `<div class="pa-bubble"><span class="pa-orbit"></span><span class="pa-typing-text">${THINKING[0]}</span></div>`;
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    let i = 0;
    const label = row.querySelector(".pa-typing-text");
    const timer = setInterval(() => {
      i += 1;
      label.textContent = health === "waking" ? "Waking the server (free tier, up to a minute)…" : THINKING[i % THINKING.length];
    }, 1600);
    return () => { clearInterval(timer); row.remove(); };
  }

  /* ------------------------------------------------------------ server status (Render free tier sleeps) */
  function setStatus(state, text) {
    health = state;
    statusEl.dataset.state = state;
    statusText.textContent = text;
  }

  function warmUp() {
    if (health === "online") return Promise.resolve(true);
    if (healthPromise) return healthPromise;
    const slow = setTimeout(() => { if (health !== "online") setStatus("waking", "Waking server · ~30–60s"); }, 2500);
    setStatus("waking", "Connecting…");
    const ctrl = new AbortController();
    const kill = setTimeout(() => ctrl.abort(), 75000);
    healthPromise = fetch(`${API_BASE}/api/health`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.knowledge_base_ready ? "online" : "offline",
          d.knowledge_base_ready ? "Online · ready" : "Knowledge base not ready");
        return d.knowledge_base_ready;
      })
      .catch(() => { setStatus("offline", "Offline · use the contact form"); return false; })
      .finally(() => { clearTimeout(slow); clearTimeout(kill); healthPromise = null; });
    return healthPromise;
  }

  /* ------------------------------------------------------------ asking */
  async function ask(raw, isRetry = false) {
    const q = String(raw || "").trim().slice(0, MAX_CHARS);
    if (!q || busy) return;
    openPanel();
    busy = true; sendBtn.disabled = true; panel.classList.add("pa-busy");
    $(".pa-welcome", panel)?.remove();

    const prior = history.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content }));
    if (!isRetry) { addMsg("user", q); history.push({ role: "user", content: q }); save(); }
    lastQuestion = q;
    const stopTyping = showTyping();

    try {
      if (health !== "online") await warmUp();
      const ctrl = new AbortController();
      const kill = setTimeout(() => ctrl.abort(), 90000);
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history: isRetry ? prior.slice(0, -1) : prior }),
        signal: ctrl.signal,
      });
      clearTimeout(kill);
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data.error || `The assistant returned an error (${res.status}).`);
      if (health !== "online") setStatus("online", "Online");
      stopTyping();
      const cta = needsCTA(q) || needsCTA(data.answer) ? q : null;
      addMsg("bot", data.answer, { sources: data.sources, cta });
      history.push({ role: "assistant", content: data.answer, sources: data.sources, cta });
      save();
    } catch (err) {
      stopTyping();
      const msg = err.name === "AbortError"
        ? "That took too long. The server may still be waking up, so please try again."
        : err instanceof TypeError
          ? `I couldn't reach the assistant right now. You can still email Powell at ${CONTACT_EMAIL} or use the contact form below.`
          : err.message;
      if (err instanceof TypeError) setStatus("offline", "Offline · use the contact form");
      addMsg("bot", msg, { error: true, retry: q });
    } finally {
      busy = false; sendBtn.disabled = false; panel.classList.remove("pa-busy");
      input.focus({ preventScroll: true });
    }
  }

  /* Hand the conversation to the page's Formspree contact form */
  function handOffToForm(question) {
    const msg = document.getElementById("message");
    if (msg && !msg.value.trim()) {
      msg.value = `Hi Powell, I'd like to discuss: ${question}\n\n(Sent after chatting with your GeoAI assistant.)`;
    }
    if (window.innerWidth < 560) closePanel();
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => document.getElementById("name")?.focus({ preventScroll: true }), 700);
  }

  /* ------------------------------------------------------------ open / close */
  let lastFocus = null;
  function openPanel() {
    if (panel.classList.contains("pa-open")) return;
    lastFocus = document.activeElement;
    hideTeaser(true);
    panel.classList.add("pa-open");
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Close Powell's GeoAI assistant");
    setTimeout(() => input.focus({ preventScroll: true }), 120);
    warmUp();
  }
  function closePanel() {
    panel.classList.remove("pa-open");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open Powell's GeoAI assistant");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  const toggle = () => (panel.classList.contains("pa-open") ? closePanel() : openPanel());

  launcher.addEventListener("click", toggle);
  $(".pa-close", panel).addEventListener("click", closePanel);
  $(".pa-expand", panel).addEventListener("click", () => panel.classList.toggle("pa-wide"));
  $(".pa-new", panel).addEventListener("click", () => {
    history = []; save(); bodyEl.innerHTML = ""; renderWelcome(); input.focus();
  });

  form.addEventListener("submit", (e) => { e.preventDefault(); const v = input.value; input.value = ""; grow(); ask(v); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  const grow = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; };
  input.addEventListener("input", grow);

  document.querySelectorAll("[data-pa-open]").forEach((el) =>
    el.addEventListener("click", (e) => { e.preventDefault(); openPanel(); }));

  document.addEventListener("keydown", (e) => {
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openPanel(); }
    if (e.key === "Escape" && panel.classList.contains("pa-open")) closePanel();
  });

  /* ------------------------------------------------------------ "Ask AI" on case studies and dashboards */
  const projectQuestion = (title) =>
    `Tell me about Powell's "${title}" work: what problem does it solve, which methods and tools does it use, and how could it help my organisation?`;

  document.querySelectorAll(".project-card").forEach((card) => {
    const title = card.querySelector("h3")?.textContent.trim();
    const actions = card.querySelector(".project-actions");
    if (!title || !actions) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pa-inline-ask";
    b.textContent = "✦ Ask AI about this";
    b.addEventListener("click", () => ask(projectQuestion(title)));
    actions.appendChild(b);
  });

  document.querySelectorAll(".dash-card").forEach((card) => {
    const media = card.querySelector(".dash-media");
    const title = card.querySelector("h3")?.textContent.trim();
    if (!media || !title) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pa-card-ask";
    b.textContent = "✦ Ask AI";
    b.setAttribute("aria-label", `Ask the AI assistant about ${title}`);
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); ask(projectQuestion(title)); });
    media.appendChild(b);
  });

  /* ------------------------------------------------------------ highlight any text → ask */
  const selBtn = document.createElement("button");
  selBtn.type = "button";
  selBtn.className = "pa-select-ask";
  selBtn.textContent = "✦ Ask AI about this";
  let selText = "";
  selBtn.addEventListener("mousedown", (e) => e.preventDefault());
  selBtn.addEventListener("click", () => {
    const t = selText; hideSel(); window.getSelection()?.removeAllRanges();
    ask(`Explain "${t}" in the context of Powell's work and services.`);
  });
  function hideSel() { selBtn.remove(); selText = ""; }
  document.addEventListener("mouseup", (e) => {
    if (e.target === selBtn) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().replace(/\s+/g, " ").trim() : "";
      const node = sel && sel.anchorNode ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement) : null;
      if (!text || text.length < 4 || text.length > 160 || !node || node.closest(".pa-panel, input, textarea, form")) { hideSel(); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect.width) { hideSel(); return; }
      selText = text;
      selBtn.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
      selBtn.style.top = `${rect.top + window.scrollY - 10}px`;
      document.body.appendChild(selBtn);
    }, 10);
  });
  document.addEventListener("scroll", () => { if (selBtn.isConnected && !window.getSelection()?.toString()) hideSel(); }, { passive: true });

  /* ------------------------------------------------------------ teaser + live UTC clock */
  let teaserSeen = false;
  try { teaserSeen = sessionStorage.getItem("pa-teaser") === "1"; } catch {}
  function hideTeaser(remember) {
    teaser.classList.remove("pa-show");
    if (remember) { try { sessionStorage.setItem("pa-teaser", "1"); } catch {} }
  }
  if (!teaserSeen) {
    setTimeout(() => { if (!panel.classList.contains("pa-open")) teaser.classList.add("pa-show"); }, 6000);
    setTimeout(() => hideTeaser(false), 20000);
  }
  teaser.addEventListener("click", (e) => {
    if (e.target.closest(".pa-teaser-x")) { hideTeaser(true); return; }
    openPanel();
  });

  const clock = $(".pa-clock", panel);
  setInterval(() => {
    if (panel.classList.contains("pa-open")) clock.textContent = new Date().toISOString().slice(11, 19) + " UTC";
  }, 1000);

  /* Wake the free Render server quietly after the visitor first interacts,
     so the first answer is fast by the time they open the chat. */
  const prewarm = () => { warmUp(); ["scroll", "pointermove", "touchstart", "keydown"].forEach((ev) => window.removeEventListener(ev, prewarm)); };
  ["scroll", "pointermove", "touchstart", "keydown"].forEach((ev) => window.addEventListener(ev, prewarm, { once: true, passive: true }));

  /* ------------------------------------------------------------ restore session */
  if (history.length) {
    history.forEach((m) => addMsg(m.role, m.content, { sources: m.sources || [], cta: m.cta || null }));
  } else {
    renderWelcome();
  }
})();
