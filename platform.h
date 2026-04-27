/**
 * platform.h — Platform abstraction for Brave History Access (C)
 *
 * Provides OS-specific paths, file operations, and utility functions.
 *
 * @version 1.0.0
 */

#ifndef PLATFORM_H
#define PLATFORM_H

#include <stddef.h>
#include <time.h>

/* ── Platform Detection ──────────────────────────────────────────── */

typedef enum {
    PLATFORM_WINDOWS,
    PLATFORM_MACOS,
    PLATFORM_LINUX,
    PLATFORM_UNKNOWN
} Platform;

/**
 * Detect the current operating system at compile time.
 */
Platform platform_detect(void);

/**
 * Return a human-readable name for the platform.
 */
const char *platform_name(Platform p);

/* ── Brave History Database Path ─────────────────────────────────── */

/**
 * Get the absolute path to Brave's History SQLite database.
 * Returns 0 on success, -1 if the path could not be determined or
 * the file does not exist.
 *
 * @param buf     Output buffer
 * @param bufsize Size of the output buffer
 */
int platform_get_brave_history_path(char *buf, size_t bufsize);

/* ── File Operations ─────────────────────────────────────────────── */

/**
 * Copy a file from src to dst. Overwrites dst if it exists.
 * Returns 0 on success, -1 on error.
 */
int platform_copy_file(const char *src, const char *dst);

/**
 * Get a path suitable for a temporary file copy of the history DB.
 * The file is NOT created — the caller should use this path to copy into.
 *
 * @param buf     Output buffer
 * @param bufsize Size of the output buffer
 */
int platform_get_temp_db_path(char *buf, size_t bufsize);

/**
 * Delete a file. Returns 0 on success.
 */
int platform_delete_file(const char *path);

/**
 * Check if a file exists. Returns 1 if yes, 0 if no.
 */
int platform_file_exists(const char *path);

/* ── Time Utilities ──────────────────────────────────────────────── */

/**
 * Write the current time as ISO 8601 (e.g. "2025-04-27T16:30:00Z")
 * into buf. Returns the number of characters written.
 */
int platform_timestamp_iso8601(char *buf, size_t bufsize);

/**
 * Convert a Chromium timestamp (microseconds since 1601-01-01 00:00:00 UTC)
 * to a Unix timestamp (seconds since 1970-01-01 00:00:00 UTC).
 */
time_t chromium_time_to_unix(long long chromium_us);

/**
 * Format a Chromium timestamp into an ISO 8601 string.
 */
int chromium_time_to_iso8601(long long chromium_us, char *buf, size_t bufsize);

#endif /* PLATFORM_H */
