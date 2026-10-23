@echo off
REM ---------------------------------------------------------------------------
REM  Runs the reminder sweep. Called by Windows Task Scheduler.
REM
REM  Two scheduled tasks use this one file:
REM
REM    manageyourcard-reminders-daily     09:00  (no argument)
REM    manageyourcard-reminders-duetoday  17:30  --due-today
REM
REM  Whatever is passed to this script is handed straight to the ace command,
REM  which is what lets one wrapper serve both.
REM
REM  node.exe is given by its full path on purpose. A scheduled task does not
REM  inherit the interactive shell's PATH, and with nvm-for-windows in play a
REM  bare "node" resolves to nothing at all when the task runs — the task then
REM  reports success having done nothing, which is the worst possible failure.
REM
REM  Requires MongoDB (27017) and Redis (6379) to be running. On this machine
REM  they are local services; if either is down the run logs an error and
REM  sends nothing.
REM ---------------------------------------------------------------------------

set "NODE_EXE=C:\nvm4w\nodejs\node.exe"
set "APP_DIR=D:\ManageYourCard\manageYourCardAPI"
set "LOG_DIR=%APP_DIR%\storage\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

cd /d "%APP_DIR%"

REM Appended, not overwritten: a week of runs in one file is what makes
REM "did last Tuesday's reminder go out?" answerable.
echo. >> "%LOG_DIR%\reminders.log"
echo ===== %DATE% %TIME% ===== args: %* >> "%LOG_DIR%\reminders.log"

"%NODE_EXE%" ace reminders:send %* >> "%LOG_DIR%\reminders.log" 2>&1

echo exit code: %ERRORLEVEL% >> "%LOG_DIR%\reminders.log"
