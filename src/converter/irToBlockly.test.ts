import { describe, expect, it } from 'vitest'
import { irToWorkspaceJson } from './irToBlockly'
import type { BlockJson, IrNode } from './types'

function makeGetVarId(): (name: string) => string {
  let counter = 0
  const varMap = new Map<string, string>()
  return (name: string) => {
    if (!varMap.has(name)) varMap.set(name, `var_${counter++}`)
    return varMap.get(name)!
  }
}

function firstTopBlock(root: IrNode): BlockJson {
  const json = irToWorkspaceJson(root, makeGetVarId(), [])
  const block = json.blocks.blocks[0]
  if (!block) throw new Error('no top block generated')
  return block
}

// "a" + "b" + "c" は Python の左結合により
// BinOp(ADD, BinOp(ADD, "a", "b"), "c") という左ネストの IR になる
function strLit(value: string): IrNode {
  return { type: 'StrLit', value }
}

describe('irToWorkspaceJson - BinOp(ADD) 文字列連結', () => {
  it('3つ以上の文字列連結は単一の text_join（N項）に平坦化される', () => {
    const root: IrNode = {
      type: 'Program',
      body: [
        {
          type: 'PrintStmt',
          value: {
            type: 'BinOp',
            op: 'ADD',
            left: { type: 'BinOp', op: 'ADD', left: strLit('name'), right: strLit('age') },
            right: strLit('は'),
          },
        },
      ],
    }

    const printBlock = firstTopBlock(root)
    const joinBlock = printBlock.inputs?.TEXT?.block
    expect(joinBlock?.type).toBe('text_join')
    expect(joinBlock?.extraState).toEqual({ itemCount: 3 })

    // ネストした text_join が存在しないこと（各ADDスロットは平坦な text ブロック）
    expect(joinBlock?.inputs?.ADD0?.block?.type).toBe('text')
    expect(joinBlock?.inputs?.ADD0?.block?.fields?.TEXT).toBe('name')
    expect(joinBlock?.inputs?.ADD1?.block?.type).toBe('text')
    expect(joinBlock?.inputs?.ADD1?.block?.fields?.TEXT).toBe('age')
    expect(joinBlock?.inputs?.ADD2?.block?.type).toBe('text')
    expect(joinBlock?.inputs?.ADD2?.block?.fields?.TEXT).toBe('は')
  })

  it('2項の文字列連結は itemCount:2 のまま（後方互換）', () => {
    const root: IrNode = {
      type: 'Program',
      body: [
        {
          type: 'PrintStmt',
          value: { type: 'BinOp', op: 'ADD', left: strLit('a'), right: strLit('b') },
        },
      ],
    }

    const printBlock = firstTopBlock(root)
    const joinBlock = printBlock.inputs?.TEXT?.block
    expect(joinBlock?.type).toBe('text_join')
    expect(joinBlock?.extraState).toEqual({ itemCount: 2 })
  })

  it('数値同士の加算は math_arithmetic のまま（文字列化されない）', () => {
    const root: IrNode = {
      type: 'Program',
      body: [
        {
          type: 'PrintStmt',
          value: {
            type: 'BinOp',
            op: 'ADD',
            left: { type: 'NumLit', value: 1 },
            right: { type: 'NumLit', value: 2 },
          },
        },
      ],
    }

    const printBlock = firstTopBlock(root)
    const block = printBlock.inputs?.TEXT?.block
    expect(block?.type).toBe('math_arithmetic')
  })

  it('文字列と変数が混在する3項連結も単一の text_join に平坦化される', () => {
    const root: IrNode = {
      type: 'Program',
      body: [
        {
          type: 'PrintStmt',
          value: {
            type: 'BinOp',
            op: 'ADD',
            left: { type: 'BinOp', op: 'ADD', left: strLit('a'), right: { type: 'VarRef', name: 'x' } },
            right: strLit('b'),
          },
        },
      ],
    }

    const printBlock = firstTopBlock(root)
    const joinBlock = printBlock.inputs?.TEXT?.block
    expect(joinBlock?.type).toBe('text_join')
    expect(joinBlock?.extraState).toEqual({ itemCount: 3 })
    expect(joinBlock?.inputs?.ADD1?.block?.type).toBe('variables_get')
  })

  it('FStringLitを含む連鎖も文字列連結として単一の text_join に平坦化される', () => {
    const root: IrNode = {
      type: 'Program',
      body: [
        {
          type: 'PrintStmt',
          value: {
            type: 'BinOp',
            op: 'ADD',
            left: {
              type: 'BinOp',
              op: 'ADD',
              left: { type: 'FStringLit', parts: [{ type: 'VarRef', name: 'x' }] },
              right: { type: 'VarRef', name: 'y' },
            },
            right: strLit('!'),
          },
        },
      ],
    }

    const printBlock = firstTopBlock(root)
    const joinBlock = printBlock.inputs?.TEXT?.block
    expect(joinBlock?.type).toBe('text_join')
    expect(joinBlock?.extraState).toEqual({ itemCount: 3 })
    expect(joinBlock?.inputs?.ADD0?.block?.type).toBe('text_fstring')
    expect(joinBlock?.inputs?.ADD1?.block?.type).toBe('variables_get')
    expect(joinBlock?.inputs?.ADD2?.block?.fields?.TEXT).toBe('!')
  })

  it('4つ以上の文字列連結も単一の text_join に平坦化される', () => {
    const root: IrNode = {
      type: 'Program',
      body: [
        {
          type: 'PrintStmt',
          value: {
            type: 'BinOp',
            op: 'ADD',
            left: {
              type: 'BinOp',
              op: 'ADD',
              left: { type: 'BinOp', op: 'ADD', left: strLit('a'), right: strLit('b') },
              right: strLit('c'),
            },
            right: strLit('d'),
          },
        },
      ],
    }

    const printBlock = firstTopBlock(root)
    const joinBlock = printBlock.inputs?.TEXT?.block
    expect(joinBlock?.type).toBe('text_join')
    expect(joinBlock?.extraState).toEqual({ itemCount: 4 })
    for (const [i, expected] of ['a', 'b', 'c', 'd'].entries()) {
      expect(joinBlock?.inputs?.[`ADD${i}`]?.block?.fields?.TEXT).toBe(expected)
    }
  })
})
