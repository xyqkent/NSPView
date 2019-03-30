#By X-man
import sys
import os
import socket
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer
from pathlib import Path

#此处更改用户名和密码和端口（默认21，如有冲突改为2121之类）
main = "game"
xci = "xci"
upddlc = "upddlc"
port = 21

def get_host_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    finally:
        s.close()
 
    return ip

def startFtp(path):
	#实例化虚拟用户，这是FTP验证首要条件
	authorizer = DummyAuthorizer()

	#添加用户权限和路径，括号内的参数是(用户名， 密码， 用户目录， 权限)
	authorizer.add_user(main, main, path, perm='elradfmw')

	#判断是否有xci目录
	xciPath = path + "\\xci"
	xciExists=os.path.exists(xciPath) 
	if xciExists:
		authorizer.add_user(xci, xci, xciPath, perm='elradfmw')	

	#判断是否有upddlc目录
	upddlcPath = path + "\\upddlc"
	upddlcExists=os.path.exists(upddlcPath) 
	if upddlcExists:
		authorizer.add_user(upddlc, upddlc, upddlcPath, perm='elradfmw')	
	#初始化ftp句柄
	handler = FTPHandler
	handler.authorizer = authorizer

	#添加被动端口范围
	handler.passive_ports = range(2000, 2333)

	#获取本机ip
	ip = get_host_ip()
	#监听ip 和 端口
	server = FTPServer((ip, port), handler)
	ftpstr = ",\"ftp://"+main+":"+main+"@"+ip+":"+str(port)+"/\""

	print()
	print("*********此FTP将会识别是否存在xci或者upddlc文件夹，有则添加其为FTP子目录*******")  
	print()
	print("本机地址：" + ip + ":" + str(port))
	print("FTP目录(主)：" + path)
	print("用户名：" + main + "  密码：" + main)
	print()
	if xciExists:
		ftpstr += ",\"ftp://"+xci+":"+xci+"@"+ip+":"+str(port)+"/\""
		print("FTP目录(XCI)：" + xciPath)
		print("用户名：" + xci + "  密码：" + xci)
		print("")
	if upddlcExists:
		ftpstr += ",\"ftp://"+upddlc+":"+upddlc+"@"+ip+":"+str(port)+"/\""
		print("FTP目录(UPD-DLC)：" + upddlcPath)
		print("用户名：" + upddlc + "  密码：" + upddlc)
		print()
	print("Switch端location.conf配置文件中加上下面ftp配置信息：")
	print(ftpstr)
	print()
	print("FTP服务正在运行....关闭窗口即可停止")
	print()
	#开始服务
	server.serve_forever()

def print_usage():
    print("""\
start_ftp.py

用于对指定文件夹启用ftp服务器

Usage: start_ftp.py path""")


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print_usage()
        sys.exit(1)
    path = sys.argv[1]
    if Path(path).is_dir():
    	startFtp(path)
    else:
    	print("输入的路径不是文件夹")
    	sys.exit(1)


