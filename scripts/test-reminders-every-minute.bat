@echo off
REM ---------------------------------------------------------------------------
REM  TEMPORARY — testing only. Delete the task when done:
REM
REM    Unregister-ScheduledTask -TaskName "manageyourcard-TEST-every-minute" -Confirm:$false
REM
REM  Fires a full reminder every minute — push, email and the in-app list — so
REM  delivery can be watched live. One minute is the floor: Windows Task
REM  Scheduler cannot repeat faster than that.
REM
REM  --force skips the once-a-day claim, which would otherwise make every run
REM  after the first report "already-sent" and send nothing.
REM
REM  --skip-email is not optional here, and must not be removed while this runs
REM  on a repeating schedule. A message a minute is 1,440 a day; Gmail allows
REM  roughly 500 and locks accounts that behave like a mailing list. The account
REM  it would lock is the one the app sends from, so the cost of that is the
REM  whole email channel, not just the test.
REM
REM  Email is verified separately with a single run:
REM
REM    node ace reminders:send --shop=SHP-00001 --force
REM ---------------------------------------------------------------------------

set "NODE_EXE=C:\nvm4w\nodejs\node.exe"
set "APP_DIR=D:\ManageYourCard\manageYourCardAPI"
set "LOG_DIR=%APP_DIR%\storage\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

cd /d "%APP_DIR%"

echo ===== TEST %DATE% %TIME% ===== >> "%LOG_DIR%\reminders-test.log"
"%NODE_EXE%" ace reminders:send --force --skip-email >> "%LOG_DIR%\reminders-test.log" 2>&1
