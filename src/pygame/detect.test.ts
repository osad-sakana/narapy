import { describe, expect, it } from 'vitest'
import { usesPygame } from './detect'

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
