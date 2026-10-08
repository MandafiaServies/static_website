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

// Contact form validation (static demo — connect to a backend/Formspree to receive messages)
const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const text = form.message.value.trim();
    if (!name || !text) return show('Please fill in your name and message.', false);
    if (!/^\S+@\S+\.\S+$/.test(email)) return show('Please enter a valid email address.', false);
    if (phone && !/^[+\d][\d\s-]{7,}$/.test(phone)) return show('Please enter a valid phone number.', false);
    show('Thank you, ' + name + '! We have received your enquiry and will contact you within 24 hours.', true);
    form.reset();
    function show(t, ok) { msg.textContent = t; msg.className = ok ? 'ok' : 'err'; }
  });
}