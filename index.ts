import { computeLayoutViaLayoutLayout } from "./layout-layout";
import { computeLayoutViaMeasureArrange } from "./measure-arrange";
import { SceneNode, getTextLayout, FinalLayout, newGUID } from "./scene";

const randomColor = (): string => {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const render = (root: SceneNode, sceneLayout: FinalLayout, ctx: CanvasRenderingContext2D) => {
  const renderSubtree = (node: SceneNode) => {
    const nodeLayout = sceneLayout[node.id]

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

{
  // render via measure / arrange pass
  const el = document.getElementById("canvas1") as HTMLCanvasElement

  // draw the background
  const ctx = el.getContext("2d") as CanvasRenderingContext2D
  ctx.fillStyle = "#eee"
  ctx.fillRect(0, 0, el.width, el.height)

  const sceneLayout = computeLayoutViaMeasureArrange(scene)

  // render the scene!
  render(scene, sceneLayout, ctx)

  console.log(ctx)
}

{
  // render via layout / layout pass
  const el = document.getElementById("canvas2") as HTMLCanvasElement

  // draw the background
  const ctx = el.getContext("2d") as CanvasRenderingContext2D
  ctx.fillStyle = "#eee"
  ctx.fillRect(0, 0, el.width, el.height)

  const sceneLayout = computeLayoutViaLayoutLayout(scene)

  // render the scene!
  render(scene, sceneLayout, ctx)

  console.log(ctx)
}