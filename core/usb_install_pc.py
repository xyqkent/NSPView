# This script depends on PyUSB. You can get it with pip install pyusb.
# You will also need libusb installed

# My sincere apologies for this process being overly complicated. Apparently Python and Windows
# aren't very friendly :(
# Windows Instructions:
# 1. Download Zadig from https://zadig.akeo.ie/.
# 2. With your switch plugged in and on the Tinfoil USB install menu, 
#    choose "List All Devices" under the options menu in Zadig, and select libnx USB comms. 
# 3. Choose libusbK from the driver list and click the "Replace Driver" button.
# 4. Run this script

# macOS Instructions:
# 1. Install Homebrew https://brew.sh
# 2. Install Python 3
#      sudo mkdir /usr/local/Frameworks
#      sudo chown $(whoami) /usr/local/Frameworks
#      brew install python
# 3. Install PyUSB 
#      pip3 install pyusb
# 4. Install libusb
#      brew install libusb
# 5. Plug in your Switch and go to Tinfoil > Title Management > USB Install NSP
# 6. Run this script
#      python3 usb_install_pc.py <path/to/nsp_folder>

import usb.core
import usb.util
import struct
import sys
import os
from binascii import hexlify as hx, unhexlify as uhx
from pathlib import Path

CMD_ID_EXIT = 0
CMD_ID_FILE_RANGE = 1

CMD_TYPE_RESPONSE = 1

SUFFIXES = {1000: ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']}
def approximate_size(size):
    if size < 0:
        return 'number must be non-negative'

    multiple = 1000
    for suffix in SUFFIXES[multiple]:
        size /= multiple
        if size < multiple:
            return '{0:.1f} {1}'.format(size, suffix)

    return 'number too large'

def send_response_header(out_ep, cmd_id, data_size):
    out_ep.write(b'TUC0') # Tinfoil USB Command 0
    out_ep.write(struct.pack('<B', CMD_TYPE_RESPONSE))
    out_ep.write(b'\x00' * 3)
    out_ep.write(struct.pack('<I', cmd_id))
    out_ep.write(struct.pack('<Q', data_size))
    out_ep.write(b'\x00' * 0xC)

def file_range_cmd(nsp_dir, in_ep, out_ep, data_size):
    file_range_header = in_ep.read(0x20)

    range_size = struct.unpack('<Q', file_range_header[:8])[0]
    range_offset = struct.unpack('<Q', file_range_header[8:16])[0]
    nsp_name_len = struct.unpack('<Q', file_range_header[16:24])[0]
    #in_ep.read(0x8) # Reserved
    nsp_name = bytes(in_ep.read(nsp_name_len)).decode('utf-8')

    print('Range Size: {}, Range Offset: {}, Name len: {}, Name: {}'.format(range_size, range_offset, nsp_name_len, nsp_name))
    send_response_header(out_ep, CMD_ID_FILE_RANGE, range_size)

    with open(nsp_name, 'rb') as f:
        f.seek(range_offset)

        curr_off = 0x0
        end_off = range_size
        read_size = 0x800000

        while curr_off < end_off:
            if curr_off + read_size >= end_off:
                read_size = end_off - curr_off

            buf = f.read(read_size)
            out_ep.write(data=buf, timeout=0)
            curr_off += read_size

def poll_commands(nsp_dir, in_ep, out_ep):
    while True:
        cmd_header = bytes(in_ep.read(0x20, timeout=0))
        magic = cmd_header[:4]
        print('Magic: {}'.format(magic), flush=True)

        if magic != b'TUC0': # Tinfoil USB Command 0
            continue

        cmd_type = struct.unpack('<B', cmd_header[4:5])[0]
        cmd_id = struct.unpack('<I', cmd_header[8:12])[0]
        data_size = struct.unpack('<Q', cmd_header[12:20])[0]

        print('Cmd Type: {}, Command id: {}, Data size: {}'.format(cmd_type, cmd_id, data_size), flush=True)

        if cmd_id == CMD_ID_EXIT:
            print('安装成功，已退出...')
            break
        elif cmd_id == CMD_ID_FILE_RANGE:
            file_range_cmd(nsp_dir, in_ep, out_ep, data_size)

def send_nsp_list(nsp_dir, out_ep):
    nsp_path_list = list()
    nsp_path_list_len = 0
    nsp_info_list = list()

    # Add all files with the extension .nsp in the provided dir
    for nsp_path in nsp_dir:
        nsp = Path(nsp_path)
        nsp_info_list.append("路径：" + nsp_path.__str__())
        nsp_info_list.append("    大小：" + approximate_size(os.path.getsize(nsp)))
        nsp_path_list.append(nsp_path.__str__() + '\n')
        nsp_path_list_len += len(nsp_path.__str__()) + 1

    print('发送头部指令')
    try:
        out_ep.write(b'TUL0') # Tinfoil USB List 0
        out_ep.write(struct.pack('<I', nsp_path_list_len))
        out_ep.write(b'\x00' * 0x8) # Padding

        print('安装列表：')
        for p in nsp_info_list:
            print(p)

        for nsp_path in nsp_path_list:
            out_ep.write(nsp_path)    
    except KeyboardInterrupt:
        raise
    except BaseException as e:
        print('error: ' + str(e))
        print('错误：连接NS的Tinfoil USB通道超时，发送安装信息失败。')
        sys.exit(1)
    

def print_usage():
    print("""\
usb_install_pc.py

用于安装NSPs

Usage: usb_install_pc.py nspfile1###nspfile2###nspfile3""")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print_usage()
        sys.exit(1)

    nsp_dir = []
    nsps = sys.argv[1].split("###")
    for nsp in nsps:
        nsp = Path(nsp)
        if nsp.is_file() and nsp.suffix == '.nsp':
            nsp_dir.append(nsp)
    # Find the switch
    dev = usb.core.find(idVendor=0x057E, idProduct=0x3000)    
    if dev is None:
        # raise ValueError('Switch is not found!')
        print("错误：未检测到NS，请确认NS的USB连接、驱动正常和NS已进入Tinfoil的USB安装界面。")
        sys.exit(1)

    dev.reset()
    dev.set_configuration()
    cfg = dev.get_active_configuration()

    is_out_ep = lambda ep: usb.util.endpoint_direction(ep.bEndpointAddress) == usb.util.ENDPOINT_OUT
    is_in_ep = lambda ep: usb.util.endpoint_direction(ep.bEndpointAddress) == usb.util.ENDPOINT_IN
    out_ep = usb.util.find_descriptor(cfg[(0,0)], custom_match=is_out_ep)
    in_ep = usb.util.find_descriptor(cfg[(0,0)], custom_match=is_in_ep)

    assert out_ep is not None
    assert in_ep is not None

    send_nsp_list(nsp_dir, out_ep)
    poll_commands(nsp_dir, in_ep, out_ep)