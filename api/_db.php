<?php
// Draxora — conexão com o banco e utilidades da API.
// As credenciais NÃO ficam no repositório (ele é público).
// Elas são lidas de um arquivo criado uma única vez no servidor, FORA da public_html:
//   domains/<seu-dominio>/draxora-config.php   (veja config.exemplo.txt)

declare(strict_types=1);

// Produção: avisos do PHP vão só para o log, nunca para a resposta (um aviso impresso
// estragaria o JSON e o formulário mostraria erro mesmo com o cadastro salvo).
ini_set('display_errors', '0');
ini_set('log_errors', '1');

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

function dx_config(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $candidates = [
        getenv('DRAXORA_CONFIG') ?: '',
        dirname(__DIR__, 2) . '/draxora-config.php', // domains/<dominio>/draxora-config.php
        dirname(__DIR__, 3) . '/draxora-config.php', // home do usuário
    ];
    foreach ($candidates as $file) {
        if ($file && is_file($file)) { $cfg = require $file; return $cfg; }
    }
    $cfg = [];
    return $cfg;
}

// Arquivo (fora da public_html) onde o site guarda o último erro de integração, para o diagnóstico.
function dx_log_file(): string {
    $dir = dirname(__DIR__, 2);
    return (is_dir($dir) && is_writable($dir)) ? $dir . '/draxora-ultimo-erro.txt' : sys_get_temp_dir() . '/draxora-ultimo-erro.txt';
}

function dx_csp_file(): string {
    return dirname(dx_log_file()) . '/draxora-csp.txt';
}

function dx_json(int $status, array $body): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function dx_db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = dx_config();
    if (empty($c['db_dsn'])) {
        dx_json(503, ['ok' => false, 'error' => 'config', 'message' => 'Cadastro indisponível no momento. Tente mais tarde.']);
    }
    try {
        $pdo = new PDO($c['db_dsn'], $c['db_user'] ?? null, $c['db_pass'] ?? null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        dx_migrate($pdo);
    } catch (PDOException $e) {
        error_log('[draxora] conexao: ' . $e->getMessage());
        dx_json(503, ['ok' => false, 'error' => 'conexao', 'message' => 'Cadastro indisponível no momento. Tente mais tarde.']);
    }
    return $pdo;
}

// Cria a tabela na primeira chamada. Nada para rodar à mão no phpMyAdmin.
function dx_migrate(PDO $pdo): void {
    $mysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $id = $mysql ? 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $tail = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
    $pdo->exec("CREATE TABLE IF NOT EXISTS inscritos (
        id $id,
        email VARCHAR(190) NOT NULL,
        lista VARCHAR(60) NOT NULL,
        consentimento_em VARCHAR(25) NOT NULL,
        origem VARCHAR(255) NULL,
        utm_source VARCHAR(120) NULL,
        utm_medium VARCHAR(120) NULL,
        utm_campaign VARCHAR(160) NULL,
        utm_content VARCHAR(160) NULL,
        ip_hash CHAR(64) NOT NULL,
        criado_em VARCHAR(25) NOT NULL,
        UNIQUE (email, lista)
    )$tail");
}

function dx_now(): string {
    return (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d H:i:s');
}

// IP real do visitante. O cabeçalho CF-Connecting-IP só vale quando a conexão vem
// de fato da Cloudflare; vindo de qualquer outro lugar, qualquer um poderia inventá-lo
// e escapar do limite de tentativas.
function dx_client_ip(): string {
    $remote = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    $cf = (string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? '');
    if ($cf !== '' && filter_var($cf, FILTER_VALIDATE_IP) && dx_is_cloudflare($remote)) return $cf;
    return $remote;
}

// Faixas publicadas em https://www.cloudflare.com/ips/
function dx_is_cloudflare(string $ip): bool {
    $ranges = [
        '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
        '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
        '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
        '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
        '2a06:98c0::/29', '2c0f:f248::/32',
    ];
    $bin = @inet_pton($ip);
    if ($bin === false) return false;
    foreach ($ranges as $r) {
        [$net, $bits] = explode('/', $r);
        $nb = inet_pton($net);
        if (strlen($nb) !== strlen($bin)) continue;
        $bytes = intdiv((int)$bits, 8); $rest = (int)$bits % 8;
        if (substr($bin, 0, $bytes) !== substr($nb, 0, $bytes)) continue;
        if ($rest === 0) return true;
        $mask = chr((0xFF << (8 - $rest)) & 0xFF);
        if ((ord($bin[$bytes]) & ord($mask)) === (ord($nb[$bytes]) & ord($mask))) return true;
    }
    return false;
}

function dx_ip_hash(): string {
    $c = dx_config();
    // Guardamos só o hash do IP (com sal), nunca o IP em si.
    return hash('sha256', ($c['salt'] ?? 'draxora') . '|' . dx_client_ip());
}

// Valor seguro para planilha: célula que começa com = + - @ vira texto
// (evita fórmula maliciosa ao abrir o CSV no Excel/Sheets).
function dx_csv_cell($v): string {
    $v = (string)($v ?? '');
    return ($v !== '' && strpbrk($v[0], "=+-@\t\r") !== false) ? "'" . $v : $v;
}

function dx_clean(?string $v, int $max): ?string {
    if ($v === null) return null;
    $v = trim(preg_replace('/[\x00-\x1F\x7F]/u', '', $v) ?? '');
    return $v === '' ? null : mb_substr($v, 0, $max);
}

// Listas aceitas. Adicione aqui a cada nova porta.
const DX_LISTAS = ['porta-01', 'mapa-dos-sintomas', 'amostra'];
