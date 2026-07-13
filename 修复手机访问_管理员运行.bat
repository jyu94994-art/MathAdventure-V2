@echo off
chcp 65001 >nul
echo 正在修复手机访问数学大冒险的问题...
echo.
echo 1. 开放 Windows 防火墙 TCP 8000 端口
netsh advfirewall firewall delete rule name="MathAdventure-V2-8000" >nul 2>nul
netsh advfirewall firewall add rule name="MathAdventure-V2-8000" dir=in action=allow protocol=TCP localport=8000 profile=private,public
echo.
echo 2. 尝试把当前网络改为“专用网络”
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetConnectionProfile | Where-Object {$_.IPv4Connectivity -eq 'Internet'} | Set-NetConnectionProfile -NetworkCategory Private"
echo.
echo 3. 当前电脑可供手机访问的地址：
echo http://192.168.1.128:8000/
echo.
echo 如果手机仍打不开，请确认手机关闭 VPN/代理，并且路由器没有开启“AP隔离/客户端隔离”。
echo.
pause
@echo off
chcp@echo off
chcp 65001 >nul
echo 正在@echo off
chcp 65001 >nul
echo 正在修复手机访问数学大冒险的问题...
echo.
echo 1. 开放 Windows@echo off
chcp 65001 >nul
echo 正在修复手机访问数学大冒险的问题...
echo.
echo 1. 开放 Windows 防火墙 TCP 80 端口
netsh advfirewall firewall delete rule name="MathAdventure@echo off
chcp 65001 >nul
echo 正在修复手机访问数学大冒险的问题...
echo.
echo 1. 开放 Windows 防火墙 TCP 80 端口
netsh advfirewall firewall delete rule name="MathAdventure-V2-80" >nul 2>nul
netsh advfirewall firewall add@echo off
chcp 65001 >nul
echo 正在修复手机访问数学大冒险的问题...
echo.
echo 1. 开放 Windows 防火墙 TCP 80 端口
netsh advfirewall firewall delete rule name="MathAdventure-V2-80" >nul 2>nul
netsh advfirewall firewall add rule name="MathAdventure-V2-80" dir=in action=allow protocol=TCP local