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
    // Ajuda a conferir o que está escrito no arquivo (nunca mostra a senha).
    preg_match('/dbname=([^;]+)/', (string)$c['db_dsn'], $m);
    preg_match('/host=([^;]+)/', (string)$c['db_dsn'], $h);
    $out['banco_no_arquivo'] = $m[1] ?? null;
    $out['host_no_arquivo'] = $h[1] ?? null;
    $out['usuario_no_arquivo'] = $c['db_user'] ?? null;
    $out['senha_preenchida'] = !empty($c['db_pass']);
    $out['arquivo_alterado_em'] = null;
    foreach ([dirname(__DIR__, 2) . '/draxora-config.php', dirname(__DIR__, 3) . '/draxora-config.php'] as $f) {
        if (is_file($f)) { $out['arquivo_alterado_em'] = date('Y-m-d H:i:s', (int)filemtime($f)); break; }
    }
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
// Versão do PHP do servidor (só aparece com a chave). Mínimo seguro em 22/10/2026:
// 8.5.12, 8.4.27 ou 8.3.36 (correção das falhas críticas CVE-2026-109618/109619).
$out['php'] = PHP_VERSION;
$out['php_seguro'] = version_compare(PHP_VERSION, '8.5.12', '>=')
    || (version_compare(PHP_VERSION, '8.4.27', '>=') && version_compare(PHP_VERSION, '8.5.0', '<'))
    || (version_compare(PHP_VERSION, '8.3.36', '>=') && version_compare(PHP_VERSION, '8.4.0', '<'));
// Como o servidor enxerga o visitante (para conferir o limite de tentativas por aparelho).
$remote = (string)($_SERVER['REMOTE_ADDR'] ?? '');
$out['visitante'] = [
    'ip_parcial' => preg_replace('/[0-9a-f]+$/i', 'x', dx_client_ip()),
    'conexao_via_cloudflare' => dx_is_cloudflare($remote),
    'cabecalho_cf_presente' => !empty($_SERVER['HTTP_CF_CONNECTING_IP']),
    'cabecalho_x_forwarded_presente' => !empty($_SERVER['HTTP_X_FORWARDED_FOR']),
];
// Diz apenas se a integração com o Brevo está ligada (chave preenchida + lista "amostra" mapeada). Nunca mostra a chave.
// Último evento da integração (sem e-mails: qualquer endereço na mensagem é mascarado).
$out['brevo_ultimo_evento'] = is_file(dx_log_file())
    ? preg_replace('/[^\s@"]+@[^\s@"]+/', '[e-mail]', trim((string)file_get_contents(dx_log_file())))
    : null;
// Formato da chave (nunca a chave): prefixo esperado "xkeysib-", tamanho, e se há espaço/aspas sobrando.
$k = (string)($c['brevo_api_key'] ?? '');
$out['brevo_chave'] = ['prefixo_ok' => str_starts_with($k, 'xkeysib-'), 'tamanho' => strlen($k), 'tem_espaco_ou_aspas' => (bool)preg_match('/[\s"\']/', $k)];
foreach ([dirname(__DIR__, 2) . '/draxora-config.php', dirname(__DIR__, 3) . '/draxora-config.php'] as $i => $f) {
    $out['config_candidato_' . ($i + 1)] = is_file($f) ? date('Y-m-d H:i:s', (int)filemtime($f)) : null;
}
$out['brevo_configurado'] = !empty($c['brevo_api_key']) && !empty($c['brevo_listas']['amostra']) && function_exists('curl_init');
// Avisos da política de conteúdo (modo relatório): contagem por diretiva + domínio
$cspF = dx_csp_file();
$csp = [];
if (is_file($cspF)) {
    foreach (file($cspF) ?: [] as $l) { $p = explode("\t", trim($l)); if (count($p) >= 3) { $k = $p[1] . ' ← ' . $p[2]; $csp[$k] = ($csp[$k] ?? 0) + 1; } }
    arsort($csp);
}
$out['csp_avisos'] = array_slice($csp, 0, 30, true);
// Sem a chave de exportação, mostra só se está funcionando (nada de banco, Brevo, PHP ou arquivos de config).
$key = (string)($c['export_key'] ?? '');
if (strlen($key) < 16 || !hash_equals($key, (string)($_GET['chave'] ?? ''))) {
    $out = ['ok' => $out['ok']];
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
