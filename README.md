# Mandafia Services Website

A responsive 5-page static website for a facility management company.
Plain HTML, CSS and JavaScript. No build step and no dependencies.

## Pages
| File | Page |
|------|------|
| `index.html` | Home |
| `about.html` | About |
| `services.html` | Services |
| `gallery.html` | Gallery (filter + pop-up) |
| `careers.html` | Careers (8 openings, each with a downloadable JD) |
| `contact.html` | Contact (form validation + map) |

## Structure
```
mandafia-website/
├── README.md
├── .gitignore
├── index.html
├── about.html
├── services.html
├── gallery.html
├── careers.html
├── contact.html
├── style.css      shared styles
├── script.js      menu, gallery, form check, footer year
├── send-mail.php  contact form handler (sends through SMTP)
├── config.php     SMTP settings (fill in, keep private)
├── .htaccess      blocks web access to config.php
├── jd/            job description PDFs linked from careers.html
└── images/        put real photos and logo here
```

## Run locally
Open `index.html` in a browser, or run `python3 -m http.server 8000` and visit http://localhost:8000.

## Deploy (GoDaddy cPanel, mandafiaservices.com)
1. cPanel > File Manager > `public_html`
2. Upload all files (HTML, CSS, JS and the `images/` folder) directly into `public_html`
3. Open https://mandafiaservices.com and check all six pages
4. In GoDaddy, make sure the domain points to this hosting plan and the free SSL certificate is active (cPanel > SSL/TLS Status > Run AutoSSL)

## Contact form (live SMTP)
The form posts to `send-mail.php`, which sends the enquiry through your SMTP mailbox. Needs Linux hosting with PHP (GoDaddy cPanel hosting has it).
1. Create a mailbox such as `customersupport@mandafiaservices.com` (cPanel > Email Accounts).
2. Open `config.php` and set `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass`, `from_email` and `to_email`.
3. Upload `send-mail.php`, `config.php` and `.htaccess` next to `contact.html`.
4. Submit the form on your live site and check the inbox (and spam folder).
The form only works on the hosted site, not when `contact.html` is opened from your computer.
Built-in protection: server-side validation, hidden spam-trap field, 5 submissions per hour per IP, header-injection filtering.

## Things to customise
- Company name, address, phone and email (repeated in the footer of every page)
- Team names on `about.html`
- Job openings: edit the cards in `careers.html` and replace the PDFs in `jd/` (the HR email is career@mandafiaservices.com)
- Gallery tiles: swap the coloured blocks for real photos (see the comment in `gallery.html`)