import { describe, expect, it } from 'vitest'
import type { RunFile } from '../types'
import { collectImportedSources, importedModules } from './importGraph'

const text = (path: string, data: string): RunFile => ({ kind: 'text', path, data })
const names = (code: string) => importedModules(code).map((m) => `${'.'.repeat(m.level)}${m.name}`)

describe('importedModules', () => {
  it('import / from import の対象を拾う', () => {
    const code = ['import os', 'import a, b as c', 'from game import run', 'from pkg.sub import x, y'].join('\n')
    expect(names(code)).toEqual(
      expect.arrayContaining(['os', 'a', 'b', 'game', 'game.run', 'pkg.sub', 'pkg.sub.x', 'pkg.sub.y']),
    )
  })

  it('相対 import はドットの数（level）を保持する', () => {
    expect(importedModules('from . import helper')).toEqual([{ level: 1, name: 'helper' }])
    expect(importedModules('from .util import f')).toEqual(
      expect.arrayContaining([{ level: 1, name: 'util' }, { level: 1, name: 'util.f' }]),
    )
    expect(importedModules('from ..pkg import g')).toEqual(
      expect.arrayContaining([{ level: 2, name: 'pkg' }, { level: 2, name: 'pkg.g' }]),
    )
  })

  it('括弧つきの複数行 import の最初の行を拾う', () => {
    expect(names('from pkg import (a as x, b)')).toEqual(expect.arrayContaining(['pkg', 'pkg.a', 'pkg.b']))
  })

  it('`;` で区切られた複数の文の import も拾う', () => {
    expect(names('import os; import game')).toEqual(expect.arrayContaining(['os', 'game']))
    expect(names('x = 1; from pkg import mod')).toEqual(expect.arrayContaining(['pkg', 'pkg.mod']))
  })

  it('括弧つきの複数行 from import の名前をすべて拾う', () => {
    expect(names('from pkg import (\n    mod,\n    other as o,\n)')).toEqual(
      expect.arrayContaining(['pkg', 'pkg.mod', 'pkg.other']),
    )
    expect(importedModules('from . import (\n  a,\n  b,\n)')).toEqual(
      expect.arrayContaining([{ level: 1, name: 'a' }, { level: 1, name: 'b' }]),
    )
  })

  it('コメント・文字列中の import は拾わない', () => {
    expect(importedModules('# import secret\nprint("import hidden")')).toEqual([])
  })

  it('インデントされた import（関数内など）も拾う', () => {
    expect(names('def f():\n    import late')).toContain('late')
  })

  it('長い 1 行の入力でも、二次時間のバックトラックで固まらない', () => {
    const n = 40_000
    const lines = [
      `from ${'.'.repeat(n)} x`,
      `from${' '.repeat(n)}x`,
      `import${' '.repeat(n)}x`,
      `import a${' '.repeat(n)}b`,
      // 閉じ括弧の無い from import が大量にあっても、行ごとにファイル末尾まで走査しない
      'from a import (\n'.repeat(20_000),
      `from a import (${' '.repeat(n)}`,
    ]
    for (const line of lines) {
      const start = performance.now()
      importedModules(line)
      expect(performance.now() - start).toBeLessThan(250)
    }
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

  describe('相対 import は import 元ファイルのパッケージ基準で解決する', () => {
    it('game/__init__.py の `from .app import App` は game/app.py を指す', () => {
      const files = [
        text('game/__init__.py', 'from .app import App'),
        text('game/app.py', 'import pygame'),
      ]
      expect(collectImportedSources(['from game import App'], files)).toEqual(
        expect.arrayContaining(['import pygame']),
      )
    })

    it('ルートに同名ファイルがあっても、パッケージ内のほうを辿る', () => {
      const files = [
        text('game/__init__.py', 'from .app import App'),
        text('game/app.py', 'import pygame'),
        text('app.py', 'x = 1'),
      ]
      const sources = collectImportedSources(['from game import App'], files)
      expect(sources).toContain('import pygame')
      expect(sources).not.toContain('x = 1')
    })

    it('`from . import helper` はサブモジュール helper を指す', () => {
      const files = [text('pkg/__init__.py', 'from . import helper'), text('pkg/helper.py', 'import pygame')]
      expect(collectImportedSources(['import pkg'], files)).toContain('import pygame')
    })

    it('`from .. import x` は 1 つ上のパッケージを指す', () => {
      const files = [
        text('top/__init__.py', ''),
        text('top/inner/__init__.py', ''),
        text('top/inner/mod.py', 'from .. import sibling'),
        text('top/sibling.py', 'import pygame'),
      ]
      expect(collectImportedSources(['import top.inner.mod'], files)).toContain('import pygame')
    })

    it('ルート直下のファイルの相対 import はルート基準になる', () => {
      const files = [text('main_mod.py', 'from . import helper'), text('helper.py', 'import pygame')]
      expect(collectImportedSources(['import main_mod'], files)).toContain('import pygame')
    })
  })
})
