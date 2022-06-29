
let nextGUID = 0
export const newGUID = (): string => {
  return `${nextGUID ++}`
}

type SizeSetting = 'grow' | 'resize-to-fit' | number

export interface FrameNode {
  type: 'frame'
  id: string

  padding: number
  color: string

  alignment: 'horizontal' | 'vertical' // eg 'wrap'

  width: SizeSetting
  height: SizeSetting

  children: SceneNode[]
}

export interface RectangleNode {
  type: 'rectangle'
  id: string

  width: Exclude<SizeSetting, 'resize-to-fit'>
  height: Exclude<SizeSetting, 'resize-to-fit'>

  color: string
}

export interface TextNode {
  type: 'text'
  id: string

  text: string

  width: SizeSetting
  height: SizeSetting
}

export type SceneNode = RectangleNode | FrameNode | TextNode

export interface FinalLayout {
  [id: string]: {
    x: number,
    y: number,
    size: [number | undefined, number | undefined]
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
