<?php
// GET /baixar/guia ou /baixar/folhas (?de=email1) — conta o download e abre o PDF.
// Nunca impede o download: se o banco falhar, o PDF abre do mesmo jeito.
declare(strict_types=1);
require __DIR__ . '/_db.php';

$arquivos = [
    'guia'   => '/assets/guia/mapa-dos-sintomas-guia.pdf',
    'folhas' => '/assets/guia/mapa-dos-sintomas-folhas.pdf',
];
$f = (string)($_GET['f'] ?? '');
if (!isset($arquivos[$f])) {
    header('Location: /mapa-dos-sintomas/?utm_source=baixar#amostra', true, 302);
    exit;
}
$destino = $arquivos[$f];

// HEAD e pré-visualizadores de link (WhatsApp, Gmail, antivírus de e-mail) não contam como download.
$ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
$metodo = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');
$robo = ($metodo !== 'GET' || $ua === '' ||
    preg_match('/bot|crawl|spider|preview|scanner|facebookexternalhit|whatsapp|slack|telegram|google-?(read|safety|image)|bingpreview|proofpoint|barracuda|mimecast|safelinks|curl|wget|python|headless/i', $ua)) ? 1 : 0;

try {
    $de = preg_replace('/[^a-z0-9_-]/i', '', (string)($_GET['de'] ?? ''));
    $pdo = dx_db();
    $ins = $pdo->prepare('INSERT INTO downloads (arquivo, origem, robo, ip_hash, criado_em) VALUES (?, ?, ?, ?, ?)');
    $ins->execute([$f, $de !== '' ? mb_substr($de, 0, 60) : null, $robo, dx_ip_hash(), dx_now()]);
} catch (Throwable $e) {
    error_log('[draxora] baixar: ' . $e->getMessage());
}

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('Location: ' . $destino, true, 302);
exit;
