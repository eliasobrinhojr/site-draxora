<?php
// GET /api/exportar.php?chave=SUA_CHAVE&lista=porta-01 — baixa a lista em CSV (abre no Excel/Sheets).
// A chave fica no draxora-config.php ('export_key'). Sem chave configurada, a exportação fica desligada.
declare(strict_types=1);
require __DIR__ . '/_db.php';

$c = dx_config();
$key = (string)($c['export_key'] ?? '');
if (strlen($key) < 16 || !hash_equals($key, (string)($_GET['chave'] ?? ''))) {
    dx_json(403, ['ok' => false, 'error' => 'chave']);
}

// ?tipo=resumo mostra, por dia, cadastros do guia, downloads (pessoas únicas) e relatos. Sem e-mails.
if (($_GET['tipo'] ?? '') === 'resumo') {
    $pdo = dx_db(); dx_migrate($pdo);
    $dias = [];
    $add = function (string $dia, string $col, int $n) use (&$dias) {
        $dias[$dia] = $dias[$dia] ?? ['cadastros' => 0, 'baixou_guia' => 0, 'baixou_folhas' => 0, 'cliques_total' => 0, 'relatos' => 0];
        $dias[$dia][$col] = $n;
    };
    foreach ($pdo->query("SELECT SUBSTR(criado_em,1,10) d, COUNT(*) n FROM inscritos WHERE lista='amostra' GROUP BY d") as $r) $add($r['d'], 'cadastros', (int)$r['n']);
    foreach ($pdo->query("SELECT SUBSTR(criado_em,1,10) d, arquivo, COUNT(DISTINCT ip_hash) n FROM downloads WHERE robo=0 GROUP BY d, arquivo") as $r) $add($r['d'], 'baixou_' . $r['arquivo'], (int)$r['n']);
    foreach ($pdo->query("SELECT SUBSTR(criado_em,1,10) d, COUNT(*) n FROM downloads WHERE robo=0 GROUP BY d") as $r) $add($r['d'], 'cliques_total', (int)$r['n']);
    foreach ($pdo->query("SELECT SUBSTR(criado_em,1,10) d, COUNT(*) n FROM feedback GROUP BY d") as $r) $add($r['d'], 'relatos', (int)$r['n']);
    krsort($dias);
    $tot = ['cadastros' => 0, 'baixou_guia' => 0, 'baixou_folhas' => 0, 'cliques_total' => 0, 'relatos' => 0];
    foreach ($dias as $v) foreach ($v as $k => $n) $tot[$k] += $n;
    $porOrigem = [];
    foreach ($pdo->query("SELECT COALESCE(origem,'(sem)') o, arquivo, COUNT(DISTINCT ip_hash) n FROM downloads WHERE robo=0 GROUP BY o, arquivo") as $r) $porOrigem[$r['o']][$r['arquivo']] = (int)$r['n'];
    dx_json(200, ['ok' => true, 'obs' => 'downloads contados desde a troca dos links nos e-mails; baixou_* = pessoas únicas por dia', 'total' => $tot, 'downloads_por_origem' => $porOrigem, 'por_dia' => $dias]);
}

// ?tipo=feedback baixa os relatos da página /conte/
if (($_GET['tipo'] ?? '') === 'feedback') {
    $pdo = dx_db(); dx_migrate($pdo);
    $q = $pdo->query('SELECT criado_em, usou, consulta, ajudou, canal, texto, email, utm_source, utm_campaign, utm_content, origem FROM feedback ORDER BY criado_em DESC');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="relatos-' . date('Y-m-d') . '.csv"');
    header('Cache-Control: no-store');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['criado_em', 'usou', 'consulta', 'ajudou', 'canal', 'texto', 'email', 'utm_source', 'utm_campaign', 'utm_content', 'origem'], ';');
    while ($row = $q->fetch()) fputcsv($out, array_map('dx_csv_cell', array_values($row)), ';');
    fclose($out);
    exit;
}

$lista = (string)($_GET['lista'] ?? '');
$sql = 'SELECT email, lista, criado_em, consentimento_em, utm_source, utm_medium, utm_campaign, utm_content, origem FROM inscritos';
$params = [];
if ($lista !== '') {
    if (!in_array($lista, DX_LISTAS, true)) dx_json(422, ['ok' => false, 'error' => 'lista']);
    $sql .= ' WHERE lista = ?';
    $params[] = $lista;
}
$sql .= ' ORDER BY criado_em DESC';
$q = dx_db()->prepare($sql);
$q->execute($params);

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="inscritos-' . ($lista ?: 'todas') . '-' . date('Y-m-d') . '.csv"');
header('Cache-Control: no-store');
$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF"); // BOM para o Excel ler acentos
fputcsv($out, ['email', 'lista', 'cadastrado_em', 'consentimento_em', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'origem'], ';');
while ($row = $q->fetch()) {
    fputcsv($out, array_map('dx_csv_cell', array_values($row)), ';');
}
fclose($out);
