import type { DirectoryEntry, FileEntry, TreeDirNode, TreeNode } from './types'
import { detectFileKind } from './fileKind'

export function buildTree(files: FileEntry[], directories: DirectoryEntry[]): TreeNode[] {
  const root: TreeDirNode = { type: 'dir', name: '', path: '', children: [] }
  const dirMap = new Map<string, TreeDirNode>()
  dirMap.set('', root)

  function ensureDir(path: string): TreeDirNode {
    if (dirMap.has(path)) return dirMap.get(path)!
    const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    const parent = ensureDir(parentPath)
    const name = path.split('/').pop() ?? path
    const node: TreeDirNode = { type: 'dir', name, path, children: [] }
    parent.children.push(node)
    dirMap.set(path, node)
    return node
  }

  for (const dir of directories) {
    ensureDir(dir.path)
  }

  for (const file of files) {
    const dirname = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : ''
    const parent = ensureDir(dirname)
    const name = file.path.split('/').pop() ?? file.path
    parent.children.push({
      type: 'file',
      name,
      path: file.path,
      kind: detectFileKind(file.path) ?? 'binary',
    })
  }

  sortTree(root)
  return root.children
}

function sortTree(node: TreeDirNode): void {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const child of node.children) {
    if (child.type === 'dir') sortTree(child)
  }
}
