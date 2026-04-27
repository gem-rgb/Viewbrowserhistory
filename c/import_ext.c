/**
 * import_ext.c — Import extension-exported JSON data
 *
 * A lightweight JSON parser specifically for the extension's export format.
 * Reads the file into memory and extracts history entries.
 *
 * @version 1.0.0
 */

#include "import_ext.h"
#include "platform.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

/* ── Minimal JSON String Extractor ───────────────────────────────── */

/**
 * Find the value of a JSON string field.
 * Looks for "key": "value" and copies the value into dst.
 * Returns pointer past the closing quote, or NULL if not found.
 */
static const char *extract_json_string(const char *json, const char *key,
                                        char *dst, size_t dstsize) {
    char search[256];
    snprintf(search, sizeof(search), "\"%s\"", key);

    const char *pos = strstr(json, search);
    if (!pos) { dst[0] = '\0'; return NULL; }

    /* Skip past "key" : " */
    pos += strlen(search);
    while (*pos && (*pos == ' ' || *pos == ':' || *pos == '\t' || *pos == '\n' || *pos == '\r')) pos++;

    if (*pos != '"') { dst[0] = '\0'; return pos; }
    pos++;  /* skip opening quote */

    size_t i = 0;
    while (*pos && *pos != '"' && i < dstsize - 1) {
        if (*pos == '\\' && *(pos + 1)) {
            pos++;  /* skip backslash */
            switch (*pos) {
                case 'n':  dst[i++] = '\n'; break;
                case 't':  dst[i++] = '\t'; break;
                case '"':  dst[i++] = '"';  break;
                case '\\': dst[i++] = '\\'; break;
                default:   dst[i++] = *pos; break;
            }
        } else {
            dst[i++] = *pos;
        }
        pos++;
    }
    dst[i] = '\0';

    if (*pos == '"') pos++;
    return pos;
}

/**
 * Extract a JSON boolean field value.
 */
static int extract_json_bool(const char *json, const char *key) {
    char search[256];
    snprintf(search, sizeof(search), "\"%s\"", key);
    const char *pos = strstr(json, search);
    if (!pos) return 0;
    pos += strlen(search);
    while (*pos && (*pos == ' ' || *pos == ':' || *pos == '\t')) pos++;
    return (strncmp(pos, "true", 4) == 0) ? 1 : 0;
}

/* ── Public API ──────────────────────────────────────────────────── */

int import_extension_json(const char *filepath, HistoryResult *result) {
    /* Read entire file into memory */
    FILE *f = fopen(filepath, "rb");
    if (!f) {
        fprintf(stderr, "[import_ext] Cannot open %s\n", filepath);
        return -1;
    }

    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);

    if (fsize <= 0 || fsize > 100 * 1024 * 1024) {  /* 100 MB limit */
        fprintf(stderr, "[import_ext] File too large or empty: %ld bytes\n", fsize);
        fclose(f);
        return -1;
    }

    char *json = malloc((size_t)fsize + 1);
    if (!json) {
        fprintf(stderr, "[import_ext] Out of memory\n");
        fclose(f);
        return -1;
    }

    size_t read = fread(json, 1, (size_t)fsize, f);
    fclose(f);
    json[read] = '\0';

    /* Verify this is from our extension */
    if (!strstr(json, "incognito-history-tracker-extension") &&
        !strstr(json, "\"data\"")) {
        fprintf(stderr, "[import_ext] File does not appear to be an extension export\n");
        free(json);
        return -1;
    }

    /* Find the "data" array */
    const char *data_start = strstr(json, "\"data\"");
    if (!data_start) {
        fprintf(stderr, "[import_ext] No 'data' array found\n");
        free(json);
        return -1;
    }

    /* Skip to the opening bracket */
    const char *p = data_start + 6;
    while (*p && *p != '[') p++;
    if (*p != '[') {
        free(json);
        return -1;
    }
    p++;  /* skip '[' */

    /* Parse each entry object */
    int imported = 0;
    int initial_count = result->count;

    while (*p) {
        /* Find next object */
        while (*p && *p != '{') {
            if (*p == ']') goto done;  /* end of array */
            p++;
        }
        if (*p != '{') break;

        /* Find the end of this object */
        const char *obj_start = p;
        int depth = 1;
        p++;
        while (*p && depth > 0) {
            if (*p == '{') depth++;
            else if (*p == '}') depth--;
            p++;
        }

        /* Extract a single object's content */
        size_t obj_len = (size_t)(p - obj_start);
        char *obj = malloc(obj_len + 1);
        if (!obj) break;
        memcpy(obj, obj_start, obj_len);
        obj[obj_len] = '\0';

        /* Grow result if needed */
        if (result->count >= result->capacity) {
            int new_cap = result->capacity * 2;
            if (new_cap < 256) new_cap = 256;
            HistoryEntry *tmp = realloc(result->entries,
                                         (size_t)new_cap * sizeof(HistoryEntry));
            if (!tmp) { free(obj); break; }
            result->entries = tmp;
            result->capacity = new_cap;
        }

        HistoryEntry *e = &result->entries[result->count];
        memset(e, 0, sizeof(*e));

        extract_json_string(obj, "url",             e->url,             sizeof(e->url));
        extract_json_string(obj, "title",           e->title,           sizeof(e->title));
        extract_json_string(obj, "last_visit_time", e->last_visit_time, sizeof(e->last_visit_time));

        /* If last_visit_time is empty, try "timestamp" */
        if (!e->last_visit_time[0]) {
            extract_json_string(obj, "timestamp", e->last_visit_time, sizeof(e->last_visit_time));
        }

        e->visit_count = 1;  /* extension tracks individual visits */
        e->typed_count = 0;
        e->last_visit_raw = 0;

        /* Mark incognito entries in the title for PDF display */
        int is_incognito = extract_json_bool(obj, "incognito");
        if (is_incognito && e->title[0]) {
            char tmp[512];
            snprintf(tmp, sizeof(tmp), "[INCOGNITO] %s", e->title);
            strncpy(e->title, tmp, sizeof(e->title) - 1);
            e->title[sizeof(e->title) - 1] = '\0';
        }

        if (e->url[0]) {  /* only add if we got a URL */
            result->count++;
            imported++;
        }

        free(obj);
    }

done:
    free(json);
    printf("[import_ext] Imported %d entries from extension export\n", imported);
    return 0;
}

int history_result_merge(HistoryResult *dst, const HistoryResult *src) {
    for (int i = 0; i < src->count; i++) {
        if (dst->count >= dst->capacity) {
            int new_cap = dst->capacity * 2;
            if (new_cap < 256) new_cap = 256;
            HistoryEntry *tmp = realloc(dst->entries,
                                         (size_t)new_cap * sizeof(HistoryEntry));
            if (!tmp) return -1;
            dst->entries = tmp;
            dst->capacity = new_cap;
        }
        dst->entries[dst->count++] = src->entries[i];
    }
    return 0;
}
