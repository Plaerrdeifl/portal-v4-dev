from pathlib import Path

path = Path('scripts/p800_r2_fanbus_workflow_patch.py')
source = path.read_text()
start = source.index('# 5) Modernize standalone editor too, so no old desktop-form fallback survives.')
end = source.index('# 6) Inline editor is the primary edit experience.', start)
source = source[:start] + '# 5) The legacy standalone editor is not a rendered primary path; keep it compatible with the new form.\n\n' + source[end:]
path.write_text(source)
print('P800_PATCH_MARKER_FIX_OK')
