<?php
// Painel da Draxora — dados. POST /painel/dados.php?acao=entrar|sair|dados|teste|turma
// (turma é a única ação que grava: cria, ativa ou desativa um código de convite do teste do app)
//
// Acesso:
//   1. (recomendado) senha de pasta do hPanel em /painel/ — barra a página antes do PHP.
//   2. Chave do painel: 'painel_key' do draxora-config.php (ou, sem ela, a 'export_key').
//      Ela vai no corpo do POST, nunca na URL. Depois do login vale uma sessão de até 12 h
//      (cookie HttpOnly, Secure, SameSite=Strict).
//   3. 5 chaves erradas em 15 min pelo mesmo aparelho = bloqueio de 15 min.
// Fora 'turma', nada aqui altera dados: só lê. E-mails saem mascarados, e só aparecem inteiros a pedido.
declare(strict_types=1);
require __DIR__ . '/../api/_db.php';

header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    dx_json(405, ['ok' => false, 'error' => 'method']);
}
// Só aceita chamadas da própria página do painel.
$host = preg_replace('/:\d+$/', '', strtolower((string)($_SERVER['HTTP_HOST'] ?? '')));
$from = (string)($_SERVER['HTTP_ORIGIN'] ?? '') ?: (string)($_SERVER['HTTP_REFERER'] ?? '');
if ($from === '' || strtolower((string)parse_url($from, PHP_URL_HOST)) !== $host) {
    dx_json(403, ['ok' => false, 'error' => 'origin']);
}

$https = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off')
    || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https'
    || in_array($host, ['localhost', '127.0.0.1'], true);
session_name('dx_painel');
session_set_cookie_params(['lifetime' => 0, 'path' => '/painel/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
ini_set('session.use_strict_mode', '1');
session_start();

const DX_SESSAO_MAX = 12 * 3600;
$acao = (string)($_GET['acao'] ?? '');
$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];

function dx_painel_logado(): bool {
    $t = (int)($_SESSION['painel_em'] ?? 0);
    return $t > 0 && (time() - $t) < DX_SESSAO_MAX;
}

if ($acao === 'sair') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    }
    session_destroy();
    dx_json(200, ['ok' => true]);
}

$pdo = dx_db();
$pdo->exec("CREATE TABLE IF NOT EXISTS painel_acessos (
    id " . ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT') . ",
    ip_hash CHAR(64) NOT NULL,
    ok TINYINT NOT NULL,
    criado_em VARCHAR(25) NOT NULL
)");

if ($acao === 'entrar') {
    $agora = dx_now();
    $limite = (new DateTimeImmutable($agora))->modify('-15 minutes')->format('Y-m-d H:i:s');
    $q = $pdo->prepare('SELECT COUNT(*) FROM painel_acessos WHERE ip_hash = ? AND ok = 0 AND criado_em >= ?');
    $q->execute([dx_ip_hash(), $limite]);
    if ((int)$q->fetchColumn() >= 5) {
        dx_json(429, ['ok' => false, 'error' => 'tentativas', 'message' => 'Muitas tentativas. Espere 15 minutos.']);
    }
    $c = dx_config();
    $chave = (string)($c['painel_key'] ?? ($c['export_key'] ?? ''));
    $ok = strlen($chave) >= 16 && hash_equals($chave, (string)($in['chave'] ?? ''));
    $pdo->prepare('INSERT INTO painel_acessos (ip_hash, ok, criado_em) VALUES (?, ?, ?)')->execute([dx_ip_hash(), $ok ? 1 : 0, $agora]);
    // Registro de acessos: guarda 90 dias.
    $pdo->prepare('DELETE FROM painel_acessos WHERE criado_em < ?')->execute([(new DateTimeImmutable($agora))->modify('-90 days')->format('Y-m-d H:i:s')]);
    if (!$ok) {
        usleep(400000);
        dx_json(401, ['ok' => false, 'error' => 'chave', 'message' => 'Chave incorreta.']);
    }
    session_regenerate_id(true);
    $_SESSION['painel_em'] = time();
    dx_json(200, ['ok' => true]);
}

// ===== Teste do app (/teste/): só contagens anônimas =====
if ($acao === 'teste' || $acao === 'turma') {
    if (!dx_painel_logado()) dx_json(401, ['ok' => false, 'error' => 'sessao', 'message' => 'Entre de novo.']);
    if ($acao === 'turma') {
        $codigo = strtoupper(trim((string)($in['codigo'] ?? '')));
        if (!preg_match('/^[A-Z0-9-]{4,20}$/', $codigo)) dx_json(422, ['ok' => false, 'message' => 'Código: 4 a 20 letras, números ou hífen.']);
        $q = $pdo->prepare('SELECT ativa FROM teste_turmas WHERE codigo = ?'); $q->execute([$codigo]);
        $existe = $q->fetchColumn();
        if ($existe === false) {
            $nome = trim((string)($in['nome'] ?? ''));
            if ($nome === '' || mb_strlen($nome) > 60) dx_json(422, ['ok' => false, 'message' => 'Dê um nome à turma (até 60 caracteres).']);
            $pdo->prepare('INSERT INTO teste_turmas (codigo, nome, ativa, criada_em) VALUES (?, ?, 1, ?)')->execute([$codigo, $nome, dx_now()]);
        } else {
            $pdo->prepare('UPDATE teste_turmas SET ativa = ? WHERE codigo = ?')->execute([!empty($in['ativa']) ? 1 : 0, $codigo]);
        }
        dx_json(200, ['ok' => true]);
    }
    $tz = new DateTimeZone('America/Sao_Paulo');
    $hojeT = new DateTimeImmutable('today', $tz);
    $turmas = [];
    foreach ($pdo->query('SELECT codigo, nome, ativa, criada_em FROM teste_turmas ORDER BY criada_em') as $r) {
        $turmas[$r['codigo']] = ['codigo' => $r['codigo'], 'nome' => $r['nome'], 'ativa' => (int)$r['ativa'] === 1, 'criada_em' => $r['criada_em']];
    }
    // Por participante: dia do aceite, dias com registro, saiu, resumo, lembrete, respostas de consulta.
    $p = [];
    foreach ($pdo->query('SELECT pid, turma, tipo, dia, valor FROM teste_eventos ORDER BY dia') as $e) {
        $id = $e['pid'];
        if (!isset($p[$id])) $p[$id] = ['turma' => $e['turma'], 'aceite' => null, 'regs' => [], 'saiu' => null, 'resumo' => 0, 'lembrete' => false, 'consultas' => []];
        switch ($e['tipo']) {
            case 'aceite': $p[$id]['aceite'] = $e['dia']; break;
            case 'registro': $p[$id]['regs'][$e['dia']] = true; break;
            case 'saiu': $p[$id]['saiu'] = $e['dia']; break;
            case 'resumo': $p[$id]['resumo']++; break;
            case 'lembrete': $p[$id]['lembrete'] = true; break;
            case 'consulta': $p[$id]['consultas'][] = $e['valor']; break;
        }
    }
    $porTurma = [];
    $linhas = []; // para a planilha: participante anônimo × semana
    $n = 0;
    foreach ($p as $id => $x) {
        if (!$x['aceite']) continue;
        $n++;
        $t = $x['turma'];
        if (!isset($porTurma[$t])) $porTurma[$t] = ['participantes' => 0, 'sairam' => 0, 'resumo' => 0, 'lembrete' => 0,
            'semanas' => [1 => ['completas' => 0, 'ativos' => 0], 2 => ['completas' => 0, 'ativos' => 0], 3 => ['completas' => 0, 'ativos' => 0], 4 => ['completas' => 0, 'ativos' => 0]],
            'dist' => array_fill(0, 8, 0), 'consulta' => ['s-muito' => 0, 's-um-pouco' => 0, 's-nao' => 0, 'n' => 0],
            'w4_lembrete' => ['completas' => 0, 'ativos' => 0], 'w4_sem_lembrete' => ['completas' => 0, 'ativos' => 0]];
        $T = &$porTurma[$t];
        $T['participantes']++;
        if ($x['saiu']) $T['sairam']++;
        if ($x['resumo'] > 0) $T['resumo']++;
        if ($x['lembrete']) $T['lembrete']++;
        foreach ($x['consultas'] as $v) if (isset($T['consulta'][$v])) $T['consulta'][$v]++;
        $ini = new DateTimeImmutable($x['aceite'], $tz);
        $codigoAnon = substr(hash('sha256', $id), 0, 8);
        for ($k = 1; $k <= 4; $k++) {
            $a = $ini->modify('+' . (7 * ($k - 1)) . ' days');
            $b = $a->modify('+6 days');
            $dias = 0;
            for ($d = $a; $d <= $b; $d = $d->modify('+1 day')) if (isset($x['regs'][$d->format('Y-m-d')])) $dias++;
            $completa = $b < $hojeT;
            if ($completa) {
                $T['semanas'][$k]['completas']++;
                if ($dias >= 4) $T['semanas'][$k]['ativos']++;
                $T['dist'][$dias]++;
                if ($k === 4) {
                    $g = $x['lembrete'] ? 'w4_lembrete' : 'w4_sem_lembrete';
                    $T[$g]['completas']++; if ($dias >= 4) $T[$g]['ativos']++;
                }
            }
            $linhas[] = [$t, $codigoAnon, $x['aceite'], $k, $a->format('Y-m-d'), $b->format('Y-m-d'), $completa ? 'sim' : 'em andamento', $dias, $dias >= 4 ? 'sim' : 'nao', $x['lembrete'] ? 'sim' : 'nao', $x['resumo'] > 0 ? 'sim' : 'nao', $x['saiu'] ?: ''];
        }
        unset($T);
    }
    foreach ($porTurma as $c => $v) if (!isset($turmas[$c])) $turmas[$c] = ['codigo' => $c, 'nome' => '(turma apagada)', 'ativa' => false, 'criada_em' => ''];
    dx_json(200, ['ok' => true, 'gerado_em' => dx_now(), 'participantes' => $n, 'turmas' => array_values($turmas), 'por_turma' => $porTurma, 'linhas' => $linhas]);
}

if ($acao !== 'dados') dx_json(404, ['ok' => false, 'error' => 'acao']);
if (!dx_painel_logado()) dx_json(401, ['ok' => false, 'error' => 'sessao', 'message' => 'Entre de novo.']);

// ===== Período =====
$tz = new DateTimeZone('America/Sao_Paulo');
$hoje = new DateTimeImmutable('today', $tz);
$dias = (int)($in['dias'] ?? 30);
if (!in_array($dias, [7, 30, 90, 0], true)) $dias = 30;
$listas = !empty($in['listas']);
$emailsInteiros = $listas && !empty($in['emails']);

if ($dias === 0) {
    $primeiro = null;
    foreach (['inscritos', 'downloads', 'feedback'] as $t) {
        $d = $pdo->query("SELECT MIN(criado_em) FROM $t")->fetchColumn();
        if ($d && ($primeiro === null || $d < $primeiro)) $primeiro = $d;
    }
    $inicio = $primeiro ? new DateTimeImmutable(substr((string)$primeiro, 0, 10), $tz) : $hoje;
} else {
    $inicio = $hoje->modify('-' . ($dias - 1) . ' days');
}
$fim = $hoje->modify('+1 day');
$de = $inicio->format('Y-m-d 00:00:00');
$ate = $fim->format('Y-m-d 00:00:00');
$antDe = $dias ? $inicio->modify("-$dias days")->format('Y-m-d 00:00:00') : null;

function dx_um(PDO $pdo, string $sql, array $p): int {
    $q = $pdo->prepare($sql); $q->execute($p); return (int)$q->fetchColumn();
}
function dx_todos(PDO $pdo, string $sql, array $p): array {
    $q = $pdo->prepare($sql); $q->execute($p); return $q->fetchAll(PDO::FETCH_ASSOC);
}
function dx_fonte(?string $s): string {
    $s = strtolower(trim((string)$s));
    $mapa = ['ig' => 'instagram', 'fb' => 'facebook', 'meta' => 'facebook', 'adwords' => 'google'];
    return $s === '' ? '(direto)' : ($mapa[$s] ?? mb_substr($s, 0, 40));
}
function dx_mascara(?string $e): ?string {
    if (!$e || !str_contains($e, '@')) return $e ?: null;
    [$u, $d] = explode('@', $e, 2);
    return mb_substr($u, 0, 2) . '•••@' . $d;
}

// Contagens de um intervalo (para o período e para o período anterior, que dá a variação).
$contar = function (string $a, string $b) use ($pdo): array {
    return [
        'cadastros' => dx_um($pdo, "SELECT COUNT(*) FROM inscritos WHERE lista = 'amostra' AND criado_em >= ? AND criado_em < ?", [$a, $b]),
        'baixou_guia' => dx_um($pdo, "SELECT COUNT(DISTINCT ip_hash) FROM downloads WHERE robo = 0 AND arquivo = 'guia' AND criado_em >= ? AND criado_em < ?", [$a, $b]),
        'baixou_folhas' => dx_um($pdo, "SELECT COUNT(DISTINCT ip_hash) FROM downloads WHERE robo = 0 AND arquivo = 'folhas' AND criado_em >= ? AND criado_em < ?", [$a, $b]),
        'relatos' => dx_um($pdo, 'SELECT COUNT(*) FROM feedback WHERE criado_em >= ? AND criado_em < ?', [$a, $b]),
        'interessados_app' => dx_um($pdo, "SELECT COUNT(*) FROM inscritos WHERE lista = 'mapa-dos-sintomas' AND criado_em >= ? AND criado_em < ?", [$a, $b]),
        'porta01' => dx_um($pdo, "SELECT COUNT(*) FROM inscritos WHERE lista = 'porta-01' AND criado_em >= ? AND criado_em < ?", [$a, $b]),
    ];
};
$atual = $contar($de, $ate);
$anterior = $antDe ? $contar($antDe, $de) : null;

// Série por dia (todos os dias do período, inclusive os zerados).
$serie = [];
for ($d = $inicio; $d < $fim; $d = $d->modify('+1 day')) {
    $serie[$d->format('Y-m-d')] = ['cadastros' => 0, 'baixou_guia' => 0, 'baixou_folhas' => 0, 'relatos' => 0, 'interessados_app' => 0];
}
$porDia = function (string $sql, string $col) use ($pdo, $de, $ate, &$serie) {
    foreach (dx_todos($pdo, $sql, [$de, $ate]) as $r) if (isset($serie[$r['d']])) $serie[$r['d']][$col] = (int)$r['n'];
};
$porDia("SELECT SUBSTR(criado_em,1,10) d, COUNT(*) n FROM inscritos WHERE lista = 'amostra' AND criado_em >= ? AND criado_em < ? GROUP BY d", 'cadastros');
$porDia("SELECT SUBSTR(criado_em,1,10) d, COUNT(DISTINCT ip_hash) n FROM downloads WHERE robo = 0 AND arquivo = 'guia' AND criado_em >= ? AND criado_em < ? GROUP BY d", 'baixou_guia');
$porDia("SELECT SUBSTR(criado_em,1,10) d, COUNT(DISTINCT ip_hash) n FROM downloads WHERE robo = 0 AND arquivo = 'folhas' AND criado_em >= ? AND criado_em < ? GROUP BY d", 'baixou_folhas');
$porDia('SELECT SUBSTR(criado_em,1,10) d, COUNT(*) n FROM feedback WHERE criado_em >= ? AND criado_em < ? GROUP BY d', 'relatos');
$porDia("SELECT SUBSTR(criado_em,1,10) d, COUNT(*) n FROM inscritos WHERE lista = 'mapa-dos-sintomas' AND criado_em >= ? AND criado_em < ? GROUP BY d", 'interessados_app');
$porDiaLista = [];
foreach ($serie as $d => $v) $porDiaLista[] = ['d' => $d] + $v;

// De onde vieram os cadastros do guia (utm_source) e quais anúncios (utm_content).
$fontes = [];
foreach (dx_todos($pdo, "SELECT utm_source s, COUNT(*) n FROM inscritos WHERE lista = 'amostra' AND criado_em >= ? AND criado_em < ? GROUP BY utm_source", [$de, $ate]) as $r) {
    $f = dx_fonte($r['s']); $fontes[$f] = ($fontes[$f] ?? 0) + (int)$r['n'];
}
arsort($fontes);
$anuncios = [];
foreach (dx_todos($pdo, "SELECT utm_source s, utm_content c, COUNT(*) n FROM inscritos WHERE lista = 'amostra' AND utm_content IS NOT NULL AND utm_content <> '' AND criado_em >= ? AND criado_em < ? GROUP BY utm_source, utm_content ORDER BY n DESC", [$de, $ate]) as $r) {
    $anuncios[] = ['fonte' => dx_fonte($r['s']), 'anuncio' => mb_substr((string)$r['c'], 0, 80), 'n' => (int)$r['n']];
}
$anuncios = array_slice($anuncios, 0, 10);

// Downloads por origem do link (?de=email1…), pessoas únicas.
$dl = [];
foreach (dx_todos($pdo, "SELECT COALESCE(NULLIF(origem,''),'(sem origem)') o, arquivo, COUNT(DISTINCT ip_hash) n FROM downloads WHERE robo = 0 AND criado_em >= ? AND criado_em < ? GROUP BY o, arquivo", [$de, $ate]) as $r) {
    $dl[$r['o']] = $dl[$r['o']] ?? ['origem' => $r['o'], 'guia' => 0, 'folhas' => 0];
    if (in_array($r['arquivo'], ['guia', 'folhas'], true)) $dl[$r['o']][$r['arquivo']] = (int)$r['n'];
}
$dl = array_values($dl);
usort($dl, fn($a, $b) => ($b['guia'] + $b['folhas']) <=> ($a['guia'] + $a['folhas']));

// Relatos da /conte/: totais por resposta.
$resumo = [];
foreach (['usou', 'semanas', 'consulta', 'ajudou', 'versao', 'diagnostico', 'canal'] as $col) {
    $resumo[$col] = [];
    foreach (dx_todos($pdo, "SELECT COALESCE(NULLIF($col,''),'(sem resposta)') v, COUNT(*) n FROM feedback WHERE criado_em >= ? AND criado_em < ? GROUP BY v", [$de, $ate]) as $r) {
        $resumo[$col][$r['v']] = (int)$r['n'];
    }
}

$saida = [
    'ok' => true,
    'periodo' => ['dias' => $dias, 'de' => $inicio->format('Y-m-d'), 'ate' => $hoje->format('Y-m-d')],
    'gerado_em' => dx_now(),
    'kpis' => $atual,
    'anterior' => $anterior,
    'por_dia' => $porDiaLista,
    'fontes' => $fontes,
    'anuncios' => $anuncios,
    'downloads_origem' => $dl,
    'relatos_resumo' => $resumo,
];

// Listas com pessoas: só quando pedidas (o modo apresentação não pede).
if ($listas) {
    $saida['relatos'] = array_map(fn($r) => [
        'em' => $r['criado_em'], 'usou' => $r['usou'], 'semanas' => $r['semanas'] ?: null, 'consulta' => $r['consulta'], 'ajudou' => $r['ajudou'],
        'versao' => $r['versao'] ?: null, 'diagnostico' => $r['diagnostico'] ?: null, 'canal' => $r['canal'] ?: null, 'texto' => $r['texto'],
        'email' => $emailsInteiros ? $r['email'] : dx_mascara($r['email']), 'fonte' => dx_fonte($r['utm_source']),
    ], dx_todos($pdo, 'SELECT criado_em, usou, semanas, consulta, ajudou, versao, diagnostico, canal, texto, email, utm_source FROM feedback WHERE criado_em >= ? AND criado_em < ? ORDER BY criado_em DESC LIMIT 100', [$de, $ate]));
    $saida['interessados'] = array_map(fn($r) => [
        'em' => $r['criado_em'], 'email' => $emailsInteiros ? $r['email'] : dx_mascara($r['email']),
        'fonte' => dx_fonte($r['utm_source']), 'campanha' => $r['utm_campaign'],
    ], dx_todos($pdo, "SELECT criado_em, email, utm_source, utm_campaign FROM inscritos WHERE lista = 'mapa-dos-sintomas' AND criado_em >= ? AND criado_em < ? ORDER BY criado_em DESC LIMIT 200", [$de, $ate]));
    $saida['emails_inteiros'] = $emailsInteiros;
}

dx_json(200, $saida);
