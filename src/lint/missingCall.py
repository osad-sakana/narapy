import ast as _ast, builtins as _builtins, json as _json, types as _types


def _narapy_ok(warnings):
    return _json.dumps({'status': 'ok', 'warnings': warnings})


def _narapy_collect_bindings(tree):
    # 関数かどうかを断定できる名前だけを警告対象にするため、def 以外で束縛されうる名前を集める。
    # スコープは区別せず、ファイル内のどこかで再束縛されていれば警告しない（誤検知より見逃しを選ぶ）
    defs, rebound, star = set(), set(), False
    for node in _ast.walk(tree):
        if isinstance(node, (_ast.FunctionDef, _ast.AsyncFunctionDef)):
            defs.add(node.name)
        elif isinstance(node, _ast.ClassDef):
            rebound.add(node.name)
        elif isinstance(node, _ast.Name) and isinstance(node.ctx, (_ast.Store, _ast.Del)):
            rebound.add(node.id)
        elif isinstance(node, (_ast.Import, _ast.ImportFrom)):
            for alias in node.names:
                if alias.name == '*':
                    star = True
                else:
                    rebound.add(alias.asname or alias.name.split('.')[0])
        elif isinstance(node, _ast.arg):
            rebound.add(node.arg)
        elif isinstance(node, (_ast.Global, _ast.Nonlocal)):
            rebound.update(node.names)
        elif isinstance(node, _ast.ExceptHandler) and node.name:
            rebound.add(node.name)
        elif isinstance(node, (_ast.MatchAs, _ast.MatchStar)) and node.name:
            rebound.add(node.name)
        elif isinstance(node, _ast.MatchMapping) and node.rest:
            rebound.add(node.rest)
    return defs, rebound, star


def _narapy_is_function_name(name, defs, rebound, star):
    if name in rebound:
        return False
    if name in defs:
        return True
    if star or name.startswith('_'):
        return False
    return isinstance(getattr(_builtins, name, None), _types.BuiltinFunctionType)


def _narapy_utf16_col(line, byte_offset):
    # ast の col_offset は UTF-8 のバイト位置。Monaco は UTF-16 の文字位置（1 始まり）なので変換する
    prefix = line.encode('utf-8')[:byte_offset].decode('utf-8', 'ignore')
    return len(prefix.encode('utf-16-le')) // 2 + 1


def _narapy_missing_call(source):
    try:
        tree = _ast.parse(source)
    except (SyntaxError, ValueError, RecursionError, MemoryError):
        return _json.dumps({'status': 'syntax_error'})
    except Exception:
        return _json.dumps({'status': 'failed'})
    try:
        defs, rebound, star = _narapy_collect_bindings(tree)
        lines = source.replace('\r\n', '\n').replace('\r', '\n').split('\n')
        warnings = []

        def add(name_node, kind):
            if not _narapy_is_function_name(name_node.id, defs, rebound, star):
                return
            line = lines[name_node.lineno - 1]
            warnings.append({
                'name': name_node.id,
                'kind': kind,
                'line': name_node.lineno,
                'col': _narapy_utf16_col(line, name_node.col_offset),
                'endCol': _narapy_utf16_col(line, name_node.end_col_offset),
            })

        for node in _ast.walk(tree):
            if isinstance(node, _ast.Expr) and isinstance(node.value, _ast.Name):
                add(node.value, 'expr')
            elif isinstance(node, (_ast.If, _ast.While, _ast.Assert)) and isinstance(node.test, _ast.Name):
                add(node.test, type(node).__name__.lower())
        warnings.sort(key=lambda w: (w['line'], w['col']))
        return _narapy_ok(warnings)
    except Exception:
        return _json.dumps({'status': 'failed'})
