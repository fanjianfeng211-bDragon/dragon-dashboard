$port = 3000
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "龙神仪表盘 → http://localhost:$port" -ForegroundColor Green
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://+:$port/")
$listener.Start()
$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".css" = "text/css"
    ".js" = "application/javascript"
    ".json" = "application/json"
    ".svg" = "image/svg+xml"
    ".png" = "image/png"
    ".jpg" = "image/jpeg"
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.AbsolutePath
    if ($path -eq "/") { $path = "/dashboard.html" }
    $file = Join-Path $root ($path.TrimStart("/"))
    if (Test-Path $file -PathType Leaf) {
        $ext = [IO.Path]::GetExtension($file)
        $ctx.Response.ContentType = if ($mime[$ext]) { $mime[$ext] } else { "text/plain" }
        $bytes = [IO.File]::ReadAllBytes($file)
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
}
