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
    performLayout: boolean,

    // resulting layout
    width: OptionalNumber,
    height: OptionalNumber
  }} = {}

  function computeLayout(
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

    // Note: in the stretch implementation this is based on, there was a parentSize parameter.
    // We can ignore that beceause it's used to calculate values like `50%`.

    const [givenWidth, givenHeight] = givenSize

    const cachedResult = cache[node.id]
    if (cachedResult &&
      isEqual(cachedResult.givenWidth, givenWidth) &&
      isEqual(cachedResult.givenHeight, givenHeight) &&
      (cachedResult.performLayout || !performLayout)
    ) {
      return [cachedResult.width, cachedResult.height]
    }

    function cacheResult(size: [OptionalNumber, OptionalNumber]): [OptionalNumber, OptionalNumber] {
      cache[node.id] = {
        givenWidth, givenHeight, width: size[0], height: size[1], performLayout
      }
      return [size[0], size[1]]
    }

    if (node.type === 'text' || node.type === 'rectangle') {
      const [ width, height ] = measureLeaf(node, givenWidth, givenHeight)
      console.warn('measured', node.id, 'of type', node.type, 'with given size: ', givenWidth, ',', givenHeight, '===>', width, ',', height)
      return cacheResult([width, height])
    }

    const isHorizontal = node.alignment === 'horizontal'
    const main = isHorizontal ? 0 : 1
    const cross = isHorizontal ? 1 : 0

    const mainSetting = [node.width, node.height][main]
    const crossSetting = [node.width, node.height][cross]

    function mainAndCross<T>(main: T, cross: T): [T, T] {
        if (isHorizontal) {
          return [main, cross]
        } else {
          return [cross, main]
        }
    }

    let givenInnerSize = givenSize.map(v => v ? v - node.padding * 2 : undefined)

    // Try to figure out the cross sizing. Note, we might not have enough info to do this. By the second
    // layout pass, when we have a given cross size from our parent, there should be enough info.
    let measuredInnerCrossSize: OptionalNumber = undefined
    if (crossSetting === 'resize-to-fit') {
      let childrenMaxCrossSize = 0

      for (const child of node.children) {
        const childSize = [child.width, child.height]
        let childMeasuredSize
        switch (childSize[cross]) {
          case 'resize-to-fit': {
            childMeasuredSize = computeLayout(child, mainAndCross(givenInnerSize[main], givenInnerSize[cross] /* not needed */), performLayout)
            break;
          }
          case 'grow': {
            childMeasuredSize = computeLayout(child, mainAndCross(givenInnerSize[main], givenInnerSize[cross]), performLayout)
            break;
          }
          default: {
            childMeasuredSize = computeLayout(child, mainAndCross(givenInnerSize[main], givenInnerSize[cross] /* not needed */), performLayout)
            break
          }
        }
        if (childMeasuredSize[cross] != null) {
          childrenMaxCrossSize = Math.max(childrenMaxCrossSize, childMeasuredSize[cross])
        }
      }
      measuredInnerCrossSize = childrenMaxCrossSize
    } else {
      measuredInnerCrossSize = givenInnerSize[cross]
    }

    const measuredCrossSize = measuredInnerCrossSize != null ? measuredInnerCrossSize + node.padding * 2 : undefined
    let measuredMainSize: OptionalNumber = 0

    if (mainSetting === 'resize-to-fit') {
      // Try to figure out the main sizing by adding up the main sizes of each child.
      // Note, if we failed to compute the cross sizing in the previous step,
      // we won't have enough info to do this.
      let sumOfChildrenMainSize = 0
      for (const child of node.children) {
        const childSize = [child.width, child.height]
        let childMeasuredSize
        switch (childSize[main]) {
          case 'resize-to-fit': {
            childMeasuredSize = computeLayout(child, mainAndCross(givenInnerSize[main] /* not needed */, measuredInnerCrossSize), performLayout)
            break;
          }
          case 'grow': {
            throw new Error('no grow inside of resize')
          }
          default: {
            childMeasuredSize = computeLayout(child, mainAndCross(givenInnerSize[main] /* not needed */, measuredInnerCrossSize), performLayout)
            break
          }
        }
        if (childMeasuredSize[main] != null) {
          sumOfChildrenMainSize += childMeasuredSize[main]
        }
      }
      measuredMainSize = sumOfChildrenMainSize + node.padding * 2
    } else {
      // We need the main size of the container to compute the size of the grow children.
      // We'll assume we got the right info from our parent.
      measuredMainSize = givenSize[main]

      // Then, size the non-grow children so we know the remaining available space.
      let sumChildMainSize = 0
      let measuredChildren = 0
      for (const child of node.children) {
        const childSize = [child.width, child.height]
        let childMeasuredSize
        switch (childSize[main]) {
          case 'grow': {
            break;
          }
          case 'resize-to-fit':
          default: {
            childMeasuredSize = computeLayout(child, mainAndCross(givenInnerSize[main] /* not needed */, measuredInnerCrossSize), performLayout)
            measuredChildren ++
            if (childMeasuredSize[main] != null) {
              sumChildMainSize += childMeasuredSize[main]
            }
            break
          }
        }
      }

      const availableMainSpace = givenInnerSize[main] != null ? givenInnerSize[main]! - sumChildMainSize : undefined
      const spacePerGrowChild = availableMainSpace != null ? availableMainSpace * (node.children.length - measuredChildren) / node.children.length : undefined

      // Next, we size the grow-children based on the remaining space.
      for (const child of node.children) {
        const childSize = [child.width, child.height]
        let childMeasuredSize
        switch (childSize[main]) {
          case 'grow': {
            break;
          }
          case 'resize-to-fit':
          default: {
            childMeasuredSize = computeLayout(child, mainAndCross(spacePerGrowChild, measuredCrossSize), performLayout)
            break
          }
        }
      }
    }

    console.warn('computing container measurements', node.id, 'of type', node.type, 'with given size: ', mainAndCross(measuredMainSize, measuredCrossSize)[0], ',', mainAndCross(measuredMainSize, measuredCrossSize)[1])

    if (!performLayout) {
      return cacheResult(mainAndCross(measuredMainSize, measuredCrossSize))
    }

    if (measuredMainSize == null || measuredCrossSize == null) {
      throw new Error('need full measurement to run layout')
    }

    let x = node.padding
    let y = node.padding

    for (const child of node.children) {
      const [childWidth, childHeight] = computeLayout(child, [cache[child.id].givenWidth, cache[child.id].givenHeight], performLayout)
      if (childWidth == null || childHeight == null) {
        throw new Error('need full child measurements')
      }

      layout[child.id] = {
        x, y, width: childWidth, height: childHeight
      }

      x += node.alignment === 'horizontal' ? childWidth : 0
      y += node.alignment === 'vertical' ? childHeight : 0
    }

    return cacheResult(mainAndCross(measuredMainSize, measuredCrossSize))
  }

  console.warn('first pass')

  const [firstPassWidth, firstPassHeight] = computeLayout(
    root,
    [numberOrUndefined(root.width), numberOrUndefined(root.height)],
    false)

  console.log(JSON.stringify(cache, null, 2))
  console.log(JSON.stringify(root, null, 2))
  console.log(JSON.stringify(layout, null, 2))
  
  console.warn('second pass')

  const [rootWidth, rootHeight] = computeLayout(
    root,
    [firstPassWidth, firstPassHeight],
    true)

  console.log(JSON.stringify(cache, null, 2))
  console.log(JSON.stringify(root, null, 2))
  console.log(JSON.stringify(layout, null, 2))
  
  layout[root.id] = {
    x: 0, y: 0, width: rootWidth, height: rootHeight
  }
  
  return layout
}
