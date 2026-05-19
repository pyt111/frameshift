/**
 * Angular 解析器 - 装饰器和模板解析
 * 提取 @Component 装饰器信息、signal()/computed()、生命周期钩子、事件处理方法
 * 解析 Angular 17+ 模板语法中的 @if、@for、事件绑定、属性绑定
 */

import { parse as parseBabel } from '@babel/parser';
import type * as BabelTypes from '@babel/types';
import type {
  SemanticNodeId,
  ReactiveStateNode,
  ComputedPropNode,
  WatchEffectNode,
  EventHandlerNode,
  ConditionalRenderNode,
  ListRenderNode,
  ComponentNode,
  TextNode,
  StyleNode,
  ComponentProp,
  VModelInfo,
} from '../../semantic-tree/types';
import { generateNodeId, getSourceLocation, stripBlockBraces, getNodeCode, isNativeElement, traverse, generate } from './utils';
import type { AngularParserContext } from './context';

/**
 * 解析 Angular TypeScript 类
 * 提取 signal()、computed()、生命周期钩子、事件处理方法
 */
export function parseComponentClass(
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
export function parseTemplateContent(template: string, ctx: AngularParserContext): SemanticNodeId | null {
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
