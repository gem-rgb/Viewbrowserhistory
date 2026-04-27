/**
 * export_json.c — JSON export implementation
 *
 * Hand-written JSON serializer (no dependency). Produces a structured
 * JSON file matching the JS version's envelope format.
 *
 * @version 1.0.0
 */

#include "export_json.h"
#include "platform.h"

#include <stdio.h>
#include <string.h>

/* ── JSON String Escaping ────────────────────────────────────────── */

/**
 * Write a JSON-escaped string to the file.
 * Escapes: \ " \n \r \t and control characters.
 */
static void write_json_string(FILE *f, const char *s) {
    fputc('"', f);
    if (!s) {
        fputc('"', f);
        return;
    }
    for (; *s; s++) {
        switch (*s) {
            case '"':  fputs("\\\"", f); break;
            case '\\': fputs("\\\\", f); break;
            case '\n': fputs("\\n",  f); break;
            case '\r': fputs("\\r",  f); break;
            case '\t': fputs("\\t",  f); break;
            default:
                if ((unsigned char)*s < 0x20) {
                    fprintf(f, "\\u%04x", (unsigned char)*s);
                } else {
                    fputc(*s, f);
                }
                break;
        }
    }
    fputc('"', f);
}

/* ── Public API ──────────────────────────────────────────────────── */

int export_to_json(const HistoryResult *result, const HistoryStats *stats,
                   const char *filepath) {
    FILE *f = fopen(filepath, "w");
    if (!f) {
        fprintf(stderr, "[export_json] Cannot open %s for writing\n", filepath);
        return -1;
    }

    char ts[64];
    platform_timestamp_iso8601(ts, sizeof(ts));

    /* Root envelope */
    fprintf(f, "{\n");
    fprintf(f, "  \"success\": true,\n");
    fprintf(f, "  \"timestamp\": \"%s\",\n", ts);
    fprintf(f, "  \"error\": null,\n");

    /* Statistics */
    fprintf(f, "  \"stats\": {\n");
    fprintf(f, "    \"total_urls\": %d,\n", stats->total_urls);
    fprintf(f, "    \"total_visits\": %d,\n", stats->total_visits);
    fprintf(f, "    \"unique_domains\": %d,\n", stats->unique_domains);
    fprintf(f, "    \"earliest_visit\": \"%s\",\n", stats->earliest_visit);
    fprintf(f, "    \"latest_visit\": \"%s\",\n", stats->latest_visit);
    fprintf(f, "    \"most_visited_url\": ");
    write_json_string(f, stats->most_visited_url);
    fprintf(f, ",\n");
    fprintf(f, "    \"most_visited_title\": ");
    write_json_string(f, stats->most_visited_title);
    fprintf(f, ",\n");
    fprintf(f, "    \"most_visited_count\": %d\n", stats->most_visited_count);
    fprintf(f, "  },\n");

    /* Data array */
    fprintf(f, "  \"data\": [\n");

    for (int i = 0; i < result->count; i++) {
        const HistoryEntry *e = &result->entries[i];

        fprintf(f, "    {\n");
        fprintf(f, "      \"url\": ");
        write_json_string(f, e->url);
        fprintf(f, ",\n");

        fprintf(f, "      \"title\": ");
        write_json_string(f, e->title);
        fprintf(f, ",\n");

        fprintf(f, "      \"visit_count\": %d,\n", e->visit_count);
        fprintf(f, "      \"typed_count\": %d,\n", e->typed_count);
        fprintf(f, "      \"last_visit_time\": \"%s\"\n", e->last_visit_time);

        fprintf(f, "    }%s\n", (i < result->count - 1) ? "," : "");
    }

    fprintf(f, "  ]\n");
    fprintf(f, "}\n");

    fclose(f);
    printf("[export_json] Exported %d entries to %s\n", result->count, filepath);
    return 0;
}
