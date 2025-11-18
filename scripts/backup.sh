#!/bin/bash
# ============================================================================
# Database Backup Script
# ============================================================================
# This script creates compressed PostgreSQL backups and manages retention

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-crm_db}"
DB_USER="${DB_USER:-crm_user}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.dump"

echo "=============================================================================="
echo "Starting backup: $(date)"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "=============================================================================="

# Create backup using pg_dump with custom format (compressed)
pg_dump -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -Fc \
        -f "$BACKUP_FILE" \
        "$DB_NAME"

# Check if backup was successful
if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup completed successfully!"
    echo "File: $BACKUP_FILE"
    echo "Size: $BACKUP_SIZE"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Clean up old backups (keep only last N days)
echo ""
echo "Cleaning up old backups (retention: ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "backup_*.dump" -type f -mtime +${RETENTION_DAYS} -delete

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup_*.dump" -type f | wc -l)
echo "✅ Cleanup complete. Backups remaining: $BACKUP_COUNT"

echo ""
echo "=============================================================================="
echo "Backup completed: $(date)"
echo "=============================================================================="
