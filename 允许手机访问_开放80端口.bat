@echo off
chcp 65001 >nul
echo 正在为"数学大冒险"开放 Windows 防火墙 80 端口...
echo.
netsh advfirewall firewall delete rule name="MathAdventure-V2-80" >nul 2>nul
netsh advfirewall firewall add rule name="MathAdventure-V2-80" dir=in action=allow protocol=TCP localport=80 profile=private,public
echo.
echo 如果上面显示"确定。"，说明已经开放成功。
echo 手机请访问：http://192.168.1.128/
echo.
pause