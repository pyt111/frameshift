/**
 * Angular 解析器
 * 将 Angular 17+ 组件代码解析为 UISemanticTree 语义树
 * 支持 standalone 组件、signal()、computed()、@if/@for 控制流
 */

import { parse as parseBabel } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import type * as BabelTypes from '@babel/types';
import type {
  UISemanticTree,
  SemanticNode,
  SemanticNodeId,
  RootComponentNode,
  ComponentNode,
  TextNode,
  ReactiveStateNode,
  ComputedPropNode,
  WatchEffectNode,
  EventHandlerNode,
  ConditionalRenderNode,
  ListRenderNode,
  StyleNode,
  ComponentProp,
  ExpressionValue,
  VModelInfo,
  PropDefinition,
  ParseWarning,
  Framework,
} from '../semantic-tree/types';
import { getConfidenceLevel } from '../translator/confidence';

// 兼容 CommonJS 和 ESModule 的 traverse 导入
const traverse = typeof _traverse === 'function' ? _traverse : (_traverse as Record<string, unknown>).default as typeof _traverse;

// 兼容 CommonJS 和 ESModule 的 generate 导入
const generate = typeof _generate === 'function' ? _generate : (_generate as Record<string, unknown>).default as typeof _generate;

/** 生成唯一节点 ID 的计数器 */
let nodeIdCounter = 0;

/** 生成唯一节点 ID */
function generateNodeId(prefix: string): SemanticNodeId {
  nodeIdCounter += 1;
  return `${prefix}-${nodeIdCounter}`;
}

/** 重置 ID 计数器 */
function resetIdCounter(): void {
  nodeIdCounter = 0;
}

/** 从 Babel AST 节点获取源码位置信息 */
function getSourceLocation(loc: BabelTypes.SourceLocation | null | undefined): RootComponentNode['sourceLocation'] {
  if (!loc) return undefined;
  return {
    startLine: loc.start.line,
    startColumn: loc.start.column,
    endLine: loc.end.line,
    endColumn: loc.end.column,
  };
}

/** 解析器上下文 */
interface AngularParserContext {
  /** 所有语义节点 */
  nodes: Record<SemanticNodeId, SemanticNode>;
  /** 解析警告 */
  warnings: ParseWarning[];
  /** 组件名称 */
  componentName: string;
  /** Props 定义 */
  propsDefinition: PropDefinition[];
  /** 样式节点列表 */
  styleNodes: StyleNode[];
  /** 事件处理函数 */
  eventHandlers: Map<string, { handlerName: string; handlerBody: string; eventParam?: string; isInline: boolean }>;
  /** 收集的 signal 名称 */
  signalNames: Set<string>;
  /** 收集的 computed 名称 */
  computedNames: Set<string>;
  /** 模板内容 */
  templateContent: string;
  /** 样式内容 */
  stylesContent: string;
  /** selector */
  selector: string;
}

/**
 * 获取 AST 节点的源码文本表示（简化版）
 */
function getNodeCode(node: BabelTypes.Node): string {
  try {
    switch (node.type) {
      case 'Identifier':
        return (node as BabelTypes.Identifier).name;
      case 'StringLiteral':
        return `"${(node as BabelTypes.StringLiteral).value}"`;
      case 'NumericLiteral':
        return String((node as BabelTypes.NumericLiteral).value);
      case 'BooleanLiteral':
        return String((node as BabelTypes.BooleanLiteral).value);
      case 'NullLiteral':
        return 'null';
      case 'MemberExpression': {
        const mem = node as BabelTypes.MemberExpression;
        const obj = getNodeCode(mem.object);
        const prop = mem.computed ? `[${getNodeCode(mem.property)}]` : `.${getNodeCode(mem.property)}`;
        return `${obj}${prop}`;
      }
      case 'CallExpression': {
        const call = node as BabelTypes.CallExpression;
        const callee = getNodeCode(call.callee);
        const args = call.arguments.map(arg => {
          if (arg.type === 'SpreadElement') return `...${getNodeCode(arg.argument)}`;
          return getNodeCode(arg as BabelTypes.Expression);
        }).join(', ');
        return `${callee}(${args})`;
      }
      case 'ArrowFunctionExpression': {
        const arrow = node as BabelTypes.ArrowFunctionExpression;
        const params = arrow.params.map(p => getNodeCode(p)).join(', ');
        const body = arrow.body.type === 'BlockStatement'
          ? '{ ... }'
          : getNodeCode(arrow.body as BabelTypes.Expression);
        return `(${params}) => ${body}`;
      }
      case 'BinaryExpression': {
        const bin = node as BabelTypes.BinaryExpression;
        return `${getNodeCode(bin.left)} ${bin.operator} ${getNodeCode(bin.right)}`;
      }
      case 'LogicalExpression': {
        const logical = node as BabelTypes.LogicalExpression;
        return `${getNodeCode(logical.left)} ${logical.operator} ${getNodeCode(logical.right)}`;
      }
      case 'ConditionalExpression': {
        const cond = node as BabelTypes.ConditionalExpression;
        return `${getNodeCode(cond.test)} ? ${getNodeCode(cond.consequent)} : ${getNodeCode(cond.alternate)}`;
      }
      case 'TemplateLiteral': {
        const tmpl = node as BabelTypes.TemplateLiteral;
        return `\`${tmpl.quasis.map(q => q.value.cooked ?? '').join('${...}')}\``;
      }
      case 'ObjectExpression': {
        const obj = node as BabelTypes.ObjectExpression;
        const props = obj.properties.map(p => {
          if (p.type === 'ObjectProperty') {
            const key = p.computed ? `[${getNodeCode(p.key as BabelTypes.Expression)}]` : getNodeCode(p.key as BabelTypes.Expression);
            return `${key}: ${getNodeCode(p.value as BabelTypes.Expression)}`;
          }
          return '...';
        }).join(', ');
        return `{ ${props} }`;
      }
      case 'ArrayExpression': {
        const arr = node as BabelTypes.ArrayExpression;
        const elems = arr.elements.map(e => e ? (e.type === 'SpreadElement' ? `...${getNodeCode(e.argument)}` : getNodeCode(e as BabelTypes.Expression)) : '').join(', ');
        return `[${elems}]`;
      }
      case 'UnaryExpression': {
        const unary = node as BabelTypes.UnaryExpression;
        return `${unary.operator}${getNodeCode(unary.argument)}`;
      }
      case 'UpdateExpression': {
        const update = node as BabelTypes.UpdateExpression;
        return update.prefix ? `${update.operator}${getNodeCode(update.argument)}` : `${getNodeCode(update.argument)}${update.operator}`;
      }
      case 'AssignmentExpression': {
        const assign = node as BabelTypes.AssignmentExpression;
        return `${getNodeCode(assign.left)} ${assign.operator} ${getNodeCode(assign.right)}`;
      }
      case 'NewExpression': {
        const ne = node as BabelTypes.NewExpression;
        const callee = getNodeCode(ne.callee);
        const args = ne.arguments.map(arg => getNodeCode(arg as BabelTypes.Expression)).join(', ');
        return `new ${callee}(${args})`;
      }
      default:
        return node.type;
    }
  } catch {
    return node.type;
  }
}

/**
 * 判断表达式类型
 */
function getExpressionType(node: BabelTypes.Node): ExpressionValue['type'] {
  switch (node.type) {
    case 'Identifier':
      return 'identifier';
    case 'MemberExpression':
      return 'member';
    case 'CallExpression':
      return 'call';
    case 'BinaryExpression':
    case 'LogicalExpression':
      return 'binary';
    case 'ConditionalExpression':
      return 'ternary';
    case 'TemplateLiteral':
      return 'template';
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return 'arrow-function';
    default:
      return 'other';
  }
}

/**
 * 判断标签名是否为原生 HTML 元素
 */
function isNativeElement(tagName: string): boolean {
  const nativeTags = new Set([
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'button', 'input', 'form', 'label',
    'select', 'option', 'textarea', 'img', 'video', 'audio',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'header', 'footer', 'nav', 'main', 'section', 'article', 'aside',
    'br', 'hr', 'strong', 'em', 'code', 'pre',
  ]);
  return nativeTags.has(tagName.toLowerCase());
}

/**
 * 去除 BlockStatement 外层的花括号并格式化内部代码
 */
function stripBlockBraces(code: string): string {
  const trimmed = code.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    let inner = trimmed.slice(1, -1);
    const lines = inner.split('\n');
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);
    const minIndent = nonEmptyLines.reduce((min, line) => {
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      return Math.min(min, indent);
    }, Infinity);
    if (minIndent < Infinity && minIndent > 0) {
      inner = lines.map(l => l.length > 0 ? l.slice(minIndent) : l).join('\n');
    }
    return inner.trim();
  }
  return trimmed;
}

/**
 * 解析 Angular TypeScript 类
 * 提取 signal()、computed()、生命周期钩子、事件处理方法
 */
function parseComponentClass(
  sourceCode: string,
  ctx: AngularParserContext
): void {
  let ast: BabelTypes.File;
  try {
    ast = parseBabel(sourceCode, {
      sourceType: 'module',
      plugins: ['typescript', 'decorators-legacy', 'classProperties'] as const,
      errorRecovery: true,
    });
  } catch (e) {
    ctx.warnings.push({
      message: `Angular component class 解析失败: ${e instanceof Error ? e.message : String(e)}`,
      level: 'error',
    });
    return;
  }

  // Extract template and styles from @Component decorator
  traverse(ast, {
    ClassDeclaration(path) {
      if (path.node.id) {
        ctx.componentName = path.node.id.name;
      }
    },

    Decorator(path) {
      const expr = path.node.expression;
      if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier' && expr.callee.name === 'Component') {
        // Extract @Component decorator properties
        const args = expr.arguments;
        if (args.length > 0 && args[0].type === 'ObjectExpression') {
          const obj = args[0] as BabelTypes.ObjectExpression;
          for (const prop of obj.properties) {
            if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
              const keyName = prop.key.name;
              if (keyName === 'template' && prop.value.type === 'StringLiteral') {
                ctx.templateContent = (prop.value as BabelTypes.StringLiteral).value;
              }
              if (keyName === 'styles' && prop.value.type === 'ArrayExpression') {
                const arr = prop.value as BabelTypes.ArrayExpression;
                if (arr.elements.length > 0 && arr.elements[0]?.type === 'StringLiteral') {
                  ctx.stylesContent = (arr.elements[0] as BabelTypes.StringLiteral).value;
                }
              }
              if (keyName === 'selector' && prop.value.type === 'StringLiteral') {
                ctx.selector = (prop.value as BabelTypes.StringLiteral).value;
              }
            }
          }
        }
      }
    },

    ClassProperty(path) {
      // Parse class properties like: count = signal(0);
      const node = path.node;
      if (
        node.key.type === 'Identifier' &&
        node.value &&
        node.value.type === 'CallExpression'
      ) {
        const callExpr = node.value as BabelTypes.CallExpression;
        const name = node.key.name;

        // signal() → ReactiveStateNode
        if (callExpr.callee.type === 'Identifier' && callExpr.callee.name === 'signal') {
          const args = callExpr.arguments;
          const initialValue = args.length > 0 ? getNodeCode(args[0] as BabelTypes.Expression) : 'undefined';

          ctx.signalNames.add(name);

          const nodeId = generateNodeId('state');
          const stateNode: ReactiveStateNode = {
            id: nodeId,
            nodeType: 'reactive-state',
            name,
            initialValue,
            stateKind: 'state',
            confidence: 0.95,
            confidenceLevel: 'high',
            sourceLocation: getSourceLocation(node.loc),
          };
          ctx.nodes[nodeId] = stateNode;
          return;
        }

        // computed() → ComputedPropNode
        if (callExpr.callee.type === 'Identifier' && callExpr.callee.name === 'computed') {
          const args = callExpr.arguments;
          let expression = '() => {}';
          let dependencies: string[] = [];

          if (args.length > 0) {
            const firstArg = args[0];
            if (firstArg.type === 'ArrowFunctionExpression' || firstArg.type === 'FunctionExpression') {
              const fn = firstArg as BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression;
              if (fn.body.type === 'BlockStatement') {
                const returnStmt = fn.body.body.find(s => s.type === 'ReturnStatement') as BabelTypes.ReturnStatement | undefined;
                if (fn.body.body.length === 1 && returnStmt?.argument) {
                  expression = getNodeCode(returnStmt.argument);
                } else {
                  const bodyCode = generate(fn.body).code;
                  expression = stripBlockBraces(bodyCode);
                }
              } else {
                expression = getNodeCode(fn.body as BabelTypes.Expression);
              }
            } else if (firstArg.type === 'ObjectExpression') {
              // computed({ get, set })
              const obj = firstArg as BabelTypes.ObjectExpression;
              for (const prop of obj.properties) {
                if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
                  if (prop.key.name === 'get') {
                    expression = getNodeCode(prop.value as BabelTypes.Expression);
                  }
                }
              }
            }
          }

          ctx.computedNames.add(name);

          const nodeId = generateNodeId('computed');
          const computedNode: ComputedPropNode = {
            id: nodeId,
            nodeType: 'computed-prop',
            name,
            expression,
            dependencies,
            hasSetter: false,
            confidence: 0.9,
            confidenceLevel: 'high',
            sourceLocation: getSourceLocation(node.loc),
          };
          ctx.nodes[nodeId] = computedNode;
          return;
        }
      }
    },

    ClassMethod(path) {
      const node = path.node;
      if (node.key.type === 'Identifier') {
        const methodName = node.key.name;

        // ngOnInit → onMounted lifecycle
        if (methodName === 'ngOnInit') {
          const bodyCode = generate(node.body).code;
          const callbackBody = stripBlockBraces(bodyCode);

          const nodeId = generateNodeId('lifecycle');
          const lifecycleNode: WatchEffectNode = {
            id: nodeId,
            nodeType: 'watch-effect',
            sources: [],
            callbackBody,
            immediate: false,
            deep: false,
            effectKind: 'lifecycle',
            lifecycleKind: 'onMounted',
            confidence: 0.9,
            confidenceLevel: 'high',
            sourceLocation: getSourceLocation(node.loc),
          };
          ctx.nodes[nodeId] = lifecycleNode;
          return;
        }

        // ngOnDestroy → onUnmounted lifecycle
        if (methodName === 'ngOnDestroy') {
          const bodyCode = generate(node.body).code;
          const callbackBody = stripBlockBraces(bodyCode);

          const nodeId = generateNodeId('lifecycle');
          const lifecycleNode: WatchEffectNode = {
            id: nodeId,
            nodeType: 'watch-effect',
            sources: [],
            callbackBody,
            immediate: false,
            deep: false,
            effectKind: 'lifecycle',
            lifecycleKind: 'onUnmounted',
            confidence: 0.9,
            confidenceLevel: 'high',
            sourceLocation: getSourceLocation(node.loc),
          };
          ctx.nodes[nodeId] = lifecycleNode;
          return;
        }

        // ngAfterViewInit → onUpdated-like
        if (methodName === 'ngAfterViewInit') {
          const bodyCode = generate(node.body).code;
          const callbackBody = stripBlockBraces(bodyCode);

          const nodeId = generateNodeId('lifecycle');
          const lifecycleNode: WatchEffectNode = {
            id: nodeId,
            nodeType: 'watch-effect',
            sources: [],
            callbackBody,
            immediate: false,
            deep: false,
            effectKind: 'lifecycle',
            lifecycleKind: 'onUpdated',
            confidence: 0.8,
            confidenceLevel: 'high',
            sourceLocation: getSourceLocation(node.loc),
          };
          ctx.nodes[nodeId] = lifecycleNode;
          return;
        }

        // Regular methods → event handlers
        const bodyCode = generate(node.body).code;
        const handlerBody = stripBlockBraces(bodyCode);
        const params = node.params.map(p => getNodeCode(p as BabelTypes.Node));
        const eventParam = params[0];

        ctx.eventHandlers.set(methodName, {
          handlerName: methodName,
          handlerBody,
          eventParam,
          isInline: false,
        });

        // Create event handler node
        const handlerNodeId = generateNodeId('handler');
        const handlerNode: EventHandlerNode = {
          id: handlerNodeId,
          nodeType: 'event-handler',
          eventName: methodName.replace(/^handle/, '').toLowerCase(),
          handlerName: methodName,
          handlerBody,
          eventParam,
          isInline: false,
          confidence: 0.9,
          confidenceLevel: 'high',
          sourceLocation: getSourceLocation(node.loc),
        };
        ctx.nodes[handlerNodeId] = handlerNode;
      }
    },
  });
}

/**
 * 简单的 Angular 模板解析器
 * 解析 Angular 17+ 模板语法中的 @if、@for、事件绑定、属性绑定
 * 注意：这是一个简化的正则解析器，不支持所有 Angular 模板语法
 */
function parseTemplateContent(template: string, ctx: AngularParserContext): SemanticNodeId | null {
  if (!template.trim()) return null;

  // For simplicity, parse the template with regex for common patterns
  // A full implementation would use Angular's template parser

  // Parse @if blocks
  // Parse @for blocks
  // Parse regular HTML elements with Angular bindings

  // Use a simplified recursive descent approach
  return parseTemplateNode(template, ctx);
}

/**
 * 解析模板节点 - 递归下降
 */
function parseTemplateNode(template: string, ctx: AngularParserContext): SemanticNodeId | null {
  const trimmed = template.trim();
  if (!trimmed) return null;

  // Try to parse @if block
  const ifMatch = trimmed.match(/^@if\s*\((.+?)\)\s*\{([\s\S]*)\}\s*(?:@else\s*\{([\s\S]*)\})?$/);
  if (ifMatch) {
    const condition = ifMatch[1];
    const trueContent = ifMatch[2];
    const falseContent = ifMatch[3];

    const trueBranchId = parseTemplateNode(trueContent, ctx) || generateNodeId('text');
    if (!ctx.nodes[trueBranchId]) {
      ctx.nodes[trueBranchId] = {
        id: trueBranchId,
        nodeType: 'text',
        content: trueContent.trim(),
        confidence: 0.7,
        confidenceLevel: 'medium',
      };
    }

    let falseBranchId: SemanticNodeId | undefined;
    if (falseContent) {
      falseBranchId = parseTemplateNode(falseContent, ctx) || generateNodeId('text');
      if (!ctx.nodes[falseBranchId]) {
        ctx.nodes[falseBranchId] = {
          id: falseBranchId,
          nodeType: 'text',
          content: falseContent.trim(),
          confidence: 0.7,
          confidenceLevel: 'medium',
        };
      }
    }

    const condId = generateNodeId('conditional');
    const condNode: ConditionalRenderNode = {
      id: condId,
      nodeType: 'conditional-render',
      condition,
      trueBranch: trueBranchId,
      falseBranch: falseBranchId,
      conditionalKind: 'if',
      confidence: 0.9,
      confidenceLevel: 'high',
    };
    ctx.nodes[condId] = condNode;
    return condId;
  }

  // Try to parse @for block
  const forMatch = trimmed.match(/^@for\s*\((.+?)\s+of\s+(.+?)(?:;\s*track\s+(.+?))?\)\s*\{([\s\S]*)\}$/);
  if (forMatch) {
    const itemName = forMatch[1].trim();
    const iterableExpression = forMatch[2].trim();
    const trackExpr = forMatch[3];
    const bodyContent = forMatch[4];

    const bodyId = parseTemplateNode(bodyContent, ctx) || generateNodeId('text');
    if (!ctx.nodes[bodyId]) {
      ctx.nodes[bodyId] = {
        id: bodyId,
        nodeType: 'text',
        content: bodyContent.trim(),
        confidence: 0.7,
        confidenceLevel: 'medium',
      };
    }

    const listId = generateNodeId('list');
    const listNode: ListRenderNode = {
      id: listId,
      nodeType: 'list-render',
      iterableExpression,
      itemName,
      keyExpression: trackExpr,
      body: bodyId,
      confidence: 0.9,
      confidenceLevel: 'high',
    };
    ctx.nodes[listId] = listNode;
    return listId;
  }

  // Try to parse HTML element
  const elementMatch = trimmed.match(/^<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)(?:\/>|>([\s\S]*)<\/\1>)$/);
  if (elementMatch) {
    const tagName = elementMatch[1];
    const attrsStr = elementMatch[2];
    const innerContent = elementMatch[3];

    // Parse attributes
    const props: ComponentProp[] = [];
    let vModelInfo: VModelInfo | undefined;

    // Parse Angular attribute bindings
    // [(ngModel)]="var" → v-model
    const ngModelMatches = attrsStr.matchAll(/\[\(ngModel\)\]="([^"]+)"/g);
    for (const match of ngModelMatches) {
      const modelVar = match[1];
      const setterName = `set${modelVar.charAt(0).toUpperCase() + modelVar.slice(1)}`;
      vModelInfo = {
        modelVarName: modelVar,
        setterName,
        tagName: tagName.toLowerCase(),
      };
      props.push({
        name: 'v-model',
        value: { expression: modelVar, type: 'identifier' },
        isDynamic: true,
      });
    }

    // (click)="handler()" → event binding
    const eventMatches = attrsStr.matchAll(/\(([^)]+)\)="([^"]+)"/g);
    for (const match of eventMatches) {
      const eventName = match[1];
      const handlerExpr = match[2];

      // Skip ngModel events
      if (eventName === 'ngModelChange') continue;

      props.push({
        name: `@${eventName}`,
        value: { expression: handlerExpr, type: 'other' },
        isDynamic: true,
        originalName: `@${eventName}`,
      });

      // Create event handler node
      const handlerId = generateNodeId('handler');
      const isInline = !handlerExpr.includes('{') && handlerExpr.length < 30;
      const handlerNode: EventHandlerNode = {
        id: handlerId,
        nodeType: 'event-handler',
        eventName,
        handlerName: handlerExpr.replace(/\(.*\)$/, '') || handlerExpr,
        handlerBody: handlerExpr,
        isInline,
        confidence: 0.95,
        confidenceLevel: 'high',
      };
      ctx.nodes[handlerId] = handlerNode;
    }

    // [prop]="expr" → property binding
    const propMatches = attrsStr.matchAll(/\[([^\]]+)\]="([^"]+)"/g);
    for (const match of propMatches) {
      const propName = match[1];
      const propExpr = match[2];

      // Skip ngModel
      if (propName === 'ngModel') continue;

      if (propName === 'class') {
        props.push({
          name: 'class',
          value: { expression: propExpr, type: 'other' },
          isDynamic: true,
          originalName: 'class',
        });
      } else if (propName === 'style') {
        const styleId = generateNodeId('style');
        const styleNode: StyleNode = {
          id: styleId,
          nodeType: 'style',
          styleKind: 'inline',
          content: propExpr,
          preprocessor: 'css',
          confidence: 0.9,
          confidenceLevel: 'high',
        };
        ctx.nodes[styleId] = styleNode;

        props.push({
          name: 'style',
          value: { expression: propExpr, type: 'other' },
          isDynamic: true,
        });
      } else if (propName.startsWith('style.')) {
        // [style.color]="expr" → inline style
        props.push({
          name: `:${propName}`,
          value: { expression: propExpr, type: 'other' },
          isDynamic: true,
        });
      } else {
        props.push({
          name: `:${propName}`,
          value: { expression: propExpr, type: 'other' },
          isDynamic: true,
        });
      }
    }

    // Static attributes
    const staticAttrMatches = attrsStr.matchAll(/\s([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g);
    for (const match of staticAttrMatches) {
      const attrName = match[1];
      const attrValue = match[2];

      // Skip attributes already parsed as bindings
      if (props.some(p => p.name === attrName || p.name === `:${attrName}`)) continue;

      props.push({
        name: attrName,
        value: attrValue,
        isDynamic: false,
      });
    }

    // Parse children
    const childIds: SemanticNodeId[] = [];
    if (innerContent) {
      // Simple child parsing - handle text and interpolation
      const childId = parseTemplateNode(innerContent, ctx);
      if (childId) childIds.push(childId);
    }

    // Create component node
    const componentId = generateNodeId('component');
    const componentNode: ComponentNode = {
      id: componentId,
      nodeType: 'component',
      tagName,
      isNativeElement: isNativeElement(tagName),
      props,
      children: childIds,
      confidence: isNativeElement(tagName) ? 1.0 : 0.85,
      confidenceLevel: 'high',
      vModelInfo,
    };
    ctx.nodes[componentId] = componentNode;
    return componentId;
  }

  // Text content with interpolation
  // Convert Angular {{ expr }} to our internal format
  const content = trimmed;
  const textId = generateNodeId('text');

  // Check for interpolation
  const interpolationMatches = content.matchAll(/\{\{(.+?)\}\}/g);
  const interpolations: { expression: string; startIndex: number; endIndex: number }[] = [];
  for (const match of interpolationMatches) {
    interpolations.push({
      expression: match[1].trim(),
      startIndex: match.index ?? 0,
      endIndex: (match.index ?? 0) + match[0].length,
    });
  }

  const textNode: TextNode = {
    id: textId,
    nodeType: 'text',
    content,
    interpolations: interpolations.length > 0 ? interpolations : undefined,
    confidence: 0.9,
    confidenceLevel: 'high',
  };
  ctx.nodes[textId] = textNode;
  return textId;
}

/**
 * 解析 Angular 组件源码为 UISemanticTree
 * @param sourceCode Angular 组件源码（TypeScript + template + styles）
 * @returns UISemanticTree 语义树
 */
export function parseAngular(sourceCode: string): UISemanticTree {
  resetIdCounter();

  const ctx: AngularParserContext = {
    nodes: {},
    warnings: [],
    componentName: 'AngularComponent',
    propsDefinition: [],
    styleNodes: [],
    eventHandlers: new Map(),
    signalNames: new Set(),
    computedNames: new Set(),
    templateContent: '',
    stylesContent: '',
    selector: '',
  };

  // Step 1: Parse the TypeScript class to extract signals, computed, methods, etc.
  parseComponentClass(sourceCode, ctx);

  // Step 2: Parse the template content
  if (ctx.templateContent) {
    const bodyId = parseTemplateContent(ctx.templateContent, ctx);
    if (bodyId) {
      // Create root component node
      const rootId = generateNodeId('root');
      const rootNode: RootComponentNode = {
        id: rootId,
        nodeType: 'root',
        componentName: ctx.componentName,
        propsDefinition: ctx.propsDefinition,
        body: bodyId,
        sourceFramework: 'angular' as Framework,
        confidence: 0.9,
        confidenceLevel: 'high',
      };
      ctx.nodes[rootId] = rootNode;

      return {
        id: `tree-${Date.now()}`,
        rootId,
        nodes: ctx.nodes,
        sourceFramework: 'angular' as Framework,
        parsedAt: Date.now(),
        parseWarnings: ctx.warnings,
      };
    }
  }

  // Fallback: create a minimal tree if template parsing failed
  const emptyId = generateNodeId('root');
  const emptyRoot: RootComponentNode = {
    id: emptyId,
    nodeType: 'root',
    componentName: ctx.componentName,
    propsDefinition: [],
    body: '',
    sourceFramework: 'angular' as Framework,
    confidence: 0.3,
    confidenceLevel: 'low',
  };

  const placeholderId = generateNodeId('text');
  ctx.nodes[placeholderId] = {
    id: placeholderId,
    nodeType: 'text',
    content: '// Angular component parsed (template extraction may be limited)',
    confidence: 0.5,
    confidenceLevel: 'medium',
  };
  emptyRoot.body = placeholderId;
  ctx.nodes[emptyId] = emptyRoot;

  ctx.warnings.push({
    message: 'Angular 模板解析受限，建议手动检查生成的代码',
    level: 'info',
  });

  return {
    id: `tree-${Date.now()}`,
    rootId: emptyId,
    nodes: ctx.nodes,
    sourceFramework: 'angular' as Framework,
    parsedAt: Date.now(),
    parseWarnings: ctx.warnings,
  };
}
