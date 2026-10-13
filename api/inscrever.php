<?php
// POST /api/inscrever.php — grava um e-mail numa lista de espera.
// Campos: email, lista, consentimento=sim, site (armadilha anti-robô: deve vir vazio), utm_*, origem.
declare(strict_types=1);
require __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    dx_json(405, ['ok' => false, 'error' => 'method']);
}

// Só aceita envios do próprio site.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== preg_replace('/:\d+$/', '', $host)) {
    dx_json(403, ['ok' => false, 'error' => 'origin']);
}

// Robôs preenchem o campo escondido "site": fingimos sucesso e não gravamos nada.
if (!empty($_POST['site'])) {
    dx_json(200, ['ok' => true]);
}

$email = mb_strtolower(trim((string)($_POST['email'] ?? '')));
$lista = (string)($_POST['lista'] ?? '');
$consent = (string)($_POST['consentimento'] ?? '');

if ($email === '' || mb_strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    dx_json(422, ['ok' => false, 'error' => 'email', 'message' => 'Confira o e-mail digitado.']);
}
if (!in_array($lista, DX_LISTAS, true)) {
    dx_json(422, ['ok' => false, 'error' => 'lista', 'message' => 'Lista inválida.']);
}
if ($consent !== 'sim') {
    dx_json(422, ['ok' => false, 'error' => 'consentimento', 'message' => 'Marque a caixa para autorizar o aviso por e-mail.']);
}

$pdo = dx_db();
$ipHash = dx_ip_hash();
$now = dx_now();

// No máximo 5 cadastros por aparelho a cada 10 minutos.
$since = (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->modify('-10 minutes')->format('Y-m-d H:i:s');
$q = $pdo->prepare('SELECT COUNT(*) FROM inscritos WHERE ip_hash = ? AND criado_em >= ?');
$q->execute([$ipHash, $since]);
if ((int)$q->fetchColumn() >= 5) {
    dx_json(429, ['ok' => false, 'error' => 'limite', 'message' => 'Muitas tentativas. Tente de novo em alguns minutos.']);
}

try {
    $ins = $pdo->prepare('INSERT INTO inscritos (email, lista, consentimento_em, origem, utm_source, utm_medium, utm_campaign, utm_content, ip_hash, criado_em)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $ins->execute([
        $email, $lista, $now,
        dx_clean($_POST['origem'] ?? null, 255),
        dx_clean($_POST['utm_source'] ?? null, 120),
        dx_clean($_POST['utm_medium'] ?? null, 120),
        dx_clean($_POST['utm_campaign'] ?? null, 160),
        dx_clean($_POST['utm_content'] ?? null, 160),
        $ipHash, $now,
    ]);
} catch (PDOException $e) {
    if ((string)$e->getCode() === '23000') {
        // Já estava na lista: para a pessoa, é o mesmo resultado.
        dx_json(200, ['ok' => true, 'ja' => true]);
    }
    error_log('[draxora] inscrever: ' . $e->getMessage());
    dx_json(500, ['ok' => false, 'error' => 'db', 'message' => 'Não foi possível salvar agora. Tente de novo em instantes.']);
}

// Aviso opcional por e-mail para você a cada novo cadastro.
$c = dx_config();
if (!empty($c['notify_to']) && !empty($c['mail_from'])) {
    @mail(
        (string)$c['notify_to'],
        '=?UTF-8?B?' . base64_encode('Novo cadastro: ' . $lista) . '?=',
        "E-mail: $email\nLista: $lista\nData: $now\nOrigem: " . ($_POST['utm_source'] ?? '-'),
        "From: {$c['mail_from']}\r\nContent-Type: text/plain; charset=UTF-8"
    );
}

dx_json(201, ['ok' => true]);
