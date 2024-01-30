#!/usr/bin/env python3
"""
decode_lsb.py
--------------
从 PNG 图片的红色通道最低有效位(LSB)中提取隐藏的文本信息。

用法:
    python3 decode_lsb.py <图片路径>

示例:
    python3 decode_lsb.py ../docs/assets/photo-13.png

这个工具不会在网站上被链接。如果你能找到它，说明你已经在认真地
翻阅这个仓库了 —— 这本身就是游戏的一部分。
"""
import sys

def decode(path):
    from PIL import Image
    img = Image.open(path).convert('RGB')
    px = img.load()
    W, H = img.size

    bits = []
    bytes_out = bytearray()
    bit_buf = 0
    bit_count = 0

    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            bit = r & 1
            bit_buf = (bit_buf << 1) | bit
            bit_count += 1
            if bit_count == 8:
                bytes_out.append(bit_buf)
                bit_buf = 0
                bit_count = 0
                if bytes_out[-1] == 0:
                    text = bytes_out[:-1].decode('utf-8', errors='replace')
                    return text
    return bytes_out.decode('utf-8', errors='replace')

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    result = decode(sys.argv[1])
    print("提取到的隐藏信息:", result)
