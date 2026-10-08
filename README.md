# PrimeCare Facility Management Website

A responsive 5-page static website for a facility management company.
Plain HTML, CSS and JavaScript. No build step and no dependencies.

## Pages
| File | Page |
|------|------|
| `index.html` | Home |
| `about.html` | About |
| `services.html` | Services |
| `gallery.html` | Gallery (filter + pop-up) |
| `contact.html` | Contact (form validation + map) |

## Structure
```
primecare-website/
├── README.md
├── .gitignore
├── index.html
├── about.html
├── services.html
├── gallery.html
├── contact.html
├── style.css      shared styles
├── script.js      menu, gallery, form check, footer year
└── images/        put real photos and logo here
```

## Run locally
Open `index.html` in a browser, or run `python3 -m http.server 8000` and visit http://localhost:8000.

## Deploy (GoDaddy cPanel)
1. cPanel > File Manager > `public_html`
2. Upload all files (HTML, CSS, JS and the `images/` folder) directly into `public_html`
3. Open your domain and check all five pages

## Things to customise
- Company name, address, phone and email (repeated in the footer of every page)
- Team names on `about.html`
- Gallery tiles: swap the coloured blocks for real photos (see the comment in `gallery.html`)
- Contact form: it only validates. Connect it to Formspree or a backend to receive enquiries.