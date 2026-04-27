@echo off
REM ────────────────────────────────────────────────────────
REM  build.bat — Build Brave History Access (C Edition)
REM  
REM  Works with either MinGW (gcc) or MSVC (cl).
REM  Tries gcc first, falls back to cl.
REM ────────────────────────────────────────────────────────

echo.
echo  ============================================
echo   Building Brave History Access - C Edition
echo  ============================================
echo.

REM Try GCC first
where gcc >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo  Compiler: GCC ^(MinGW^)
    echo  Compiling...
    gcc -O2 -Wall -Wextra -Wno-unused-parameter -std=c11 ^
        -o brave-history.exe ^
        brave_history.c ^
        history_db.c ^
        export_json.c ^
        export_pdf.c ^
        import_ext.c ^
        platform.c ^
        vendor\sqlite3.c ^
        -lshell32 -lole32
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo  SUCCESS: brave-history.exe built successfully!
        echo.
        echo  Usage:
        echo    brave-history.exe --help
        echo    brave-history.exe --json history.json
        echo    brave-history.exe --pdf report.pdf --days 30
        echo.
    ) else (
        echo  ERROR: Compilation failed.
    )
    goto :end
)

REM Try MSVC
where cl >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo  Compiler: MSVC ^(cl.exe^)
    echo  Compiling...
    cl /O2 /W3 /Fe:brave-history.exe ^
        brave_history.c ^
        history_db.c ^
        export_json.c ^
        export_pdf.c ^
        import_ext.c ^
        platform.c ^
        vendor\sqlite3.c ^
        shell32.lib ole32.lib
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo  SUCCESS: brave-history.exe built successfully!
        echo.
    ) else (
        echo  ERROR: Compilation failed.
    )
    goto :end
)

echo  ERROR: No C compiler found!
echo  Please install one of:
echo    - MinGW-w64: https://www.mingw-w64.org/
echo    - Visual Studio Build Tools: https://visualstudio.microsoft.com/
echo.

:end
