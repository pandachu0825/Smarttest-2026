<?php
/**
 * IVS SmartTest AI - API Handler for PHP 8.x (XAMPP)
 * Xử lý gọi Gemini API với cơ chế Ma trận Multi-Key & Multi-Model
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// 1. Đọc cấu hình từ file .env (Giả lập hoặc đọc thực tế)
// Trong thực tế, bạn nên dùng thư viện vlucas/phpdotenv
// Ở đây tôi sẽ đọc trực tiếp từ file .env.local nếu tồn tại
$env = [];
if (file_exists('.env.local')) {
    $lines = file('.env.local', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        $env[trim($name)] = trim($value);
    }
}

$api_keys = explode(',', $env['API_KEYS'] ?? '');
$api_models = explode(',', $env['API_MODELS'] ?? 'gemini-3.1-pro-preview,gemini-3-flash-preview,gemini-2.5-flash-lite,gemini-1.5-flash');

$api_keys = array_map('trim', array_filter($api_keys));
$api_models = array_map('trim', array_filter($api_models));

// 2. Lấy dữ liệu từ Request
$input = json_decode(file_get_contents('php://input'), true);
$prompt = $input['prompt'] ?? '';
$systemInstruction = $input['systemInstruction'] ?? '';

if (empty($prompt)) {
    echo json_encode(['error' => 'Prompt is empty']);
    exit;
}

// 3. Hệ thống Log
$log_dir = __DIR__ . '/logs';
if (!is_dir($log_dir)) {
    mkdir($log_dir, 0777, true);
}

function log_msg($msg) {
    global $log_dir;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($log_dir . '/api.log', "[$timestamp] $msg\n", FILE_APPEND);
}

// 4. Logic Xoay vòng Key & Model
$last_error = "No keys/models available";

foreach ($api_models as $model) {
    foreach ($api_keys as $key) {
        log_msg("Attempting Model: $model with Key: " . substr($key, 0, 5) . "...");
        
        $url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$key";
        
        $payload = [
            'contents' => [
                ['parts' => [['text' => $prompt]]]
            ],
            'systemInstruction' => [
                'parts' => [['text' => $systemInstruction]]
            ],
            'generationConfig' => [
                'responseMimeType' => 'application/json'
            ]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            log_msg("CURL Error: $err");
            $last_error = $err;
            continue;
        }

        if ($http_code === 200) {
            $res_data = json_decode($response, true);
            if (isset($res_data['candidates'][0]['content']['parts'][0]['text'])) {
                log_msg("Success with Model: $model");
                echo json_encode(['text' => $res_data['candidates'][0]['content']['parts'][0]['text']]);
                exit;
            }
        } else {
            $res_data = json_decode($response, true);
            $msg = $res_data['error']['message'] ?? 'Unknown error';
            log_msg("HTTP Error $http_code: $msg");
            $last_error = "HTTP $http_code: $msg";
            
            // Nếu lỗi không phải do Quota hoặc Server, có thể cân nhắc dừng lại
            // Nhưng theo yêu cầu là triệt tiêu "ngõ cụt", nên cứ thử tiếp
        }
    }
}

http_response_code(500);
echo json_encode(['error' => 'All keys and models failed', 'details' => $last_error]);
