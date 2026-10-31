import jedi as _jedi, json as _json, re as _re, time as _time

# parent() / goto() は jedi の推論を伴い重いので、時間予算を超えたら以降は軽い情報だけにする
# （呼び出し前にしか確認しないため、上限ではなく目安）
_META_BUDGET_SEC = 0.3
_AFTER_DOT = _re.compile(r'\.\s*\w*$')


def _owner(c, after_dot):
    # (module, parent, parentType, line, fullName) を返す。import した名前は定義元まで辿る
    target = c
    p = target.parent()
    if p.type == 'module' and target.module_name == '__main__':
        defs = target.goto(follow_imports=True)
        if defs and defs[0].module_name != '__main__':
            target = defs[0]
            p = target.parent()
    if after_dot and p.type == 'function':
        # __init__ 内の self.x は所属クラスのメンバとして扱う
        gp = p.parent()
        if gp is not None and gp.type == 'class':
            p = gp
    return target.module_name or '', p.name or '', p.type or '', target.line, target.full_name or ''


def _complete(source, line, col):
    try:
        comps = _jedi.Script(code=source).complete(line, col)
        lines = source.split('\n')
        head = lines[line - 1][:col] if 0 < line <= len(lines) else ''
        after_dot = bool(_AFTER_DOT.search(head))
        deadline = _time.monotonic() + _META_BUDGET_SEC
        out = []
        for c in comps:
            item = {'name': c.name, 'type': c.type}
            try:
                item['module'] = c.module_name or ''
                if _time.monotonic() < deadline:
                    module, parent, parent_type, def_line, full_name = _owner(c, after_dot)
                    item.update({'module': module, 'parent': parent, 'parentType': parent_type,
                                 'line': def_line, 'fullName': full_name})
            except Exception:
                pass
            out.append(item)
        return _json.dumps(out)
    except Exception:
        return '[]'
