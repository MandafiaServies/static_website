# Mandafia Services Website (Node.js)

Static website (Home, About, Services, Gallery, Careers, Contact) served by a small Node.js server,
with a contact form API at `POST /api/contact`. It uses only Node.js built-in modules, so there is
nothing to install (`dependencies` is empty).

## Structure
```
├── server.js        HTTP server: static pages + /api/contact + /healthz
├── mailer.js        Sends the enquiry email (Resend HTTPS API, or SMTP)
├── package.json     name, version, main, build and start scripts
├── package-lock.json
├── .npmrc           points to the public npm registry (GoDaddy requirement)
├── .env.example     all settings, copy to .env for local use
├── .gitignore
└── public/          the website
    ├── index.html, about.html, services.html, gallery.html, careers.html, contact.html, 404.html
    ├── style.css, script.js
    ├── jd/          job description PDFs
    └── images/      your photos and logo
```

## Run locally
Needs Node.js 20.12 or newer.
```
cp .env.example .env      # then edit the values
npm start                 # http://localhost:3000
```

## Contact form email
GoDaddy Node.js hosting does not allow outbound SMTP, so the default transport is an HTTPS email API.

**Option A: Resend (default, works on GoDaddy Node.js hosting)**
1. Create an account at resend.com and add the domain `mandafiaservices.com`.
2. Add the DNS records Resend shows you in GoDaddy DNS (Domain > DNS), then click Verify.
3. Create an API key.
4. Set these environment variables:
   `MAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `FROM_EMAIL=customersupport@mandafiaservices.com`,
   `TO_EMAIL=customersupport@mandafiaservices.com`, `FROM_NAME`.

`TO_EMAIL` must be a mailbox that exists, or enquiries bounce.

**Option B: SMTP (local testing, VPS, any host that allows SMTP)**
Set `MAIL_TRANSPORT=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (`true` for 465, `starttls` for 587),
`SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`, `TO_EMAIL`.

Built-in protection: server-side validation, hidden spam-trap field, `RATE_LIMIT_PER_HOUR` submissions per
visitor per hour (default 5), 20 KB request limit, header-injection filtering.

## Deploy on GoDaddy Node.js Hosting
1. Zip the project so that `package.json` is at the top level of the zip (zip the contents of this folder,
   not the folder itself). Leave out `node_modules` and `.env`. `mandafia-node-deploy.zip` is already prepared.
2. In your GoDaddy account, open Node.js Hosting, create a new app, choose a region, and upload the zip.
   Alternatively, connect a GitHub repository and every push to the chosen branch redeploys.
3. Add the environment variables from the section above in the app's settings (they are stored encrypted).
   Do not put real keys in the zip.
4. Connect the domain: in the app's Settings, change the domain name to `mandafiaservices.com`.
   For a domain registered elsewhere, GoDaddy shows the exact A and CNAME records to add.
5. Publish, then open https://mandafiaservices.com and test all six pages and the contact form.

Notes
- The server reads its port from `PORT` and listens on `0.0.0.0`.
- Nothing in this app writes files to disk.
- Preview apps are private and are removed after 30 days. Publishing needs a hosting plan that includes
  a Node.js app slot.
- GoDaddy Node.js hosting is a new product, so screen names and limits may change. Check GoDaddy's
  current help pages.

## Customise
- Company details (address, phone, email) are repeated in the footer of every page in `public/`.
- Job openings are the cards in `public/careers.html`; replace the PDFs in `public/jd/`.
- Replace the gallery colour tiles with real photos (see the comment in `public/gallery.html`).