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
  padding: number
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
  needsTextReflow?: boolean,
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
  secondPass?: SecondPassLayout,

  // Finally, in the last (optional) layout pass (bottom up, child => root), we reflow any text nodes that were
  // stretched in the second pass and adjust all siblings/parents.
  finalPass?: FinalPassLayout
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

const computeMeasurementsForNode = (
  node: SceneNode,
  parent: FrameNode | undefined,
  getChildSize: (child: SceneNode) => { width: number, height: number, },
  options: { forceWidth?: number }
): {
  width: number,
  height: number,
} => {
  if (options.forceWidth && node.type !== 'text') {
    throw Error('you only need to force width for text nodes')
  }

  if (node.type === 'rectangle') {
    // Rectangles are easy :)
    return {
      width: node.width,
      height: node.height
    }
  } else if (node.type === 'text') {
    if (parent && parent.alignment.horizontalAlignment === 'FILL' && !options.forceWidth) {
      return {
        width: 2 * node.padding,
        height: 2 * node.padding,
      }
    } else {
      const maxWidth = node.fixedWidth ? node.fixedWidth : options.forceWidth ? options.forceWidth : undefined
      const textLayout = getTextLayout(node.text, maxWidth)

      return {
        width: textLayout.width + 2 * node.padding,
        height: textLayout.height + 2 * node.padding,
      }
    }
  } else if (node.type === 'frame') {
    // We need to calculate the size of frames by measuring children.
    let idealWidth = 0
    let idealHeight = 0

    for (const child of node.children) {
      if (node.alignment.type === 'HORIZONTAL') {
        idealWidth += getChildSize(child).width
        idealHeight = Math.max(idealHeight, getChildSize(child).height)
      } else {
        idealWidth = Math.max(idealWidth, getChildSize(child).width)
        idealHeight += getChildSize(child).height
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
  const layout: Layout = {}

  const firstLayoutPass = (node: SceneNode, parent?: FrameNode) => {
    // In the first layout pass (bottom up, child => root), we optimistically estimate the sizes of all nodes.
    // This doesn't take into account nodes that will be stretched due to a `fill` alignment.
    if (node.type === 'frame') {
      for (const child of node.children) {
        firstLayoutPass(child, node)
      }
    }

    layout[node.id] = {
      firstPass: computeMeasurementsForNode(node, parent, (child) => layout[child.id].firstPass as FirstPassLayout, {})
    }
  }

  const secondLayoutPass = (root: SceneNode) => {
    // In the second layout pass (top down, root => children), we determine the locations of all nodes, and stretch
    // all nodes that are found within a `fill` alignment.

    const traverse = (parent: SceneNode) => {
      if (parent.type !== 'frame') {
        return
      }
      let x = parent.padding
      let y = parent.padding
      const parentSecondLayout = layout[parent.id].secondPass as SecondPassLayout

      for (const child of parent.children) {
        const childFirstLayout = layout[child.id].firstPass as FirstPassLayout
        const needsTextReflow = child.type === 'text' && parent.alignment.horizontalAlignment === 'FILL'

        layout[child.id].secondPass = {
          x,
          y,
          width: parent.alignment.horizontalAlignment === 'FILL' ? parentSecondLayout.width - parent.padding * 2 : childFirstLayout.width,
          height: parent.alignment.verticalAlignment === 'FILL' ? parentSecondLayout.height - parent.padding * 2 : childFirstLayout.height,
          needsTextReflow
        }

        if (parent.alignment.type === 'HORIZONTAL') {
          x += childFirstLayout.width + parent.spacing
        } else {
          y += childFirstLayout.height + parent.spacing
        }

        traverse(child)
      }
    }

    const rootFirstLayout = layout[root.id].firstPass as FirstPassLayout
    layout[root.id].secondPass = {
      x: 0,
      y: 0,
      width: rootFirstLayout.width,
      height: rootFirstLayout.height
    }

    traverse(root)
  }

  const thirdLayoutPass = (root: SceneNode) => {
    // Finally, in the last (optional) layout pass (bottom up, child => root), we reflow any text nodes that were
    // stretched in the second pass and adjust all siblings/parents.

    const traverse = (node: SceneNode) => {
      // if (node.type === 'text') {
      //   node.
      // }

      if (node.type === 'frame') {
        for (const child of node.children) {
          traverse(child)
        }
      }

      layout[node.id].finalPass = {
        ... layout[node.id].secondPass as SecondPassLayout
      }
    }

    traverse(root)
  }

  firstLayoutPass(root)
  secondLayoutPass(root)
  thirdLayoutPass(root)
  return layout
}

const render = (root: SceneNode, layout: Layout, ctx: CanvasRenderingContext2D) => {
  const renderSubtree = (node: SceneNode) => {
    const nodeLayout = layout[node.id].finalPass as FinalPassLayout

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
        ctx.strokeText(line, nodeLayout.x + node.padding, nodeLayout.y + node.padding + textLayout.lineHeight * (i + 0.8))
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
//       text: 'hello!\n this is some text. isn\'t it grand\nyes!'
//     }
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
      padding: 2,
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
              padding: 2,
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

const layout = computeSceneLayout(scene)
console.log('First pass -------------------------------------------------')
for (const id in layout) {
  console.log(id, layout[id].firstPass)
}
console.log('Second pass ------------------------------------------------')
for (const id in layout) {
  console.log(id, layout[id].secondPass)
}
console.log('Final pass -------------------------------------------------')
for (const id in layout) {
  console.log(id, layout[id].finalPass)
}

// render the scene!
render(scene, layout, ctx)

console.log(ctx)
console.log('done')
