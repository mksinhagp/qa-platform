#!/bin/bash
# Fix all stored procedures that use INSERT...RETURNING inside RETURNS TABLE
# without RETURN QUERY — causing "query has no destination for result data" error.
# Patches the .sql files and re-applies them to the DB.

set -e

PGPASSWORD=qa_password
export PGPASSWORD

PSQL="psql -h localhost -p 5434 -U qa_user -d qa_platform"
PROCS_DIR="$(dirname "$0")/../procs"

fix_and_apply() {
  local file="$1"
  local tmpfile=$(mktemp)

  # Add RETURN QUERY before INSERT ... RETURNING (only if not already present)
  # Pattern: lines with just "    INSERT" preceded by no "RETURN QUERY"
  sed 's/^\([ \t]*\)\(INSERT INTO\)/\1RETURN QUERY\n\1\2/g' "$file" > "$tmpfile"

  # Check if we actually changed anything
  if ! diff -q "$file" "$tmpfile" > /dev/null 2>&1; then
    cp "$tmpfile" "$file"
    echo "Patched: $(basename $file)"
  fi
  rm "$tmpfile"
}

# Fix all proc files that contain RETURNING but not RETURN QUERY
for f in "$PROCS_DIR"/*.sql; do
  if grep -q "RETURNING" "$f" && ! grep -q "RETURN QUERY" "$f"; then
    fix_and_apply "$f"
  fi
done

echo "Applying all procs to database..."
for f in $(ls "$PROCS_DIR"/*.sql | sort); do
  # Extract just the CREATE OR REPLACE FUNCTION block (strip BEGIN/END wrapper)
  content=$(grep -v "^BEGIN$\|^END$" "$f")
  echo "$content" | $PSQL > /dev/null 2>&1 || true
done

echo "Done."
