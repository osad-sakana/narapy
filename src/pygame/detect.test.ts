import { describe, expect, it } from 'vitest'
import { routeRun, usesPygame } from './detect'

describe('usesPygame', () => {
  it.each([
    'import pygame',
    'import pygame as pg',
    'from pygame import draw',
    'from pygame.locals import *',
    'import os, pygame',
    '  import pygame',
    'import pygame_ce',
  ])('detects %s', (code) => {
    expect(usesPygame(code)).toBe(code !== 'import pygame_ce')
  })

  it.each([
    'print("import pygame")',
    '# import pygame',
    'import pygamelike',
    'x = 1',
    '',
  ])('ignores %s', (code) => {
    expect(usesPygame(code)).toBe(false)
  })
})

describe('routeRun', () => {
  const PYGAME = 'import pygame\nprint(1)'
  const PLAIN = 'print(1)'

  it('pygame を使わないコードは従来どおり Worker で実行する', () => {
    expect(routeRun('normal', PLAIN)).toEqual({ kind: 'worker' })
    expect(routeRun('trace', PLAIN)).toEqual({ kind: 'worker' })
    expect(routeRun('grade', PLAIN, PLAIN)).toEqual({ kind: 'worker' })
  })

  it('通常実行で pygame を使うコードはモーダルのメインスレッド実行にする', () => {
    expect(routeRun('normal', PYGAME)).toEqual({ kind: 'pygame' })
  })

  it('ステップ実行で pygame を使うコードは実行せず、通常実行を案内する', () => {
    const route = routeRun('trace', PYGAME)
    expect(route.kind).toBe('unsupported')
    if (route.kind === 'unsupported') {
      expect(route.message).toContain('ステップ実行')
      expect(route.message).toContain('通常の実行')
    }
  })

  it('採点で採点対象コードが pygame を使う場合は実行しない', () => {
    const route = routeRun('grade', PYGAME, PLAIN)
    expect(route.kind).toBe('unsupported')
    if (route.kind === 'unsupported') expect(route.message).toContain('採点')
  })

  it('採点で test.py だけが pygame を使う場合も実行しない', () => {
    expect(routeRun('grade', PLAIN, PYGAME).kind).toBe('unsupported')
  })

  it('採点で testCode が未指定でも判定できる', () => {
    expect(routeRun('grade', PLAIN)).toEqual({ kind: 'worker' })
  })
})

describe('routeRun（import 先ファイル）', () => {
  const files = [
    { kind: 'text' as const, path: 'game.py', data: 'import pygame\n' },
    { kind: 'text' as const, path: 'plain.py', data: 'x = 1\n' },
    { kind: 'text' as const, path: 'unused.py', data: 'import pygame\n' },
  ]

  it('main が import する別ファイルだけが pygame を使う場合も、通常実行は pygame 経路にする', () => {
    expect(routeRun('normal', 'import game\ngame.run()', '', files)).toEqual({ kind: 'pygame' })
  })

  it('import されていないファイルの pygame は無視する', () => {
    expect(routeRun('normal', 'import plain', '', files)).toEqual({ kind: 'worker' })
  })

  it('ステップ実行でも、import 先が pygame を使うなら実行しない', () => {
    expect(routeRun('trace', 'import game', '', files).kind).toBe('unsupported')
  })

  it('採点では test.py が import する先の pygame も見る', () => {
    expect(routeRun('grade', 'x = 1', 'import game', files).kind).toBe('unsupported')
  })
})
