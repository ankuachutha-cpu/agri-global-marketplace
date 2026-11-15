<#
.SYNOPSIS
  Automated MongoDB backup script for AgriGlobal Marketplace (Windows).
.DESCRIPTION
  Performs mongodump with gzip compression and timestamps into logs/mongo-backup/.
  Automatically retains the last 14 backups.
#>

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $PSScriptRoot "..\logs\mongo-backup"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$archiveFile = Join-Path $backupDir "agri_marketplace_backup_$timestamp.gz"
$logFile = Join-Path $backupDir "backup_audit.log"

Write-Host "Starting AgriGlobal database backup to $archiveFile..."

# Execute mongodump
$mongoUri = if ($env:MONGODB_URI) { $env:MONGODB_URI } else { "mongodb://127.0.0.1:27017/agri_marketplace" }
$cmd = "mongodump --uri=`"$mongoUri`" --archive=`"$archiveFile`" --gzip"

try {
    Invoke-Expression $cmd
    $logMsg = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] SUCCESS: Backup created: $archiveFile"
    Write-Host $logMsg -ForegroundColor Green
    Add-Content -Path $logFile -Value $logMsg
} catch {
    $errMsg = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: Backup failed: $_"
    Write-Host $errMsg -ForegroundColor Red
    Add-Content -Path $logFile -Value $errMsg
    exit 1
}

# Retain last 14 backups
Get-ChildItem -Path $backupDir -Filter "agri_marketplace_backup_*.gz" |
    Sort-Object CreationTime -Descending |
    Select-Object -Skip 14 |
    Remove-Item -Force
