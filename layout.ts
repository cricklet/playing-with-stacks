import { FinalLayout, getTextLayout, RectangleNode, SceneNode, TextNode } from "./scene"



function traverse(node: SceneNode, f: (n: SceneNode) => void) {
  f(node)

  if (node.type === 'frame') {
    for (const child of node.children) {
      traverse(child, f)
    }
  }
}

function nodesByDepth(root: SceneNode) {
  const result: Array<[SceneNode, number]> = []

  function traverse(node: SceneNode, depth: number) {
    result.push([node, depth])

    if (node.type === 'frame') {
      for (const child of node.children) {
        traverse(child, depth + 1)
      }
    }
  }

  traverse(root, 0)
  return result
}

function measureText(
  node: TextNode,
  parentWidth: number | undefined,
  parentHeight: number | undefined
): [number | undefined, number | undefined] {
  const fixedWidth: number | undefined =
    typeof node.width === 'number' ? node.width :
    node.width === 'grow' && parentWidth != null ? parentWidth :
    undefined

  const fixedHeight: number | undefined =
    typeof node.height === 'number' ? node.height :
    node.height === 'grow' && parentHeight != null ? parentHeight :
    undefined

  if (fixedWidth != null && fixedHeight != null) {
    return [fixedWidth, fixedHeight]
  }

  if (fixedWidth != null) {
    if (node.height === 'resize-to-fit') {
      const {height} = getTextLayout(node.text, fixedWidth)
      return [fixedWidth, height]
    }
  }

  if (fixedHeight != null) {
    if (node.width === 'resize-to-fit') {
      const {width} = getTextLayout(node.text)
      return [width, fixedHeight]
    }
  }

  if (node.width === 'resize-to-fit' && node.height === 'resize-to-fit') {
    const {width, height} = getTextLayout(node.text)
    return [width, height]
  }

  return [undefined, undefined]
}

export function computeLayoutViaImmediate(root: SceneNode): FinalLayout {
  const bottomUpNodes = nodesByDepth(root)
  bottomUpNodes.sort((a, b) => b[1] - a[1])

  const topDownNodes = nodesByDepth(root)
  topDownNodes.sort((a, b) => a[1] - b[1])

  const finalLayout: FinalLayout = {}
  for (const [node, _] of bottomUpNodes) {
    finalLayout[node.id] = { x: 0, y: 0, width: undefined, height: undefined }
  }

  function bottomUp() {
    for (const [node, _] of bottomUpNodes) {
      if (node.type === 'frame') {
        // Figure out my size & align children
        let x = node.padding
        let y = node.padding

        const horizontalAlign = node.alignment === 'horizontal'
        const verticalAlign = node.alignment === 'vertical'

        let childrenWidth = 0
        let childrenHeight = 0

        for (const child of node.children) {
          finalLayout[child.id].x = x
          finalLayout[child.id].y = y

          let childWidth = finalLayout[child.id].width
          let childHeight = finalLayout[child.id].height

          if (typeof child.width === 'number' && childWidth == null) {
            childWidth = child.width
          }
          if (typeof child.height === 'number' && childHeight == null) {
            childHeight = child.height
          }

          if (child.type === 'text' && (childWidth == null || childHeight == null)) {
            const [textWidth, textHeight] = measureText(child, undefined, undefined)
            childWidth = textWidth
            childHeight = textHeight
          }

          finalLayout[child.id].width = childWidth
          finalLayout[child.id].height = childHeight

          // make sure we have a value here
          childWidth = childWidth != null ? childWidth : 0
          childHeight = childHeight != null ? childHeight : 0

          x += horizontalAlign ? childWidth : 0
          y += verticalAlign ? childHeight : 0

          childrenWidth = horizontalAlign ?
            childrenWidth + childWidth :
            Math.max(childrenWidth, childWidth)

          childrenHeight = verticalAlign ?
            childrenHeight + childHeight :
            Math.max(childrenHeight, childHeight)
        }

        if (node.width === 'resize-to-fit') {
          finalLayout[node.id].width = childrenWidth + 2 * node.padding
        } else if (node.width === 'grow') {
          // need to wait till our parent is sized
        } else {
          finalLayout[node.id].width = node.width
        }

        if (node.height === 'resize-to-fit') {
          finalLayout[node.id].height = childrenHeight + 2 * node.padding
        } else if (node.height === 'grow') {
          // need to wait till our parent is sized
        } else {
          finalLayout[node.id].height = node.height
        }
      }
    }
  }

  function topDown() {
    for (const [node, _] of topDownNodes) {
      if (node.type === 'frame') {
        const {width, height} = finalLayout[node.id]
        if (width == null || height == null) {
          throw new Error("null values")
        }

        const stretchWidth = width - node.padding * 2
        const stretchHeight = height - node.padding * 2

        // Stretch children
        for (const child of node.children) {
          if (child.width === 'grow') {
            finalLayout[child.id].width = stretchWidth
          }
          if (child.height === 'grow') {
            finalLayout[child.id].height = stretchHeight
          }
          if (child.type === 'text' && child.width === 'grow' && child.height === 'resize-to-fit') {
            const [textWidth, textHeight] = measureText(child, stretchWidth, stretchHeight)
            finalLayout[child.id].width = stretchWidth
            finalLayout[child.id].height = textHeight
          }
        }
      }
    }
  }

  bottomUp()
  topDown()
  bottomUp()
  topDown()

  return finalLayout
}

function numberOrUndefined(x: number | any): number | undefined {
  if (typeof x === 'number') {
    return x
  }
  return undefined
}

function isEqual(x: number | undefined, y: number | undefined): boolean {
  return Math.abs(x - y) < 0.001
}

type OptionalNumber = number | undefined

function measureLeaf(node: TextNode | RectangleNode, givenWidth: OptionalNumber, givenHeight: OptionalNumber): [OptionalNumber, OptionalNumber] {
  if (node.type === 'text') {
    const [ width, height ] = measureText(node, givenWidth, givenHeight)
    return [ width, height ]
  } else if (node.type === 'rectangle') {
    let width = numberOrUndefined(node.width)
    let height = numberOrUndefined(node.height)
    if (node.width === 'grow') {
      width = givenWidth
    }
    if (node.height === 'grow') {
      height = givenHeight
    }
    return [ width, height ]
  }

  return [undefined, undefined]
}

export function computeLayoutViaRecursive(root: SceneNode): FinalLayout {
  const layout: FinalLayout = {}
  traverse(root, n => layout[n.id] = { x: 0, y: 0, width: undefined, height: undefined })

  const cache: {[id: string]: {
    // parameters we computed layout with
    givenWidth: OptionalNumber,
    givenHeight: OptionalNumber,
    parentWidth: OptionalNumber,
    parentHeight: OptionalNumber,

    // resulting layout
    width: OptionalNumber,
    height: OptionalNumber
  }} = {}

  function computeInternal(
    node: SceneNode, givenWidth: OptionalNumber, givenHeight: OptionalNumber,
    parentWidth: OptionalNumber, parentHeight: OptionalNumber,
    performLayout: boolean
  ): [OptionalNumber, OptionalNumber] {
    const cachedResult = cache[node.id]
    if (cachedResult &&
      isEqual(cachedResult.givenWidth, givenWidth) &&
      isEqual(cachedResult.givenHeight, givenHeight) &&
      isEqual(cachedResult.parentWidth, parentWidth) &&
      isEqual(cachedResult.parentHeight, parentHeight)
    ) {
      return [cachedResult.width, cachedResult.height]
    }

    if (node.type === 'text' || node.type === 'rectangle') {
      const [ width, height ] = measureLeaf(node, givenWidth, givenHeight)
      cache[node.id] = {
        givenWidth, givenHeight, parentWidth, parentHeight, width, height
      }
      return [width, height]
    }

    let containerWidth = 0
    let containerHeight = 0
    let innerWidth = 0
    let innerHeight = 0
  }

  computeInternal(
    root,
    numberOrUndefined(root.width),
    numberOrUndefined(root.height),
    undefined,
    undefined,
    false)

  computeInternal(
    root,
    layout[root.id].width,
    layout[root.id].height,
    undefined,
    undefined,
    true)
  
  return layout
}

export function computeLayoutViaMeasureArrange(root: SceneNode): FinalLayout {
  const finalLayout: FinalLayout = {}

  return finalLayout
}
