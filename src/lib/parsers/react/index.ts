/**
 * React 解析器 - 主入口
 * 将 React JSX/TSX 代码解析为 UISemanticTree 语义树
 * 使用 @babel/parser 和 @babel/traverse 实现 AST 遍历
 */

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type * as BabelTypes from '@babel/types';
import type {
  UISemanticTree,
  SemanticNodeId,
  RootComponentNode,
  ReactiveStateNode,
  ComputedPropNode,
  WatchEffectNode,
  Framework,
} from '../../semantic-tree/types';
import type { ParserContext } from './context';
import {
  resetIdCounter,
  generateNodeId,
  getSourceLocation,
  stripBlockBraces,
  getNodeCode,
  extractEffectBody,
  extractReferencedIdentifiers,
  generate,
} from './utils';
import {
  parseJSXElement,
} from './jsx-parser';

// 兼容 CommonJS 和 ESModule 的 traverse 导入
const traverse = typeof _traverse === 'function' ? _traverse : (_traverse as Record<string, unknown>).default as typeof _traverse;

/**
 * 解析 React 源码为 UISemanticTree
 * @param sourceCode React 组件源码（JSX/TSX）
 * @returns UISemanticTree 语义树
 */
export function parseReact(sourceCode: string): UISemanticTree {
  resetIdCounter();

  const ctx: ParserContext = {
    nodes: {},
    warnings: [],
    componentName: 'UnknownComponent',
    propsDefinition: [],
    hooks: new Map(),
    eventHandlers: new Map(),
    functionDeclarations: new Map(),
    imports: [],
    styleNodes: [],
  };

  // 步骤1：使用 Babel 解析源码为 AST
  let ast: BabelTypes.File;
  try {
    ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties'] as const,
      errorRecovery: true,
    });
  } catch (e) {
    ctx.warnings.push({
      message: `源码解析失败: ${e instanceof Error ? e.message : String(e)}`,
      level: 'error',
    });
    // 返回一个空的语义树
    const emptyId = generateNodeId('root');
    const emptyRoot: RootComponentNode = {
      id: emptyId,
      nodeType: 'root',
      componentName: 'ParseError',
      propsDefinition: [],
      body: '',
      sourceFramework: 'react' as Framework,
      confidence: 0,
      confidenceLevel: 'low',
    };
    return {
      id: `tree-${Date.now()}`,
      rootId: emptyId,
      nodes: { [emptyId]: emptyRoot },
      sourceFramework: 'react' as Framework,
      parsedAt: Date.now(),
      parseWarnings: ctx.warnings,
    };
  }

  // 步骤2：遍历 AST，收集组件信息
  traverse(ast, {
    // 收集导入语句
    ImportDeclaration(path) {
      const source = path.node.source.value;
      ctx.imports.push(source);
    },

    // 识别函数组件声明 & 收集函数声明
    FunctionDeclaration(path) {
      const name = path.node.id?.name;
      if (!name) return;

      // 判断是否为 React 组件（首字母大写 + 返回 JSX）
      if (name.charAt(0) === name.charAt(0).toUpperCase() && name.charAt(0) !== name.charAt(0).toLowerCase()) {
        ctx.componentName = name;
      } else {
        // 首字母小写，可能是事件处理函数
        const bodyCode = stripBlockBraces(generate(path.node.body).code);
        ctx.functionDeclarations.set(name, bodyCode);
      }
    },

    // 识别箭头函数组件 & 派生变量检测
    VariableDeclarator(path) {
      if (
        path.node.id.type === 'Identifier' &&
        path.node.init?.type === 'ArrowFunctionExpression'
      ) {
        const name = path.node.id.name;
        // 判断是否为 React 组件（首字母大写）
        if (name.charAt(0) === name.charAt(0).toUpperCase() && name.charAt(0) !== name.charAt(0).toLowerCase()) {
          ctx.componentName = name;
        }
      }

      // 派生变量检测：如果变量声明引用了其他 state 变量，视为计算属性
      if (
        path.node.id.type === 'Identifier' &&
        path.node.init &&
        path.node.init.type !== 'ArrowFunctionExpression' &&
        path.node.init.type !== 'FunctionExpression' &&
        path.node.init.type !== 'CallExpression' // Skip hook calls (useState, useMemo, etc.)
      ) {
        const varName = path.node.id.name;
        // Skip component names (capitalized)
        if (varName.charAt(0) === varName.charAt(0).toUpperCase() && varName.charAt(0) !== varName.charAt(0).toLowerCase()) {
          return;
        }

        // Skip variables already handled as hooks (they appear in ctx.hooks)
        if (ctx.hooks.has(varName)) return;

        // Check if the expression references any known state variables
        const referencedIds = extractReferencedIdentifiers(path.node.init);
        const stateDeps = referencedIds.filter(id => ctx.hooks.has(id));

        if (stateDeps.length > 0) {
          // This is a derived variable - create a ComputedPropNode
          const expression = getNodeCode(path.node.init);

          const nodeId = generateNodeId('computed');
          const computedNode: ComputedPropNode = {
            id: nodeId,
            nodeType: 'computed-prop',
            name: varName,
            expression,
            dependencies: stateDeps,
            hasSetter: false,
            confidence: 0.8,
            confidenceLevel: 'medium',
            sourceLocation: getSourceLocation(path.node.loc),
          };
          ctx.nodes[nodeId] = computedNode;

          ctx.warnings.push({
            message: `检测到派生变量 "${varName}"，已转换为计算属性（依赖: ${stateDeps.join(', ')}）`,
            level: 'info',
            location: getSourceLocation(path.node.loc),
          });
        }
      }
    },

    // 识别 useState 调用
    CallExpression(path) {
      const callee = path.node.callee;

      // useState
      if (callee.type === 'Identifier' && callee.name === 'useState') {
        const args = path.node.arguments;
        const initialValue = args.length > 0 ? getNodeCode(args[0] as BabelTypes.Expression) : 'undefined';

        // 从父级变量声明获取状态名
        const parentPath = path.parentPath;
        let stateName = 'state';
        let setterName = 'setState';

        if (parentPath?.isVariableDeclarator()) {
          const id = parentPath.node.id;
          if (id.type === 'ArrayPattern' && id.elements.length >= 2) {
            const firstEl = id.elements[0];
            const secondEl = id.elements[1];
            if (firstEl?.type === 'Identifier') {
              stateName = firstEl.name;
            }
            if (secondEl?.type === 'Identifier') {
              setterName = secondEl.name;
            }
          }
        }

        const nodeId = generateNodeId('state');
        const stateNode: ReactiveStateNode = {
          id: nodeId,
          nodeType: 'reactive-state',
          name: stateName,
          initialValue,
          stateKind: 'state',
          setterName,
          confidence: 0.95,
          confidenceLevel: 'high',
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = stateNode;
        ctx.hooks.set(stateName, { names: [stateName, setterName], nodeId });
      }

      // useMemo
      if (callee.type === 'Identifier' && callee.name === 'useMemo') {
        const args = path.node.arguments;
        let expression = '() => {}';
        let dependencies: string[] = [];

        if (args.length > 0 && (args[0].type === 'ArrowFunctionExpression' || args[0].type === 'FunctionExpression')) {
          const callback = args[0] as BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression;
          if (callback.body.type === 'BlockStatement') {
            // Extract the return expression from the BlockStatement
            // For useMemo, we want the actual returned value, not the `return` keyword
            const returnStmt = callback.body.body.find(
              s => s.type === 'ReturnStatement'
            ) as BabelTypes.ReturnStatement | undefined;

            if (callback.body.body.length === 1 && returnStmt?.argument) {
              // Single return statement: extract just the return expression
              expression = getNodeCode(returnStmt.argument);
            } else {
              // Multiple statements: generate the full body
              const bodyCode = generate(callback.body).code;
              expression = stripBlockBraces(bodyCode);
              // Keep `return` for multi-statement bodies - generators will wrap in block
            }
          } else {
            expression = getNodeCode(callback.body as BabelTypes.Expression);
          }
        }

        if (args.length > 1 && args[1].type === 'ArrayExpression') {
          dependencies = args[1].elements
            .filter((el): el is BabelTypes.Expression => el !== null && el !== undefined)
            .map(el => getNodeCode(el));
        }

        // 获取变量名
        const parentPath = path.parentPath;
        let computedName = 'computed';
        if (parentPath?.isVariableDeclarator() && parentPath.node.id.type === 'Identifier') {
          computedName = parentPath.node.id.name;
        }

        const nodeId = generateNodeId('computed');
        const computedNode: ComputedPropNode = {
          id: nodeId,
          nodeType: 'computed-prop',
          name: computedName,
          expression,
          dependencies,
          hasSetter: false,
          confidence: 0.9,
          confidenceLevel: 'high',
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = computedNode;
      }

      // useEffect
      if (callee.type === 'Identifier' && callee.name === 'useEffect') {
        const args = path.node.arguments;
        let callbackBody = '{ ... }';
        let cleanupBody: string | undefined;
        let sources: string[] = [];
        let effectKind: WatchEffectNode['effectKind'] = 'effect';
        let lifecycleKind: WatchEffectNode['lifecycleKind'] | undefined;

        if (args.length > 0 && (args[0].type === 'ArrowFunctionExpression' || args[0].type === 'FunctionExpression')) {
          const callback = args[0] as BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression;
          if (callback.body.type === 'BlockStatement') {
            // Extract actual source code from the BlockStatement using @babel/generator
            const fullBodyCode = generate(callback.body).code;

            // 检查是否有 return 清理函数
            const returnStmt = callback.body.body.find(
              s => s.type === 'ReturnStatement'
            ) as BabelTypes.ReturnStatement | undefined;
            if (returnStmt?.argument) {
              if (returnStmt.argument.type === 'ArrowFunctionExpression' || returnStmt.argument.type === 'FunctionExpression') {
                const cleanupFn = returnStmt.argument;
                cleanupBody = cleanupFn.body.type === 'BlockStatement'
                  ? stripBlockBraces(generate(cleanupFn.body).code)
                  : getNodeCode(cleanupFn.body as BabelTypes.Expression);
              } else {
                cleanupBody = getNodeCode(returnStmt.argument);
              }
            }

            // Extract the callback body, excluding the cleanup return statement if present
            callbackBody = extractEffectBody(callback.body, returnStmt);
          } else {
            callbackBody = getNodeCode(callback.body as BabelTypes.Expression);
          }
        }

        // 解析依赖数组
        if (args.length > 1 && args[1].type === 'ArrayExpression') {
          sources = args[1].elements
            .filter((el): el is BabelTypes.Expression => el !== null && el !== undefined)
            .map(el => getNodeCode(el));
        }

        // 根据依赖判断 effectKind
        if (sources.length === 0) {
          // 空依赖 → 生命周期 onMounted
          effectKind = 'lifecycle';
          lifecycleKind = 'onMounted';
        } else {
          effectKind = 'watch';
        }

        const nodeId = generateNodeId('effect');
        const effectNode: WatchEffectNode = {
          id: nodeId,
          nodeType: 'watch-effect',
          sources,
          callbackBody,
          immediate: false,
          deep: false,
          cleanupBody,
          effectKind,
          lifecycleKind,
          confidence: 0.75,
          confidenceLevel: 'medium',
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = effectNode;
      }

      // useRef
      if (callee.type === 'Identifier' && callee.name === 'useRef') {
        const args = path.node.arguments;
        const initialValue = args.length > 0 ? getNodeCode(args[0] as BabelTypes.Expression) : 'null';

        const parentPath = path.parentPath;
        let refName = 'ref';
        if (parentPath?.isVariableDeclarator() && parentPath.node.id.type === 'Identifier') {
          refName = parentPath.node.id.name;
        }

        const nodeId = generateNodeId('ref');
        const refNode: ReactiveStateNode = {
          id: nodeId,
          nodeType: 'reactive-state',
          name: refName,
          initialValue,
          stateKind: 'ref',
          confidence: 0.75,
          confidenceLevel: 'medium',
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = refNode;
        ctx.hooks.set(refName, { names: [refName], nodeId });
      }
    },
  });

  // 步骤3：再次遍历，解析 JSX 返回值
  let bodyId: SemanticNodeId = generateNodeId('component');

  traverse(ast, {
    // 查找组件的 return 语句中的 JSX
    ReturnStatement(path) {
      const argument = path.node.argument;
      if (!argument) return;

      // 只处理组件内的 return（排除嵌套函数中的 return）
      const funcParent = path.getFunctionParent();
      if (!funcParent) return;

      // 确认是组件函数
      if (
        funcParent.node.type === 'FunctionDeclaration' ||
        funcParent.node.type === 'ArrowFunctionExpression'
      ) {
        const funcName = funcParent.node.type === 'FunctionDeclaration'
          ? funcParent.node.id?.name
          : undefined;

        // 如果函数名匹配组件名，或者没有显式函数名但包含 JSX
        if (funcName === ctx.componentName || (!funcName && argument.type === 'JSXElement')) {
          if (argument.type === 'JSXElement' || argument.type === 'JSXFragment') {
            bodyId = parseJSXElement(argument, ctx);
          } else {
            // 返回非 JSX 表达式
            const code = getNodeCode(argument);
            const textId = generateNodeId('text');
            ctx.nodes[textId] = {
              id: textId,
              nodeType: 'text',
              content: code,
              confidence: 0.6,
              confidenceLevel: 'medium',
              sourceLocation: getSourceLocation(argument.loc),
            };
            bodyId = textId;
          }
        }
      }
    },
  });

  // 如果没有解析出组件体，创建一个空占位
  if (!ctx.nodes[bodyId]) {
    const emptyId = generateNodeId('text');
    ctx.nodes[emptyId] = {
      id: emptyId,
      nodeType: 'text',
      content: '{ /* 解析未完成 */ }',
      confidence: 0.3,
      confidenceLevel: 'low',
    };
    bodyId = emptyId;
  }

  // 步骤4：尝试解析 Props（从函数参数中提取）
  traverse(ast, {
    Function(path) {
      // 跳过嵌套函数（回调函数、内部函数等），只处理组件函数本身
      // 组件函数是没有父函数的最外层函数
      if (path.parentPath?.isFunction()) return;

      // 确认是组件函数：检查函数名是否匹配组件名
      let isComponentFunc = false;

      if (path.node.type === 'FunctionDeclaration') {
        // 命名函数声明：function Counter(props) { ... }
        const name = path.node.id?.name;
        isComponentFunc = name === ctx.componentName;
      } else if (path.node.type === 'ArrowFunctionExpression' || path.node.type === 'FunctionExpression') {
        // 箭头函数/函数表达式：const Counter = (props) => { ... }
        // 检查父级是否为 VariableDeclarator 且名称匹配组件名
        const parentPath = path.parentPath;
        if (parentPath?.isVariableDeclarator() && parentPath.node.id.type === 'Identifier') {
          isComponentFunc = parentPath.node.id.name === ctx.componentName;
        }
      }

      if (!isComponentFunc && ctx.componentName !== 'UnknownComponent') return;
      if (!isComponentFunc) return; // 即使 componentName 为 UnknownComponent，也跳过非组件函数

      // 清空已有的 props 定义（避免重复）
      ctx.propsDefinition.length = 0;

      const params = path.node.params;
      if (params.length > 0) {
        const firstParam = params[0];
        if (firstParam.type === 'Identifier') {
          // 如 function Counter(props) - 通用 props
          ctx.propsDefinition.push({
            name: firstParam.name,
            type: 'object',
            required: true,
            description: '组件属性',
          });
        } else if (firstParam.type === 'ObjectPattern') {
          // 如 function Counter({ count, onIncrement }) - 解构 props
          for (const prop of firstParam.properties) {
            if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
              ctx.propsDefinition.push({
                name: prop.key.name,
                type: 'any',
                required: !prop.value.type.toString().includes('AssignmentPattern'),
                description: `属性 ${prop.key.name}`,
              });
            }
          }
        }
      }
    },
  });

  // 步骤5：创建根节点
  const rootId = generateNodeId('root');
  const rootNode: RootComponentNode = {
    id: rootId,
    nodeType: 'root',
    componentName: ctx.componentName,
    propsDefinition: ctx.propsDefinition,
    body: bodyId,
    sourceFramework: 'react' as Framework,
    confidence: 0.9,
    confidenceLevel: 'high',
  };
  ctx.nodes[rootId] = rootNode;

  // 步骤6：构建语义树
  return {
    id: `tree-${Date.now()}`,
    rootId,
    nodes: ctx.nodes,
    sourceFramework: 'react' as Framework,
    parsedAt: Date.now(),
    parseWarnings: ctx.warnings,
  };
}
