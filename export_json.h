/**
 * export_json.h — JSON export for history data
 *
 * @version 1.0.0
 */

#ifndef EXPORT_JSON_H
#define EXPORT_JSON_H

#include "history_db.h"

/**
 * Export history results to a JSON file.
 * Matches the {success, data, error, timestamp} envelope from the JS version.
 *
 * @param result   The history query results
 * @param stats    Computed statistics
 * @param filepath Output file path
 * @return 0 on success, -1 on error
 */
int export_to_json(const HistoryResult *result, const HistoryStats *stats,
                   const char *filepath);

#endif /* EXPORT_JSON_H */
