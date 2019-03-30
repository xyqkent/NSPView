#By X-man
import requests 
from tqdm import tqdm
import sys
import time

downlist = ['AR.en.json','AR.es.json','AT.de.json','AU.en.json','BE.fr.json','BE.nl.json','CA.en.json','CA.fr.json','CL.en.json','CL.es.json','CO.en.json',
'CO.es.json','CZ.en.json','DE.de.json','demos.au.txt','demos.gb.txt','demos.jp.txt','demos.us.txt','DK.en.json','ES.es.json','FI.en.json','FR.fr.json',
'GB.en.json','GR.en.json','HK.zh.json','HU.en.json','IT.it.json','JP.ja.json','KR.ko.json','languages.json','MX.en.json','MX.es.json','NL.nl.json',
'NO.en.json','NZ.en.json','PE.en.json','PE.es.json','PL.en.json','PT.pt.json','redirectCache.json','RU.ru.json','SE.en.json','US.en.json','US.es.json',
'versions.txt','ZA.en.json']

def downloadFILE(url,name,fn):
    resp = requests.get(url=url,stream=True)
	#stream=True的作用是仅让响应头被下载，连接保持打开状态，
    content_size = int(resp.headers['Content-Length'])/1024		#确定整个安装包的大小
    with open(name, "wb") as f:
        print("大小：",round(content_size),'k，开始下载...')
        for data in tqdm(iterable=resp.iter_content(1024),total=round(content_size),unit='k',desc=fn,ascii=True):
	#调用iter_content，一块一块的遍历要下载的内容，搭配stream=True，此时才开始真正的下载
	#iterable：可迭代的进度条 total：总的迭代次数 desc：进度条的前缀			
            f.write(data)

        print(fn + "已经下载完毕！\n")

print("nut数据库共有: " + str(len(downlist)) + "个文件")
count = 1
for fn in downlist:	
	url = 'https://raw.githubusercontent.com/blawar/nut/master/titledb/' + fn
	print(str(count) + "、" + fn)
	downloadFILE(url,"../nut/titledb/" + fn,fn)
	count+=1
print("nut数据库" + str(count) + "个文件已经完成下载")