import { FinalLayout, FrameNode, getTextLayout, RectangleNode, SceneNode, TextNode } from "./scene"



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

function * allNonGrowNodes(children: Array<SceneNode>, axis: 0 | 1) {
  for (const child of children) {
    const sizing = [child.width, child.height][axis]
    if (typeof sizing === 'number' || sizing === 'resize-to-fit') {
      yield child
    }
  }
}

function * allGrowNodes( children: Array<SceneNode>, axis: 0 | 1) {
  for (const child of children) {
    const sizing = [child.width, child.height][axis]
    if (sizing === 'grow') {
      yield child
    }
  }
}

function axesToWidthHeight<T>(alignment: 'horizontal' | 'vertical', main: T, cross: T): [T, T] {
  const isHorizontal = alignment === 'horizontal'
  if (isHorizontal) {
    return [main, cross]
  } else {
    return [cross, main]
  }
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
    finalLayout[node.id] = { x: 0, y: 0, size: [undefined, undefined] }
  }

  function bottomUp() {
    for (const [node, depth] of bottomUpNodes) {
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

          let [childWidth, childHeight] = finalLayout[child.id].size

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

          finalLayout[child.id].size = [childWidth, childHeight]

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
          finalLayout[node.id].size[0] = childrenWidth + 2 * node.padding
        } else if (node.width === 'grow') {
          // need to wait till our parent is sized
        } else {
          finalLayout[node.id].size[0] = node.width
        }

        if (node.height === 'resize-to-fit') {
          finalLayout[node.id].size[1] = childrenHeight + 2 * node.padding
        } else if (node.height === 'grow') {
          // need to wait till our parent is sized
        } else {
          finalLayout[node.id].size[1] = node.height
        }
      }

      console.log('  '.repeat(depth), 'bottom-up on ', node.id, '=>', finalLayout[node.id].size)
    }
  }

  function topDown() {
    for (const [node, depth] of topDownNodes) {
      if (node.type === 'frame') {
        const [width, height] = finalLayout[node.id].size
        if (width == null || height == null) {
          throw new Error("null values")
        }

        const isHorizontal = node.alignment === 'horizontal'
        const main = isHorizontal ? 0 : 1
        const cross = isHorizontal ? 1 : 0

        const innerSize = [width - node.padding * 2, height - node.padding * 2]

        let availableMainSpace = innerSize[main]
        let numChildrenMainGrow = 0
        for (const child of node.children) {
          const mainSetting = [child.width, child.height][main]
          if (mainSetting === 'grow') {
            numChildrenMainGrow ++
          } else {
            const childMainSize = finalLayout[child.id].size[main]
            if (childMainSize != null) {
              availableMainSpace -= childMainSize
            }
          }
        }

        const stretchMain = availableMainSpace / numChildrenMainGrow
        const stretchCross = innerSize[cross]

        // Stretch children
        for (const child of node.children) {
          const mainSetting = [child.width, child.height][main]
          const crossSetting = [child.width, child.height][cross]

          if (mainSetting === 'grow') {
            finalLayout[child.id].size[main] = stretchMain
          }
          if (crossSetting === 'grow') {
            finalLayout[child.id].size[cross] = stretchCross
          }
          if (child.type === 'text' && child.width === 'grow' && child.height === 'resize-to-fit') {
            const [stretchWidth, _] = axesToWidthHeight(node.alignment, stretchMain, stretchCross)
            const [textWidth, textHeight] = measureText(child, stretchWidth, undefined)
            finalLayout[child.id].size = [stretchWidth, textHeight]
          }
        }
      }

      console.log('  '.repeat(depth), 'top-down on ', node.id, '=>', finalLayout[node.id].size)
    }
  }

  console.log('')
  console.log('')
  console.log('')
  console.log('')
  console.log('')

  console.warn('bottom-up (immediate)')
  bottomUp()
  console.warn('top-down (immediate)')
  topDown()
  console.warn('bottom-up (immediate)')
  bottomUp()
  console.warn('top-down (immediate)')
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
  traverse(root, n => layout[n.id] = { x: 0, y: 0, size: [undefined, undefined] })

  const targetSizes: {[id: string]: {
    // parameters we computed layout with
    givenWidth: OptionalNumber,
    givenHeight: OptionalNumber,
    performLayout: boolean,

    // resulting layout
    width: OptionalNumber,
    height: OptionalNumber
  }} = {}

  const depths = Object.fromEntries(nodesByDepth(root).map(v => [v[0].id, v[1]]))

  function computeInternal(
    node: SceneNode, givenSize: [OptionalNumber, OptionalNumber],
    performLayout: boolean
  ): [OptionalNumber, OptionalNumber] {
    // Our parent supplies a suggested 'givenSize', for example, based on the space the node
    // can take up if it is set to 'grow'. To get a more accurate 'givenSize', let's update
    // it to match the numerical size set for the node.
    if (typeof node.width === 'number') {
      givenSize[0] = node.width
    }
    if (typeof node.height === 'number') {
      givenSize[1] = node.height
    }

    // If our parent doesn't have a good guess for given size, let's borrow our previous guess
    // from the cache.
    if (givenSize[0] == null) {
      givenSize[0] = targetSizes[node.id]?.width
    }
    if (givenSize[1] == null) {
      givenSize[1] = targetSizes[node.id]?.height
    }

    // Note: in the stretch implementation this is based on, there was a parentSize parameter.
    // We can ignore that beceause it's used to calculate values like `50%`.

    const [givenWidth, givenHeight] = givenSize

    console.log(' '.repeat(2 * depths[node.id]), 'visiting', node.id, 'of type', node.type, 'with given size: ', givenWidth, ',', givenHeight)

    const cachedResult = targetSizes[node.id]
    if (cachedResult &&
      isEqual(cachedResult.givenWidth, givenWidth) &&
      isEqual(cachedResult.givenHeight, givenHeight) &&
      (cachedResult.performLayout || !performLayout)
    ) {
      return [cachedResult.width, cachedResult.height]
    }

    function cacheTargetSize(size: [OptionalNumber, OptionalNumber]): [OptionalNumber, OptionalNumber] {
      targetSizes[node.id] = {
        givenWidth, givenHeight, width: size[0], height: size[1], performLayout
      }
      return [size[0], size[1]]
    }

    if (node.type === 'text' || node.type === 'rectangle') {
      const [ width, height ] = measureLeaf(node, givenWidth, givenHeight)
      console.log(' '.repeat(2 * depths[node.id]), 'measured', node.id, 'of type', node.type, '===>', width, ',', height)
      return cacheTargetSize([width, height])
    }

    const isHorizontal = node.alignment === 'horizontal'
    const main = isHorizontal ? 0 : 1
    const cross = isHorizontal ? 1 : 0

    const mainSetting = [node.width, node.height][main]
    const crossSetting = [node.width, node.height][cross]

    let givenInnerSize = givenSize.map(v => v ? v - node.padding * 2 : undefined)

    let measuredInnerCrossSize: OptionalNumber = undefined
    let measuredInnerMainSize: OptionalNumber = undefined

    if (mainSetting === 'resize-to-fit') {
      //////////////////////////////////////////////////////
      // Measure for a main-axis resize-to-fit container. //
      //////////////////////////////////////////////////////

      let sumOfChildrenMainSize = 0
      let maxOfChildrenCrossSize = 0

      for (const child of node.children) {
        const childSize = [child.width, child.height]
        let childMeasuredSize
        switch (childSize[main]) {
          case 'resize-to-fit': {
            childMeasuredSize = computeInternal(child,
              axesToWidthHeight(
                node.alignment,
                undefined /* parent main size depends on child */,
                givenInnerSize[cross]),
              performLayout)
            break;
          }
          case 'grow': {
            throw new Error('grow inside of resize is illegal (implicit sizing not supported)')
          }
          default: {
            childMeasuredSize = computeInternal(child,
              axesToWidthHeight(
                node.alignment,
                undefined /* parent main size depends on child */,
                givenInnerSize[cross]),
              performLayout)
            break
          }
        }
        if (childMeasuredSize[main] != null) {
          sumOfChildrenMainSize += childMeasuredSize[main]
        }
        if (childMeasuredSize[cross] != null) {
          maxOfChildrenCrossSize = Math.max(maxOfChildrenCrossSize, childMeasuredSize[cross])
        }
      }
      measuredInnerMainSize = mainSetting === 'resize-to-fit' ? sumOfChildrenMainSize : givenInnerSize[main]
      measuredInnerCrossSize = crossSetting === 'resize-to-fit' ? maxOfChildrenCrossSize : givenInnerSize[cross]

      ///////////
      // Done! //
      ///////////
    } else {
      ////////////////////////////////////////////////////////////
      // Measure children for a main-axis grow/fixed container. //
      ////////////////////////////////////////////////////////////

      let sumOfChildrenMainSize = 0
      let maxOfChildrenCrossSize = 0
      let measuredChildren = 0

      // First size the non-grow children so we can determine the remaining space for the grow children
      for (const child of allNonGrowNodes(node.children, main)) {
        const childSize = [child.width, child.height]
        const childMainSize = childSize[main]
        if (childMainSize === 'grow') {
          throw new Error('should have been skipped')
        }

        const childMeasuredSize = computeInternal(child,
          axesToWidthHeight(
            node.alignment,
            undefined, // child main-size depends on child contents
            givenInnerSize[cross]
          ), performLayout)

        if (childMeasuredSize[main] != null) {
          sumOfChildrenMainSize += childMeasuredSize[main]!
        }
        if (childMeasuredSize[cross] != null) {
          maxOfChildrenCrossSize = Math.max(maxOfChildrenCrossSize, childMeasuredSize[cross]!)
        }

        measuredChildren ++
      }

      const availableMainSpace = givenInnerSize[main] != null ? givenInnerSize[main]! - sumOfChildrenMainSize : undefined
      const percentPerChild = 1 / (node.children.length - measuredChildren)

      // Now that we have remaining space for the grow children, size those
      for (const child of allGrowNodes(node.children, main)) {
        const childMeasuredSize = computeInternal(child,
          axesToWidthHeight(
            node.alignment,
            // child main-size fills remaining space left by siblings
            availableMainSpace != null ? availableMainSpace * percentPerChild : undefined,
            givenInnerSize[cross]
          ), performLayout)

        if (childMeasuredSize[cross] != null) {
          maxOfChildrenCrossSize = Math.max(maxOfChildrenCrossSize, childMeasuredSize[cross]!)
        }
      }

      measuredInnerMainSize = givenInnerSize[main]
      measuredInnerCrossSize = crossSetting === 'resize-to-fit' ? maxOfChildrenCrossSize : givenInnerSize[cross]

      ///////////
      // Done! //
      ///////////
    }

    const measuredMainSize = measuredInnerMainSize != null ? measuredInnerMainSize + node.padding * 2 : undefined
    const measuredCrossSize = measuredInnerCrossSize != null ? measuredInnerCrossSize + node.padding * 2 : undefined
    const [measuredWidth, measuredHeight] = axesToWidthHeight(node.alignment, measuredMainSize, measuredCrossSize)

    console.log(' '.repeat(2 * depths[node.id]), 'measured', node.id, 'of type', node.type, '===>', measuredWidth, ',', measuredHeight)

    if (!performLayout) {
      // We're just measuring this phase, skip arrangment below.
      return cacheTargetSize([measuredWidth, measuredHeight])
    }

    if (measuredWidth == null || measuredHeight == null) {
      throw new Error('need full measurement to run layout')
    }

    let x = node.padding
    let y = node.padding

    for (const child of node.children) {
      const [childWidth, childHeight] = computeInternal(
        child,
        [
          targetSizes[child.id].givenWidth,
          targetSizes[child.id].givenHeight
        ], performLayout)
      if (childWidth == null || childHeight == null) {
        throw new Error('need full child measurements')
      }

      layout[child.id] = {
        x, y, size: [childWidth, childHeight]
      }

      x += node.alignment === 'horizontal' ? childWidth : 0
      y += node.alignment === 'vertical' ? childHeight : 0
    }

    return cacheTargetSize([measuredWidth, measuredHeight])
  }

  console.log('')
  console.log('')
  console.log('')
  console.log('')
  console.log('')

  console.warn('first pass (recursive)')

  const [firstPassWidth, firstPassHeight] = computeInternal(
    root,
    [numberOrUndefined(root.width), numberOrUndefined(root.height)],
    false)

  console.warn('second pass (recursive)')

  const [rootWidth, rootHeight] = computeInternal(
    root,
    [firstPassWidth, firstPassHeight],
    true)

  layout[root.id] = {
    x: 0, y: 0, size: [rootWidth, rootHeight]
  }
  
  return layout
}
