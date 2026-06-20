// ゲームオブジェクトのストア。1オブジェクト = 1スクリプト。
// 状態は不変に扱い、全操作が新しい配列/オブジェクトを返す純関数。

import type { GameObject } from './types'

// 暗黙self（Scratch風）の新規オブジェクト用テンプレート。
export function defaultScript(): string {
  return `from stage import on_start, on_update, key_pressed

@on_start
def start():
    self.goto(0, 0)


@on_update
def update(dt):
    self.turn(3)
`
}

let counter = 0

// 一意な id を生成する（テストの決定性のため counter ベース）。
function nextId(): string {
  counter += 1
  return `obj-${counter}`
}

export function createObject(name: string, script?: string): GameObject {
  return { id: nextId(), name, script: script ?? defaultScript() }
}

// 既存名と衝突しない一意な名前を返す（"player", "player2", ...）。
export function uniqueName(objects: readonly GameObject[], base: string): string {
  const names = new Set(objects.map((o) => o.name))
  if (!names.has(base)) return base
  let n = 2
  while (names.has(`${base}${n}`)) n += 1
  return `${base}${n}`
}

export function addObject(objects: readonly GameObject[], name: string): GameObject[] {
  return [...objects, createObject(uniqueName(objects, name))]
}

export function removeObject(objects: readonly GameObject[], id: string): GameObject[] {
  return objects.filter((o) => o.id !== id)
}

export function updateScript(
  objects: readonly GameObject[],
  id: string,
  script: string,
): GameObject[] {
  return objects.map((o) => (o.id === id ? { ...o, script } : o))
}

export function renameObject(
  objects: readonly GameObject[],
  id: string,
  name: string,
): GameObject[] {
  return objects.map((o) => (o.id === id ? { ...o, name } : o))
}

export function findObject(
  objects: readonly GameObject[],
  id: string,
): GameObject | undefined {
  return objects.find((o) => o.id === id)
}
