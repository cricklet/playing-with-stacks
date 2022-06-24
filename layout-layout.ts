import { computeMeasurementForTextHelper, FinalLayout, FrameNode, initialHeight, initialWidth, SceneNode } from "./scene"

enum PerformLayout {
  NO,
  YES
}

interface Size {
  width?: number,
  height?: number,
}

interface Point {
  x?: number,
  y?: number
}

type SizeCache = {[id: string]: Size}

// interface Layout {
//   id: string,
//   size: Size,
//   location: Point,
//   children: Layout[]
// }
// interface ComputeResult {
//   size: Size,
//   children: Layout[]
// }

const computeMeasurementsForFrame = (
  node: FrameNode,
  parent: FrameNode | undefined
  sizeOfFrameChild: (child: SceneNode) => { width: number, height: number, },
): { width: number, height: number } => {
  let idealWidth: number = undefined
  let idealHeight: number = undefined
  if (parent?.alignment.horizontalAlignment === 'FILL' && idealSizeFromParent.width) {
    idealWidth = idealSizeFromParent.width
  }
  if (parent?.alignment.verticalAlignment === 'FILL' && idealSizeFromParent.height) {
    idealHeight = idealSizeFromParent.height
  }

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

const measure = (
  root: SceneNode,
  measureCache: SizeCache
): SizeCache => {
  
  const measureHelper = (node: SceneNode, parent: FrameNode | undefined, idealSizeFromParent: Size): Size => {
    function cacheResult(size: Size) {
      measureCache[node.id] = size
      return size
    }

    switch (node.type) {
      case 'rectangle': {
        let idealWidth: number | undefined = node.width
        let idealHeight: number | undefined = node.height
        if (parent?.alignment.horizontalAlignment === 'FILL' && idealSizeFromParent.width) {
          idealWidth = idealSizeFromParent.width
        }
        if (parent?.alignment.verticalAlignment === 'FILL' && idealSizeFromParent.height) {
          idealHeight = idealSizeFromParent.height
        }

        return cacheResult({ width: idealWidth, height: idealHeight }) // trivial
      }
      case 'text': {
        let idealWidth: number | 'auto' | undefined = undefined
        if (node.fixedWidth) idealWidth = node.fixedWidth
        else if (parent?.alignment.horizontalAlignment === 'FILL') {
          if (idealSizeFromParent.width) idealWidth = idealSizeFromParent.width
          else idealWidth = undefined
        } else {
          idealWidth = 'auto'
        }
  
        return cacheResult(computeMeasurementForTextHelper(node.text, idealWidth))
      }
      case 'frame': {
        let idealChildWidth: number | undefined = undefined
        let idealChildHeight: number | undefined = undefined
  
        if (node.fixedWidth) {
          idealChildWidth = node.fixedWidth - node.padding * 2;
        } else if (node?.alignment.horizontalAlignment === 'FILL' && idealSizeFromParent.width) {
          idealChildWidth = idealSizeFromParent.width - node.padding * 2;
        }

        if (node.fixedHeight) {
          idealChildHeight = node.fixedHeight - node.padding * 2;
        } else if (node?.alignment.verticalAlignment === 'FILL' && idealSizeFromParent.height) {
          idealChildHeight = idealSizeFromParent.height - node.padding * 2;
        }

        console.log(parent?.alignment.horizontalAlignment, idealSizeFromParent, idealChildWidth)

        return cacheResult(computeMeasurementsForFrame(node,
          (child: SceneNode) => {
            const {width, height} = measureHelper(child, node, { width: idealChildWidth, height: idealChildHeight})
            return {
              width: width || 0,
              height: height || 0
            }
          }))
      }
    }
  }

  measureHelper(root, undefined, measureCache[root.id] || {width: undefined, height: undefined})
  return measureCache
}

const layout = (
  root: SceneNode,
  measureCache: SizeCache
): FinalLayout => {
  const finalLayout: FinalLayout = {}

  const traverse = (node: SceneNode) => {
    if (node.type === 'frame') {
      let x = node.padding
      let y = node.padding

      for (const child of node.children) {
        const childSizing = measureCache[child.id]

        if (childSizing.width == null || childSizing.height == null) {
          throw new Error('need to measure everything first')
        }

        finalLayout[child.id] = {
          x, y,
          width: childSizing.width,
          height: childSizing.height,
        }

        if (node.alignment.type === 'HORIZONTAL') {
          x += childSizing.width + node.spacing
        } else {
          y += childSizing.height + node.spacing
        }

        traverse(child)
      }
    }
  }


  const { width, height } = measureCache[root.id]
  if (width == null || height == null) {
    throw new Error('need to measure everything first')
  }

  finalLayout[root.id] = {
    x: 0, y: 0,
    width, height
  }

  traverse(root)

  return finalLayout
}

export const computeLayoutViaLayoutLayout = (
  root: SceneNode
): FinalLayout => {
  const measureCache: SizeCache = {}
  const firstPass = measure(root, measureCache)
  const secondPass = measure(root, measureCache)

  // Copy the results into finalLayout
  return layout(root, secondPass)
}
