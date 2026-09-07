#!/usr/bin/env python3
"""Generate a QR SVG using the QR encoder shipped in the pinned Inkscape image."""

from __future__ import annotations

import argparse
import importlib.util
import sys
import types
from pathlib import Path
from xml.sax.saxutils import escape

EXTENSION = "/usr/share/inkscape/extensions/render_barcode_qrcode.py"


def _load_encoder():
    # Matrix generation in the Inkscape extension only needs a list-backed
    # array. Mask scoring is replaced below with deterministic mask 0.
    fake_numpy = types.ModuleType("numpy")
    fake_numpy.array = lambda value: value
    sys.modules["numpy"] = fake_numpy

    # The renderer/UI portions are not used for matrix generation. Stub their
    # imports so the encoder remains usable in the headless LinuxServer image.
    inkex = types.ModuleType("inkex")

    class GenerateExtension:
        pass

    class AbortExtension(Exception):
        pass

    class Dummy:
        pass

    inkex.GenerateExtension = GenerateExtension
    inkex.AbortExtension = AbortExtension
    inkex.Boolean = bool
    inkex.Group = Dummy
    inkex.Rectangle = Dummy
    inkex.Use = Dummy
    inkex.PathElement = Dummy
    inkex.Path = Dummy
    inkex.Transform = Dummy
    sys.modules["inkex"] = inkex

    paths = types.ModuleType("inkex.paths")
    paths.Move = Dummy
    paths.zoneClose = lambda: None
    paths.Line = Dummy
    paths.Curve = Dummy
    sys.modules["inkex.paths"] = paths

    localization = types.ModuleType("inkex.localization")
    localization.inkex_gettext = lambda value: value
    sys.modules["inkex.localization"] = localization

    utils = types.ModuleType("inkex.utils")

    def circular_pairwise(values):
        values = list(values)
        return zip(values, values[1:] + values[:1]) if values else iter(())

    utils.circular_pairwise = circular_pairwise
    sys.modules["inkex.utils"] = utils

    spec = importlib.util.spec_from_file_location("m340_inkscape_qr", EXTENSION)
    if spec is None or spec.loader is None:
        raise RuntimeError("QR_EXTENSION_UNAVAILABLE")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    # Every QR mask 0..7 is standards-valid. The extension normally uses
    # numpy only to score them. Returning zero consistently chooses mask 0.
    module.QRUtil.getLostPoint = staticmethod(lambda _qr: 0)
    return module


def build_svg(text: str) -> str:
    if not text or len(text) > 512 or not text.isascii():
        raise ValueError("QR_TEXT_INVALID")

    module = _load_encoder()
    data = module.QR8BitByte(text)
    qr = module.QRCode.getMinimumQRCode(data, 0)  # M error correction
    modules = qr.modules
    size = qr.getModuleCount()
    margin = 4
    total = size + (margin * 2)

    commands: list[str] = []
    for row in range(size):
        for col in range(size):
            if modules[row][col]:
                commands.append(f"M{col + margin} {row + margin}h1v1h-1z")

    path_data = "".join(commands)
    escaped_text = escape(text, {'"': "&quot;"})
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" '
        f'width="512" height="512" data-qr-url="{escaped_text}">\n'
        f'  <rect width="{total}" height="{total}" fill="#ffffff"/>\n'
        f'  <path id="m340-qr-vector" d="{path_data}" fill="#000000"/>\n'
        '</svg>\n'
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    Path(args.output).write_text(build_svg(args.text), encoding="utf-8")


if __name__ == "__main__":
    main()
