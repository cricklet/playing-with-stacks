const randomColor = (): string => {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

let nextGUID = 0
const newGUID = (): string => {
  return `${nextGUID ++}`
}

interface HorizontalAlign {
  type: 'HORIZONTAL'
  horizontalAlignment: 'MIN'
  verticalAlignment: 'MIN' | 'FILL'
}

interface VerticalAlign {
  type: 'VERTICAL'
  verticalAlignment: 'MIN'
  horizontalAlignment: 'MIN' | 'FILL'
}

interface FrameNode {
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

interface RectangleNode {
  type: 'rectangle'
  id: string
  width: number
  height: number
  color: string
}

interface TextNode {
  type: 'text'
  id: string
  text: string
  fixedWidth?: number
}

type SceneNode = RectangleNode | FrameNode | TextNode

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

interface FinalPassLayout {
  x: number,
  y: number,
  width: number,
  height: number
}

interface NodeLayout {
  // In the first layout pass (bottom up, child => root), we optimistically estimate the sizes of all nodes.
  // This doesn't take into account nodes that will be stretched due to a `fill` alignment.
  firstPass?: FirstPassLayout,

  // In the second layout pass (top down, root => children), we determine the locations of all nodes, and stretch
  // all nodes that are found within a `fill` alignment.
  secondPass?: SecondPassLayout
}

interface Layout {
  [id: string]: NodeLayout
}

const getTextLayout = (text: string, maxWidth?: number): { lines: string[], lineHeight: number, width: number, height: number } => {
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

const computeMeasurementForText = (
  text: string, width: number | 'auto' | 'fill'
): {
  width: number,
  height: number,
} => {
  if (width === 'fill') {
    return {
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

const computeMeasurementsForNode = (
  node: SceneNode,
  options: {
    getSizeOfChild: (child: SceneNode) => { width: number, height: number, },
    horizontalAlignment: 'MIN' | 'FILL' | undefined
    forceWidth: number | undefined
  }
): {
  width: number,
  height: number,
} => {
  if (node.type === 'rectangle') {
    // Rectangles are easy :)
    return {
      width: node.width,
      height: node.height
    }
  } else if (node.type === 'text') {
    const maxWidth =
      (node.fixedWidth != null) ? node.fixedWidth :
      (options.forceWidth != null) ? options.forceWidth :
      (options.horizontalAlignment === 'FILL') ? 'fill' : 'auto'

    return computeMeasurementForText(node.text, maxWidth)
  } else if (node.type === 'frame') {
    // We need to calculate the size of frames by measuring children.
    let idealWidth = 0
    let idealHeight = 0

    for (const child of node.children) {
      if (node.alignment.type === 'HORIZONTAL') {
        idealWidth += options.getSizeOfChild(child).width
        idealHeight = Math.max(idealHeight, options.getSizeOfChild(child).height)
      } else {
        idealWidth = Math.max(idealWidth, options.getSizeOfChild(child).width)
        idealHeight += options.getSizeOfChild(child).height
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
  } else {
    throw Error()
  }
}

const computeSceneLayout = (root: SceneNode): Layout => {
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

    const newMeasurements = computeMeasurementsForNode(node, {
      horizontalAlignment: parent ? parent.alignment.horizontalAlignment : undefined,
      forceWidth: node.type === 'text' && nodeLayout.secondPass ? nodeLayout.secondPass.width : undefined,
      getSizeOfChild: (child) => getLayout(child).firstPass as FirstPassLayout
    })
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

  console.log('First pass -------------------------------------------------')
  firstLayoutPass(root)
  for (const id in _layout) {
    console.log(id, _layout[id].firstPass)
  }

  console.log('Second pass ------------------------------------------------')
  secondLayoutPass(root)
  for (const id in _layout) {
    console.log(id, _layout[id].secondPass)
  }

  const rootSecondLayout = getLayout(root).secondPass as SecondPassLayout
  if (rootSecondLayout.isDirty) {
    firstLayoutPass(root)
    secondLayoutPass(root)
  }

  return _layout
}

const render = (root: SceneNode, sceneLayout: Layout, ctx: CanvasRenderingContext2D) => {
  const renderSubtree = (node: SceneNode) => {
    const nodeLayout = sceneLayout[node.id].secondPass as SecondPassLayout

    if (node.type === 'frame') {
      ctx.fillStyle = node.color
      ctx.fillRect(nodeLayout.x, nodeLayout.y, nodeLayout.width, nodeLayout.height)
    } else if (node.type === 'rectangle') {
      ctx.fillStyle = node.color
      ctx.fillRect(nodeLayout.x, nodeLayout.y, nodeLayout.width, nodeLayout.height)
    } else if (node.type === 'text') {
      ctx.fillStyle = '#fafafa'
      ctx.fillRect(nodeLayout.x, nodeLayout.y, nodeLayout.width, nodeLayout.height)
      ctx.strokeStyle = '#000'

      const textLayout = getTextLayout(node.text, nodeLayout.width)
      for (let i = 0; i < textLayout.lines.length; i ++) {
        const line = textLayout.lines[i]
        ctx.strokeText(line, nodeLayout.x, nodeLayout.y + textLayout.lineHeight * (i + 0.8))
      }
    } else {
      throw Error()
    }

    if (node.type === 'frame' && node.children.length > 0) {
      ctx.save()
      ctx.transform(1, 0, 0, 1, nodeLayout.x, nodeLayout.y)
      for (const child of node.children) {
        renderSubtree(child)
      }
      ctx.restore()
    }
  }

  renderSubtree(root)
}

// const scene: SceneNode = {
//   type: 'frame',
//   id: newGUID(),
//   padding: 4,
//   spacing: 4,
//   color: randomColor(),
//   alignment: {
//     type: 'VERTICAL',
//     horizontalAlignment: 'FILL',
//     verticalAlignment: 'MIN'
//   },

//   children: [
//     {
//       type: 'text',
//       id: newGUID(),
//       text: 'blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah'
//     },
//     {
//       type: 'rectangle',
//       id: newGUID(),
//       width: 100,
//       height: 80,
//       color: randomColor(),
//     },
//   ]
// }

const scene: SceneNode = {
  type: 'frame',
  id: newGUID(),
  padding: 4,
  spacing: 4,
  color: randomColor(),
  alignment: {
    type: 'VERTICAL',
    horizontalAlignment: 'MIN',
    verticalAlignment: 'MIN'
  },

  children: [
    {
      type: 'text',
      id: newGUID(),
      text: `XXX hello! this is some text. yes! blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah`,
      fixedWidth: 200,
    },
    {
      type: 'rectangle',
      id: newGUID(),
      width: 100,
      height: 80,
      color: randomColor(),
    },
    {
      type: 'frame',
      id: newGUID(),
      padding: 4,
      spacing: 4,
      color: randomColor(),
      alignment: {
        type: 'HORIZONTAL',
        horizontalAlignment: 'MIN',
        verticalAlignment: 'FILL'
      },
    
      children: [
        {
          type: 'frame',
          id: newGUID(),
          padding: 4,
          spacing: 4,
          color: randomColor(),
          alignment: {
            type: 'VERTICAL',
            horizontalAlignment: 'MIN',
            verticalAlignment: 'MIN'
          },
          children: [
            {
              type: 'rectangle',
              id: newGUID(),
              width: 40,
              height: 30,
              color: randomColor(),
            },
            {
              type: 'rectangle',
              id: newGUID(),
              width: 20,
              height: 30,
              color: randomColor(),
            },
            {
              type: 'rectangle',
              id: newGUID(),
              width: 50,
              height: 30,
              color: randomColor(),
            },
            {
              type: 'rectangle',
              id: newGUID(),
              width: 20,
              height: 10,
              color: randomColor(),
            },
          ]
        },
        {
          type: 'frame',
          id: newGUID(),
          padding: 4,
          spacing: 4,
          color: randomColor(),
          alignment: {
            type: 'VERTICAL',
            horizontalAlignment: 'FILL',
            verticalAlignment: 'MIN'
          },
        
          children: [
            {
              type: 'rectangle',
              id: newGUID(),
              width: 100,
              height: 80,
              color: randomColor(),
            },
            {
              type: 'text',
              id: newGUID(),
              text: `XXX hello! this is some text. yes! blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah`,
            },
          ]
        },
        {
          type: 'frame',
          id: newGUID(),
          padding: 4,
          spacing: 4,
          color: randomColor(),
          alignment: {
            type: 'VERTICAL',
            horizontalAlignment: 'FILL',
            verticalAlignment: 'MIN'
          },
        
          children: [
            {
              type: 'rectangle',
              id: newGUID(),
              width: 40,
              height: 20,
              color: randomColor(),
            },
            {
              type: 'rectangle',
              id: newGUID(),
              width: 60,
              height: 30,
              color: randomColor(),
            },
            {
              type: 'rectangle',
              id: newGUID(),
              width: 20,
              height: 10,
              color: randomColor(),
            }
          ]
        }
      ]
    },
    {
      type: 'rectangle',
      id: newGUID(),
      width: 100,
      height: 80,
      color: randomColor(),
    },
    {
      type: 'rectangle',
      id: newGUID(),
      width: 100,
      height: 80,
      color: randomColor(),
    }
  ]
}

const el = document.getElementById("canvas") as HTMLCanvasElement

// draw the background
const ctx = el.getContext("2d") as CanvasRenderingContext2D
ctx.fillStyle = "#eee"
ctx.fillRect(0, 0, el.width, el.height)

const sceneLayout = computeSceneLayout(scene)

// render the scene!
render(scene, sceneLayout, ctx)

console.log(ctx)
console.log('done')
