<?php
/**
 * PrimeCare contact form - SMTP settings.
 * Fill in the values below, then upload this file next to send-mail.php.
 * Never share this file or commit real passwords to GitHub.
 */
return [
    // --- SMTP server (the mailbox that will SEND the enquiry) ---
    // GoDaddy cPanel hosting mailbox : mail.yourdomain.com  | port 465 | 'ssl'
    // GoDaddy Workspace email        : smtpout.secureserver.net | port 465 | 'ssl'
    // Microsoft 365 mailbox          : smtp.office365.com  | port 587 | 'tls'
    // Gmail (app password required)  : smtp.gmail.com      | port 465 | 'ssl'
    'smtp_host'   => 'mail.yourdomain.com',
    'smtp_port'   => 465,
    'smtp_secure' => 'ssl',            // 'ssl' (port 465), 'tls' (port 587) or '' (none)
    'smtp_user'   => 'info@yourdomain.com',
    'smtp_pass'   => 'CHANGE_ME',

    // --- Addresses ---
    'from_email'  => 'info@yourdomain.com',   // must be the same mailbox/domain as smtp_user
    'from_name'   => 'PrimeCare Website',
    'to_email'    => 'info@yourdomain.com',   // where enquiries are delivered

    // --- Spam protection ---
    'rate_limit_per_hour' => 5,               // max submissions per visitor IP per hour
];