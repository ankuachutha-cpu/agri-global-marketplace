<#
.SYNOPSIS
  Restores AgriGlobal MongoDB from an archive file.
.PARAMETER ArchiveFile
  Path to the .gz mongodump archive file to restore.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ArchiveFile
)

if (-not (Test-Path $ArchiveFile)) {
    Write-Host "Error: Archive file '$ArchiveFile' does not exist." -ForegroundColor Red
    exit 1
}

$mongoUri = if ($env:MONGODB_URI) { $env:MONGODB_URI } else { "mongodb://127.0.0.1:27017/agri_marketplace" }

Write-Host "Restoring AgriGlobal database from $ArchiveFile to $mongoUri..."
$cmd = "mongorestore --uri=`"$mongoUri`" --archive=`"$ArchiveFile`" --gzip --drop"

try {
    Invoke-Expression $cmd
    Write-Host "Database restore completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "Database restore failed: $_" -ForegroundColor Red
    exit 1
}
