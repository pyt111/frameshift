/**
 * Vue Script Setup 解析器
 * 使用 Babel 解析 <script setup> 块，提取 ref/reactive/computed/watch 等
 * 同时捕获所有 import 语句和未被白名单处理的代码
 */

import { parse as parseBabel } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import type * as BabelTypes from '@babel/types';

import type {
  ReactiveStateNode,
  ComputedPropNode,
  WatchEffectNode,
} from '../../semantic-tree/types';

import { generateNodeId, getNodeCode, getSourceLocation } from './utils';
import { markStatementHandled } from './context';
import type { VueParserContext } from './context';

// 兼容 CommonJS 和 ESModule 的 traverse 导入
const traverse = typeof _traverse === 'function' ? _traverse : (_traverse as Record<string, unknown>).default as typeof _traverse;

// 兼容 CommonJS 和 ESModule 的 generate 导入
const generate = typeof _generate === 'function' ? _generate : (_generate as Record<string, unknown>).default as typeof _generate;

/**
 * 解析 <script setup> 块
 * 使用 Babel 解析，提取 ref/reactive/computed/watch 等
 * 同时捕获所有 import 语句和未被白名单处理的代码
 */
export function parseScriptSetup(
  scriptContent: string,
  ctx: VueParserContext
): void {
  let ast: BabelTypes.File;
  try {
    ast = parseBabel(scriptContent, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch (e) {
    ctx.warnings.push({
      message: `Script setup 解析失败: ${e instanceof Error ? e.message : String(e)}`,
      level: 'error',
    });
    // 解析失败时，保留原始代码
    ctx.rawScriptCode = scriptContent;
    return;
  }

  // 已被白名单处理过的 AST 节点路径集合
  const handledPaths = new Set<BabelTypes.Node>();

  // 已处理的顶层语句行号集合
  const handledLineNumbers = new Set<number>();

  traverse(ast, {
    // 捕获 import 语句
    ImportDeclaration(path) {
      const importCode = generate(path.node).code;
      ctx.importStatements.push(importCode);
      // 记录已处理的行号范围
      if (path.node.loc) {
        for (let line = path.node.loc.start.line; line <= path.node.loc.end.line; line++) {
          handledLineNumbers.add(line);
        }
      }
      handledPaths.add(path.node);
    },

    // 解析 ref() 调用
    CallExpression(path) {
      const callee = path.node.callee;

      // ref()
      if (callee.type === 'Identifier' && callee.name === 'ref') {
        const args = path.node.arguments;
        const initialValue = args.length > 0 ? getNodeCode(args[0] as BabelTypes.Expression) : 'undefined';

        const parentPath = path.parentPath;
        let refName = 'ref';
        if (parentPath?.isVariableDeclarator() && parentPath.node.id.type === 'Identifier') {
          refName = parentPath.node.id.name;
        }

        const nodeId = generateNodeId('state');
        const stateNode: ReactiveStateNode = {
          id: nodeId,
          nodeType: 'reactive-state',
          name: refName,
          initialValue,
          stateKind: 'ref',
          confidence: 0.95,
          confidenceLevel: 'high',
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = stateNode;
        // 标记此语句为已处理
        markStatementHandled(path, handledLineNumbers);
        return;
      }

      // reactive()
      if (callee.type === 'Identifier' && callee.name === 'reactive') {
        const args = path.node.arguments;
        const initialValue = args.length > 0 ? getNodeCode(args[0] as BabelTypes.Expression) : '{}';

        const parentPath = path.parentPath;
        let reactiveName = 'state';
        if (parentPath?.isVariableDeclarator() && parentPath.node.id.type === 'Identifier') {
          reactiveName = parentPath.node.id.name;
        }

        const nodeId = generateNodeId('state');
        const stateNode: ReactiveStateNode = {
          id: nodeId,
          nodeType: 'reactive-state',
          name: reactiveName,
          initialValue,
          stateKind: 'reactive',
          confidence: 0.9,
          confidenceLevel: 'high',
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = stateNode;
        markStatementHandled(path, handledLineNumbers);
        return;
      }

      // computed()
      if (callee.type === 'Identifier' && callee.name === 'computed') {
        const args = path.node.arguments;
        let expression = '() => {}';
        let dependencies: string[] = [];
        let hasSetter = false;
        let setterExpression: string | undefined;

        if (args.length > 0) {
          const firstArg = args[0];
          if (firstArg.type === 'ArrowFunctionExpression' || firstArg.type === 'FunctionExpression') {
            const fn = firstArg as BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression;
            if (fn.body.type === 'BlockStatement') {
              const returnStmt = fn.body.body.find(
                s => s.type === 'ReturnStatement'
              ) as BabelTypes.ReturnStatement | undefined;

              if (fn.body.body.length === 1 && returnStmt?.argument) {
                expression = getNodeCode(returnStmt.argument);
              } else {
                const bodyCode = generate(fn.body).code;
                expression = bodyCode.trim();
                if (expression.startsWith('{') && expression.endsWith('}')) {
                  let inner = expression.slice(1, -1);
                  const lines = inner.split('\n');
                  const nonEmptyLines = lines.filter(l => l.trim().length > 0);
                  const minIndent = nonEmptyLines.reduce((min, line) => {
                    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
                    return Math.min(min, indent);
                  }, Infinity);
                  if (minIndent < Infinity && minIndent > 0) {
                    inner = lines.map(l => l.length > 0 ? l.slice(minIndent) : l).join('\n').trim();
                  }
                  expression = inner;
                }
              }
            } else {
              expression = getNodeCode(fn.body as BabelTypes.Expression);
            }
          } else if (firstArg.type === 'ObjectExpression') {
            const obj = firstArg as BabelTypes.ObjectExpression;
            for (const prop of obj.properties) {
              if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
                if (prop.key.name === 'get') {
                  expression = getNodeCode(prop.value as BabelTypes.Expression);
                } else if (prop.key.name === 'set') {
                  hasSetter = true;
                  setterExpression = getNodeCode(prop.value as BabelTypes.Expression);
                }
              }
            }
          }
        }

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
          hasSetter,
          setterExpression,
          confidence: 0.9,
          confidenceLevel: 'high',
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = computedNode;
        markStatementHandled(path, handledLineNumbers);
        return;
      }

      // watch()
      if (callee.type === 'Identifier' && callee.name === 'watch') {
        const args = path.node.arguments;
        let sources: string[] = [];
        let callbackBody = '{ ... }';
        let deep = false;
        let immediate = false;

        if (args.length > 0) {
          const source = args[0];
          if (source.type === 'Identifier') {
            sources = [source.name];
          } else if (source.type === 'ArrayExpression') {
            sources = source.elements
              .filter((el): el is BabelTypes.Expression => el !== null && el !== undefined)
              .map(el => getNodeCode(el));
          } else {
            sources = [getNodeCode(source as BabelTypes.Expression)];
          }
        }

        if (args.length > 1) {
          const callback = args[1];
          if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
            const fn = callback as BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression;
            if (fn.body.type === 'BlockStatement') {
              callbackBody = '{ ... }';
            } else {
              callbackBody = getNodeCode(fn.body as BabelTypes.Expression);
            }
          }
        }

        if (args.length > 2 && args[2].type === 'ObjectExpression') {
          const options = args[2] as BabelTypes.ObjectExpression;
          for (const prop of options.properties) {
            if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
              if (prop.key.name === 'deep' && prop.value.type === 'BooleanLiteral') {
                deep = prop.value.value;
              }
              if (prop.key.name === 'immediate' && prop.value.type === 'BooleanLiteral') {
                immediate = prop.value.value;
              }
            }
          }
        }

        const nodeId = generateNodeId('watch');
        const watchNode: WatchEffectNode = {
          id: nodeId,
          nodeType: 'watch-effect',
          sources,
          callbackBody,
          immediate,
          deep,
          effectKind: 'watch',
          confidence: 0.85,
          confidenceLevel: 'high',
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = watchNode;
        markStatementHandled(path, handledLineNumbers);
        return;
      }

      // watchEffect()
      if (callee.type === 'Identifier' && callee.name === 'watchEffect') {
        const args = path.node.arguments;
        let callbackBody = '{ ... }';

        if (args.length > 0) {
          const callback = args[0];
          if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
            const fn = callback as BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression;
            if (fn.body.type === 'BlockStatement') {
              callbackBody = '{ ... }';
            } else {
              callbackBody = getNodeCode(fn.body as BabelTypes.Expression);
            }
          }
        }

        const nodeId = generateNodeId('effect');
        const effectNode: WatchEffectNode = {
          id: nodeId,
          nodeType: 'watch-effect',
          sources: [],
          callbackBody,
          immediate: true,
          deep: false,
          effectKind: 'effect',
          confidence: 0.7,
          confidenceLevel: 'medium',
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = effectNode;
        markStatementHandled(path, handledLineNumbers);
        return;
      }

      // onMounted()
      if (callee.type === 'Identifier' && callee.name === 'onMounted') {
        const args = path.node.arguments;
        let callbackBody = '{ ... }';

        if (args.length > 0) {
          const callback = args[0];
          if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
            const fn = callback as BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression;
            if (fn.body.type === 'BlockStatement') {
              callbackBody = '{ ... }';
            } else {
              callbackBody = getNodeCode(fn.body as BabelTypes.Expression);
            }
          }
        }

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
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = lifecycleNode;
        markStatementHandled(path, handledLineNumbers);
        return;
      }

      // onUnmounted()
      if (callee.type === 'Identifier' && callee.name === 'onUnmounted') {
        const args = path.node.arguments;
        let callbackBody = '{ ... }';

        if (args.length > 0) {
          const callback = args[0];
          if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
            const fn = callback as BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression;
            if (fn.body.type === 'BlockStatement') {
              callbackBody = '{ ... }';
            } else {
              callbackBody = getNodeCode(fn.body as BabelTypes.Expression);
            }
          }
        }

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
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = lifecycleNode;
        markStatementHandled(path, handledLineNumbers);
        return;
      }

      // onUpdated()
      if (callee.type === 'Identifier' && callee.name === 'onUpdated') {
        const args = path.node.arguments;
        let callbackBody = '{ ... }';

        if (args.length > 0) {
          const callback = args[0];
          if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
            const fn = callback as BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression;
            if (fn.body.type === 'BlockStatement') {
              callbackBody = '{ ... }';
            } else {
              callbackBody = getNodeCode(fn.body as BabelTypes.Expression);
            }
          }
        }

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
          confidence: 0.9,
          confidenceLevel: 'high',
          sourceLocation: getSourceLocation(path.node.loc),
        };
        ctx.nodes[nodeId] = lifecycleNode;
        markStatementHandled(path, handledLineNumbers);
        return;
      }

      // defineProps()
      if (callee.type === 'Identifier' && callee.name === 'defineProps') {
        const args = path.node.arguments;
        if (args.length > 0 && args[0].type === 'ObjectExpression') {
          const propsObj = args[0] as BabelTypes.ObjectExpression;
          for (const prop of propsObj.properties) {
            if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
              const propName = prop.key.name;
              let propType = 'any';
              let required = true;
              let defaultValue: string | undefined;

              if (prop.value.type === 'ObjectExpression') {
                const propDef = prop.value as BabelTypes.ObjectExpression;
                for (const defProp of propDef.properties) {
                  if (defProp.type === 'ObjectProperty' && defProp.key.type === 'Identifier') {
                    if (defProp.key.name === 'type') {
                      propType = getNodeCode(defProp.value as BabelTypes.Expression);
                    }
                    if (defProp.key.name === 'required' && defProp.value.type === 'BooleanLiteral') {
                      required = defProp.value.value;
                    }
                    if (defProp.key.name === 'default') {
                      defaultValue = getNodeCode(defProp.value as BabelTypes.Expression);
                    }
                  }
                }
              } else {
                propType = getNodeCode(prop.value as BabelTypes.Expression);
              }

              ctx.propsDefinition.push({
                name: propName,
                type: propType,
                defaultValue,
                required,
                description: `属性 ${propName}`,
              });
            }
          }
        }
        markStatementHandled(path, handledLineNumbers);
        return;
      }

      // defineEmits()
      if (callee.type === 'Identifier' && callee.name === 'defineEmits') {
        const args = path.node.arguments;
        if (args.length > 0 && args[0].type === 'ArrayExpression') {
          const emitArray = args[0] as BabelTypes.ArrayExpression;
          for (const el of emitArray.elements) {
            if (el?.type === 'StringLiteral') {
              ctx.emitNames.push(el.value);
            }
          }
        }
        markStatementHandled(path, handledLineNumbers);
        return;
      }
    },
  });

  // 收集未被白名单处理的代码行
  const sourceLines = scriptContent.split('\n');
  const unhandledLines: string[] = [];
  for (let i = 0; i < sourceLines.length; i++) {
    if (!handledLineNumbers.has(i + 1)) {  // 行号从1开始
      unhandledLines.push(sourceLines[i]);
    }
  }
  ctx.rawScriptCode = unhandledLines.join('\n').trim();
}
