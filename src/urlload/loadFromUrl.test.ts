import { describe, expect, it, vi } from 'vitest'
import type { NarapyProject } from '../fileio/index'
import * as decode from './decode'
import * as fetchProject from './fetchProject'
import { resolveProjectFromUrl } from './loadFromUrl'

const dummyProject: NarapyProject = {
  version: 2,
  files: [{ path: 'main.py', content: { kind: 'text', data: '' } }],
  directories: [],
  activeFile: 'main.py',
}

describe('resolveProjectFromUrl', () => {
  it('パラメータが何もなければnull', async () => {
    expect(await resolveProjectFromUrl('', '')).toBeNull()
  })

  it('#project= が最優先で使われる', async () => {
    const projectSpy = vi.spyOn(decode, 'decodeProjectParam').mockReturnValue(dummyProject)
    const codeSpy = vi.spyOn(decode, 'decodeCodeParam').mockReturnValue(dummyProject)
    const result = await resolveProjectFromUrl('#project=xyz&code=abc', '?project=https://example.com/p.narapy')
    expect(result).toEqual({ project: dummyProject, source: 'project' })
    expect(projectSpy).toHaveBeenCalledWith('xyz')
    expect(codeSpy).not.toHaveBeenCalled()
  })

  it('#project= がなければ #code= が使われる', async () => {
    vi.spyOn(decode, 'decodeCodeParam').mockReturnValue(dummyProject)
    const result = await resolveProjectFromUrl('#code=abc', '?project=https://example.com/p.narapy')
    expect(result).toEqual({ project: dummyProject, source: 'code' })
  })

  it('hashに何もなければ ?project=<URL> をフェッチする', async () => {
    const fetchSpy = vi.spyOn(fetchProject, 'fetchNarapyFromUrl').mockResolvedValue(dummyProject)
    const result = await resolveProjectFromUrl('', '?project=https://example.com/p.narapy')
    expect(result).toEqual({ project: dummyProject, source: 'projectUrl' })
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/p.narapy')
  })
})
