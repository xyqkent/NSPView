@ECHO OFF
ECHO 下载一些必要文件到/core/node_modules ...
ECHO.
ECHO 如果找不到npm指令，请确保已经安装NodeJS并重启电脑
ECHO.
ECHO 这会耗费一些时间，如果App有问题，你也可以删了/core/node_modules文件夹并重新执行此bat
ECHO.
cd .\core
call npm install
ECHO.
ECHO 安装nut的依赖包
ECHO.
pip3 install colorama pyopenssl requests tqdm unidecode image bs4 urllib3 flask pyqt5 pyusb pyftpdlib
ECHO.
PAUSE