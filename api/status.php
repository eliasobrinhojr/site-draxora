<?php
// GET /api/status.php — diagnóstico da configuração do cadastro. Não mostra senhas nem dados.
declare(strict_types=1);
require __DIR__ . '/_db.php';

$c = dx_config();
$out = ['config_encontrado' => !empty($c), 'conexao' => false, 'tabela' => false, 'problema' => null];
if (empty($c)) {
    $out['problema'] = 'Arquivo draxora-config.php não encontrado. Ele deve ficar em domains/<dominio>/, uma pasta acima da public_html.';
} elseif (empty($c['db_dsn'])) {
    $out['problema'] = 'db_dsn vazio no draxora-config.php.';
} else {
    try {
        $pdo = new PDO($c['db_dsn'], $c['db_user'] ?? null, $c['db_pass'] ?? null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $out['conexao'] = true;
        dx_migrate($pdo);
        $pdo->query('SELECT COUNT(*) FROM inscritos')->fetchColumn();
        $out['tabela'] = true;
    } catch (PDOException $e) {
        $code = (int)($e->errorInfo[1] ?? 0);
        $msg = $e->getMessage();
        if ($code === 1045 || str_contains($msg, '1045')) $out['problema'] = 'Usuário ou senha do banco recusados (erro 1045). Confira db_user e db_pass: na Hostinger eles começam com u + números, ex.: u123456789_draxora.';
        elseif ($code === 1049 || str_contains($msg, '1049')) $out['problema'] = 'Banco não existe (erro 1049). Confira o dbname no db_dsn: copie o nome exato do hPanel, ex.: u123456789_draxora.';
        elseif ($code === 1044 || str_contains($msg, '1044')) $out['problema'] = 'O usuário não tem acesso a esse banco (erro 1044). No hPanel, confira se o usuário foi criado junto com esse banco.';
        elseif ($code === 2002 || str_contains($msg, '2002')) $out['problema'] = 'Servidor do banco não encontrado (erro 2002). Use host=localhost no db_dsn.';
        else $out['problema'] = 'Erro do banco: código ' . ($code ?: (string)$e->getCode());
    }
}
$out['ok'] = $out['tabela'];
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
