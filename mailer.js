'use strict';
/**
 * Sends the contact-form email. No external packages needed.
 *
 * MAIL_TRANSPORT=resend  (default) HTTPS API on port 443 (Resend).
 *                        Use this on GoDaddy Node.js hosting, which blocks outbound SMTP.
 * MAIL_TRANSPORT=smtp    Plain SMTP client built on Node's net/tls modules.
 *                        Use this locally, on a VPS, or anywhere outbound SMTP is allowed.
 */
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

const env = (name, fallback = '') => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
};

/* ---------------- Resend (HTTPS) ---------------- */

async function sendWithResend(mail) {
  const key = env('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY is not set.');

  const res = await fetch(env('RESEND_API_URL', 'https://api.resend.com/emails'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${mail.fromName} <${mail.fromEmail}>`,
      to: [mail.to],
      reply_to: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend API ${res.status}: ${detail.slice(0, 300)}`);
  }
}

/* ---------------- SMTP ---------------- */

class SmtpConnection {
  constructor(sock) {
    this.sock = sock;
    this.buf = '';
    this.waiters = [];
    this.err = null;
    sock.setEncoding('utf8');
    sock.on('data', (d) => { this.buf += d; this.flush(); });
    sock.on('error', (e) => this.fail(e));
    sock.on('close', () => this.fail(new Error('SMTP connection closed')));
  }

  fail(e) {
    this.err = this.err || e;
    while (this.waiters.length) this.waiters.shift().reject(this.err);
  }

  flush() {
    while (this.waiters.length) {
      // A reply is zero or more "250-..." lines followed by one "250 ..." line
      const m = this.buf.match(/^(?:\d{3}-[^\n]*\n)*\d{3} [^\n]*\n/);
      if (!m) return;
      this.buf = this.buf.slice(m[0].length);
      this.waiters.shift().resolve({ code: Number(m[0].slice(0, 3)), text: m[0].trim() });
    }
  }

  read() {
    return new Promise((resolve, reject) => {
      if (this.err) return reject(this.err);
      this.waiters.push({ resolve, reject });
      this.flush();
    });
  }

  async cmd(line, expect) {
    if (line !== null) this.sock.write(line + '\r\n');
    const reply = await this.read();
    if (!expect.includes(reply.code)) throw new Error(`SMTP error: ${reply.text}`);
    return reply;
  }

  close() { this.sock.destroy(); }
}

function openSocket({ host, port, implicitTls }) {
  return new Promise((resolve, reject) => {
    const sock = implicitTls ? tls.connect({ host, port, servername: net.isIP(host) ? undefined : host }) : net.connect({ host, port });
    sock.setTimeout(20000, () => sock.destroy(new Error('SMTP timeout')));
    sock.once(implicitTls ? 'secureConnect' : 'connect', () => resolve(sock));
    sock.once('error', reject);
  });
}

const mimeWord = (text) => `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;

function buildMessage(mail) {
  const domain = (mail.fromEmail.split('@')[1] || 'localhost').trim();
  const headers = [
    `Date: ${new Date().toUTCString()}`,
    `From: ${mimeWord(mail.fromName)} <${mail.fromEmail}>`,
    `To: <${mail.to}>`,
    `Reply-To: <${mail.replyTo}>`,
    `Subject: ${mimeWord(mail.subject)}`,
    `Message-ID: <${crypto.randomBytes(12).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  const body = Buffer.from(mail.text, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  // A base64 body never has a line that is only ".", so no dot-stuffing is needed
  return headers.join('\r\n') + '\r\n\r\n' + body + '\r\n.\r\n';
}

async function sendWithSmtp(mail) {
  const host = env('SMTP_HOST');
  const port = Number(env('SMTP_PORT', '465'));
  if (!host) throw new Error('SMTP_HOST is not set.');

  // SMTP_SECURE: "true" = TLS from the start (port 465), "starttls" (port 587), "false" = none
  const mode = env('SMTP_SECURE', port === 465 ? 'true' : port === 587 ? 'starttls' : 'false').toLowerCase();
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  const helo = (env('SMTP_HELO', mail.fromEmail.split('@')[1]) || 'localhost').replace(/[^A-Za-z0-9.-]/g, '') || 'localhost';

  let sock = await openSocket({ host, port, implicitTls: mode === 'true' });
  let smtp = new SmtpConnection(sock);
  try {
    await smtp.cmd(null, [220]);
    await smtp.cmd(`EHLO ${helo}`, [250]);

    if (mode === 'starttls') {
      await smtp.cmd('STARTTLS', [220]);
      sock.removeAllListeners();
      sock.on('error', () => {});
      sock = tls.connect({ socket: sock, servername: net.isIP(host) ? undefined : host });
      sock.setTimeout(20000, () => sock.destroy(new Error('SMTP timeout')));
      await new Promise((resolve, reject) => { sock.once('secureConnect', resolve); sock.once('error', reject); });
      smtp = new SmtpConnection(sock);
      await smtp.cmd(`EHLO ${helo}`, [250]);
    }

    if (user) {
      await smtp.cmd('AUTH LOGIN', [334]);
      await smtp.cmd(Buffer.from(user).toString('base64'), [334]);
      await smtp.cmd(Buffer.from(pass).toString('base64'), [235]);
    }

    await smtp.cmd(`MAIL FROM:<${mail.fromEmail}>`, [250]);
    await smtp.cmd(`RCPT TO:<${mail.to}>`, [250, 251]);
    await smtp.cmd('DATA', [354]);
    sock.write(buildMessage(mail));
    await smtp.cmd(null, [250]);
    smtp.cmd('QUIT', [221]).catch(() => {});
  } finally {
    setTimeout(() => smtp.close(), 500).unref();
  }
}

/* ---------------- entry point ---------------- */

async function sendMail({ name, email, phone, service, message, ip }) {
  const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' });

  const mail = {
    fromName: env('FROM_NAME', 'Mandafia Services Website'),
    fromEmail: env('FROM_EMAIL'),
    to: env('TO_EMAIL'),
    replyTo: email,
    subject: `New website enquiry from ${name}`,
    text:
      'New enquiry from the Mandafia Services website\n' +
      '----------------------------------------------\n' +
      `Name:     ${name}\n` +
      `Email:    ${email}\n` +
      `Phone:    ${phone || '-'}\n` +
      `Service:  ${service || '-'}\n\n` +
      `Message:\n${message}\n\n` +
      '----------------------------------------------\n' +
      `Sent: ${when} IST\n` +
      `IP:   ${ip}\n`,
  };

  if (!mail.fromEmail || !mail.to) throw new Error('FROM_EMAIL and TO_EMAIL must be set.');

  const transport = env('MAIL_TRANSPORT', 'resend').toLowerCase();
  if (transport === 'smtp') return sendWithSmtp(mail);
  if (transport === 'resend') return sendWithResend(mail);
  throw new Error(`Unknown MAIL_TRANSPORT "${transport}".`);
}

module.exports = { sendMail };