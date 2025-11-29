/* scripts.js - corrected
   - helper functions are hoisted (function declarations)
   - showreel fallback uses relative path 'assets/show_reel.mp4'
   - Google Drive normalization & full modal handling retained
*/

/* -------------------------
   Hoisted DOM helpers (function declarations -> hoisted)
   ------------------------- */
function q(sel, ctx = document) { return ctx.querySelector(sel); }
function qa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }
function on(el, evt, fn, opts = {}) { if (!el) return; el.addEventListener(evt, fn, opts); return el; }

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

/* -------------------------
   URL helpers: detect and normalize video links
   ------------------------- */
function getVideoType(url = '') {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('vimeo.com')) return 'vimeo';
  if (u.match(/\.mp4(\?.*)?$/i)) return 'mp4';
  if (u.includes('drive.google.com')) return 'gdrive';
  return 'unknown';
}

function normalizeEmbedUrl(raw = '') {
  if (!raw) return raw;
  try {
    const url = new URL(raw, location.href);
    const host = url.hostname;

    // youtu.be short links
    if (host.includes('youtu.be')) {
      const id = url.pathname.slice(1);
      return `https://www.youtube.com/embed/${id}`;
    }

    // youtube watch?v=... or already embed
    if (host.includes('youtube.com')) {
      if (url.pathname.includes('/embed/')) return raw.split('?')[0];
      const v = url.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      const p = url.pathname.split('/').pop();
      if (p) return `https://www.youtube.com/embed/${p}`;
    }

    // vimeo -> player.vimeo.com/video/ID
    if (host.includes('vimeo.com')) {
      if (url.pathname.includes('/video/')) return raw.split('?')[0];
      const parts = url.pathname.split('/').filter(Boolean);
      const id = parts.pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }

    // Google Drive file -> convert to /preview
    if (host.includes('drive.google.com')) {
      const m = raw.match(/\/file\/d\/([^/]+)/);
      if (m && m[1]) return `https://drive.google.com/file/d/${m[1]}/preview`;
      const m2 = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (m2 && m2[1]) return `https://drive.google.com/file/d/${m2[1]}/preview`;
    }
  } catch (err) {
    // ignore parse errors, fallback below
  }
  return raw;
}

/* -------------------------
   Theme toggle
   ------------------------- */
(function initThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (prefersDark ? 'dark' : 'light');

  applyTheme(initial);

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
  });

  function applyTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    toggle.setAttribute('aria-pressed', name === 'dark' ? 'true' : 'false');
    toggle.textContent = name === 'dark' ? '🌙' : '☀️';
  }
})();

/* -------------------------
   Modal system (media + image)
   ------------------------- */
const Modal = (function () {
  const root = document.getElementById('modalRoot');
  let active = null;
  let previouslyFocused = null;

  if (!root) {
    console.warn('Modal root (#modalRoot) not found in document.');
    return null;
  }

  root.setAttribute('aria-hidden', 'true');

  function createMediaModal({ src, title = 'Media' }) {
    const type = getVideoType(src);
    const embed = normalizeEmbedUrl(src);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', title);
    modal.setAttribute('aria-modal', 'true');

    if (type === 'mp4') {
      modal.innerHTML = `
        <div class="modal-body" style="padding:18px;max-width:1100px;">
          <button class="close" aria-label="Close media">&times;</button>
          
          <div style="text-align:center;">
            <video controls autoplay playsinline style="width:100%;height:auto;max-height:70vh;background:#000;border-radius:6px;">
              <source src="${src}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      `;
    } else {
      const url = embed || src;
      const sep = url.includes('?') ? '&' : '?';
      modal.innerHTML = `
        <div class="modal-body" style="padding:12px;max-width:1100px;">
          <button class="close" aria-label="Close media">&times;</button>
             <p style="color:#ccc;font-size:14px;margin-bottom:8px;text-align:center;">
        If the video doesn’t play, click the pop-out icon below.
      </p>
          <div class="video-wrap" style="position:relative;padding-top:56.25%;">
         
            <iframe
              width="100%" height="100%"
              src="${url}${sep}autoplay=1"
              frameborder="0"
              allow="autoplay; fullscreen"
              allowfullscreen
              style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:6px;">
            </iframe>
          </div>
        </div>
      `;
    }

    return modal;
  }

  function createImageModal({ src, alt = 'Image preview', title = 'Image' }) {
    const modal = document.createElement('div');
    modal.className = 'modal image-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', title);
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <div class="modal-body" style="padding:18px;max-width:1100px;box-sizing:border-box;position:relative;">
        <button class="close" aria-label="Close image preview">&times;</button>
        <div class="modal-media" style="text-align:center;">
          <img src="${src}" alt="${alt}" style="max-width:100%;max-height:calc(100vh - 180px);object-fit:contain;border-radius:8px;" />
        </div>
      </div>
    `;
    return modal;
  }

  function open(modalEl) {
    if (!modalEl) return;
    previouslyFocused = document.activeElement;
    root.innerHTML = '';
    root.appendChild(modalEl);
    root.classList.add('active');
    root.setAttribute('aria-hidden', 'false');
    active = modalEl;
    trapFocus(active);

    const closeBtn = active.querySelector('.close');
    on(closeBtn, 'click', close);

    root.addEventListener('click', function overlayClick(e) {
      if (e.target === root) close();
    });

    on(document, 'keydown', escHandler);
  }

  function close() {
    if (!root.classList.contains('active')) return;
    root.classList.remove('active');
    root.setAttribute('aria-hidden', 'true');

    const iframe = root.querySelector('iframe');
    if (iframe) iframe.src = '';

    root.innerHTML = '';
    active = null;
    document.removeEventListener('keydown', escHandler);

    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
  }

  function escHandler(e) { if (e.key === 'Escape') close(); }

  function trapFocus(modalEl) {
    const focusable = qa('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])', modalEl)
      .filter(n => n.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    first.focus();
    modalEl.addEventListener('keydown', function trap(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  return { createMediaModal, createImageModal, open, close };
})();

/* -------------------------
   Video handlers
   ------------------------- */
(function initVideoHandlers() {
  /* hero: either #openHeroVideo or .video-thumb
  const heroBtn = document.getElementById('openHeroVideo') || q('.video-thumb');
  if (heroBtn) {
    on(heroBtn, 'click', () => {
      const raw = heroBtn.getAttribute('data-video') || heroBtn.dataset?.video || heroBtn.getAttribute('data-src') || '';
      const src = normalizeEmbedUrl(raw) || raw || 'https://www.youtube.com/embed/VIDEO_ID_1';
      const modal = Modal.createMediaModal({ src, title: 'Hero Video' });
      Modal.open(modal);
    });
    on(heroBtn, 'keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') heroBtn.click(); });
  } */

  // showreel
  const openReel = document.getElementById('openReel');
  if (openReel) {
    on(openReel, 'click', (e) => {
      const raw = openReel.getAttribute('data-video') || openReel.dataset?.video || 'assets/show_reel.mp4';
      const src = normalizeEmbedUrl(raw) || raw;
      const modal = Modal.createMediaModal({ src, title: openReel.getAttribute('data-title') || 'Showreel' });
      Modal.open(modal);
    });
    on(openReel, 'keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') openReel.click(); });
  }

  // project cards/buttons
  const projectButtons = qa('.projects-grid [data-video], .project-actions [data-video]');
  projectButtons.forEach((btn) => {
    on(btn, 'click', (ev) => {
      ev.preventDefault();
      const raw = btn.getAttribute('data-video') || btn.closest('.project-card')?.dataset?.video;
      if (!raw) { console.warn('No video URL found for project button', btn); return; }
      const src = normalizeEmbedUrl(raw) || raw;
      const title = (btn.closest('.project-card') && q('.project-title', btn.closest('.project-card'))?.textContent) || 'Project video';
      const modal = Modal.createMediaModal({ src, title });
      Modal.open(modal);
    });
  });

  // thumbnail play buttons
  const thumbPlays = qa('.thumb-play');
  thumbPlays.forEach((p) => {
    on(p, 'click', (ev) => {
      ev.preventDefault();
      const card = p.closest('.project-card');
      const raw = card?.dataset?.video;
      if (!raw) return;
      const src = normalizeEmbedUrl(raw) || raw;
      const title = q('.project-title', card)?.textContent || 'Project';
      const modal = Modal.createMediaModal({ src, title });
      Modal.open(modal);
    });
  });
})();

/* -------------------------
   Gallery lightbox
   ------------------------- */
(function initGalleryLightbox() {
  const gallery = q('.gallery-grid');
  if (!gallery) return;
  gallery.addEventListener('click', (ev) => {
    const img = ev.target.closest('img');
    if (!img) return;
    const src = img.getAttribute('src') || img.dataset.src;
    const alt = img.getAttribute('alt') || 'Gallery image';
    const modal = Modal.createImageModal({ src, alt });
    Modal.open(modal);
    const closeBtn = q('.modal .close', document);
    if (closeBtn) closeBtn.focus();
  });
})();

/* -------------------------
   Smooth scrolling
   ------------------------- */
(function initSmoothScroll() {
  const links = qa('a[href^="#"]');
  links.forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    on(a, 'click', (e) => {
      const url = new URL(href, location.href);
      if (url.hash) {
        e.preventDefault();
        const target = q(url.hash);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, '', url.hash);
        }
      }
    });
  });
  const hireBtn = document.getElementById('hireMeBtn');
  if (hireBtn) on(hireBtn, 'click', (e) => { e.preventDefault(); const contact = q('#contact'); if (contact) contact.scrollIntoView({ behavior: 'smooth' }); });
})();

/* -------------------------
   CV download helper
   ------------------------- */
(function initCVDownload() {
  const dl = document.getElementById('downloadCV');
  if (!dl) return;
  on(dl, 'click', () => {
    const href = dl.getAttribute('data-href') || '/assets/Evelyn_Kavindu_CV.pdf';
    const a = document.createElement('a');
    a.href = href;
    a.download = href.split('/').pop();
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
})();

/* -------------------------
   Contact form: validation + send to /api/contact (Vercel)
   - validates client-side
   - POSTs JSON to /api/contact
   - shows inline messages and handles loading state
   - falls back to mailto if network / server fails
   ------------------------- */
(function initContactForm() {
  // prefer existing q helper if present, otherwise create a minimal one
  const qHelper = (window.q && typeof window.q === 'function') ? window.q : ((sel, ctx = document) => ctx.querySelector(sel));

  const form = qHelper('#contactForm');
  if (!form) return;

  const submitBtn = form.querySelector("button[type='submit']");
  const originalBtnText = submitBtn ? submitBtn.textContent : 'Send Message';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // gather & trim
    const nm = (form.name && form.name.value || '').trim();
    const email = (form.email && form.email.value || '').trim();
    const msg = (form.message && form.message.value || '').trim();

    // client validation
    const errors = [];
    if (nm.length < 2) errors.push('Please enter your name.');
    if (!validateEmail(email)) errors.push('Please enter a valid email address.');
    if (msg.length < 10) errors.push('Message must be at least 10 characters.');

    clearFormNotes();

    if (errors.length) {
      showFormNote(errors.join(' '), 'error');
      return;
    }

    // prepare UI for sending
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      submitBtn.setAttribute('aria-busy', 'true');
    }

    const payload = { name: nm, email, message: msg };

    // try sending via API first (recommended)
    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        showFormNote('Message sent — thank you!', 'success');
        form.reset();
      } else {
        // read server message if available
        let text = 'Failed to send message. ';
        try {
          const json = await resp.json();
          if (json && json.error) text += json.error;
        } catch (_) { /* ignore JSON parse */ }
        showFormNote(text + ' Opening your mail client as a fallback...', 'error');

        // fallback to mailto after short delay to let user read message
        setTimeout(() => fallbackToMailto(nm, email, msg), 700);
      }
    } catch (err) {
      // network error -> fallback
      console.error('Contact API error:', err);
      showFormNote('Network error — opening your mail client as a fallback.', 'error');
      setTimeout(() => fallbackToMailto(nm, email, msg), 700);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        submitBtn.removeAttribute('aria-busy');
      }
    }
  });

  // helper: basic email validator
  function validateEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  // helper: show inline note inside the form (keeps previous styles)
  function showFormNote(text, type = 'info') {
    let el = qHelper('.form-note', form);
    if (!el) {
      el = document.createElement('div');
      el.className = 'form-note';
      form.appendChild(el);
    }
    el.textContent = text;
    if (type === 'error') el.style.color = '#ff6b6b';
    else if (type === 'success') el.style.color = '#2eb82e';
    else el.style.color = '';
  }

  function clearFormNotes() {
    const el = qHelper('.form-note', form);
    if (el) el.textContent = '';
  }

  // fallback: open mail client via mailto (encode subject/body)
  function fallbackToMailto(name, email, message) {
    const subject = encodeURIComponent('Inquiry');
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:kavinduevelyn@gmail.com?subject=${subject}&body=${body}`;
  }
})();

/* -------------------------
   Lazy load images
   ------------------------- */
(function initLazyLoad() {
  const lazyImages = qa('img[data-src], img.lazy');
  if (!lazyImages.length) return;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.getAttribute('data-src') || img.dataset.src;
          if (src) { img.src = src; img.removeAttribute('data-src'); img.classList.remove('lazy'); }
          obs.unobserve(img);
        }
      });
    }, { rootMargin: '200px 0px' });
    lazyImages.forEach(img => io.observe(img));
  } else {
    lazyImages.forEach(img => {
      const src = img.getAttribute('data-src') || img.dataset.src;
      if (src) img.src = src;
    });
  }
})();

/* -------------------------
   Current year
   ------------------------- */
(function setYear() {
  const y = new Date().getFullYear();
  const el = document.getElementById('year');
  if (el) el.textContent = y;
})();

/* -------------------------
   Accessibility helpers
   ------------------------- */
(function accessibilityHelpers() {
  qa('.video-thumb, .thumb-play, .play-large').forEach((el) => {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  });
})();

// mobile menu toggle
(function mobileMenuToggle() {
  const btn = document.getElementById('mobileMenuBtn');
  const nav = document.querySelector('.nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    nav.classList.toggle('open');
    const expanded = nav.classList.contains('open');
    btn.setAttribute('aria-expanded', String(expanded));
  });
  // close menu on outside click
  document.addEventListener('click', (e) => {
    if (!nav.classList.contains('open')) return;
    if (!nav.contains(e.target)) {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
})();


/* -------------------------
   Dev hooks
   ------------------------- */
window.EK = window.EK || {};
window.EK.modal = Modal;
window.EK.normalizeEmbedUrl = normalizeEmbedUrl;
window.EK.scrollTo = (selector) => { const t = q(selector); if (t) t.scrollIntoView({ behavior: 'smooth' }); };

