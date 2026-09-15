(() => {
  "use strict";

  const { user, codingSince, categories, projects, languageColors, stackIgnore } = window.PORTFOLIO;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = () => motionQuery.matches;

  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
    );
  const icon = (name, extra = "") =>
    `<svg class="i${name === "github" ? " i--fill" : ""}" aria-hidden="true" ${extra}><use href="#i-${name}"/></svg>`;
  const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const langColor = (name) => languageColors[name] || "#8888a0";
  const ignoredLanguages = new Set(stackIgnore);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const timeAgo = (input) => {
    const seconds = (new Date(input).getTime() - Date.now()) / 1000;
    const units = [
      ["year", 31536000],
      ["month", 2592000],
      ["week", 604800],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ];
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return "just now";
  };
  const formatDate = (input) =>
    new Date(input).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  for (const p of projects) {
    p._key = slug(p.repo || p.title);
    p._search = [p.title, p.repo, p.description, categoryById.get(p.category)?.label, ...(p.tags || []), ...Object.keys(p.languages || {})]
      .join(" ")
      .toLowerCase();
  }

  /* ------------------------------------------------------------------ */
  /* Reveal on scroll                                                    */
  /* ------------------------------------------------------------------ */

  const revealed = new Set();
  const revealObserver =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.classList.add("is-in");
              if (entry.target.dataset.key) revealed.add(entry.target.dataset.key);
              revealObserver.unobserve(entry.target);
            }
          },
          { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
        )
      : null;

  const observeReveal = (root = document) => {
    for (const el of $$("[data-reveal]:not(.is-in)", root)) {
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add("is-in");
    }
  };

  /* ------------------------------------------------------------------ */
  /* Navigation, scroll progress                                         */
  /* ------------------------------------------------------------------ */

  const initNav = () => {
    const nav = $(".nav");
    const progress = $(".progress");
    const toggle = $(".nav__toggle");
    let ticking = false;

    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
      nav.classList.toggle("is-scrolled", scrollY > 12);
      ticking = false;
    };
    addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true },
    );
    update();

    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    $$(".nav__links a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));

    const links = $$(".nav__links a[href^='#']");
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          for (const a of links) a.classList.toggle("is-active", a.hash === `#${entry.target.id}`);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const a of links) {
      const section = document.getElementById(a.hash.slice(1));
      if (section) sectionObserver.observe(section);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Hero: particle constellation                                        */
  /* ------------------------------------------------------------------ */

  const initHeroCanvas = () => {
    const canvas = $(".hero__canvas");
    const hero = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const LINK = 128;
    const hues = [262, 188, 322];
    const pointer = { x: -9999, y: -9999 };
    let width = 0;
    let height = 0;
    let points = [];
    let running = false;
    let inView = true;
    let frame = 0;

    const makePoint = () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.12 + Math.random() * 0.25;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx,
        vy,
        bx: vx,
        by: vy,
        r: 0.7 + Math.random() * 1.5,
        hue: hues[(Math.random() * hues.length) | 0],
      };
    };

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      width = hero.clientWidth;
      height = hero.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(Math.min(110, Math.max(34, (width * height) / 15000)));
      while (points.length < target) points.push(makePoint());
      points.length = target;
      for (const p of points) {
        p.x = Math.min(p.x, width);
        p.y = Math.min(p.y, height);
      }
      if (!running) draw(false);
    };

    const draw = (move) => {
      ctx.clearRect(0, 0, width, height);
      const n = points.length;

      if (move) {
        for (const p of points) {
          const dx = pointer.x - p.x;
          const dy = pointer.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 200 && dist > 1) {
            const force = (1 - dist / 200) * 0.03;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
          p.vx += (p.bx - p.vx) * 0.015;
          p.vy += (p.by - p.vy) * 0.015;
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -20) p.x = width + 20;
          else if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          else if (p.y > height + 20) p.y = -20;
        }
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const a = points[i];
        for (let j = i + 1; j < n; j++) {
          const b = points[j];
          const dx = a.x - b.x;
          if (dx > LINK || dx < -LINK) continue;
          const dy = a.y - b.y;
          if (dy > LINK || dy < -LINK) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          ctx.strokeStyle = `hsla(${a.hue} 90% 70% / ${(1 - Math.sqrt(d2) / LINK) * 0.28})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        const pdx = a.x - pointer.x;
        const pdy = a.y - pointer.y;
        const pd = Math.hypot(pdx, pdy);
        if (pd < 170) {
          ctx.strokeStyle = `hsla(${a.hue} 95% 75% / ${(1 - pd / 170) * 0.55})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }

      for (const p of points) {
        ctx.fillStyle = `hsla(${p.hue} 95% 76% / 0.9)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      draw(true);
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || !inView || document.hidden || reducedMotion()) return;
      running = true;
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    new ResizeObserver(resize).observe(hero);
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      inView ? start() : stop();
    }).observe(hero);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    motionQuery.addEventListener("change", () => {
      stop();
      draw(false);
      start();
    });

    hero.addEventListener(
      "pointermove",
      (e) => {
        const rect = hero.getBoundingClientRect();
        pointer.x = e.clientX - rect.left;
        pointer.y = e.clientY - rect.top;
      },
      { passive: true },
    );
    hero.addEventListener("pointerleave", () => {
      pointer.x = pointer.y = -9999;
    });
  };

  /* ------------------------------------------------------------------ */
  /* Hero: rotating word, stat counters, marquee                         */
  /* ------------------------------------------------------------------ */

  const initRotator = () => {
    const el = $("[data-rotate]");
    if (!el || !el.animate) return;
    const words = JSON.parse(el.dataset.rotate);
    let index = 0;
    setInterval(async () => {
      if (reducedMotion() || document.hidden) return;
      index = (index + 1) % words.length;
      await el.animate(
        [
          { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
          { opacity: 0, transform: "translateY(-0.45em)", filter: "blur(6px)" },
        ],
        { duration: 260, easing: "ease-in", fill: "forwards" },
      ).finished;
      el.textContent = words[index];
      el.animate(
        [
          { opacity: 0, transform: "translateY(0.45em)", filter: "blur(6px)" },
          { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
        ],
        { duration: 520, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" },
      );
    }, 2600);
  };

  const languageTotals = () => {
    const totals = new Map();
    for (const p of projects) {
      for (const [name, bytes] of Object.entries(p.languages || {})) {
        if (ignoredLanguages.has(name) || !bytes) continue;
        const entry = totals.get(name) || { bytes: 0, projects: 0 };
        entry.bytes += bytes;
        entry.projects += 1;
        totals.set(name, entry);
      }
    }
    return [...totals.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.bytes - a.bytes);
  };

  const tagTotals = () => {
    const counts = new Map();
    for (const p of projects) for (const tag of p.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };

  const initStats = () => {
    const values = {
      projects: projects.length,
      languages: languageTotals().length,
      years: new Date().getFullYear() - codingSince,
    };
    for (const el of $$("[data-stat]")) {
      const target = values[el.dataset.stat] ?? 0;
      if (reducedMotion()) {
        el.textContent = target;
        continue;
      }
      const startAt = performance.now() + 900;
      const duration = 1500;
      const step = (now) => {
        const k = Math.max(0, Math.min(1, (now - startAt) / duration));
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  };

  const initMarquee = () => {
    const track = $(".marquee__track");
    if (!track) return;
    const items = [
      ...languageTotals().slice(0, 8).map((l) => l.name),
      ...tagTotals().slice(0, 12).map(([tag]) => tag),
    ];
    const group = `<ul class="marquee__group">${[...new Set(items)]
      .map((item) => `<li class="marquee__item">${escapeHtml(item)}</li>`)
      .join("")}</ul>`;
    track.innerHTML = group + group;
  };

  /* ------------------------------------------------------------------ */
  /* Live repository visibility                                          */
  /* ------------------------------------------------------------------ */

  const CACHE_KEY = `gh-public-repos:v1:${user.toLowerCase()}`;
  const CACHE_TTL = 10 * 60 * 1000;
  // state: "loading" | "live" | "stale" (cached, GitHub unreachable) | "offline" (no data at all)
  const live = { state: "loading", repos: new Map(), checkedAt: 0 };

  const readCache = () => {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    } catch {
      return null;
    }
  };
  const writeCache = (payload) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {
      /* storage unavailable: skip caching */
    }
  };

  const fetchPublicRepos = async () => {
    const repos = [];
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(
        `https://api.github.com/users/${encodeURIComponent(user)}/repos?type=owner&per_page=100&page=${page}`,
      );
      if (!res.ok) throw new Error(`GitHub responded with ${res.status}`);
      const batch = await res.json();
      for (const r of batch) {
        repos.push({ name: r.name, stars: r.stargazers_count, pushed: r.pushed_at, url: r.html_url, homepage: r.homepage || "" });
      }
      if (batch.length < 100) break;
    }
    return repos;
  };

  const applyRepos = (payload, state) => {
    live.repos = new Map(payload.repos.map((r) => [r.name.toLowerCase(), r]));
    live.checkedAt = payload.t;
    live.state = state;
  };

  const checkVisibility = async (force = false) => {
    const cached = readCache();
    if (!force && cached && Date.now() - cached.t < CACHE_TTL) {
      applyRepos(cached, "live");
      return;
    }
    try {
      const payload = { t: Date.now(), repos: await fetchPublicRepos() };
      writeCache(payload);
      applyRepos(payload, "live");
    } catch {
      if (cached) applyRepos(cached, "stale");
      else live.state = "offline";
    }
  };

  const hasLiveData = () => live.state === "live" || live.state === "stale";
  const liveRepo = (p) => (hasLiveData() && p.repo ? live.repos.get(p.repo.toLowerCase()) : undefined);
  const visibilityOf = (p) => {
    if (!hasLiveData() || !p.repo) return p.visibility;
    return live.repos.has(p.repo.toLowerCase()) ? "public" : "private";
  };
  const updatedOf = (p) => liveRepo(p)?.pushed || p.updated;

  /* ------------------------------------------------------------------ */
  /* Projects: state, filtering, rendering                               */
  /* ------------------------------------------------------------------ */

  const state = { category: "all", visibility: "all", query: "", sort: "updated" };
  const params = new URLSearchParams(location.search);
  if (categoryById.has(params.get("cat"))) state.category = params.get("cat");
  if (["public", "private"].includes(params.get("vis"))) state.visibility = params.get("vis");
  if (["created", "name"].includes(params.get("sort"))) state.sort = params.get("sort");
  state.query = params.get("q") || "";

  const els = {
    results: $("#project-results"),
    summary: $("#results-summary"),
    chips: $("#category-chips"),
    visibility: $("#visibility-filter"),
    search: $("#project-search"),
    sort: $("#project-sort"),
    status: $("#visibility-status"),
    statusText: $("#visibility-status .status__text"),
    refresh: $("#visibility-refresh"),
  };

  const syncUrl = () => {
    const next = new URLSearchParams();
    if (state.category !== "all") next.set("cat", state.category);
    if (state.visibility !== "all") next.set("vis", state.visibility);
    if (state.sort !== "updated") next.set("sort", state.sort);
    if (state.query.trim()) next.set("q", state.query.trim());
    const qs = next.toString();
    history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
  };

  const matches = (p, { ignoreCategory = false, ignoreVisibility = false } = {}) => {
    if (!ignoreCategory && state.category !== "all" && p.category !== state.category) return false;
    if (!ignoreVisibility && state.visibility !== "all" && visibilityOf(p) !== state.visibility) return false;
    const terms = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    return terms.every((t) => p._search.includes(t));
  };

  const sortProjects = (list) => {
    const sorted = [...list];
    if (state.sort === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (state.sort === "created") sorted.sort((a, b) => Date.parse(b.created) - Date.parse(a.created));
    else sorted.sort((a, b) => Date.parse(updatedOf(b)) - Date.parse(updatedOf(a)));
    return sorted;
  };

  const languageShares = (languages = {}) => {
    const entries = Object.entries(languages).filter(([, bytes]) => bytes > 0);
    const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
    if (!total) return [];
    const shares = entries
      .sort((a, b) => b[1] - a[1])
      .map(([name, bytes]) => ({ name, pct: (bytes / total) * 100 }));
    const main = shares.filter((l) => l.pct >= 2.5).slice(0, 4);
    const rest = 100 - main.reduce((sum, l) => sum + l.pct, 0);
    if (rest >= 0.5) main.push({ name: "Other", pct: rest });
    return main;
  };
  const pctLabel = (pct) => (pct < 1 ? "<1%" : `${Math.round(pct)}%`);

  const badgeHtml = (p, fresh, i) => {
    if (live.state === "loading") {
      return `<span class="badge badge--loading" title="Checking visibility on GitHub…">${icon("refresh")}Checking</span>`;
    }
    const note =
      live.state === "live"
        ? "Checked live against GitHub"
        : live.state === "stale"
          ? "GitHub unreachable, showing cached visibility"
          : "GitHub unreachable, showing last known visibility";
    const cls = `badge${fresh ? " badge--fresh" : ""}`;
    const style = fresh ? ` style="--i:${Math.min(i, 20)}"` : "";
    return visibilityOf(p) === "public"
      ? `<span class="${cls} badge--public" title="Public repository · ${note}"${style}>${icon("globe")}Public</span>`
      : `<span class="${cls} badge--private" title="Private repository · ${note}"${style}>${icon("lock")}Private</span>`;
  };

  const linksHtml = (p, wasPrivate) => {
    const repo = liveRepo(p);
    const out = [];
    if (visibilityOf(p) === "public") {
      const url = repo?.url || `https://github.com/${user}/${p.repo}`;
      out.push(
        `<a class="link${wasPrivate ? " link--unlocked" : ""}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${icon("github")}Source</a>`,
      );
    } else {
      out.push(`<span class="link link--locked" title="The source code is private for now">${icon("lock")}Private source</span>`);
    }
    const links = [...(p.links || [])];
    if (repo?.homepage && !links.some((l) => l.url.replace(/\/$/, "") === repo.homepage.replace(/\/$/, ""))) {
      links.push({ label: "Website", url: repo.homepage });
    }
    for (const link of links) {
      out.push(
        `<a class="link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)}${icon("arrow", "data-arrow")}</a>`,
      );
    }
    return out.join("");
  };

  const previousVisibility = new Map();

  const cardHtml = (p, i, mode) => {
    const category = categoryById.get(p.category);
    const shares = languageShares(p.languages);
    const updated = updatedOf(p);
    const stars = liveRepo(p)?.stars || 0;
    const visibility = visibilityOf(p);
    const wasPrivate = previousVisibility.get(p._key) === "private" && visibility === "public";

    let revealAttrs;
    if (mode === "filter") revealAttrs = `class="card is-in${reducedMotion() || document.startViewTransition ? "" : " card--pop"}${p.featured ? " card--featured" : ""}"`;
    else if (revealed.has(p._key)) revealAttrs = `class="card is-in${p.featured ? " card--featured" : ""}"`;
    else revealAttrs = `class="card${p.featured ? " card--featured" : ""}" data-reveal`;

    return `
      <article ${revealAttrs} data-key="${p._key}" style="--accent:${category.accent};--i:${Math.min(i, 8)};view-transition-name:card-${p._key}">
        <div class="card__body">
          <div class="card__top">
            <span class="card__cat">${p.featured ? icon("sparkle") : ""}${escapeHtml(p.featured ? "Featured" : category.label)}</span>
            ${badgeHtml(p, mode === "status", i)}
          </div>
          <div>
            <h4 class="card__title">${escapeHtml(p.title)}</h4>
            ${p.repo ? `<span class="card__repo">${escapeHtml(user)}/${escapeHtml(p.repo)}</span>` : ""}
          </div>
          <p class="card__desc">${escapeHtml(p.description)}</p>
          ${p.tags?.length ? `<ul class="tags">${p.tags.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` : ""}
          ${
            shares.length
              ? `<div class="langbar" role="img" aria-label="Languages: ${escapeHtml(shares.map((l) => `${l.name} ${pctLabel(l.pct)}`).join(", "))}">
                  ${shares.map((l) => `<span style="--w:${l.pct.toFixed(2)}%;--c:${l.name === "Other" ? "#4a4a5e" : langColor(l.name)}"></span>`).join("")}
                </div>
                <ul class="langs">
                  ${shares
                    .filter((l) => l.name !== "Other")
                    .slice(0, 3)
                    .map((l) => `<li><i style="--c:${langColor(l.name)}"></i>${escapeHtml(l.name)} <span>${pctLabel(l.pct)}</span></li>`)
                    .join("")}
                </ul>`
              : ""
          }
          <div class="card__foot">
            <div class="card__meta">
              <span title="Last push ${escapeHtml(formatDate(updated))}">Updated ${escapeHtml(timeAgo(updated))}</span>
              ${stars ? `<span>${icon("star")} ${stars}</span>` : ""}
            </div>
            <div class="card__links">${linksHtml(p, wasPrivate)}</div>
          </div>
        </div>
      </article>`;
  };

  const groupHtml = (category, items, mode) => `
    <section class="group" style="--accent:${category.accent}" aria-labelledby="group-${category.id}">
      <header class="group__head" style="view-transition-name:group-${category.id}">
        <h3 class="group__title" id="group-${category.id}"><span class="group__dot" aria-hidden="true"></span>${escapeHtml(category.label)}</h3>
        <p class="group__sub">${escapeHtml(category.sub)}</p>
        <span class="group__count">${items.length} ${items.length === 1 ? "project" : "projects"}</span>
      </header>
      <div class="grid">${items.map((p, i) => cardHtml(p, i, mode)).join("")}</div>
    </section>`;

  const emptyHtml = () => `
    <div class="empty">
      ${icon("search")}
      <h3>No projects match</h3>
      <p>Try another search term, or clear the filters.</p>
      <button class="btn" type="button" data-reset>Reset filters</button>
    </div>`;

  const buildChips = () => {
    const used = categories.filter((c) => projects.some((p) => p.category === c.id));
    els.chips.innerHTML = [{ id: "all", label: "All projects" }, ...used]
      .map(
        (c) =>
          `<button type="button" class="chip" data-category="${c.id}" aria-pressed="false"${c.accent ? ` style="--accent:${c.accent}"` : ""}>
            <span>${escapeHtml(c.label)}</span><span class="chip__count">0</span>
          </button>`,
      )
      .join("");
  };

  const updateControls = () => {
    const forCategories = projects.filter((p) => matches(p, { ignoreCategory: true }));
    for (const chip of $$(".chip", els.chips)) {
      const id = chip.dataset.category;
      const count = id === "all" ? forCategories.length : forCategories.filter((p) => p.category === id).length;
      chip.querySelector(".chip__count").textContent = count;
      chip.dataset.empty = String(count === 0);
      chip.setAttribute("aria-pressed", String(state.category === id));
    }

    const forVisibility = projects.filter((p) => matches(p, { ignoreVisibility: true }));
    const counts = { all: forVisibility.length, public: 0, private: 0 };
    for (const p of forVisibility) counts[visibilityOf(p)] += 1;
    els.visibility.dataset.active = state.visibility;
    for (const button of $$("button", els.visibility)) {
      const id = button.dataset.visibility;
      button.setAttribute("aria-pressed", String(state.visibility === id));
      button.querySelector(".seg__count").textContent = counts[id];
    }

    if (els.search.value !== state.query) els.search.value = state.query;
    els.sort.value = state.sort;
  };

  const renderStatus = () => {
    els.status.dataset.state = live.state;
    els.statusText.textContent = {
      loading: "Checking repository visibility on GitHub…",
      live: `Visibility checked live on GitHub ${timeAgo(live.checkedAt)}`,
      stale: `GitHub unreachable, using visibility cached ${timeAgo(live.checkedAt)}`,
      offline: "GitHub unreachable, showing last known visibility",
    }[live.state];
  };

  const render = (mode = "initial") => {
    const list = sortProjects(projects.filter((p) => matches(p)));
    let html;
    if (!list.length) html = emptyHtml();
    else if (state.category === "all") {
      html = categories
        .map((c) => {
          const items = list.filter((p) => p.category === c.id);
          return items.length ? groupHtml(c, items, mode) : "";
        })
        .join("");
    } else {
      html = groupHtml(categoryById.get(state.category), list, mode);
    }

    const pub = list.filter((p) => visibilityOf(p) === "public").length;
    const summary = `Showing <strong>${list.length}</strong> of ${projects.length} projects · ${pub} public · ${list.length - pub} private`;

    const commit = () => {
      els.results.innerHTML = html;
      els.summary.innerHTML = summary;
      if (mode === "filter") for (const p of list) revealed.add(p._key);
      observeReveal(els.results);
      for (const p of projects) previousVisibility.set(p._key, visibilityOf(p));
    };

    if (mode === "filter" && document.startViewTransition && !reducedMotion()) {
      document.startViewTransition(commit);
    } else {
      commit();
    }
  };

  const setState = (patch) => {
    Object.assign(state, patch);
    syncUrl();
    updateControls();
    render("filter");
  };

  const initProjects = async () => {
    buildChips();
    updateControls();
    render("initial");

    els.chips.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-category]");
      if (chip && chip.dataset.category !== state.category) setState({ category: chip.dataset.category });
    });
    els.visibility.addEventListener("click", (e) => {
      const button = e.target.closest("[data-visibility]");
      if (button && button.dataset.visibility !== state.visibility) setState({ visibility: button.dataset.visibility });
    });
    els.sort.addEventListener("change", () => setState({ sort: els.sort.value }));

    let searchTimer = 0;
    els.search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => setState({ query: els.search.value }), 140);
    });
    els.search.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.search.value) {
        e.stopPropagation();
        setState({ query: "" });
      }
    });
    addEventListener("keydown", (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      els.search.focus({ preventScroll: true });
      els.search.closest(".toolbar").scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    });

    els.results.addEventListener("click", (e) => {
      if (e.target.closest("[data-reset]")) setState({ category: "all", visibility: "all", query: "" });
    });

    els.refresh.addEventListener("click", async () => {
      els.refresh.disabled = true;
      live.state = "loading";
      renderStatus();
      await checkVisibility(true);
      renderStatus();
      updateControls();
      render("status");
      els.refresh.disabled = false;
    });

    // Card spotlight + tilt, delegated and throttled to one update per frame.
    if (finePointer.matches) {
      let pending = null;
      els.results.addEventListener("pointermove", (e) => {
        const firstInFrame = !pending;
        pending = e;
        if (!firstInFrame) return;
        requestAnimationFrame(() => {
          const body = pending.target.closest?.(".card__body");
          const event = pending;
          pending = null;
          if (!body) return;
          const rect = body.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          body.style.setProperty("--mx", `${x}px`);
          body.style.setProperty("--my", `${y}px`);
          if (!reducedMotion()) {
            body.style.setProperty("--ry", `${(x / rect.width - 0.5) * 5}deg`);
            body.style.setProperty("--rx", `${(0.5 - y / rect.height) * 5}deg`);
          }
        });
      });
      els.results.addEventListener("pointerout", (e) => {
        const body = e.target.closest?.(".card__body");
        if (body && !body.contains(e.relatedTarget)) {
          body.style.setProperty("--rx", "0deg");
          body.style.setProperty("--ry", "0deg");
        }
      });
    }

    setInterval(() => live.checkedAt && renderStatus(), 30000);

    await checkVisibility();
    renderStatus();
    updateControls();
    render("status");
  };

  /* ------------------------------------------------------------------ */
  /* Stack section                                                       */
  /* ------------------------------------------------------------------ */

  const initStack = () => {
    const languages = languageTotals();
    const total = languages.reduce((sum, l) => sum + l.bytes, 0) || 1;
    const top = languages.slice(0, 8);
    const max = top[0]?.bytes || 1;
    $("#language-bars").innerHTML = top
      .map(
        (l, i) => `
        <li style="--c:${langColor(l.name)};--w:${Math.max(2, (l.bytes / max) * 100).toFixed(2)}%;--i:${i}">
          <div class="bar__label">
            <span>${escapeHtml(l.name)}</span>
            <span class="bar__meta">${pctLabel((l.bytes / total) * 100)} · ${l.projects} ${l.projects === 1 ? "project" : "projects"}</span>
          </div>
          <div class="bar__track"><span class="bar__fill"></span></div>
        </li>`,
      )
      .join("");

    $("#tool-cloud").innerHTML = tagTotals()
      .map(([tag, count]) => `<li>${escapeHtml(tag)}${count > 1 ? ` <span>×${count}</span>` : ""}</li>`)
      .join("");
  };

  /* ------------------------------------------------------------------ */
  /* Small interactions                                                  */
  /* ------------------------------------------------------------------ */

  const initMagnetic = () => {
    if (!finePointer.matches) return;
    for (const el of $$("[data-magnetic]")) {
      el.addEventListener("pointermove", (e) => {
        if (reducedMotion()) return;
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.22;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.35;
        el.style.translate = `${x}px ${y}px`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.translate = "";
      });
    }
  };

  const initCopyEmail = () => {
    const button = $("#copy-email");
    const toast = $("#toast");
    let timer = 0;
    button?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.email);
        toast.textContent = "Email copied to clipboard";
      } catch {
        toast.textContent = button.dataset.email;
      }
      toast.classList.add("is-visible");
      clearTimeout(timer);
      timer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
    });
  };

  $("#year").textContent = new Date().getFullYear();
  initNav();
  initHeroCanvas();
  initRotator();
  initStats();
  initMarquee();
  initStack();
  initMagnetic();
  initCopyEmail();
  initProjects();
  observeReveal();
})();
