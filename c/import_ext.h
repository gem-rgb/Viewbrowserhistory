/**
 * import_ext.h — Import extension-exported JSON data
 *
 * Reads JSON files exported by the Incognito History Tracker extension
 * and merges them with native history data.
 *
 * @version 1.0.0
 */

#ifndef IMPORT_EXT_H
#define IMPORT_EXT_H

#include "history_db.h"

/**
 * Import history entries from an extension-exported JSON file.
 * The JSON must follow the extension's export format:
 *   { "source": "incognito-history-tracker-extension", "data": [...] }
 *
 * @param filepath  Path to the JSON file
 * @param result    Output: populated result set (appended, not overwritten)
 * @return 0 on success, -1 on error
 */
int import_extension_json(const char *filepath, HistoryResult *result);

/**
 * Merge two HistoryResult sets. Entries from `src` are appended to `dst`.
 * Duplicate URLs are kept (they may have different timestamps).
 */
int history_result_merge(HistoryResult *dst, const HistoryResult *src);

#endif /* IMPORT_EXT_H */
