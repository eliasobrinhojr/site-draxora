<?php
// POST /api/csp.php — recebe avisos da Content-Security-Policy (modo relatório).
// Guarda só o essencial (diretiva, domínio bloqueado, página), sem IP nem dados do visitante,
// num arquivo fora da public_html com no máximo 300 linhas. Leia em status.php?chave=…
declare(strict_types=1);
require __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); exit; }
$raw = file_get_contents('php://input', false, null, 0, 8192) ?: '';
$j = json_decode($raw, true);
if (!is_array($j)) { http_response_code(204); exit; }
$r = $j['csp-report'] ?? ($j[0]['body'] ?? $j['body'] ?? $j);
if (!is_array($r)) { http_response_code(204); exit; }
$dir = (string)($r['violated-directive'] ?? $r['effectiveDirective'] ?? $r['effective-directive'] ?? '?');
$blocked = (string)($r['blocked-uri'] ?? $r['blockedURL'] ?? '?');
$host = parse_url($blocked, PHP_URL_HOST) ?: $blocked; // só o domínio, nunca o endereço completo
$page = (string)(parse_url((string)($r['document-uri'] ?? $r['documentURL'] ?? ''), PHP_URL_PATH) ?? '');
$line = date('Y-m-d H:i:s') . "\t" . mb_substr(preg_replace('/\s+/', ' ', $dir), 0, 60) . "\t" . mb_substr((string)$host, 0, 80) . "\t" . mb_substr($page, 0, 80) . "\n";
$f = dx_csp_file();
$old = is_file($f) ? file($f) : [];
$old = array_slice($old ?: [], -299);
@file_put_contents($f, implode('', $old) . $line, LOCK_EX);
http_response_code(204);
