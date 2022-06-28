import { SceneNode, getTextLayout, FinalLayout, newGUID } from "./scene";
import { computeLayoutViaImmediate, computeLayoutViaRecursive } from "./layout";

const randomColor = (): string => {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function render(root: SceneNode, sceneLayout: FinalLayout, ctx: CanvasRenderingContext2D) {
  const renderSubtree = (node: SceneNode) => {
    const nodeLayout = sceneLayout[node.id];
    if (nodeLayout == null || nodeLayout.width == null || nodeLayout.height == null) {
      console.error('no layout found for', node.id)
      return
    }

    if (node.type === 'frame') {
      ctx.fillStyle = node.color;
      ctx.fillRect(nodeLayout.x, nodeLayout.y, nodeLayout.width, nodeLayout.height);
    } else if (node.type === 'rectangle') {
      ctx.fillStyle = node.color;
      ctx.fillRect(nodeLayout.x, nodeLayout.y, nodeLayout.width, nodeLayout.height);
    } else if (node.type === 'text') {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(nodeLayout.x, nodeLayout.y, nodeLayout.width, nodeLayout.height);
      ctx.strokeStyle = '#000';

      const textLayout = getTextLayout(node.text, nodeLayout.width);
      for (let i = 0; i < textLayout.lines.length; i++) {
        const line = textLayout.lines[i];
        ctx.strokeText(line, nodeLayout.x, nodeLayout.y + textLayout.lineHeight * (i + 0.8));
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
  padding: 4,
  color: randomColor(),

  width: 'resize-to-fit',
  height: 'resize-to-fit',
  alignment: 'vertical',

  children: [
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
    },
  ]
}

const scene2: SceneNode = {
  type: 'frame',
  id: newGUID(),
  padding: 4,
  color: randomColor(),

  width: 'resize-to-fit',
  height: 'resize-to-fit',
  alignment: 'vertical',

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
      width: 'grow',
      height: 'resize-to-fit'
    },
  ]
}

const scene3: SceneNode = {
  type: 'frame',
  id: 'outer',
  padding: 4,
  color: randomColor(),

  width: 'resize-to-fit',
  height: 'resize-to-fit',
  alignment: 'horizontal',

  children: [
    {
      type: 'frame',
      id: 'text-frame',
      padding: 4,
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
  type: 'frame', id: newGUID(), padding: 4, color: randomColor(),

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
      type: 'frame', id: newGUID(), padding: 4, color: randomColor(),
    
      width: 'resize-to-fit',
      height: 'resize-to-fit',
      alignment: 'horizontal',

      children: [
        {
          type: 'frame', id: newGUID(), padding: 4, color: randomColor(),

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
            },
            {
              type: 'rectangle', id: newGUID(), width: 20, height: 10, color: randomColor()
            }
          ]
        },
        {
          type: 'frame', id: 'test-frame', padding: 4, color: randomColor(),

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
          type: 'frame', id: newGUID(), padding: 4, color: randomColor(),

          width: 'resize-to-fit',
          height: 'resize-to-fit',
          alignment: 'vertical',

          children: [

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
  el.height = 500;
  canvasesEl?.appendChild(el)

  // draw the background
  const ctx = el.getContext("2d") as CanvasRenderingContext2D
  ctx.fillStyle = "#eee"
  ctx.fillRect(0, 0, el.width, el.height)

  // render the scene!
  render(scene, sceneLayout, ctx)
}

renderScene(scene4, computeLayoutViaImmediate(scene4))
renderScene(scene4, computeLayoutViaRecursive(scene4))

// canvasesEl?.appendChild(document.createElement('div'))

// renderScene(scene2, computeLayoutViaImmediate(scene2))
// renderScene(scene2, computeLayoutViaRecursive(scene2))

// canvasesEl?.appendChild(document.createElement('div'))

// renderScene(scene3, computeLayoutViaImmediate(scene3))
// renderScene(scene3, computeLayoutViaRecursive(scene3))
