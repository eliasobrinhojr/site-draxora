<?php
// Teste do app (/teste/), só para convidados.
//   GET  /api/teste.php?c=CODIGO          → a turma existe e está ativa?
//   POST /api/teste.php (JSON)            → um evento anônimo: {pid, turma, tipo, dia, valor?}
// Nada do que a pessoa registra (sono, humor, remédio, nota) é enviado: fica no celular dela.
declare(strict_types=1);
require __DIR__ . '/_db.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

const DX_TESTE_TIPOS = [
    'aceite'   => [null],
    'registro' => [null],
    'resumo'   => ['2', '4'],
    'consulta' => ['s-muito', 's-um-pouco', 's-nao', 'n'],
    'lembrete' => [null, 'ics', 'google'],
    'copia'    => [null],
    'saiu'     => [null],
];

function dx_turma_ativa(PDO $pdo, string $codigo): bool {
    if (!preg_match('/^[A-Z0-9-]{4,20}$/', $codigo)) return false;
    $q = $pdo->prepare('SELECT ativa FROM teste_turmas WHERE codigo = ?');
    $q->execute([$codigo]);
    return (int)$q->fetchColumn() === 1;
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? '';
$pdo = dx_db();

if ($metodo === 'GET') {
    $c = strtoupper(trim((string)($_GET['c'] ?? '')));
    usleep(150000); // freia quem tenta adivinhar códigos
    dx_json(200, ['ok' => true, 'ativa' => dx_turma_ativa($pdo, $c)]);
}
if ($metodo !== 'POST') {
    header('Allow: GET, POST');
    dx_json(405, ['ok' => false, 'error' => 'method']);
}

// Só aceita envios do próprio site.
$host = preg_replace('/:\d+$/', '', strtolower((string)($_SERVER['HTTP_HOST'] ?? '')));
$from = (string)($_SERVER['HTTP_ORIGIN'] ?? '') ?: (string)($_SERVER['HTTP_REFERER'] ?? '');
if ($from === '' || strtolower((string)parse_url($from, PHP_URL_HOST)) !== $host) {
    dx_json(403, ['ok' => false, 'error' => 'origin']);
}

$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) dx_json(400, ['ok' => false, 'error' => 'json']);

$pid = strtolower((string)($in['pid'] ?? ''));
$turma = strtoupper((string)($in['turma'] ?? ''));
$tipo = (string)($in['tipo'] ?? '');
$dia = (string)($in['dia'] ?? '');
$valor = isset($in['valor']) && $in['valor'] !== '' ? (string)$in['valor'] : null;

if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $pid)) dx_json(422, ['ok' => false, 'error' => 'pid']);
if (!array_key_exists($tipo, DX_TESTE_TIPOS) || !in_array($valor, DX_TESTE_TIPOS[$tipo], true)) dx_json(422, ['ok' => false, 'error' => 'tipo']);

$tz = new DateTimeZone('America/Sao_Paulo');
$d = DateTimeImmutable::createFromFormat('!Y-m-d', $dia, $tz);
$hoje = new DateTimeImmutable('today', $tz);
// Aceita 1 dia à frente (fuso do celular) e até 60 dias para trás.
if (!$d || $d->format('Y-m-d') !== $dia || $d > $hoje->modify('+1 day') || $d < $hoje->modify('-60 days')) {
    dx_json(422, ['ok' => false, 'error' => 'dia']);
}

// Turma: no aceite precisa estar ativa. Depois, quem já entrou continua contando mesmo se a turma fechar para novos.
if ($tipo === 'aceite') {
    if (!dx_turma_ativa($pdo, $turma)) dx_json(403, ['ok' => false, 'error' => 'turma']);
} else {
    $q = $pdo->prepare("SELECT turma FROM teste_eventos WHERE pid = ? AND tipo = 'aceite' LIMIT 1");
    $q->execute([$pid]);
    $t = $q->fetchColumn();
    if ($t === false) dx_json(403, ['ok' => false, 'error' => 'participante']);
    $turma = (string)$t;
}

// Limite por aparelho de rede: 120 eventos em 10 minutos.
$ipHash = dx_ip_hash();
$now = dx_now();
$since = (new DateTimeImmutable('now', $tz))->modify('-10 minutes')->format('Y-m-d H:i:s');
$q = $pdo->prepare('SELECT COUNT(*) FROM teste_eventos WHERE ip_hash = ? AND criado_em >= ?');
$q->execute([$ipHash, $since]);
if ((int)$q->fetchColumn() >= 120) dx_json(429, ['ok' => false, 'error' => 'limite']);

$mysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
$sql = ($mysql ? 'INSERT IGNORE' : 'INSERT OR IGNORE') . ' INTO teste_eventos (pid, turma, tipo, dia, valor, ip_hash, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)';
try {
    $pdo->prepare($sql)->execute([$pid, $turma, $tipo, $dia, $valor, $ipHash, $now]);
} catch (PDOException $e) {
    error_log('[draxora] teste: ' . $e->getMessage());
    dx_json(500, ['ok' => false, 'error' => 'db']);
}
dx_json(201, ['ok' => true]);
