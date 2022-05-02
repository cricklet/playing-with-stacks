
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

export const getTextLayout = (text: string, maxWidth?: number): { lines: string[], lineHeight: number, width: number, height: number } => {
  const el = document.getElementById("hidden") as HTMLCanvasElement
  const ctx = el.getContext("2d") as CanvasRenderingContext2D

  if (maxWidth == null) {
    const measurement = ctx.measureText(text)
    return { lines: [text], width: measurement.width, height: 12, lineHeight: 12 };
  }

  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const measurement = ctx.measureText(currentLine + " " + word)
    const width = measurement.width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return { lines, width: maxWidth, height: lines.length * 12, lineHeight: 12 };
}

export const computeMeasurementForTextHelper = (
  text: string, width: number | 'auto' | 'fill'
): {
  width: number,
  height: number,
} => {
  if (width === 'fill') {
    return {
      // These are arbitrary fake measurements for when we don't know the
      // fill size of the text yet.
      width: 0, height: 0
    }
  } else {
    const maxWidth = width === 'auto' ? undefined : width
    const textLayout = getTextLayout(text, maxWidth)
    return {
      width: textLayout.width,
      height: textLayout.height
    }
  }
}

export const computeMeasurementsForText = (
  node: TextNode,
  horizontalAlignment?: 'MIN' | 'FILL',
  forceWidth?: number | undefined
): { width: number, height: number } => {
  const maxWidth =
    (node.fixedWidth != null) ? node.fixedWidth :
    (forceWidth != null) ? forceWidth :
    (horizontalAlignment === 'FILL') ? 'fill' : 'auto'

  return computeMeasurementForTextHelper(node.text, maxWidth)
}

export const computeMeasurementsForRectangle = (
  node: RectangleNode,
): { width: number, height: number } => {
  return {
    width: node.width,
    height: node.height
  }
}

export const computeMeasurementsForFrame = (
  node: FrameNode,
  sizeOfFrameChild: (child: SceneNode) => { width: number, height: number, },
): { width: number, height: number } => {
  // We need to calculate the size of frames by measuring children.
  let idealWidth = 0
  let idealHeight = 0

  for (const child of node.children) {
    if (node.alignment.type === 'HORIZONTAL') {
      idealWidth += sizeOfFrameChild(child).width
      idealHeight = Math.max(idealHeight, sizeOfFrameChild(child).height)
    } else {
      idealWidth = Math.max(idealWidth, sizeOfFrameChild(child).width)
      idealHeight += sizeOfFrameChild(child).height
    }
  }

  idealWidth += node.padding * 2
  idealHeight += node.padding * 2

  if (node.children.length) {
    if (node.alignment.type === 'HORIZONTAL') {
      idealWidth += (node.children.length - 1) * node.spacing
    } else {
      idealHeight += (node.children.length - 1) * node.spacing
    }
  }

  return {
    width: node.fixedWidth != null ? node.fixedWidth : idealWidth,
    height: node.fixedHeight != null ? node.fixedHeight : idealHeight
  }
}
