import jedi as _jedi, json as _json, re as _re, time as _time

# parent() / goto() は jedi の推論を伴い重いので、時間予算を超えたら以降は軽い情報だけにする
# （呼び出し前にしか確認しないため、上限ではなく目安）
_META_BUDGET_SEC = 0.3
_AFTER_DOT = _re.compile(r'\.\s*\w*$')


def _parent(name):
    try:
        return name.parent()
    except Exception:
        return None


def _owner(c, after_dot):
    # (module, parent, parentType, line, fullName) を返す。import した名前は定義元まで辿る
    target = c
    p = _parent(target)
    if p is None:
        # import os のように親を持たないモジュール自身
        return target.module_name or '', '', target.type or '', target.line, target.full_name or ''
    if p.type == 'module' and target.module_name == '__main__':
        defs = target.goto(follow_imports=True)
        if defs and defs[0].module_name != '__main__':
            target = defs[0]
            p = _parent(target)
            if p is None:
                return target.module_name or '', '', target.type or '', target.line, target.full_name or ''
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


# docstring の長さ上限（巨大なモジュール docstring を Worker 間で送らない）。
# editor/intel.ts の DOC_MAX_CHARS と同じ値に保つこと
_DOC_MAX = 4000
# range のようなオーバーロードの多い関数でも返す候補はこの数まで
_SIGNATURES_MAX = 5
_BOUND_SELF = _re.compile(r'\((self|cls)(, |\))')


def _hover(source, line, col):
    try:
        script = _jedi.Script(code=source)
        names = script.help(line, col)
        if not names:
            return 'null'
        n = names[0]
        if n.type == 'keyword' and not n.name.isidentifier():
            # ( . = などの記号にカーソルが乗っただけで長い解説を出さない
            return 'null'
        inferred_from_assignment = False
        if n.type == 'statement':
            # random.randint のように代入で束ねられた関数・クラスは定義元まで辿る
            inferred = [d for d in script.infer(line, col) if d.type in ('function', 'class')]
            if inferred:
                n = inferred[0]
                inferred_from_assignment = True
        sigs = n.get_signatures() if n.type in ('function', 'class') else []
        signature = sigs[0].to_string() if sigs else ''
        if inferred_from_assignment:
            # 束ねられたインスタンスのメソッドは self が残るので隠す
            signature = _BOUND_SELF.sub(lambda m: '()' if m.group(2) == ')' else '(', signature)
        return _json.dumps({
            'name': n.name,
            'fullName': n.full_name or '',
            'type': n.type,
            'signature': signature,
            'doc': (n.docstring(raw=True) or '')[:_DOC_MAX],
            'description': n.description or '',
        })
    except Exception:
        return 'null'


def _signature(source, line, col):
    try:
        sigs = _jedi.Script(code=source).get_signatures(line, col)
        if not sigs:
            return 'null'
        shown = sigs[:_SIGNATURES_MAX]
        # オーバーロードのうち、いま入力中の引数位置を特定できたものを最初に開く
        active = next((i for i, s in enumerate(shown) if s.index is not None), 0)
        return _json.dumps({
            'active': active,
            'signatures': [{
                'name': s.name,
                'fullName': s.full_name or '',
                'params': [p.to_string() for p in s.params],
                'index': s.index if s.index is not None else -1,
                'doc': (s.docstring(raw=True) or '')[:_DOC_MAX],
            } for s in shown],
        })
    except Exception:
        return 'null'
