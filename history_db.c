/**
 * history_db.c — SQLite query layer implementation
 *
 * Queries Brave's History SQLite database for URL entries and visit data.
 * Chromium stores timestamps as microseconds since 1601-01-01 00:00:00 UTC.
 *
 * @version 1.0.0
 */

#include "history_db.h"
#include "platform.h"
#include "vendor/sqlite3.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define INITIAL_CAPACITY 256

/* ── Helpers ─────────────────────────────────────────────────────── */

static void safe_copy(char *dst, const char *src, size_t dstsize) {
    if (src) {
        strncpy(dst, src, dstsize - 1);
        dst[dstsize - 1] = '\0';
    } else {
        dst[0] = '\0';
    }
}

static int result_grow(HistoryResult *r) {
    int new_cap = r->capacity * 2;
    if (new_cap < INITIAL_CAPACITY) new_cap = INITIAL_CAPACITY;

    HistoryEntry *tmp = realloc(r->entries, (size_t)new_cap * sizeof(HistoryEntry));
    if (!tmp) return -1;

    r->entries  = tmp;
    r->capacity = new_cap;
    return 0;
}

/* ── Public API ──────────────────────────────────────────────────── */

void history_result_init(HistoryResult *result) {
    result->entries  = NULL;
    result->count    = 0;
    result->capacity = 0;
}

void history_result_free(HistoryResult *result) {
    free(result->entries);
    result->entries  = NULL;
    result->count    = 0;
    result->capacity = 0;
}

int history_db_query(const char *db_path, int days_back, HistoryResult *result) {
    sqlite3 *db = NULL;
    sqlite3_stmt *stmt = NULL;
    int rc;

    history_result_init(result);

    rc = sqlite3_open_v2(db_path, &db, SQLITE_OPEN_READONLY, NULL);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[history_db] Cannot open database: %s\n", sqlite3_errmsg(db));
        sqlite3_close(db);
        return -1;
    }

    /*
     * Brave/Chromium History schema (key tables):
     *
     *   urls:
     *     id              INTEGER PRIMARY KEY
     *     url             LONGVARCHAR
     *     title           LONGVARCHAR
     *     visit_count     INTEGER DEFAULT 0
     *     typed_count     INTEGER DEFAULT 0
     *     last_visit_time INTEGER NOT NULL
     *     hidden          INTEGER DEFAULT 0
     *
     * We query urls directly — it has aggregated visit_count and last_visit_time.
     */

    const char *sql;
    if (days_back > 0) {
        /*
         * Filter by last_visit_time.
         * Chromium epoch offset: 11644473600 seconds from Unix epoch.
         * We compute the cutoff in Chromium microseconds.
         */
        sql =
            "SELECT url, title, visit_count, typed_count, last_visit_time "
            "FROM urls "
            "WHERE last_visit_time > ?1 "
            "ORDER BY last_visit_time DESC";
    } else {
        sql =
            "SELECT url, title, visit_count, typed_count, last_visit_time "
            "FROM urls "
            "ORDER BY last_visit_time DESC";
    }

    rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[history_db] SQL prepare failed: %s\n", sqlite3_errmsg(db));
        sqlite3_close(db);
        return -1;
    }

    if (days_back > 0) {
        /* Calculate cutoff in Chromium microseconds */
        time_t now = time(NULL);
        long long cutoff_unix = (long long)now - (long long)days_back * 86400LL;
        long long cutoff_chromium = (cutoff_unix + 11644473600LL) * 1000000LL;
        sqlite3_bind_int64(stmt, 1, cutoff_chromium);
    }

    /* Execute and collect rows */
    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
        if (result->count >= result->capacity) {
            if (result_grow(result) != 0) {
                fprintf(stderr, "[history_db] Out of memory\n");
                break;
            }
        }

        HistoryEntry *e = &result->entries[result->count];
        memset(e, 0, sizeof(*e));

        safe_copy(e->url,   (const char *)sqlite3_column_text(stmt, 0), sizeof(e->url));
        safe_copy(e->title, (const char *)sqlite3_column_text(stmt, 1), sizeof(e->title));
        e->visit_count   = sqlite3_column_int(stmt, 2);
        e->typed_count   = sqlite3_column_int(stmt, 3);
        e->last_visit_raw = sqlite3_column_int64(stmt, 4);

        chromium_time_to_iso8601(e->last_visit_raw, e->last_visit_time, sizeof(e->last_visit_time));

        result->count++;
    }

    if (rc != SQLITE_DONE && rc != SQLITE_ROW) {
        fprintf(stderr, "[history_db] Query error: %s\n", sqlite3_errmsg(db));
    }

    sqlite3_finalize(stmt);
    sqlite3_close(db);

    printf("[history_db] Retrieved %d history entries\n", result->count);
    return 0;
}

void history_compute_stats(const HistoryResult *result, HistoryStats *stats) {
    memset(stats, 0, sizeof(*stats));

    if (result->count == 0) return;

    stats->total_urls = result->count;

    long long earliest = result->entries[0].last_visit_raw;
    long long latest   = result->entries[0].last_visit_raw;
    int max_visits = 0;
    int max_idx = 0;

    /*
     * Simple unique domain count using a hash-like approach.
     * For production code you'd want a proper hash set, but for a tool
     * that typically processes < 50K entries, a simple O(n^2) check on
     * extracted domains is fine. We'll use a simpler heuristic:
     * count unique "://host/" prefixes.
     */
    /* We'll just count total visits and find extremes for now */
    for (int i = 0; i < result->count; i++) {
        const HistoryEntry *e = &result->entries[i];
        stats->total_visits += e->visit_count;

        if (e->last_visit_raw < earliest) earliest = e->last_visit_raw;
        if (e->last_visit_raw > latest)   latest   = e->last_visit_raw;

        if (e->visit_count > max_visits) {
            max_visits = e->visit_count;
            max_idx = i;
        }
    }

    chromium_time_to_iso8601(earliest, stats->earliest_visit, sizeof(stats->earliest_visit));
    chromium_time_to_iso8601(latest,   stats->latest_visit,   sizeof(stats->latest_visit));

    safe_copy(stats->most_visited_url,   result->entries[max_idx].url,   sizeof(stats->most_visited_url));
    safe_copy(stats->most_visited_title, result->entries[max_idx].title, sizeof(stats->most_visited_title));
    stats->most_visited_count = max_visits;

    /* Simple unique domain counter */
    int unique = 0;
    char **domains = calloc((size_t)result->count, sizeof(char *));
    if (domains) {
        for (int i = 0; i < result->count; i++) {
            /* Extract domain: skip past "://" then take until next '/' */
            const char *url = result->entries[i].url;
            const char *proto = strstr(url, "://");
            if (!proto) continue;
            const char *host_start = proto + 3;
            const char *host_end = strchr(host_start, '/');
            size_t host_len = host_end ? (size_t)(host_end - host_start) : strlen(host_start);

            /* Check if we've seen this domain */
            int found = 0;
            for (int j = 0; j < unique; j++) {
                if (strlen(domains[j]) == host_len && strncmp(domains[j], host_start, host_len) == 0) {
                    found = 1;
                    break;
                }
            }
            if (!found) {
                domains[unique] = malloc(host_len + 1);
                if (domains[unique]) {
                    memcpy(domains[unique], host_start, host_len);
                    domains[unique][host_len] = '\0';
                    unique++;
                }
            }
        }

        /* Cleanup */
        for (int i = 0; i < unique; i++) free(domains[i]);
        free(domains);
    }
    stats->unique_domains = unique;
}
