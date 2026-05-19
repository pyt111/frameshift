/**
 * React 解析器 - JSX 解析模块
 * 包含 JSX 属性、元素、子节点、条件渲染、列表渲染等解析逻辑
 */

import type * as BabelTypes from '@babel/types';
import type {
  SemanticNodeId,
  ComponentNode,
  TextNode,
  EventHandlerNode,
  ConditionalRenderNode,
  ListRenderNode,
  StyleNode,
  ComponentProp,
} from '../../semantic-tree/types';
import type { ParserContext } from './context';
import {
  generateNodeId,
  getSourceLocation,
  stripBlockBraces,
  getNodeCode,
  getExpressionType,
  isNativeElement,
  reactEventToNative,
  generate,
} from './utils';

/**
 * 解析 JSX 属性为 ComponentProp
 */
export function parseJSXAttribute(
  attr: BabelTypes.JSXAttribute,
  ctx: ParserContext
): ComponentProp | null {
  try {
    const name = attr.name.type === 'JSXIdentifier' ? attr.name.name : '';

    // 跳过 key 和 ref 等内部属性（但保留语义）
    if (name === 'key') {
      return {
        name: 'key',
        value: attr.value ? (attr.value.type === 'StringLiteral' ? attr.value.value : getNodeCode(attr.value as BabelTypes.Expression)) : 'true',
        isDynamic: attr.value?.type === 'JSXExpressionContainer',
      };
    }

    // 处理 className 属性
    if (name === 'className') {
      return parseClassNameAttribute(attr, ctx);
    }

    // 处理 style 属性
    if (name === 'style') {
      return parseStyleAttribute(attr, ctx);
    }

    // 处理事件属性 (onClick, onChange 等)
    if (name.startsWith('on')) {
      return parseEventAttribute(attr, name, ctx);
    }

    // 处理普通属性
    return parseRegularAttribute(attr, name, ctx);
  } catch (e) {
    ctx.warnings.push({
      message: `解析 JSX 属性失败: ${e instanceof Error ? e.message : String(e)}`,
      level: 'warning',
    });
    return null;
  }
}

/**
 * 解析 className 属性
 */
function parseClassNameAttribute(attr: BabelTypes.JSXAttribute, ctx: ParserContext): ComponentProp {
  if (!attr.value) {
    return { name: 'className', value: '', isDynamic: false, originalName: 'className' };
  }

  if (attr.value.type === 'StringLiteral') {
    return {
      name: 'className',
      value: attr.value.value,
      isDynamic: false,
      originalName: 'className',
    };
  }

  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;
    const exprCode = getNodeCode(expr as BabelTypes.Expression);
    return {
      name: 'className',
      value: { expression: exprCode, type: getExpressionType(expr as BabelTypes.Node) },
      isDynamic: true,
      originalName: 'className',
    };
  }

  return { name: 'className', value: '', isDynamic: false, originalName: 'className' };
}

/**
 * 解析 style 属性
 */
function parseStyleAttribute(attr: BabelTypes.JSXAttribute, ctx: ParserContext): ComponentProp {
  if (!attr.value) {
    return { name: 'style', value: '', isDynamic: false };
  }

  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;
    const exprCode = getNodeCode(expr as BabelTypes.Expression);

    // 创建内联样式节点
    const styleNodeId = generateNodeId('style');
    const styleNode: StyleNode = {
      id: styleNodeId,
      nodeType: 'style',
      styleKind: 'inline',
      content: exprCode,
      preprocessor: 'css',
      confidence: 0.9,
      confidenceLevel: 'high',
      sourceLocation: getSourceLocation((expr as BabelTypes.Node).loc),
    };
    ctx.nodes[styleNodeId] = styleNode;
    ctx.styleNodes.push(styleNode);

    return {
      name: 'style',
      value: { expression: exprCode, type: getExpressionType(expr as BabelTypes.Node) },
      isDynamic: true,
    };
  }

  return { name: 'style', value: '', isDynamic: false };
}

/**
 * 解析事件属性
 */
function parseEventAttribute(attr: BabelTypes.JSXAttribute, name: string, ctx: ParserContext): ComponentProp {
  const eventName = reactEventToNative(name);

  if (!attr.value) {
    return { name, value: '', isDynamic: false, originalName: name };
  }

  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;

    if (expr.type === 'Identifier') {
      // 引用已定义的处理函数
      const handlerName = expr.name;
      const handlerInfo = ctx.eventHandlers.get(handlerName);
      if (handlerInfo) {
        return {
          name,
          value: { expression: handlerName, type: 'identifier' },
          isDynamic: true,
          originalName: name,
        };
      }
      return {
        name,
        value: { expression: handlerName, type: 'identifier' },
        isDynamic: true,
        originalName: name,
      };
    }

    if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
      // 内联事件处理函数
      const handlerBody = expr.body.type === 'BlockStatement'
        ? stripBlockBraces(generate(expr.body).code)
        : getNodeCode(expr.body as BabelTypes.Expression);
      const params = expr.params.map(p => getNodeCode(p as BabelTypes.Node));
      const eventParam = params[0];

      // 创建事件处理节点
      const handlerNodeId = generateNodeId('handler');
      const handlerNode: EventHandlerNode = {
        id: handlerNodeId,
        nodeType: 'event-handler',
        eventName,
        handlerName: `handle${eventName.charAt(0).toUpperCase() + eventName.slice(1)}`,
        handlerBody,
        eventParam,
        isInline: true,
        confidence: 0.95,
        confidenceLevel: 'high',
        sourceLocation: getSourceLocation(expr.loc),
      };
      ctx.nodes[handlerNodeId] = handlerNode;

      const exprCode = getNodeCode(expr as BabelTypes.Expression);
      return {
        name,
        value: { expression: exprCode, type: 'arrow-function' },
        isDynamic: true,
        originalName: name,
      };
    }

    const exprCode = getNodeCode(expr as BabelTypes.Expression);
    return {
      name,
      value: { expression: exprCode, type: getExpressionType(expr as BabelTypes.Node) },
      isDynamic: true,
      originalName: name,
    };
  }

  return { name, value: '', isDynamic: false, originalName: name };
}

/**
 * 解析普通属性
 */
function parseRegularAttribute(attr: BabelTypes.JSXAttribute, name: string, _ctx: ParserContext): ComponentProp {
  if (!attr.value) {
    // 布尔属性如 disabled, checked
    return { name, value: 'true', isDynamic: false };
  }

  if (attr.value.type === 'StringLiteral') {
    return { name, value: attr.value.value, isDynamic: false };
  }

  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;
    if (expr.type === 'JSXEmptyExpression') {
      return { name, value: '', isDynamic: false };
    }
    const exprCode = getNodeCode(expr as BabelTypes.Expression);
    return {
      name,
      value: { expression: exprCode, type: getExpressionType(expr as BabelTypes.Node) },
      isDynamic: true,
    };
  }

  return { name, value: '', isDynamic: false };
}

/**
 * 解析 JSX 元素为 ComponentNode
 */
export function parseJSXElement(
  element: BabelTypes.JSXElement | BabelTypes.JSXFragment,
  ctx: ParserContext
): SemanticNodeId {
  if (element.type === 'JSXFragment') {
    // Fragment 片段，创建一个虚拟的容器组件节点
    const fragId = generateNodeId('component');
    const childIds: SemanticNodeId[] = [];

    for (const child of element.children) {
      const childId = parseJSXChild(child, ctx);
      if (childId) childIds.push(childId);
    }

    const fragNode: ComponentNode = {
      id: fragId,
      nodeType: 'component',
      tagName: 'Fragment',
      isNativeElement: false,
      props: [],
      children: childIds,
      confidence: 0.9,
      confidenceLevel: 'high',
      sourceLocation: getSourceLocation(element.loc),
    };
    ctx.nodes[fragId] = fragNode;
    return fragId;
  }

  // JSXElement
  const openingElement = element.openingElement;
  let tagName = '';

  // 获取标签名
  if (openingElement.name.type === 'JSXIdentifier') {
    tagName = openingElement.name.name;
  } else if (openingElement.name.type === 'JSXMemberExpression') {
    // 如 React.Fragment, Components.Layout 等
    const obj = openingElement.name.object;
    const prop = openingElement.name.property;
    if (obj.type === 'JSXIdentifier') {
      tagName = `${obj.name}.${prop.name}`;
    }
  }

  // 解析属性
  const props: ComponentProp[] = [];
  for (const attr of openingElement.attributes) {
    if (attr.type === 'JSXAttribute') {
      const prop = parseJSXAttribute(attr, ctx);
      if (prop) props.push(prop);
    }
    // JSXSpreadAttribute 暂时跳过，添加警告
    if (attr.type === 'JSXSpreadAttribute') {
      ctx.warnings.push({
        message: `JSX 展开属性暂不支持完整解析: {...${getNodeCode(attr.argument as BabelTypes.Expression)}}`,
        level: 'info',
        location: getSourceLocation(attr.loc),
      });
    }
  }

  // 解析子节点
  const childIds: SemanticNodeId[] = [];
  for (const child of element.children) {
    const childId = parseJSXChild(child, ctx);
    if (childId) childIds.push(childId);
  }

  // 创建组件节点
  const nodeId = generateNodeId('component');
  const componentNode: ComponentNode = {
    id: nodeId,
    nodeType: 'component',
    tagName,
    isNativeElement: isNativeElement(tagName),
    props,
    children: childIds,
    confidence: isNativeElement(tagName) ? 1.0 : 0.85,
    confidenceLevel: isNativeElement(tagName) ? 'high' : 'high',
    sourceLocation: getSourceLocation(element.loc),
  };
  ctx.nodes[nodeId] = componentNode;
  return nodeId;
}

/**
 * 解析 JSX 子节点
 */
export function parseJSXChild(
  child: BabelTypes.JSXText | BabelTypes.JSXExpressionContainer | BabelTypes.JSXSpreadChild | BabelTypes.JSXElement | BabelTypes.JSXFragment,
  ctx: ParserContext
): SemanticNodeId | null {
  // 文本节点
  if (child.type === 'JSXText') {
    const text = child.value.trim();
    if (!text) return null;

    const textId = generateNodeId('text');
    const textNode: TextNode = {
      id: textId,
      nodeType: 'text',
      content: text,
      confidence: 1.0,
      confidenceLevel: 'high',
      sourceLocation: getSourceLocation(child.loc),
    };
    ctx.nodes[textId] = textNode;
    return textId;
  }

  // 表达式容器 {expression}
  if (child.type === 'JSXExpressionContainer') {
    const expr = child.expression;

    // 空表达式
    if (expr.type === 'JSXEmptyExpression') return null;

    // 条件渲染：三元表达式
    if (expr.type === 'ConditionalExpression') {
      return parseConditionalExpression(expr, ctx);
    }

    // 条件渲染：逻辑与表达式
    if (expr.type === 'LogicalExpression' && expr.operator === '&&') {
      return parseLogicalAndExpression(expr, ctx);
    }

    // 列表渲染：.map() 调用
    if (expr.type === 'CallExpression') {
      const mapResult = tryParseMapExpression(expr, ctx);
      if (mapResult) return mapResult;
    }

    // 普通表达式 - 创建文本节点（含插值）
    const exprCode = getNodeCode(expr as BabelTypes.Expression);
    const textId = generateNodeId('text');
    const textNode: TextNode = {
      id: textId,
      nodeType: 'text',
      content: `{{${exprCode}}}`,
      interpolations: [{
        expression: exprCode,
        startIndex: 0,
        endIndex: exprCode.length + 4,
      }],
      confidence: 0.9,
      confidenceLevel: 'high',
      sourceLocation: getSourceLocation((expr as BabelTypes.Node).loc),
    };
    ctx.nodes[textId] = textNode;
    return textId;
  }

  // JSX 元素
  if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
    return parseJSXElement(child, ctx);
  }

  // JSXSpreadChild 暂不支持
  if (child.type === 'JSXSpreadChild') {
    ctx.warnings.push({
      message: 'JSX 展开子节点暂不支持解析',
      level: 'info',
    });
  }

  return null;
}

/**
 * 解析条件渲染：三元表达式
 */
function parseConditionalExpression(expr: BabelTypes.ConditionalExpression, ctx: ParserContext): SemanticNodeId {
  const conditionCode = getNodeCode(expr.test);

  // 解析 true 分支
  let trueBranchId: SemanticNodeId;
  if (expr.consequent.type === 'JSXElement' || expr.consequent.type === 'JSXFragment') {
    trueBranchId = parseJSXElement(expr.consequent, ctx);
  } else if (expr.consequent.type === 'NullLiteral') {
    trueBranchId = generateNodeId('text');
    ctx.nodes[trueBranchId] = {
      id: trueBranchId,
      nodeType: 'text',
      content: '',
      confidence: 1.0,
      confidenceLevel: 'high',
    };
  } else {
    const code = getNodeCode(expr.consequent);
    trueBranchId = generateNodeId('text');
    ctx.nodes[trueBranchId] = {
      id: trueBranchId,
      nodeType: 'text',
      content: code,
      confidence: 0.7,
      confidenceLevel: 'medium',
      sourceLocation: getSourceLocation((expr.consequent as BabelTypes.Node).loc),
    };
  }

  // 解析 false 分支
  let falseBranchId: SemanticNodeId | undefined;
  if (expr.alternate.type === 'JSXElement' || expr.alternate.type === 'JSXFragment') {
    falseBranchId = parseJSXElement(expr.alternate, ctx);
  } else if (expr.alternate.type === 'NullLiteral') {
    // null 表示不渲染，不需要 false 分支
  } else {
    const code = getNodeCode(expr.alternate);
    falseBranchId = generateNodeId('text');
    ctx.nodes[falseBranchId] = {
      id: falseBranchId,
      nodeType: 'text',
      content: code,
      confidence: 0.7,
      confidenceLevel: 'medium',
      sourceLocation: getSourceLocation((expr.alternate as BabelTypes.Node).loc),
    };
  }

  // 创建条件渲染节点
  const condId = generateNodeId('conditional');
  const condNode: ConditionalRenderNode = {
    id: condId,
    nodeType: 'conditional-render',
    condition: conditionCode,
    trueBranch: trueBranchId,
    falseBranch: falseBranchId,
    conditionalKind: 'ternary',
    confidence: 0.85,
    confidenceLevel: 'high',
    sourceLocation: getSourceLocation(expr.loc),
  };
  ctx.nodes[condId] = condNode;
  return condId;
}

/**
 * 解析条件渲染：逻辑与表达式 (&&)
 */
function parseLogicalAndExpression(expr: BabelTypes.LogicalExpression, ctx: ParserContext): SemanticNodeId {
  const conditionCode = getNodeCode(expr.left);

  // 解析右侧（条件为真时的内容）
  let trueBranchId: SemanticNodeId;
  if (expr.right.type === 'JSXElement' || expr.right.type === 'JSXFragment') {
    trueBranchId = parseJSXElement(expr.right, ctx);
  } else {
    const code = getNodeCode(expr.right);
    trueBranchId = generateNodeId('text');
    ctx.nodes[trueBranchId] = {
      id: trueBranchId,
      nodeType: 'text',
      content: code,
      confidence: 0.8,
      confidenceLevel: 'high',
      sourceLocation: getSourceLocation((expr.right as BabelTypes.Node).loc),
    };
  }

  // 创建条件渲染节点
  const condId = generateNodeId('conditional');
  const condNode: ConditionalRenderNode = {
    id: condId,
    nodeType: 'conditional-render',
    condition: conditionCode,
    trueBranch: trueBranchId,
    conditionalKind: 'logical-and',
    confidence: 0.9,
    confidenceLevel: 'high',
    sourceLocation: getSourceLocation(expr.loc),
  };
  ctx.nodes[condId] = condNode;
  return condId;
}

/**
 * 尝试解析 .map() 列表渲染
 */
function tryParseMapExpression(
  expr: BabelTypes.CallExpression,
  ctx: ParserContext
): SemanticNodeId | null {
  // 检查是否是 .map() 调用
  if (
    expr.callee.type !== 'MemberExpression' ||
    expr.callee.property.type !== 'Identifier' ||
    expr.callee.property.name !== 'map'
  ) {
    return null;
  }

  // 获取被迭代的数组表达式
  const iterableExpr = getNodeCode(expr.callee.object as BabelTypes.Expression);

  // 获取 map 的回调参数
  const callback = expr.arguments[0];
  if (!callback) return null;

  let itemName = 'item';
  let indexName: string | undefined;
  let bodyId: SemanticNodeId;

  if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
    // 获取参数名
    const params = callback.params;
    if (params.length > 0 && params[0].type === 'Identifier') {
      itemName = params[0].name;
    }
    if (params.length > 1 && params[1].type === 'Identifier') {
      indexName = params[1].name;
    }

    // 解析回调体
    if (callback.body.type === 'BlockStatement') {
      // 块级回调体 - 提取 return 语句
      const returnStmt = callback.body.body.find(
        s => s.type === 'ReturnStatement'
      ) as BabelTypes.ReturnStatement | undefined;
      if (returnStmt?.argument) {
        if (returnStmt.argument.type === 'JSXElement' || returnStmt.argument.type === 'JSXFragment') {
          bodyId = parseJSXElement(returnStmt.argument, ctx);
        } else {
          const code = getNodeCode(returnStmt.argument);
          bodyId = generateNodeId('text');
          ctx.nodes[bodyId] = {
            id: bodyId,
            nodeType: 'text',
            content: code,
            confidence: 0.7,
            confidenceLevel: 'medium',
          };
        }
      } else {
        bodyId = generateNodeId('text');
        ctx.nodes[bodyId] = {
          id: bodyId,
          nodeType: 'text',
          content: '{ /* empty map body */ }',
          confidence: 0.5,
          confidenceLevel: 'medium',
        };
      }
    } else if (callback.body.type === 'JSXElement' || callback.body.type === 'JSXFragment') {
      bodyId = parseJSXElement(callback.body, ctx);
    } else {
      const code = getNodeCode(callback.body as BabelTypes.Expression);
      bodyId = generateNodeId('text');
      ctx.nodes[bodyId] = {
        id: bodyId,
        nodeType: 'text',
        content: code,
        confidence: 0.7,
        confidenceLevel: 'medium',
      };
    }
  } else {
    // 传递函数引用
    const code = getNodeCode(callback as BabelTypes.Expression);
    bodyId = generateNodeId('text');
    ctx.nodes[bodyId] = {
      id: bodyId,
      nodeType: 'text',
      content: code,
      confidence: 0.6,
      confidenceLevel: 'medium',
    };
  }

  // 创建列表渲染节点
  const listId = generateNodeId('list');
  const listNode: ListRenderNode = {
    id: listId,
    nodeType: 'list-render',
    iterableExpression: iterableExpr,
    itemName,
    indexName,
    keyExpression: undefined, // 将在属性解析中处理
    body: bodyId,
    confidence: 0.85,
    confidenceLevel: 'high',
    sourceLocation: getSourceLocation(expr.loc),
  };
  ctx.nodes[listId] = listNode;
  return listId;
}
