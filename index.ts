import * as html2canvas from 'html2canvas'

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

interface Measurements {
  // Padding + ideal size of contents.
  idealWidth: number,
  idealHeight: number

  // The finalized size of this node. Either:
  //  - the defined width/height for "fixed" size elements (some frames/text, all rectangles)
  //  - the ideal width/height for "auto" or "fill" sized elements (some frames/text, possibly
  //    different for each axis)
  computedWidth: number,
  computedHeight: number,

  isDirty?: boolean
}

interface FirstPassLayout {
  x: number
  y: number
  width: number
  height: number
}

interface Layout {
  measurements: {
    [id: string]: Measurements
  },
  firstPass: {
    [id: string]: FirstPassLayout
  }
}

const computeMeasurementsForNode = (node: SceneNode, parent: FrameNode | undefined, measurements: { [id: string]: Measurements }, options: { forceWidth?: number }): Measurements => {
  if (options.forceWidth && node.type !== 'text') {
    throw Error('you only need to force width for text nodes')
  }

  if (node.type === 'rectangle') {
    // Rectangles are easy :)
    return {
      idealWidth: node.width,
      idealHeight: node.height,
      computedWidth: node.width,
      computedHeight: node.height
    }
  } else if (node.type === 'text') {
    if (parent && parent.alignment.horizontalAlignment === 'FILL' && !options.forceWidth) {
      return {
        idealWidth: 0,
        idealHeight: 0,
        computedWidth: 0,
        computedHeight: 0,
        isDirty: true
      }
    } else {
      const textEl = document.getElementById('hidden') as HTMLElement
      textEl.style.width =
          node.fixedWidth ? `${node.fixedWidth}px`
        : options.forceWidth ? `${options.forceWidth}px`
        : 'auto'
      textEl.innerText = node.text

      return {
        idealWidth: textEl.clientWidth + 1,
        idealHeight: textEl.clientHeight + 1,
        computedWidth: textEl.clientWidth + 1,
        computedHeight: textEl.clientHeight + 1
      }
    }
  } else if (node.type === 'frame') {
    // We need to calculate the size of frames by measuring children.
    let idealWidth = 0
    let idealHeight = 0

    for (const child of node.children) {
      if (node.alignment.type === 'HORIZONTAL') {
        idealWidth += measurements[child.id].computedWidth
        idealHeight = Math.max(idealHeight, measurements[child.id].computedHeight)
      } else {
        idealWidth = Math.max(idealWidth, measurements[child.id].computedWidth)
        idealHeight += measurements[child.id].computedHeight
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
      idealWidth: idealWidth,
      idealHeight: idealHeight,
      computedWidth: node.fixedWidth != null ? node.fixedWidth : idealWidth,
      computedHeight: node.fixedHeight != null ? node.fixedHeight : idealHeight
    }
  } else {
    throw Error()
  }
}

const computeLayout = (root: SceneNode): Layout => {
  const layout: Layout = { measurements: {}, firstPass: {} }

  const recursivelyComputeMeasurements = (node: SceneNode, parent?: FrameNode) => {
    // Layout of parents depends on layout of children. Do the children first!
    if (node.type == 'frame') {
      for (const child of node.children) {
        recursivelyComputeMeasurements(child, node)
      }
    }
    layout.measurements[node.id] = computeMeasurementsForNode(node, parent, layout.measurements, {})
  }

  const computeFirstPassLayout = (parent: SceneNode) => {
    // The first-pass-layout of children depends on the sizing of the parents.
    // Do the parents first!

    if (parent.type == 'rectangle' || parent.type === 'text') {
    } else if (parent.type == 'frame') {
      let x = parent.padding
      let y = parent.padding
      const parentMeasurements = layout.measurements[parent.id]
      for (const child of parent.children) {
        const childMeasurements = layout.measurements[child.id]
        layout.firstPass[child.id] = {
          x: x,
          y: y,
          width: parent.alignment.horizontalAlignment === 'FILL' ? parentMeasurements.computedWidth - parent.padding * 2 : childMeasurements.computedWidth,
          height: parent.alignment.verticalAlignment === 'FILL' ? parentMeasurements.computedHeight - parent.padding * 2 : childMeasurements.computedHeight
        }
        if (parent.alignment.type == 'HORIZONTAL') {
          x += childMeasurements.computedWidth + parent.spacing
        } else {
          y += childMeasurements.computedHeight + parent.spacing
        }
        computeFirstPassLayout(child)
      }
    } else {
      throw Error()
    }

    if (!(parent.id in layout.firstPass)) {
      layout.firstPass[parent.id] = {
        x: 0,
        y: 0,
        width: layout.measurements[parent.id].computedWidth,
        height: layout.measurements[parent.id].computedHeight
      }
    }
  }

  recursivelyComputeMeasurements(root)
  computeFirstPassLayout(root)
  return layout
}

const render = (root: SceneNode, layout: Layout, ctx: CanvasRenderingContext2D) => {
  const renderSubtree = (node: SceneNode) => {
    const nodeLayout = layout.firstPass[node.id]
    if (node.type === 'frame') {
      ctx.fillStyle = node.color
      ctx.fillRect(nodeLayout.x, nodeLayout.y, nodeLayout.width, nodeLayout.height)
    } else if (node.type === 'rectangle') {
      ctx.fillStyle = node.color
      ctx.fillRect(nodeLayout.x, nodeLayout.y, nodeLayout.width, nodeLayout.height)
    } else if (node.type === 'text') {
      const textEl = document.getElementById('hidden') as HTMLElement
      textEl.style.width = `${nodeLayout.width}px`
      textEl.innerText = node.text
      // html2canvas(textEl, {
      //   onrendered: function (image) {
      //     ctx.drawImage(image, 0, 0, 100, 100);
      //   }
      // })
    
      ctx.strokeStyle = '#000'
      ctx.strokeText(node.text, nodeLayout.x, nodeLayout.y, nodeLayout.width)
    } else {
      throw Error()
    }

    if (node.type == 'frame' && node.children.length > 0) {
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
      text: `hello!
      this is some text.
      yes!`
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

const layout = computeLayout(scene)
console.log(layout)

// render the scene!
render(scene, layout, ctx)

console.log(ctx)
console.log('done')
