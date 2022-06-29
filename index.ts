import { SceneNode, getTextLayout, FinalLayout, newGUID } from "./scene";
import { computeLayoutViaImmediate, computeLayoutViaRecursive } from "./layout";

const randomColor = (): string => {
  var letters = '789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * letters.length)];
  }
  return color;
}

function render(root: SceneNode, sceneLayout: FinalLayout, ctx: CanvasRenderingContext2D) {
  const renderSubtree = (node: SceneNode) => {
    const nodeLayout = sceneLayout[node.id];
    const [nodeWidth, nodeHeight] = nodeLayout.size
    if (nodeLayout == null || nodeWidth == null || nodeHeight == null) {
      console.error('no layout found for', node.id)
      return
    }

    if (node.type === 'frame') {
      ctx.fillStyle = node.color;
      ctx.fillRect(nodeLayout.x, nodeLayout.y, nodeWidth, nodeHeight);
    } else if (node.type === 'rectangle') {
      ctx.fillStyle = node.color;
      ctx.fillRect(nodeLayout.x, nodeLayout.y, nodeWidth, nodeHeight);
    } else if (node.type === 'text') {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(nodeLayout.x, nodeLayout.y, nodeWidth, nodeHeight);
      ctx.fillStyle = '#000';

      const textLayout = getTextLayout(node.text, nodeWidth);
      for (let i = 0; i < textLayout.lines.length; i++) {
        const line = textLayout.lines[i];
        ctx.fillText(line, nodeLayout.x, nodeLayout.y + textLayout.lineHeight * (i + 0.8));
      }
    } else {
      throw Error();
    }

    if (node.type === 'frame' && node.children.length > 0) {
      ctx.save();
      ctx.transform(1, 0, 0, 1, nodeLayout.x, nodeLayout.y);
      for (const child of node.children) {
        renderSubtree(child);
      }
      ctx.restore();
    }
  };

  renderSubtree(root);
}

const scene1: SceneNode = {
  type: 'frame',
  id: newGUID(),
  padding: 8,
  color: randomColor(),

  width: 200,
  height: 'resize-to-fit',
  alignment: 'horizontal',

  children: [
    {
      type: 'rectangle',
      id: newGUID(),
      width: 'grow',
      height: 'grow',
      color: randomColor(),
    },
    {
      type: 'text',
      id: newGUID(),
      width: 'grow',
      height: 'grow',
      text: 'test test test test test test test test test'
    },
    {
      type: 'frame',
      id: newGUID(),
      padding: 8,
      color: randomColor(),

      width: 'grow',
      height: 100,
      alignment: 'vertical',

      children: []
    },
  ]
}

const scene2: SceneNode = {
  type: 'frame',
  id: 'frame',
  padding: 8,
  color: randomColor(),

  width: 'resize-to-fit',
  height: 'resize-to-fit',
  alignment: 'vertical',

  children: [
    {
      type: 'rectangle',
      id: 'rect',
      width: 100,
      height: 80,
      color: randomColor(),
    },
    {
      type: 'text',
      id: 'text',
      text: `XXX hello! this is some text. yes! blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah`,
      width: 'grow',
      height: 'resize-to-fit'
    },
  ]
}

const scene3: SceneNode = {
  type: 'frame',
  id: 'outer',
  padding: 8,
  color: randomColor(),

  width: 'resize-to-fit',
  height: 'resize-to-fit',
  alignment: 'horizontal',

  children: [
    {
      type: 'frame',
      id: 'text-frame',
      padding: 8,
      color: randomColor(),

      width: 100,
      height: 'resize-to-fit',
      alignment: 'horizontal',

      children: [
        {
          type: 'text',
          id: 'text',
          text: `XXX hello! this is some text. yes! blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah`,
          width: 'grow',
          height: 'resize-to-fit'
        },
      ]
    },
    {
      type: 'rectangle',
      id: 'rect',
      width: 100,
      height: 'grow',
      color: randomColor(),
    },
  ]
}

const scene4: SceneNode = {
  type: 'frame', id: newGUID(), padding: 8, color: randomColor(),

  width: 'resize-to-fit',
  height: 'resize-to-fit',
  alignment: 'vertical',

  children: [
    {
      type: 'text', id: newGUID(), width: 200, height: 'resize-to-fit',
      text: 'test test test test test test test test test test test test test test test test test test test test'
    },
    {
      type: 'rectangle', id: newGUID(), width: 120, height: 80, color: randomColor()
    },
    {
      type: 'frame', id: newGUID(), padding: 8, color: randomColor(),
    
      width: 'resize-to-fit',
      height: 'resize-to-fit',
      alignment: 'horizontal',

      children: [
        {
          type: 'frame', id: newGUID(), padding: 8, color: randomColor(),

          width: 'resize-to-fit',
          height: 'resize-to-fit',
          alignment: 'vertical',

          children: [
            {
              type: 'rectangle', id: newGUID(), width: 40, height: 30, color: randomColor()
            },
            {
              type: 'rectangle', id: newGUID(), width: 20, height: 30, color: randomColor()
            },
            {
              type: 'rectangle', id: newGUID(), width: 50, height: 30, color: randomColor()
            }
          ]
        },
        {
          type: 'frame', id: 'test-frame', padding: 8, color: randomColor(),

          width: 'resize-to-fit',
          height: 'resize-to-fit',
          alignment: 'vertical',

          children: [
            {
              type: 'rectangle', id: newGUID(), width: 100, height: 80, color: randomColor()
            },
            {
              type: 'text', id: 'test-text', width: 'grow', height: 'resize-to-fit',
              text: 'test test test test test test test test test test test test test test test test test test'
            }
          ]
        },
        {
          type: 'frame', id: newGUID(), padding: 8, color: randomColor(),

          width: 'resize-to-fit',
          height: 'resize-to-fit',
          alignment: 'vertical',

          children: [
            {
              type: 'rectangle', id: newGUID(), width: 40, height: 20, color: randomColor()
            },
            {
              type: 'rectangle', id: newGUID(), width: 60, height: 30, color: randomColor()
            },
            {
              type: 'rectangle', id: newGUID(), width: 20, height: 10, color: randomColor()
            }
          ]
        }
      ]
    }
  ]
}

const canvasesEl = document.getElementById("canvases")

function renderScene(scene: SceneNode, sceneLayout: FinalLayout) {
  // render via measure / arrange pass
  var el = document.createElement('canvas');
  el.width = 300;
  el.height = 300;
  canvasesEl?.appendChild(el)

  // draw the background
  const ctx = el.getContext("2d") as CanvasRenderingContext2D
  ctx.fillStyle = "#eee"
  ctx.fillRect(0, 0, el.width, el.height)

  // render the scene!
  render(scene, sceneLayout, ctx)
}

renderScene(scene1, computeLayoutViaImmediate(scene1))
renderScene(scene1, computeLayoutViaRecursive(scene1))

canvasesEl?.appendChild(document.createElement('div'))

renderScene(scene2, computeLayoutViaImmediate(scene2))
renderScene(scene2, computeLayoutViaRecursive(scene2))

canvasesEl?.appendChild(document.createElement('div'))

renderScene(scene3, computeLayoutViaImmediate(scene3))
renderScene(scene3, computeLayoutViaRecursive(scene3))

canvasesEl?.appendChild(document.createElement('div'))

renderScene(scene4, computeLayoutViaImmediate(scene4))
renderScene(scene4, computeLayoutViaRecursive(scene4))