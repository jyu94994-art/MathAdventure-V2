import pathlib
root = pathlib.Path(__file__).parent

html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css' / 'css.css').read_text(encoding='utf-8')
qjs = (root / 'data' / 'questions.js').read_text(encoding='utf-8')
ajs = (root / 'js' / 'app.js').read_text(encoding='utf-8')

html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<script src="data/questions.js"></script>', '<script>\n' + qjs + '\n</script>')
html = html.replace('<script src="js/app.js"></script>', '<script>\n' + ajs + '\n</script>')

(root / 'index.html').write_text(html, encoding='utf-8')
print('合并完成，总大小:', len(html), '字符')