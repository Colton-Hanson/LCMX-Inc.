@echo off
cd /d "%~dp0"

if not exist "..\backend\.env" goto nobackend
if exist ".venv\Scripts\python.exe" goto havevenv

echo Setting up the reader's Python environment. This takes a minute.
py -3.12 -m venv .venv
if errorlevel 1 goto nopython
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto installfailed

:havevenv
if exist ".env" goto run
echo.
set /p KEY=Paste the API key you were given, then press Enter: 
if "%KEY%"=="" goto nokey
> ".env" echo RECEIPT_READER_API_KEY=%KEY%
>> ".env" echo RECEIPT_READER_MODEL=claude-haiku-5-5
>> ".env" echo RECEIPT_READER_EFFORT=medium
>> ".env" echo RECEIPT_READER_THINKING=disabled
cls

:run
echo The reader is running. Keep this window open. Close it to stop.
".venv\Scripts\python.exe" worker.py
echo.
echo The reader stopped. Scroll up to see why.
pause
exit /b 0

:nobackend
echo Cannot find ..\backend\.env. Set up the backend first, then run this again.
pause
exit /b 1

:nopython
echo Python 3.12 was not found. Install it, then run this again.
pause
exit /b 1

:installfailed
echo The install failed. Check your internet connection, then run this again.
pause
exit /b 1

:nokey
echo No key entered. Run this again when you have it.
pause
exit /b 1
