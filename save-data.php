<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dataFile = __DIR__ . '/data.json';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Save data ke data.json
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['data'])) {
        // Simpan data baru (tanpa backup)
        $result = file_put_contents($dataFile, json_encode($input['data'], JSON_PRETTY_PRINT));
        
        if ($result !== false) {
            echo json_encode(['success' => true, 'message' => 'Data saved successfully', 'count' => count($input['data'])]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to save data - check file permissions']);
        }
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid request - no data field']);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Load data dari data.json
    if (file_exists($dataFile)) {
        $data = json_decode(file_get_contents($dataFile), true);
        if ($data !== null) {
            echo json_encode($data);
        } else {
            echo json_encode([]);
        }
    } else {
        // File belum ada, return empty array
        echo json_encode([]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>