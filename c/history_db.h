/**
 * history_db.h — SQLite query layer for Brave's History database
 *
 * @version 1.0.0
 */

#ifndef HISTORY_DB_H
#define HISTORY_DB_H

#include <stddef.h>
#include <time.h>

/* ── Data Structures ─────────────────────────────────────────────── */

/** A single history entry from Brave's database */
typedef struct {
    char    url[2048];
    char    title[512];
    int     visit_count;
    int     typed_count;
    char    last_visit_time[64];    /* ISO 8601 formatted */
    long long last_visit_raw;       /* Chromium microsecond timestamp */
} HistoryEntry;

/** Result set from a query */
typedef struct {
    HistoryEntry *entries;
    int           count;
    int           capacity;
} HistoryResult;

/** Summary statistics */
typedef struct {
    int    total_urls;
    int    total_visits;
    int    unique_domains;
    char   earliest_visit[64];
    char   latest_visit[64];
    char   most_visited_url[2048];
    char   most_visited_title[512];
    int    most_visited_count;
} HistoryStats;

/* ── API ─────────────────────────────────────────────────────────── */

/**
 * Open the History database at the given path and query entries.
 *
 * @param db_path    Path to the (copied) History SQLite database
 * @param days_back  Number of days of history to retrieve (0 = all)
 * @param result     Output: populated result set (caller must free with history_result_free)
 * @return 0 on success, -1 on error
 */
int history_db_query(const char *db_path, int days_back, HistoryResult *result);

/**
 * Compute summary statistics from a result set.
 */
void history_compute_stats(const HistoryResult *result, HistoryStats *stats);

/**
 * Free memory allocated inside a HistoryResult.
 */
void history_result_free(HistoryResult *result);

/**
 * Initialize an empty result set.
 */
void history_result_init(HistoryResult *result);

#endif /* HISTORY_DB_H */
