
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

export const initialWidth = (node: SceneNode) => {
  switch (node.type) {
    case 'rectangle':
      return node.width;
    case 'text':
      return node.fixedWidth ? node.fixedWidth : undefined;
    case 'frame':
      return node.fixedWidth ? node.fixedWidth : undefined;
  }
}

export const initialHeight = (node: SceneNode) => {
  switch (node.type) {
    case 'rectangle':
      return node.height;
    case 'text':
      return undefined;
    case 'frame':
      return node.fixedHeight ? node.fixedHeight : undefined;
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
  const lines: string[] = [];
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
  text: string, width: number | 'auto' | undefined
): {
  width: number,
  height: number,
} => {
  if (width === undefined) {
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
    (horizontalAlignment === 'FILL') ? undefined : 'auto'

  return computeMeasurementForTextHelper(node.text, maxWidth)
}

export const computeMeasurementsForFrame = (
  node: FrameNode,
  sizeOfFrameChild: (child: SceneNode) => { width: number, height: number, },
): { width: number, height: number } => {
  // We need to calculate the size of frames by measuring children.
  let widthFromChildren = 0
  let heightFromChildren = 0

  for (const child of node.children) {
    if (node.alignment.type === 'HORIZONTAL') {
      widthFromChildren += sizeOfFrameChild(child).width
      heightFromChildren = Math.max(heightFromChildren, sizeOfFrameChild(child).height)
    } else {
      widthFromChildren = Math.max(widthFromChildren, sizeOfFrameChild(child).width)
      heightFromChildren += sizeOfFrameChild(child).height
    }
  }

  widthFromChildren += node.padding * 2
  heightFromChildren += node.padding * 2

  if (node.children.length) {
    if (node.alignment.type === 'HORIZONTAL') {
      widthFromChildren += (node.children.length - 1) * node.spacing
    } else {
      heightFromChildren += (node.children.length - 1) * node.spacing
    }
  }

  return {
    width: node.fixedWidth != null ? node.fixedWidth : widthFromChildren,
    height: node.fixedHeight != null ? node.fixedHeight : heightFromChildren
  }
}
