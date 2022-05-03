import { computeMeasurementsForFrame, computeMeasurementsForRectangle, computeMeasurementsForText, FinalLayout, FrameNode, SceneNode } from "./scene"

enum PerformLayout {
  NO,
  YES
}

interface SizingResult {
  width: number,
  height: number,
}

export const computeLayoutViaLayoutLayout = (root: SceneNode): FinalLayout => {
  const widthsForTextNeedingReflow: { [id: string]: number } = {}
  const finalLayout: FinalLayout = {}

  let sizingCache = {}

  const layout = (node: SceneNode, parent: FrameNode | undefined, performLayout: PerformLayout): SizingResult => {
    if (node.id in sizingCache && performLayout === PerformLayout.NO) {
      return sizingCache[node.id]
    }

    let nodeSize
    switch (node.type) {
      case 'rectangle':
        nodeSize = computeMeasurementsForRectangle(node)
        break
      case 'text':
        const fixedWidthForReflow = widthsForTextNeedingReflow[node.id]
        nodeSize = computeMeasurementsForText(node,
          parent ? parent.alignment.horizontalAlignment : undefined,
          fixedWidthForReflow != null ? fixedWidthForReflow : undefined)
        break
      case 'frame':
        // During the first layout method call, we run this recursively to compute measurements (eg similar
        // to the measure pass of the measure/arrange algorithm). During the second layout method call, we
        // don't run this call because the sizing should been cached already.
        nodeSize = computeMeasurementsForFrame(node, (child: SceneNode) => layout(child, node, PerformLayout.NO))
        break
    }

    if (performLayout == PerformLayout.NO) {
      sizingCache[node.id] = nodeSize
      return nodeSize
    }

    if (node.type === 'frame') {
      let x = node.padding
      let y = node.padding

      for (const child of node.children) {
        // Perform layout on grandchildren and get current child size
        const childSizing = layout(child, node, PerformLayout.YES)
        const needsTextReflow = child.type === 'text' && node.alignment.horizontalAlignment === 'FILL'

        const finalWidth = node.alignment.horizontalAlignment === 'FILL' ? nodeSize.width - node.padding * 2 : childSizing.width
        const finalHeight = node.alignment.verticalAlignment === 'FILL' ? nodeSize.height - node.padding * 2 : childSizing.height

        finalLayout[child.id] = {
          x, y,
          width: finalWidth,
          height: finalHeight,
        }

        if (needsTextReflow) {
          widthsForTextNeedingReflow[child.id] = finalWidth
        }

        if (node.alignment.type === 'HORIZONTAL') {
          x += childSizing.width + node.spacing
        } else {
          y += childSizing.height + node.spacing
        }
      }
    }

    return nodeSize
  }

  // Our first layout call serves the same purpose as a measurement pass in the measure/arrange
  // algorithm. Here, we figure out the sizes of all containers based on the sizes of their children.
  layout(root, undefined, PerformLayout.NO)

  // Our second layout call finalizes the layout (arrangement / resizing). It re-uses the cached
  // sizing that we calculated in that first layout call.
  let rootSize = layout(root, undefined, PerformLayout.YES)

  if (widthsForTextNeedingReflow) {
    // TODO: we clear the sizing cache so that all sizes dependent on reflowed text will be
    // recomputed. We could be smarter and figure out which sizes need to be cleared and only
    // clear those.
    sizingCache = {}
    layout(root, undefined, PerformLayout.NO)
    rootSize = layout(root, undefined, PerformLayout.YES)
  }

  finalLayout[root.id] = {
    x: 0, y: 0, ... rootSize
  }

  return finalLayout
}
