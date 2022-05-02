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
  const textNeedingReflow: Set<string> = new Set<string>()
  const finalLayout: FinalLayout = {}

  const layout = (node: SceneNode, parent: FrameNode | undefined, performLayout: PerformLayout): SizingResult => {
    if (node.type === 'rectangle') {
      return computeMeasurementsForRectangle(node)
    } else if (node.type === 'text') {
      const nodeLayout = finalLayout[node.id]

      if (nodeLayout && !textNeedingReflow.has(node.id)) {
        return { width: nodeLayout.width, height: nodeLayout.height }
      } else {
        return computeMeasurementsForText(node,
          parent ? parent.alignment.horizontalAlignment : undefined,
          nodeLayout ? nodeLayout.width : undefined)
      }
    }

    const frameSize = computeMeasurementsForFrame(node,
      (child: SceneNode) => layout(child, node, PerformLayout.NO))

    if (performLayout == PerformLayout.NO) {
      return frameSize
    }

    let x = node.padding
    let y = node.padding

    for (const child of node.children) {
      // Perform layout on grandchildren and get current child size
      const childSizing = layout(child, node, PerformLayout.YES)
      const needsTextReflow = child.type === 'text' && node.alignment.horizontalAlignment === 'FILL'

      finalLayout[child.id] = {
        x, y,
        width: node.alignment.horizontalAlignment === 'FILL' ? frameSize.width - node.padding * 2 : childSizing.width,
        height: node.alignment.verticalAlignment === 'FILL' ? frameSize.height - node.padding * 2 : childSizing.height,
      }

      if (needsTextReflow) {
        textNeedingReflow.add(child.id)
      }

      if (node.alignment.type === 'HORIZONTAL') {
        x += childSizing.width + node.spacing
      } else {
        y += childSizing.height + node.spacing
      }
    }

    return frameSize
  }

  let rootSize = layout(root, undefined, PerformLayout.YES)
  if (textNeedingReflow) {
    rootSize = layout(root, undefined, PerformLayout.YES)
  }

  finalLayout[root.id] = {
    x: 0, y: 0, ... rootSize
  }

  return finalLayout
}
