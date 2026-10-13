<?php
// GET /api/contador.php?lista=porta-01 — quantas pessoas estão esperando uma porta.
// Abaixo de 'min_publico' (config, padrão 20) devolve null, para a porta não mostrar "3 pessoas".
declare(strict_types=1);
require __DIR__ . '/_db.php';

$lista = (string)($_GET['lista'] ?? '');
if (!in_array($lista, DX_LISTAS, true)) {
    dx_json(422, ['ok' => false, 'error' => 'lista']);
}
$q = dx_db()->prepare('SELECT COUNT(*) FROM inscritos WHERE lista = ?');
$q->execute([$lista]);
$total = (int)$q->fetchColumn();
$min = (int)(dx_config()['min_publico'] ?? 20);

header('Cache-Control: public, max-age=300');
dx_json(200, ['ok' => true, 'total' => $total >= $min ? $total : null]);
