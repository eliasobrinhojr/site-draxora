<?php
// Draxora — conexão com o banco e utilidades da API.
// As credenciais NÃO ficam no repositório (ele é público).
// Elas são lidas de um arquivo criado uma única vez no servidor, FORA da public_html:
//   domains/<seu-dominio>/draxora-config.php   (veja config.exemplo.txt)

declare(strict_types=1);

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
    $pdo = new PDO($c['db_dsn'], $c['db_user'] ?? null, $c['db_pass'] ?? null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    dx_migrate($pdo);
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

function dx_ip_hash(): string {
    $c = dx_config();
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
    // Guardamos só o hash do IP (com sal), nunca o IP em si.
    return hash('sha256', ($c['salt'] ?? 'draxora') . '|' . $ip);
}

function dx_clean(?string $v, int $max): ?string {
    if ($v === null) return null;
    $v = trim(preg_replace('/[\x00-\x1F\x7F]/u', '', $v) ?? '');
    return $v === '' ? null : mb_substr($v, 0, $max);
}

// Listas aceitas. Adicione aqui a cada nova porta.
const DX_LISTAS = ['porta-01', 'mapa-dos-sintomas'];
