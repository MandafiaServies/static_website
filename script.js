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
  const box = lb.querySelector('.box');
  tiles.forEach(t => t.addEventListener('click', () => {
    box.className = 'box ' + [...t.classList].find(c => /^t\d$/.test(c));
    box.querySelector('.em').textContent = t.querySelector('.em').textContent;
    box.querySelector('h3').textContent = t.querySelector('h3').textContent;
    box.querySelector('p').textContent = t.querySelector('span').textContent;
    lb.classList.add('open');
  }));
  lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('close')) lb.classList.remove('open'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('open'); });
}

// Contact form: validate in the browser, then send through send-mail.php (live SMTP)
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
      const res = await fetch('send-mail.php', { method: 'POST', body: data });
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