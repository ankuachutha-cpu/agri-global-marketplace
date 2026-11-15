#!/usr/bin/env bash
# ==============================================================================
# Automated MongoDB Backup Script for AgriGlobal Marketplace (Linux / Docker)
# ==============================================================================
set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../logs/mongo-backup"
mkdir -p "${BACKUP_DIR}"

ARCHIVE_FILE="${BACKUP_DIR}/agri_marketplace_backup_${TIMESTAMP}.gz"
LOG_FILE="${BACKUP_DIR}/backup_audit.log"
MONGO_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/agri_marketplace}"

echo "Starting AgriGlobal database backup to ${ARCHIVE_FILE}..."

if mongodump --uri="${MONGO_URI}" --archive="${ARCHIVE_FILE}" --gzip; then
    LOG_MSG="[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: Backup created: ${ARCHIVE_FILE}"
    echo "${LOG_MSG}"
    echo "${LOG_MSG}" >> "${LOG_FILE}"
else
    LOG_MSG="[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup failed!"
    echo "${LOG_MSG}" >&2
    echo "${LOG_MSG}" >> "${LOG_FILE}"
    exit 1
fi

# Retention: retain the 14 most recent backup files and prune older
find "${BACKUP_DIR}" -name "agri_marketplace_backup_*.gz" -type f | sort -r | tail -n +15 | xargs -r rm -f
echo "Pruning complete. 14 latest backups retained."
