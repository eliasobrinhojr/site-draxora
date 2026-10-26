<?php
// POST /api/feedback.php — relato de uso do Mapa dos Sintomas (página /conte/).
// Campos: usou, consulta, ajudou, canal?, texto?, email?, consentimento=sim, site (armadilha), dx_t, utm_*, origem.
declare(strict_types=1);
require __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    dx_json(405, ['ok' => false, 'error' => 'method']);
}
// Só aceita envios do próprio site.
$host = preg_replace('/:\d+$/', '', strtolower((string)($_SERVER['HTTP_HOST'] ?? '')));
$from = (string)($_SERVER['HTTP_ORIGIN'] ?? '') ?: (string)($_SERVER['HTTP_REFERER'] ?? '');
if ($from === '' || strtolower((string)parse_url($from, PHP_URL_HOST)) !== $host) {
    dx_json(403, ['ok' => false, 'error' => 'origin']);
}
// Robôs: fingimos sucesso e não gravamos.
$dxT = $_POST['dx_t'] ?? null;
if (!empty($_POST['site']) || !is_numeric($dxT) || (float)$dxT < 3) {
    dx_json(200, ['ok' => true]);
}

$op = [
    'usou' => ['quase-todo-dia', 'alguns-dias', 'nao-usei'],
    'consulta' => ['fui-levei', 'fui-sem-levar', 'ainda-nao'],
    'ajudou' => ['muito', 'um-pouco', 'nao', 'nao-se-aplica'],
    'canal' => ['sim', 'nao', 'nao-sabia', ''],
];
$v = [];
foreach ($op as $k => $allowed) {
    $v[$k] = (string)($_POST[$k] ?? '');
    if (!in_array($v[$k], $allowed, true)) {
        dx_json(422, ['ok' => false, 'error' => $k, 'message' => 'Responda as três primeiras perguntas.']);
    }
}
if ((string)($_POST['consentimento'] ?? '') !== 'sim') {
    dx_json(422, ['ok' => false, 'error' => 'consentimento', 'message' => 'Marque a caixa de autorização para enviar.']);
}
$texto = trim((string)($_POST['texto'] ?? ''));
if (mb_strlen($texto) > 2000) $texto = mb_substr($texto, 0, 2000);
$email = mb_strtolower(trim((string)($_POST['email'] ?? '')));
if ($email !== '' && (mb_strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL))) {
    dx_json(422, ['ok' => false, 'error' => 'email', 'message' => 'Confira o e-mail (ou deixe em branco).']);
}

$pdo = dx_db();
dx_migrate($pdo);
$ipHash = dx_ip_hash();
$now = dx_now();
$since = (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->modify('-10 minutes')->format('Y-m-d H:i:s');
$q = $pdo->prepare('SELECT COUNT(*) FROM feedback WHERE ip_hash = ? AND criado_em >= ?');
$q->execute([$ipHash, $since]);
if ((int)$q->fetchColumn() >= 3) {
    dx_json(429, ['ok' => false, 'error' => 'limite', 'message' => 'Já recebemos suas respostas. Obrigado!']);
}
try {
    $ins = $pdo->prepare('INSERT INTO feedback (usou, consulta, ajudou, canal, texto, email, consentimento_em, origem, utm_source, utm_medium, utm_campaign, utm_content, ip_hash, criado_em)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $ins->execute([
        $v['usou'], $v['consulta'], $v['ajudou'], $v['canal'] ?: null,
        $texto !== '' ? $texto : null, $email !== '' ? $email : null, $now,
        dx_clean($_POST['origem'] ?? null, 255),
        dx_clean($_POST['utm_source'] ?? null, 120),
        dx_clean($_POST['utm_medium'] ?? null, 120),
        dx_clean($_POST['utm_campaign'] ?? null, 160),
        dx_clean($_POST['utm_content'] ?? null, 160),
        $ipHash, $now,
    ]);
} catch (PDOException $e) {
    error_log('[draxora] feedback: ' . $e->getMessage());
    dx_json(500, ['ok' => false, 'error' => 'db', 'message' => 'Não foi possível salvar agora. Tente de novo em instantes.']);
}
// Aviso ao Elias sem o conteúdo (o relato pode ter dado de saúde: fica só no banco).
$c = dx_config();
if (!empty($c['notify_to']) && !empty($c['mail_from'])) {
    @mail((string)$c['notify_to'], '=?UTF-8?B?' . base64_encode('Novo relato do Mapa dos Sintomas') . '?=',
        "Chegou um relato em $now. Veja pela exportação (tipo=feedback).",
        "From: {$c['mail_from']}\r\nContent-Type: text/plain; charset=UTF-8");
}
dx_json(201, ['ok' => true]);
