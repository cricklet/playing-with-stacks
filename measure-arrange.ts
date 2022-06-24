import { computeMeasurementsForFrame, computeMeasurementsForText, FinalLayout, FrameNode, SceneNode } from "./scene"

interface Layout {
  [id: string]: NodeLayout
}

interface NodeLayout {
  // In the first layout pass (bottom up, child => root), we optimistically estimate the sizes of all nodes.
  // This doesn't take into account nodes that will be stretched due to a `fill` alignment.
  firstPass?: FirstPassLayout,

  // In the second layout pass (top down, root => children), we determine the locations of all nodes, and stretch
  // all nodes that are found within a `fill` alignment.
  secondPass?: SecondPassLayout
}

interface FirstPassLayout {
  width: number,
  height: number,
}

interface SecondPassLayout {
  x: number,
  y: number,
  width: number,
  height: number,
  isDirty: boolean
}

export const computeLayoutViaMeasureArrange = (root: SceneNode): FinalLayout => {
  const _layout: Layout = {}
  const getOrAddLayout = (node: SceneNode): NodeLayout => {
    if (node.id in _layout) {
      return _layout[node.id]
    } else {
      _layout[node.id] = {}
      return _layout[node.id]
    }
  }
  const getLayout = (node:SceneNode): NodeLayout => {
    if (node.id in _layout) {
      return _layout[node.id]
    } else {
      throw Error()
    }
  }

  const firstLayoutPass = (node: SceneNode, parent?: FrameNode) => {
    // In the first layout pass (bottom up, child => root), we optimistically estimate the sizes of all nodes.
    // This doesn't take into account nodes that will be stretched due to a `fill` alignment.
    if (node.type === 'frame') {
      for (const child of node.children) {
        firstLayoutPass(child, node)
      }
    }

    const nodeLayout: NodeLayout = getOrAddLayout(node)

    if (nodeLayout.secondPass != null && !nodeLayout.secondPass.isDirty) {
      // We're already done!
      return
    }
    
    let newMeasurements: { width: number, height: number } | undefined = undefined
    switch (node.type) {
      case 'frame':
        newMeasurements = computeMeasurementsForFrame(
          node,
          (child) => getLayout(child).firstPass as FirstPassLayout)
        break
      case 'rectangle':
        newMeasurements = { width: node.width, height: node.height }
        break
      case 'text':
        newMeasurements = computeMeasurementsForText(
          node,
          parent ? parent.alignment.horizontalAlignment : undefined,
          // This will only be set if we've already done our initial 2-pass
          // algorithm and determined there was text still needs reflow.
          nodeLayout.secondPass ? nodeLayout.secondPass.width : undefined)
        break
    }

    nodeLayout.firstPass = newMeasurements
  }

  const secondLayoutPass = (root: SceneNode) => {
    // In the second layout pass (top down, root => children), we determine the locations of all nodes, and stretch
    // all nodes that are found within a `fill` alignment.

    const recursiveLayoutReturningDirtyState = (node: SceneNode): boolean => {
      if (node.type !== 'frame') {
        return false
      }

      let x = node.padding
      let y = node.padding
      const parentSecondLayout = getLayout(node).secondPass as SecondPassLayout

      let hasDirtyChildren = false

      for (const child of node.children) {
        const childFirstLayout = getLayout(child).firstPass as FirstPassLayout
        const needsTextReflow = child.type === 'text' && node.alignment.horizontalAlignment === 'FILL'

        const childSecondLayout = {
          x,
          y,
          width: node.alignment.horizontalAlignment === 'FILL' ? parentSecondLayout.width - node.padding * 2 : childFirstLayout.width,
          height: node.alignment.verticalAlignment === 'FILL' ? parentSecondLayout.height - node.padding * 2 : childFirstLayout.height,
          isDirty: needsTextReflow
        }

        if (node.alignment.type === 'HORIZONTAL') {
          x += childFirstLayout.width + node.spacing
        } else {
          y += childFirstLayout.height + node.spacing
        }

        getLayout(child).secondPass = childSecondLayout
        const childHasDirtyChildren = recursiveLayoutReturningDirtyState(child)
        if (childHasDirtyChildren && !childSecondLayout.isDirty) {
          childSecondLayout.isDirty = childHasDirtyChildren
        }

        hasDirtyChildren = hasDirtyChildren || needsTextReflow || childHasDirtyChildren
      }

      return hasDirtyChildren
    }

    // Set the root node's layout (this is easy)
    const rootLayout = getLayout(root)
    const rootFirstLayout = rootLayout.firstPass as FirstPassLayout
    const rootSecondLayout = {
      x: 0,
      y: 0,
      width: rootFirstLayout.width,
      height: rootFirstLayout.height,
      isDirty: false
    }
    rootLayout.secondPass = rootSecondLayout

    // Traverse down setting all the children/grandchildren's layouts. Then, mark the root as dirty
    // if any of the descendants were dirty.
    const isDirty = recursiveLayoutReturningDirtyState(root)
    if (isDirty && !rootSecondLayout.isDirty) {
      rootSecondLayout.isDirty = isDirty
    }
  }

  if (root.type === 'frame') {

  }

  // In this bottom-up pass, we use the sizes of each container's children to determine a size for
  // the container.
  firstLayoutPass(root)

  // In this top-down pass, we use the prior sizes to arrange & stretch the children within each
  // container.
  secondLayoutPass(root)

  const rootSecondLayout = getLayout(root).secondPass as SecondPassLayout
  if (rootSecondLayout.isDirty) {
    // These extra layout passes happen when there are stretched text that now need to be reflowed
    firstLayoutPass(root)
    secondLayoutPass(root)
  }

  const finalLayout: FinalLayout = {}
  for (const id in _layout) {
    finalLayout[id] = {
      ... _layout[id].secondPass!
    }
  }

  return finalLayout
}
