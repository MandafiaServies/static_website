// Mobile menu
const btn = document.getElementById('menuBtn');
const nav = document.getElementById('mainNav');
if (btn) btn.addEventListener('click', () => nav.classList.toggle('open'));

// Footer year
document.querySelectorAll('.year').forEach(e => e.textContent = new Date().getFullYear());

// Gallery filter + lightbox
const filterBtns = document.querySelectorAll('.filters button');
const tiles = document.querySelectorAll('.tile');
filterBtns.forEach(b => b.addEventListener('click', () => {
  filterBtns.forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  const f = b.dataset.filter;
  tiles.forEach(t => t.style.display = (f === 'all' || t.dataset.cat === f) ? 'flex' : 'none');
}));

const lb = document.getElementById('lightbox');
if (lb) {
  const img = lb.querySelector('img'); img.decoding = 'async';
  const prev = lb.querySelector('.prev'), next = lb.querySelector('.next');
  const thumbs = lb.querySelector('.thumbs');
  let list = [], idx = 0;
  const render = () => {
    img.src = list[idx];
    thumbs.querySelectorAll('img').forEach((t, i) => t.classList.toggle('on', i === idx));
    prev.classList.toggle('hide', list.length < 2);
    next.classList.toggle('hide', list.length < 2);
  };
  const step = d => { idx = (idx + d + list.length) % list.length; render(); };
  tiles.forEach(t => t.addEventListener('click', () => {
    list = (t.dataset.images || '').split('|').filter(Boolean);
    idx = 0;
    img.alt = t.querySelector('h3').textContent;
    lb.querySelector('h3').textContent = t.querySelector('h3').textContent;
    lb.querySelector('p').textContent = t.querySelector('span').textContent;
    thumbs.innerHTML = '';
    if (list.length > 1) list.forEach((src, i) => {
      const th = document.createElement('img');
      th.decoding = 'async'; th.loading = 'lazy'; th.src = src; th.alt = 'Photo ' + (i + 1);
      th.addEventListener('click', e => { e.stopPropagation(); idx = i; render(); });
      thumbs.appendChild(th);
    });
    render();
    lb.classList.add('open');
  }));
  prev.addEventListener('click', e => { e.stopPropagation(); step(-1); });
  next.addEventListener('click', e => { e.stopPropagation(); step(1); });
  lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('close')) lb.classList.remove('open'); });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') lb.classList.remove('open');
    if (e.key === 'ArrowLeft' && list.length > 1) step(-1);
    if (e.key === 'ArrowRight' && list.length > 1) step(1);
  });
}

// Contact form: validate in the browser, then send through /api/contact
const form = document.getElementById('contactForm');
if (form) {
  const msg = document.getElementById('msg');
  const submitBtn = form.querySelector('button[type="submit"]');
  const show = (t, ok) => { msg.textContent = t; msg.className = ok ? 'ok' : 'err'; };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = new FormData(form);
    const name = (data.get('name') || '').trim();
    const email = (data.get('email') || '').trim();
    const phone = (data.get('phone') || '').trim();
    const text = (data.get('message') || '').trim();

    if (!name || !text) return show('Please fill in your name and message.', false);
    if (!/^\S+@\S+\.\S+$/.test(email)) return show('Please enter a valid email address.', false);
    if (phone && !/^[+\d][\d\s-]{7,}$/.test(phone)) return show('Please enter a valid phone number.', false);

    submitBtn.disabled = true;
    const label = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.ok) {
        show(out.message || 'Thank you! We will contact you shortly.', true);
        form.reset();
      } else {
        show(out.message || 'Sorry, something went wrong. Please try again or call us.', false);
      }
    } catch (err) {
      show('Could not reach the server. Please check your connection or call us.', false);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });
}