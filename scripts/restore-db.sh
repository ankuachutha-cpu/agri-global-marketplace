#!/usr/bin/env bash
# ==============================================================================
# Restores AgriGlobal MongoDB from an archive file (Linux / Docker)
# ==============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <path-to-archive.gz>"
    exit 1
fi

ARCHIVE_FILE="$1"
if [ ! -f "${ARCHIVE_FILE}" ]; then
    echo "Error: Archive file '${ARCHIVE_FILE}' not found." >&2
    exit 1
fi

MONGO_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/agri_marketplace}"

echo "Restoring database from ${ARCHIVE_FILE} to ${MONGO_URI} (with --drop)..."
mongorestore --uri="${MONGO_URI}" --archive="${ARCHIVE_FILE}" --gzip --drop
echo "Database restore completed successfully!"
