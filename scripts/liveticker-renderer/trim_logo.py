#!/usr/bin/env python3
from __future__ import annotations
import sys
import gi
gi.require_version("GdkPixbuf","2.0")
from gi.repository import GdkPixbuf

ALPHA_THRESHOLD=8

def trimmed(source:str,target:str)->None:
    pixbuf=GdkPixbuf.Pixbuf.new_from_file(source)
    width=pixbuf.get_width(); height=pixbuf.get_height()
    if width<=0 or height<=0:
        raise RuntimeError("invalid logo dimensions")
    result=pixbuf
    if pixbuf.get_has_alpha():
        channels=pixbuf.get_n_channels(); stride=pixbuf.get_rowstride(); pixels=pixbuf.get_pixels(); alpha_index=channels-1
        min_x=width; min_y=height; max_x=-1; max_y=-1
        for y in range(height):
            row=y*stride
            for x in range(width):
                if pixels[row+x*channels+alpha_index] > ALPHA_THRESHOLD:
                    if x<min_x: min_x=x
                    if x>max_x: max_x=x
                    if y<min_y: min_y=y
                    if y>max_y: max_y=y
        if max_x>=min_x and max_y>=min_y:
            result=pixbuf.new_subpixbuf(min_x,min_y,max_x-min_x+1,max_y-min_y+1)
    if not result.savev(target,"png",[],[]):
        raise RuntimeError("logo png save failed")

def main()->int:
    if len(sys.argv)<3 or (len(sys.argv)-1)%2:
        raise SystemExit("usage: trim_logo.py SOURCE TARGET [SOURCE TARGET ...]")
    for i in range(1,len(sys.argv),2): trimmed(sys.argv[i],sys.argv[i+1])
    return 0

if __name__=="__main__":
    raise SystemExit(main())
