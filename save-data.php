<?php
/**
 * save-data.php
 * API untuk menyimpan dan mengambil data catatan ke/dari data.json
 * 
 * Metode yang didukung:
 * - GET:  Mengambil semua data
 * - POST: Menyimpan data (body: { notes: [...] })
 * - PUT:  Update data (body: { notes: [...] } atau array langsung)
 * - DELETE: Menghapus semua data (reset)
 */

// Set header untuk JSON response
header('Content-Type: application/json');

// CORS headers untuk development (opsional)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight request (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Tentukan file data
$dataFile = __DIR__ . '/data.json';

// Fungsi untuk membaca data dari file
function readData($file) {
    if (file_exists($file)) {
        $content = file_get_contents($file);
        $data = json_decode($content, true);
        return is_array($data) ? $data : [];
    }
    return [];
}

// Fungsi untuk menulis data ke file
function writeData($file, $data) {
    // Pastikan direktori ada dan bisa ditulis
    $dir = dirname($file);
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    
    // Tulis data dengan format JSON yang rapi
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($file, $json, LOCK_EX);
}

// Fungsi untuk logging error
function logError($message) {
    error_log("[save-data.php] " . $message);
}

// Handle request berdasarkan metode
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // GET: Ambil semua data
        $data = readData($dataFile);
        echo json_encode($data);
        exit;
    }

    if ($method === 'POST') {
        // POST: Simpan data
        $input = json_decode(file_get_contents('php://input'), true);
        
        if ($input === null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid JSON data']);
            exit;
        }
        
        // Validasi data
        if (!isset($input['notes']) || !is_array($input['notes'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing or invalid "notes" field']);
            exit;
        }
        
        // Simpan data
        $success = writeData($dataFile, $input['notes']);
        
        if ($success !== false) {
            echo json_encode([
                'success' => true, 
                'message' => 'Data saved successfully',
                'count' => count($input['notes'])
            ]);
        } else {
            logError("Failed to write data file: $dataFile");
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to write data file']);
        }
        exit;
    }

    if ($method === 'PUT') {
        // PUT: Update atau replace seluruh data
        $input = json_decode(file_get_contents('php://input'), true);
        
        if ($input === null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid JSON data']);
            exit;
        }
        
        // Jika data adalah array langsung, gunakan sebagai notes
        if (is_array($input) && !isset($input['notes'])) {
            $notes = $input;
        } else if (isset($input['notes'])) {
            $notes = $input['notes'];
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid data format']);
            exit;
        }
        
        // Validasi data
        if (!is_array($notes)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Data must be an array']);
            exit;
        }
        
        $success = writeData($dataFile, $notes);
        
        if ($success !== false) {
            echo json_encode([
                'success' => true, 
                'message' => 'Data updated successfully',
                'count' => count($notes)
            ]);
        } else {
            logError("Failed to update data file: $dataFile");
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to write data file']);
        }
        exit;
    }

    if ($method === 'DELETE') {
        // DELETE: Hapus semua data (reset)
        $success = writeData($dataFile, []);
        
        if ($success !== false) {
            echo json_encode(['success' => true, 'message' => 'All data cleared']);
        } else {
            logError("Failed to clear data file: $dataFile");
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to clear data']);
        }
        exit;
    }

    // Method tidak didukung
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    
} catch (Exception $e) {
    logError("Exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Internal server error: ' . $e->getMessage()
    ]);
}
?>