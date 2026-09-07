$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskExecutable = Join-Path $taskRoot 'src-tauri\target\release\baan-ran-pos.exe'
$taskPort = [System.Net.Sockets.TcpClient]::new()
try {
    $taskPort.Connect('127.0.0.1', 3001)
    throw 'Port 3001 is in use. Close the other POS instance before this test.'
} catch [System.Net.Sockets.SocketException] {
} finally { $taskPort.Dispose() }
$taskNative = Start-Process -FilePath $taskExecutable -WindowStyle Hidden -PassThru
try {
    $taskReady = $false
    for ($taskAttempt = 0; $taskAttempt -lt 40; $taskAttempt++) {
        if ($taskNative.HasExited) { throw "Desktop exited before ready: $($taskNative.ExitCode)" }
        try {
            $taskHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/health' -TimeoutSec 1
            if ($taskHealth.ok) { $taskReady = $true; break }
        } catch {}
        Start-Sleep -Milliseconds 250
    }
    if (-not $taskReady) { throw 'Desktop backend did not become ready. See the AppData server.log.' }
    $taskSession = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/session' -TimeoutSec 3
    Write-Output "PASS: native executable started its bundled backend. Health=$($taskHealth.ok), NeedsSetup=$($taskSession.needsSetup)"
} finally {
    if (-not $taskNative.HasExited) { Stop-Process -Id $taskNative.Id }
}
