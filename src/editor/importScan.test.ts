import { describe, expect, it } from 'vitest'
import { MAX_IMPORTED_MODULES, extractImportedModules } from './importScan'

describe('extractImportedModules', () => {
  it.each([
    ['import numpy', ['numpy']],
    ['import numpy as np', ['numpy']],
    ['import os, sys', ['os', 'sys']],
    ['import os.path', ['os']],
    ['import numpy as np, pandas as pd', ['numpy', 'pandas']],
    ['from pygame import display', ['pygame']],
    ['from matplotlib.pyplot import plot', ['matplotlib']],
    ['    import random', ['random']],
    ['import numpy  # 数値計算', ['numpy']],
  ])('%s', (code, expected) => {
    expect(extractImportedModules(code)).toEqual(expected)
  })

  it('構文エラーになる入力途中のコードでも import 行は拾える', () => {
    expect(extractImportedModules('import numpy as np\nnp.')).toEqual(['numpy'])
    expect(extractImportedModules('import numpy\nx = (')).toEqual(['numpy'])
  })

  it('相対 import・不正な名前・文字列内の import は無視する', () => {
    expect(extractImportedModules('from . import x')).toEqual([])
    expect(extractImportedModules('from .pkg import x')).toEqual([])
    expect(extractImportedModules('import 123abc')).toEqual([])
    expect(extractImportedModules('import os; rm -rf /')).toEqual(['os'])
    expect(extractImportedModules('print("import hack")')).toEqual([])
    expect(extractImportedModules('importnumpy')).toEqual([])
  })

  it('重複は1つにまとめ、出現順を保ち、上限を超えない', () => {
    expect(extractImportedModules('import b\nimport a\nimport b')).toEqual(['b', 'a'])
    const many = Array.from({ length: MAX_IMPORTED_MODULES + 10 }, (_, i) => `import m${i}`).join('\n')
    expect(extractImportedModules(many)).toHaveLength(MAX_IMPORTED_MODULES)
  })

  it('Windows 改行や空コードも扱える', () => {
    expect(extractImportedModules('import a\r\nimport b')).toEqual(['a', 'b'])
    expect(extractImportedModules('')).toEqual([])
  })

  it('入力中の行の import は途中の綴りなので拾わず、from ... import は拾う', () => {
    expect(extractImportedModules('import numpy\nimport pan', 2)).toEqual(['numpy'])
    expect(extractImportedModules('from pygame import d', 1)).toEqual(['pygame'])
    expect(extractImportedModules('import numpy as np', 1)).toEqual([])
    expect(extractImportedModules('import numpy as np', 2)).toEqual(['numpy'])
  })
})
