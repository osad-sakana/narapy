import { describe, expect, it } from 'vitest'
import type { RunFile } from '../types'
import { collectImportedSources, importedModuleNames } from './importGraph'

const text = (path: string, data: string): RunFile => ({ kind: 'text', path, data })

describe('importedModuleNames', () => {
  it('import / from import の対象を拾う', () => {
    const code = ['import os', 'import a, b as c', 'from game import run', 'from pkg.sub import x, y'].join('\n')
    expect(importedModuleNames(code)).toEqual(
      expect.arrayContaining(['os', 'a', 'b', 'game', 'game.run', 'pkg.sub', 'pkg.sub.x', 'pkg.sub.y']),
    )
  })

  it('相対 import は先頭のドットを外して扱う', () => {
    expect(importedModuleNames('from . import helper\nfrom .util import f')).toEqual(
      expect.arrayContaining(['helper', 'util', 'util.f']),
    )
  })

  it('コメント・文字列中の import は拾わない', () => {
    expect(importedModuleNames('# import secret\nprint("import hidden")')).toEqual([])
  })

  it('インデントされた import（関数内など）も拾う', () => {
    expect(importedModuleNames('def f():\n    import late')).toContain('late')
  })
})

describe('collectImportedSources', () => {
  it('エントリが直接 import するファイルの内容を返す', () => {
    const files = [text('game.py', 'import pygame'), text('other.py', 'x = 1')]
    expect(collectImportedSources(['import game'], files)).toEqual(['import pygame'])
  })

  it('import を再帰的に辿る（main → game → engine）', () => {
    const files = [text('game.py', 'import engine'), text('engine.py', 'import pygame')]
    expect(collectImportedSources(['import game'], files)).toEqual(
      expect.arrayContaining(['import engine', 'import pygame']),
    )
  })

  it('import されていないファイルは含めない', () => {
    const files = [text('unused.py', 'import pygame')]
    expect(collectImportedSources(['print(1)'], files)).toEqual([])
  })

  it('パッケージ（__init__.py）とサブモジュールを解決する', () => {
    const files = [text('pkg/__init__.py', 'A = 1'), text('pkg/sub.py', 'import pygame')]
    expect(collectImportedSources(['from pkg import sub'], files)).toEqual(
      expect.arrayContaining(['A = 1', 'import pygame']),
    )
    expect(collectImportedSources(['import pkg.sub'], files)).toEqual(
      expect.arrayContaining(['import pygame']),
    )
  })

  it('循環 import でも無限ループしない', () => {
    const files = [text('a.py', 'import b'), text('b.py', 'import a')]
    expect(collectImportedSources(['import a'], files)).toHaveLength(2)
  })

  it('バイナリファイルや .py 以外は対象にしない', () => {
    const files: RunFile[] = [
      { kind: 'binary', path: 'game.py', data: new Uint8Array([1]) },
      text('game.txt', 'import pygame'),
    ]
    expect(collectImportedSources(['import game'], files)).toEqual([])
  })
})
