<?php
/**
 * PrimeCare contact form handler.
 * Receives a POST from contact.html and sends it through a live SMTP server.
 * No external libraries needed. Settings live in config.php.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $code, bool $ok, string $message): void
{
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'message' => $message]);
    exit;
}

function clean(string $v, int $max): string
{
    $v = str_replace(["\r", "\n", "\0"], ' ', $v);      // block header injection
    return mb_substr(trim($v), 0, $max);
}

/* ---------- SMTP helpers ---------- */

function smtp_read($fp): array
{
    $data = '';
    while (($line = fgets($fp, 515)) !== false) {
        $data .= $line;
        if (strlen($line) < 4 || $line[3] === ' ') {
            break;
        }
    }
    return [(int) substr($data, 0, 3), trim($data)];
}

function smtp_cmd($fp, string $cmd, array $expect): string
{
    if ($cmd !== '') {
        fwrite($fp, $cmd . "\r\n");
    }
    [$code, $resp] = smtp_read($fp);
    if (!in_array($code, $expect, true)) {
        throw new RuntimeException('SMTP error: ' . $resp);
    }
    return $resp;
}

function mime_header(string $text): string
{
    return '=?UTF-8?B?' . base64_encode($text) . '?=';
}

function smtp_send(array $c, string $to, string $subject, string $body, string $replyEmail, string $replyName): void
{
    $secure = $c['smtp_secure'];
    $target = ($secure === 'ssl' ? 'ssl://' : '') . $c['smtp_host'] . ':' . $c['smtp_port'];

    $fp = @stream_socket_client($target, $errno, $errstr, 15);
    if (!$fp) {
        throw new RuntimeException("Cannot connect to SMTP server: $errstr ($errno)");
    }
    stream_set_timeout($fp, 15);

    try {
        smtp_cmd($fp, '', [220]);
        $helo = preg_replace('/[^A-Za-z0-9.\-]/', '', $_SERVER['SERVER_NAME'] ?? 'localhost') ?: 'localhost';
        smtp_cmd($fp, "EHLO $helo", [250]);

        if ($secure === 'tls') {
            smtp_cmd($fp, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('TLS negotiation failed.');
            }
            smtp_cmd($fp, "EHLO $helo", [250]);
        }

        if ($c['smtp_user'] !== '') {
            smtp_cmd($fp, 'AUTH LOGIN', [334]);
            smtp_cmd($fp, base64_encode($c['smtp_user']), [334]);
            smtp_cmd($fp, base64_encode($c['smtp_pass']), [235]);
        }

        smtp_cmd($fp, 'MAIL FROM:<' . $c['from_email'] . '>', [250]);
        smtp_cmd($fp, 'RCPT TO:<' . $to . '>', [250, 251]);
        smtp_cmd($fp, 'DATA', [354]);

        $domain = substr(strrchr($c['from_email'], '@') ?: '@localhost', 1);
        $headers = [
            'Date: ' . date('r'),
            'From: ' . mime_header($c['from_name']) . ' <' . $c['from_email'] . '>',
            'To: <' . $to . '>',
            'Reply-To: ' . mime_header($replyName) . ' <' . $replyEmail . '>',
            'Subject: ' . mime_header($subject),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
        ];

        // base64 body never contains a lone "." line, so no dot-stuffing is needed
        $message = implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($body));
        fwrite($fp, $message . "\r\n.\r\n");
        smtp_cmd($fp, '', [250]);

        try {
            smtp_cmd($fp, 'QUIT', [221]);
        } catch (Throwable $ignored) {
        }
    } finally {
        fclose($fp);
    }
}

/* ---------- Request handling ---------- */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, false, 'Method not allowed.');
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    error_log('PrimeCare form: config.php is missing.');
    respond(500, false, 'The contact form is not configured yet.');
}
$cfg = require $configFile;

// Honeypot: real visitors never see or fill this field. Pretend success to bots.
if (!empty($_POST['website'])) {
    respond(200, true, 'Thank you! We will contact you shortly.');
}

$name    = clean((string) ($_POST['name'] ?? ''), 100);
$email   = clean((string) ($_POST['email'] ?? ''), 150);
$phone   = clean((string) ($_POST['phone'] ?? ''), 30);
$service = clean((string) ($_POST['service'] ?? ''), 80);
$message = trim(str_replace("\0", '', (string) ($_POST['message'] ?? '')));
$message = mb_substr($message, 0, 3000);

if ($name === '' || $message === '') {
    respond(422, false, 'Please fill in your name and message.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, false, 'Please enter a valid email address.');
}
if ($phone !== '' && !preg_match('/^[+\d][\d\s\-]{7,}$/', $phone)) {
    respond(422, false, 'Please enter a valid phone number.');
}

// Simple per-IP rate limit
$ip   = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rl   = sys_get_temp_dir() . '/pc_rl_' . md5($ip);
$now  = time();
$hits = [];
if (is_file($rl)) {
    $hits = array_values(array_filter(
        array_map('intval', file($rl, FILE_IGNORE_NEW_LINES) ?: []),
        fn(int $t): bool => $now - $t < 3600
    ));
}
if (count($hits) >= (int) $cfg['rate_limit_per_hour']) {
    respond(429, false, 'Too many requests. Please try again later.');
}

$subject = 'New website enquiry from ' . $name;
$body = "New enquiry from the PrimeCare website\n"
      . "--------------------------------------\n"
      . "Name:     $name\n"
      . "Email:    $email\n"
      . "Phone:    " . ($phone !== '' ? $phone : '-') . "\n"
      . "Service:  " . ($service !== '' ? $service : '-') . "\n\n"
      . "Message:\n$message\n\n"
      . "--------------------------------------\n"
      . "Sent: " . date('d M Y, H:i:s T') . "\n"
      . "IP:   $ip\n";

try {
    smtp_send($cfg, $cfg['to_email'], $subject, $body, $email, $name);
} catch (Throwable $e) {
    error_log('PrimeCare form SMTP failure: ' . $e->getMessage());
    respond(502, false, 'Sorry, we could not send your message right now. Please call us or email ' . $cfg['to_email'] . '.');
}

$hits[] = $now;
@file_put_contents($rl, implode("\n", $hits), LOCK_EX);

respond(200, true, 'Thank you, ' . $name . '! We have received your enquiry and will contact you within 24 hours.');