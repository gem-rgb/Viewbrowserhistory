/**
 * platform.c — Platform abstraction implementation
 *
 * @version 1.0.0
 */

#include "platform.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <sys/stat.h>

#ifdef _WIN32
    #include <windows.h>
    #include <shlobj.h>      /* SHGetFolderPathA */
    #include <direct.h>
#else
    #include <unistd.h>
    #include <pwd.h>
    #include <errno.h>
#endif

/* ── Platform Detection ──────────────────────────────────────────── */

Platform platform_detect(void) {
#if defined(_WIN32)
    return PLATFORM_WINDOWS;
#elif defined(__APPLE__)
    return PLATFORM_MACOS;
#elif defined(__linux__)
    return PLATFORM_LINUX;
#else
    return PLATFORM_UNKNOWN;
#endif
}

const char *platform_name(Platform p) {
    switch (p) {
        case PLATFORM_WINDOWS: return "Windows";
        case PLATFORM_MACOS:   return "macOS";
        case PLATFORM_LINUX:   return "Linux";
        default:               return "Unknown";
    }
}

/* ── Brave History Database Path ─────────────────────────────────── */

int platform_get_brave_history_path(char *buf, size_t bufsize) {
#if defined(_WIN32)
    /* %LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data\Default\History */
    char local_app[MAX_PATH];
    if (SHGetFolderPathA(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, local_app) != S_OK) {
        return -1;
    }
    snprintf(buf, bufsize, "%s\\BraveSoftware\\Brave-Browser\\User Data\\Default\\History",
             local_app);

#elif defined(__APPLE__)
    /* ~/Library/Application Support/BraveSoftware/Brave-Browser/Default/History */
    const char *home = getenv("HOME");
    if (!home) {
        struct passwd *pw = getpwuid(getuid());
        if (!pw) return -1;
        home = pw->pw_dir;
    }
    snprintf(buf, bufsize,
             "%s/Library/Application Support/BraveSoftware/Brave-Browser/Default/History",
             home);

#elif defined(__linux__)
    /* ~/.config/BraveSoftware/Brave-Browser/Default/History */
    const char *home = getenv("HOME");
    if (!home) {
        struct passwd *pw = getpwuid(getuid());
        if (!pw) return -1;
        home = pw->pw_dir;
    }
    snprintf(buf, bufsize,
             "%s/.config/BraveSoftware/Brave-Browser/Default/History",
             home);
#else
    return -1;
#endif

    /* Verify the file actually exists */
    if (!platform_file_exists(buf)) {
        return -1;
    }
    return 0;
}

/* ── File Operations ─────────────────────────────────────────────── */

int platform_copy_file(const char *src, const char *dst) {
#ifdef _WIN32
    /* CopyFileA returns nonzero on success */
    if (CopyFileA(src, dst, FALSE)) {
        return 0;
    }
    return -1;
#else
    FILE *fin = fopen(src, "rb");
    if (!fin) return -1;

    FILE *fout = fopen(dst, "wb");
    if (!fout) {
        fclose(fin);
        return -1;
    }

    char buffer[8192];
    size_t n;
    while ((n = fread(buffer, 1, sizeof(buffer), fin)) > 0) {
        if (fwrite(buffer, 1, n, fout) != n) {
            fclose(fin);
            fclose(fout);
            return -1;
        }
    }

    fclose(fin);
    fclose(fout);
    return 0;
#endif
}

int platform_get_temp_db_path(char *buf, size_t bufsize) {
#ifdef _WIN32
    char tmp[MAX_PATH];
    DWORD len = GetTempPathA(MAX_PATH, tmp);
    if (len == 0 || len > MAX_PATH) return -1;
    snprintf(buf, bufsize, "%sbrave_history_copy.db", tmp);
#else
    const char *tmp = getenv("TMPDIR");
    if (!tmp) tmp = "/tmp";
    snprintf(buf, bufsize, "%s/brave_history_copy.db", tmp);
#endif
    return 0;
}

int platform_delete_file(const char *path) {
#ifdef _WIN32
    return DeleteFileA(path) ? 0 : -1;
#else
    return unlink(path);
#endif
}

int platform_file_exists(const char *path) {
#ifdef _WIN32
    DWORD attr = GetFileAttributesA(path);
    return (attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY));
#else
    struct stat st;
    return (stat(path, &st) == 0 && S_ISREG(st.st_mode));
#endif
}

/* ── Time Utilities ──────────────────────────────────────────────── */

int platform_timestamp_iso8601(char *buf, size_t bufsize) {
    time_t now = time(NULL);
    struct tm *t = gmtime(&now);
    return (int)strftime(buf, bufsize, "%Y-%m-%dT%H:%M:%SZ", t);
}

/**
 * Chromium epoch: 1601-01-01 00:00:00 UTC
 * Unix epoch:     1970-01-01 00:00:00 UTC
 * Difference:     11644473600 seconds
 * Chromium stores microseconds; divide by 1,000,000 for seconds.
 */
time_t chromium_time_to_unix(long long chromium_us) {
    return (time_t)(chromium_us / 1000000LL - 11644473600LL);
}

int chromium_time_to_iso8601(long long chromium_us, char *buf, size_t bufsize) {
    if (chromium_us == 0) {
        snprintf(buf, bufsize, "(never)");
        return 0;
    }
    time_t t = chromium_time_to_unix(chromium_us);
    struct tm *tm = gmtime(&t);
    if (!tm) {
        snprintf(buf, bufsize, "(invalid)");
        return 0;
    }
    return (int)strftime(buf, bufsize, "%Y-%m-%dT%H:%M:%SZ", tm);
}
