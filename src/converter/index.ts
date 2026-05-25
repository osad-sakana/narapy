import { serialization } from 'blockly'
import type { WorkspaceSvg } from 'blockly'
import type { IrNode } from './types'
import { irToWorkspaceJson } from './irToBlockly'
import { buildVariableRegistry } from './variableRegistry'
import { setSyncingFromPython, setHasUnsupportedCode } from '../blockly/workspace'
import { getPythonToIr } from '../runner/validator'
import { setBadge } from '../runner/badge'

function containsUnsupported(irJson: string): boolean {
  return irJson.includes('"type":"Unsupported"')
}

export async function applyPythonToWorkspace(
  source: string,
  workspace: WorkspaceSvg
): Promise<void> {
  const pythonToIr = getPythonToIr()
  if (!pythonToIr || source.trim() === '') {
    setHasUnsupportedCode(false)
    return
  }

  let irJson: string
  try {
    irJson = pythonToIr(source)
  } catch (err: unknown) {
    // 構文エラー: Blocklyは変更しない
    const message = err instanceof Error ? err.message : String(err)
    setBadge(`エラー: ${message}`, 'error')
    setHasUnsupportedCode(false)
    return
  }

  let root: IrNode
  try {
    root = JSON.parse(irJson) as IrNode
  } catch {
    return
  }

  if (root.type !== 'Program') return

  const hasUnsupported = containsUnsupported(irJson)
  setHasUnsupportedCode(hasUnsupported)

  // 変数レジストリ構築（ワークスペースに変数を登録しながらIDを割り当てる）
  const registry = buildVariableRegistry(root.body, workspace)

  const workspaceJson = irToWorkspaceJson(root, registry.getOrCreate, registry.toJson())

  setSyncingFromPython(true)
  try {
    workspace.clear()
    serialization.workspaces.load(workspaceJson, workspace, { recordUndo: false })
    if (hasUnsupported) {
      setBadge('⚠ 未対応構文あり', 'warn')
    } else {
      setBadge('構文OK', 'success')
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    setBadge(`変換エラー: ${message}`, 'error')
    setSyncingFromPython(false)
    return
  }
  requestAnimationFrame(() => setSyncingFromPython(false))
}
