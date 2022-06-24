
let nextGUID = 0
export const newGUID = (): string => {
  return `${nextGUID ++}`
}

export interface HorizontalAlign {
  type: 'HORIZONTAL'
  horizontalAlignment: 'MIN'
  verticalAlignment: 'MIN' | 'FILL'
}

export interface VerticalAlign {
  type: 'VERTICAL'
  verticalAlignment: 'MIN'
  horizontalAlignment: 'MIN' | 'FILL'
}

export interface FrameNode {
  type: 'frame'
  id: string

  padding: number
  spacing: number
  color: string

  alignment: HorizontalAlign | VerticalAlign

  fixedWidth?: number
  fixedHeight?: number

  children: SceneNode[]
}

export interface RectangleNode {
  type: 'rectangle'
  id: string
  width: number
  height: number
  color: string
}

export interface TextNode {
  type: 'text'
  id: string
  text: string
  fixedWidth?: number
}

export type SceneNode = RectangleNode | FrameNode | TextNode

export interface FinalLayout {
  [id: string]: {
    x: number,
    y: number,
    width: number,
    height: number
  }
}

export function initialWidth(node: SceneNode) {
  switch (node.type) {
    case 'rectangle':
      return node.width
    case 'text':
      return node.fixedWidth ? node.fixedWidth : undefined
    case 'frame':
      return node.fixedWidth ? node.fixedWidth : undefined
  }
}

export function initialHeight(node: SceneNode) {
  switch (node.type) {
    case 'rectangle':
      return node.height
    case 'text':
      return undefined
    case 'frame':
      return node.fixedHeight ? node.fixedHeight : undefined
  }
}

export function getTextLayout(text: string, maxWidth?: number): { lines: string[]; lineHeight: number; width: number; height: number}  {
  const el = document.getElementById("hidden") as HTMLCanvasElement
  const ctx = el.getContext("2d") as CanvasRenderingContext2D

  if (maxWidth == null) {
    const measurement = ctx.measureText(text)
    return { lines: [text], width: measurement.width, height: 12, lineHeight: 12 }
  }

  const words = text.split(" ")
  const lines: string[] = []
  let currentLine = words[0]

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const measurement = ctx.measureText(currentLine + " " + word)
    const width = measurement.width
    if (width < maxWidth) {
      currentLine += " " + word
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  lines.push(currentLine)
  return { lines, width: maxWidth, height: lines.length * 12, lineHeight: 12 }
}
