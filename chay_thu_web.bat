@echo off
chcp 65001 >nul
echo ========================================================
echo   LabMaster 2026-2027 - Sổ Thực Hành Phòng Máy Tính
echo ========================================================
echo Đang mở ứng dụng trên trình duyệt web mặc định...
start "" "%~dp0index.html"
echo.
echo [OK] Ứng dụng đã được mở trên trình duyệt!
echo Để triển khai lên Vercel, vui lòng xem hướng dẫn tại file HUONG_DAN_VERCEL.md
echo ========================================================
pause
