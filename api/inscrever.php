<?php
// POST /api/inscrever.php — grava um e-mail numa lista de espera.
// Campos: email, lista, consentimento=sim, site (armadilha anti-robô: deve vir vazio), utm_*, origem.
declare(strict_types=1);
require __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    dx_json(405, ['ok' => false, 'error' => 'method']);
}

// Só aceita envios do próprio site. Navegadores sempre mandam Origin num envio por fetch;
// sem Origin, usamos o Referer; sem nenhum dos dois, é um robô postando direto.
$host = preg_replace('/:\d+$/', '', strtolower((string)($_SERVER['HTTP_HOST'] ?? '')));
$from = (string)($_SERVER['HTTP_ORIGIN'] ?? '') ?: (string)($_SERVER['HTTP_REFERER'] ?? '');
$fromHost = strtolower((string)parse_url($from, PHP_URL_HOST));
if ($from === '' || $fromHost !== $host) {
    dx_json(403, ['ok' => false, 'error' => 'origin']);
}

// Robôs: campo escondido "site" preenchido, ou envio sem o carimbo de tempo que o JavaScript
// do site acrescenta (dx_t = segundos desde que a página abriu; pessoa leva mais de 2 s).
// Fingimos sucesso e não gravamos nada, para o robô não aprender a contornar.
$dxT = $_POST['dx_t'] ?? null;
if (!empty($_POST['site']) || !is_numeric($dxT) || (float)$dxT < 2) {
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

// Freio geral contra robôs espalhados em muitos IPs: no máximo N cadastros novos por hora
// no site todo (padrão 300; ajuste 'max_por_hora' no draxora-config.php).
$hora = (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->modify('-1 hour')->format('Y-m-d H:i:s');
$g = $pdo->prepare('SELECT COUNT(*) FROM inscritos WHERE criado_em >= ?');
$g->execute([$hora]);
if ((int)$g->fetchColumn() >= (int)(dx_config()['max_por_hora'] ?? 300)) {
    error_log('[draxora] limite geral por hora atingido');
    dx_json(429, ['ok' => false, 'error' => 'limite', 'message' => 'Muitas inscrições agora. Tente de novo em alguns minutos.']);
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

// Envia o contato ao Brevo (lista por nome de lista), se a chave estiver no draxora-config.php.
// Falha aqui nunca derruba o cadastro: o e-mail já está salvo no banco.
$brevoKey = (string)($c['brevo_api_key'] ?? '');
$brevoLists = (array)($c['brevo_listas'] ?? []);
if ($brevoKey !== '' && !empty($brevoLists[$lista]) && function_exists('curl_init')) {
    $payload = json_encode([
        'email' => $email,
        'listIds' => [(int)$brevoLists[$lista]],
        'updateEnabled' => true,
        'attributes' => [
            'LISTA' => $lista,
            'UTM_SOURCE' => (string)dx_clean($_POST['utm_source'] ?? null, 160),
            'UTM_CAMPAIGN' => (string)dx_clean($_POST['utm_campaign'] ?? null, 160),
            'UTM_CONTENT' => (string)dx_clean($_POST['utm_content'] ?? null, 160),
        ],
    ]);
    $ch = curl_init('https://api.brevo.com/v3/contacts');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['accept: application/json', 'content-type: application/json', 'api-key: ' . $brevoKey],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 4,
        CURLOPT_CONNECTTIMEOUT => 3,
    ]);
    $resp = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    // (sem curl_close: no PHP 8.5 ela é obsoleta; o recurso é liberado sozinho)
    unset($ch);
    if ($code < 200 || $code >= 300) {
        error_log('[draxora] brevo ' . $code . ': ' . substr((string)$resp, 0, 200));
    }
}

dx_json(201, ['ok' => true]);
