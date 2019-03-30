#By X-man
import sys
import os
import socket
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer
from pathlib import Path

#此处更改用户名和密码和端口（默认21，如有冲突改为2121之类）
username = "game"
password = "game"
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
	authorizer.add_user(username, password, path, perm='elradfmw')

	#初始化ftp句柄
	handler = FTPHandler
	handler.authorizer = authorizer

	#添加被动端口范围
	handler.passive_ports = range(2000, 2333)

	#获取本机ip
	ip = get_host_ip()
	#监听ip 和 端口
	server = FTPServer((ip, port), handler)
	print("FTP目录：" + path)
	print("本机地址：" + ip + ":" + str(port))
	print("用户名：" + username)
	print("密码：" + password)
	print("")
	print("FTP服务正在运行....关闭窗口即可停止")
	print("")
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


