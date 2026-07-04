import type { NarapyProject } from '../fileio/index'
import { decodeCodeParam, decodeProjectParam } from './decode'
import { fetchNarapyFromUrl } from './fetchProject'
import { parseUrlLoadParams } from './params'

export interface UrlLoadResult {
  project: NarapyProject
  source: 'project' | 'code' | 'projectUrl'
}

// 優先順位: #project= > #code= > ?project=<URL> (issue #32)
export async function resolveProjectFromUrl(
  hash: string = window.location.hash,
  search: string = window.location.search,
): Promise<UrlLoadResult | null> {
  const params = parseUrlLoadParams(hash, search)

  if (params.project) {
    return { project: decodeProjectParam(params.project), source: 'project' }
  }
  if (params.code) {
    return { project: decodeCodeParam(params.code), source: 'code' }
  }
  if (params.projectUrl) {
    return { project: await fetchNarapyFromUrl(params.projectUrl), source: 'projectUrl' }
  }
  return null
}
