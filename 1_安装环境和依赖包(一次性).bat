@ECHO OFF
ECHO ����һЩ��Ҫ�ļ���/core/node_modules ...
ECHO.
ECHO ����Ҳ���npmָ���ȷ���Ѿ���װNodeJS����������
ECHO.
ECHO ���ķ�һЩʱ�䣬���App�����⣬��Ҳ����ɾ��/core/node_modules�ļ��в�����ִ�д�bat
ECHO.
cd .\core
call npm install
ECHO.
ECHO ��װnut��������
ECHO.
pip3 install colorama pyopenssl requests tqdm unidecode image bs4 urllib3 flask pyqt5 pyusb pyftpdlib
ECHO.
PAUSE