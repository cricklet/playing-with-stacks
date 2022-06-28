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
  if (x == null || y == null) {
    if (x === y) return true;
    else return false;
  }
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

    // resulting layout
    width: OptionalNumber,
    height: OptionalNumber
  }} = {}

  function computeInternal(
    node: SceneNode, givenWidth: OptionalNumber, givenHeight: OptionalNumber,
    performLayout: boolean
  ): [OptionalNumber, OptionalNumber] {
    // Our parent computes givenWidth / givenHeight -- this is the space node can take
    // up if it so chooses.
    //
    // Previously, there was a parentWidth and parentHeight parameter. We can ignore those
    // because they're used to calculate css values like `50%`.

    const cachedResult = cache[node.id]
    if (cachedResult &&
      isEqual(cachedResult.givenWidth, givenWidth) &&
      isEqual(cachedResult.givenHeight, givenHeight)
    ) {
      return [cachedResult.width, cachedResult.height]
    }

    function cacheResult(width: OptionalNumber, height: OptionalNumber): [OptionalNumber, OptionalNumber] {
      cache[node.id] = {
        givenWidth, givenHeight, width, height
      }
      return [width, height]
    }

    if (node.type === 'text' || node.type === 'rectangle') {
      console.warn('measuring', node.id, 'of type', node.type, 'with given size: ', givenWidth, ',', givenHeight)
      const [ width, height ] = measureLeaf(node, givenWidth, givenHeight)
      return cacheResult(width, height)
    }

    console.warn('computing container measurements', node.id, 'of type', node.type, 'with given size: ', givenWidth, ',', givenHeight)

    let availableWidth = typeof node.width === 'number' ? node.width - node.padding * 2 : givenWidth ? givenWidth - node.padding * 2 : undefined
    let availableHeight = typeof node.height === 'number' ? node.height - node.padding * 2 : givenHeight ? givenHeight - node.padding * 2 : undefined

    let containerWidth: OptionalNumber = 0
    let containerHeight: OptionalNumber = 0

    let childrenWidth = 0
    let childrenHeight = 0

    const horizontalAlign = node.alignment === 'horizontal'
    const verticalAlign = node.alignment === 'vertical'

    let measuredChildren = 0

    for (const child of node.children) {
      if (horizontalAlign) {
        if (child.width !== 'grow') {
          // We can know the width of the child. We will know the height if availableHeight is valid (or if it is trivial)
          let [childWidth, childHeight] = computeInternal(child, undefined, availableHeight, performLayout)
          if (childWidth == null && availableHeight) {
            throw new Error('should know child width')
          }
          childrenWidth += childWidth ? childWidth : 0
          childrenHeight = Math.max(childrenHeight, childHeight ? childHeight : 0)
          measuredChildren ++
        }
      }
      if (verticalAlign) {
        if (child.height !== 'grow') {
          // We can know the height of the child
          let [childWidth, childHeight] = computeInternal(child, availableWidth, undefined, performLayout)
          if (childHeight == null && availableWidth) {
            throw new Error('should know child height')
          }
          childrenWidth = Math.max(childrenWidth, childWidth ? childWidth : 0)
          childrenHeight += childHeight ? childHeight : 0
          measuredChildren ++
        }
      }
    }

    availableWidth = availableWidth && horizontalAlign ? availableWidth - childrenWidth : availableWidth
    availableHeight = availableHeight && verticalAlign ? availableHeight - childrenHeight : availableHeight

    const percentToGrow = (node.children.length - measuredChildren) / node.children.length

    for (const child of node.children) {
      if (horizontalAlign) {
        if (child.width === 'grow') {
          const remainingWidth = availableWidth ? availableWidth * percentToGrow : undefined
          let [childWidth, childHeight] = computeInternal(child, remainingWidth, availableHeight, performLayout)

          childrenWidth += childWidth ? childWidth : 0
          childrenHeight = Math.max(childrenHeight, childHeight ? childHeight : 0)

          if (node.width === 'resize-to-fit') {
            throw new Error('grow inside resize-to-fit is disallowed')
          }
        }
      }
      if (verticalAlign) {
        if (child.height === 'grow') {
          const remainingHeight = availableHeight ? availableHeight * percentToGrow : undefined
          let [childWidth, childHeight] = computeInternal(child, availableWidth, remainingHeight, performLayout)

          childrenWidth = Math.max(childrenWidth, childWidth ? childWidth : 0)
          childrenHeight += childHeight ? childHeight : 0

          if (node.height === 'resize-to-fit') {
            throw new Error('grow inside resize-to-fit is disallowed')
          }
        }
      }
    }

    if (node.width === 'resize-to-fit') {
      containerWidth = childrenWidth + 2 * node.padding
    } else if (node.width === 'grow') {
      containerWidth = givenWidth
    } else {
      containerWidth = node.width
    }

    if (node.height === 'resize-to-fit') {
      containerHeight = childrenHeight + 2 * node.padding
    } else if (node.height === 'grow') {
      containerHeight = givenHeight
    } else {
      containerHeight = node.height
    }

    if (!performLayout) {
      return cacheResult(containerWidth, containerHeight)
    }

    if (containerWidth == null || containerHeight == null) {
      throw new Error('need full measurement to run layout')
    }

    let x = node.padding
    let y = node.padding

    for (const child of node.children) {
      const [childWidth, childHeight] = computeInternal(child, cache[child.id].givenWidth, cache[child.id].givenHeight, performLayout)
      if (childWidth == null || childHeight == null) {
        throw new Error('need full child measurements')
      }

      layout[child.id] = {
        x, y, width: childWidth, height: childHeight
      }

      x += horizontalAlign ? childWidth : 0
      y += verticalAlign ? childHeight : 0
    }

    return cacheResult(containerWidth, containerHeight)
  }

  console.warn('first pass')

  const [firstPassWidth, firstPassHeight] = computeInternal(
    root,
    numberOrUndefined(root.width),
    numberOrUndefined(root.height),
    false)

  console.warn('second pass')

  const [rootWidth, rootHeight] = computeInternal(
    root,
    firstPassWidth,
    firstPassHeight,
    true)

  console.log(JSON.stringify(cache, null, 2))
  console.log(JSON.stringify(root, null, 2))
  console.log(JSON.stringify(layout, null, 2))
  
  layout[root.id] = {
    x: 0, y: 0, width: rootWidth, height: rootHeight
  }
  
  return layout
}
