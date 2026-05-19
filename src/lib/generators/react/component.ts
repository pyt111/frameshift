/**
 * React 代码生成器 - Component 块生成
 */

import type {
  UISemanticTree,
  RootComponentNode,
  VModelInfo,
  TranslationWarning,
} from '../../semantic-tree/types';
import { generateWarning } from '../../translator/confidence';
import { findMapping } from '../../translator/mappings';
import {
  indent,
  escapeRegex,
  collectVModelInfos,
  stripValueAccessForRefs,
  isBlockExpression,
} from './utils';
import { generateNodeJsx } from './jsx';

/**
 * 从语义树生成 React 函数组件代码
 */
export function generateComponentCode(tree: UISemanticTree, warnings: TranslationWarning[]): string {
  const lines: string[] = [];
  const reactImports: Set<string> = new Set();
  const rootNode = tree.nodes[tree.rootId] as RootComponentNode;

  // 收集需要的 React 导入
  for (const node of Object.values(tree.nodes)) {
    switch (node.nodeType) {
      case 'reactive-state':
        if (node.stateKind === 'state' || node.stateKind === 'ref') {
          reactImports.add('useState');
        } else if (node.stateKind === 'reactive') {
          reactImports.add('useState');
        }
        break;
      case 'computed-prop':
        reactImports.add('useMemo');
        break;
      case 'watch-effect':
        if (node.effectKind === 'lifecycle' && node.lifecycleKind === 'onMounted') {
          reactImports.add('useEffect');
        } else if (node.effectKind === 'watch' || node.effectKind === 'effect') {
          reactImports.add('useEffect');
        } else if (node.effectKind === 'lifecycle' && node.lifecycleKind === 'onUnmounted') {
          reactImports.add('useEffect');
        }
        break;
    }
  }

  // 生成 React 导入语句
  if (reactImports.size > 0) {
    lines.push(`import { ${Array.from(reactImports).sort().join(', ')} } from 'react';`);
  }

  // 输出从源代码中提取的 import 语句（非 Vue 核心 API 的第三方 import）
  if (tree.importStatements && tree.importStatements.length > 0) {
    const vueCoreImports = ['vue', '@vue/runtime-core', '@vue/reactivity', '@vue/compiler-sfc'];
    for (const importStmt of tree.importStatements) {
      // 跳过 Vue 核心 API 的 import（它们会被转换为 React 等价形式）
      const isVueCore = vueCoreImports.some(v => importStmt.includes(`from '${v}'`) || importStmt.includes(`from "${v}"`));
      // 跳过已经在 React import 中生成的
      const isReactImport = importStmt.includes("from 'react'") || importStmt.includes('from "react"');
      if (!isVueCore && !isReactImport) {
        lines.push(importStmt);
      }
    }
  }

  lines.push('');

  // 生成组件声明
  const componentName = rootNode.componentName;
  
  // 生成 Props 接口
  if (rootNode.propsDefinition.length > 0) {
    lines.push(`interface ${componentName}Props {`);
    for (const prop of rootNode.propsDefinition) {
      const optional = prop.required ? '' : '?';
      const type = prop.type === 'any' ? 'unknown' : prop.type;
      lines.push(`  ${prop.name}${optional}: ${type};`);
    }
    lines.push('}');
    lines.push('');
  }

  // 生成函数组件
  const propsParam = rootNode.propsDefinition.length > 0
    ? `{ ${rootNode.propsDefinition.map(p => p.name).join(', ')} }`
    : '';
  
  lines.push(`export default function ${componentName}(${propsParam}) {`);

  // 生成响应式状态
  // 先收集已有的 ref/state 变量名集合，用于后续检测 v-model 是否需要自动生成 useState
  const existingStateNames = new Set<string>();
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'reactive-state') {
      existingStateNames.add(node.name);
    }
  }

  // 收集所有 v-model 信息，检查是否有尚未生成 useState 的变量
  const vModelInfos = collectVModelInfos(tree);
  const vModelStateNeeded: VModelInfo[] = [];
  for (const vmi of vModelInfos) {
    if (!existingStateNames.has(vmi.modelVarName)) {
      vModelStateNeeded.push(vmi);
    }
  }

  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'reactive-state') {
      lines.push('');
      if (node.stateKind === 'ref' || node.stateKind === 'state') {
        // Vue ref / React useState → React useState
        const setterName = node.setterName || `set${node.name.charAt(0).toUpperCase() + node.name.slice(1)}`;
        lines.push(`  const [${node.name}, ${setterName}] = useState(${node.initialValue || 'undefined'});`);

        if (node.stateKind === 'ref') {
          const mapping = findMapping('ref', tree.sourceFramework, 'react');
          if (mapping && mapping.confidence < 0.9) {
            warnings.push(generateWarning(
              `Vue ref → React useState 需要调整 .value 访问方式为直接变量访问`,
              mapping.confidence,
              'mapping-uncertain',
              `ref(${node.initialValue})`,
              `useState(${node.initialValue})`,
            ));
          }
        }
      } else if (node.stateKind === 'reactive') {
        // Vue reactive → React useState with object
        lines.push(`  const [${node.name}, set${node.name.charAt(0).toUpperCase() + node.name.slice(1)}] = useState(${node.initialValue || '{}'});`);
        
        warnings.push(generateWarning(
          `Vue reactive → React useState：需要将响应式对象的属性访问改为 state 对象的属性访问，更新时需用展开运算符`,
          0.7,
          'mapping-uncertain',
          `reactive(${node.initialValue})`,
          `useState(${node.initialValue})`,
        ));
      }
    }
  }

  // 为 v-model 中引用但尚未生成 useState 的变量自动生成 useState
  for (const vmi of vModelStateNeeded) {
    lines.push('');
    const initialValue = (vmi.inputType === 'number') ? '0' : "''";
    lines.push(`  const [${vmi.modelVarName}, ${vmi.setterName}] = useState(${initialValue});`);

    warnings.push(generateWarning(
      `Vue v-model="${vmi.modelVarName}" 绑定的变量未在 <script setup> 中声明 ref，已自动生成 useState`,
      0.75,
      'mapping-uncertain',
      `v-model="${vmi.modelVarName}"`,
      `const [${vmi.modelVarName}, ${vmi.setterName}] = useState(${initialValue})`,
    ));
  }

  // 生成计算属性
  // 收集所有 ref 变量名，用于在表达式中去除 .value（Vue → React 转换时）
  const refNames = new Set<string>();
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'reactive-state' && (node.stateKind === 'ref' || node.stateKind === 'state')) {
      refNames.add(node.name);
    }
  }

  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'computed-prop') {
      lines.push('');
      // Strip .value from ref accesses when source is Vue
      const expressionStripped = tree.sourceFramework === 'vue3'
        ? stripValueAccessForRefs(node.expression, refNames)
        : node.expression;

      // Determine dependencies: use explicit deps if available, otherwise infer from ref names
      let deps: string[];
      if (node.dependencies.length > 0) {
        deps = node.dependencies;
      } else if (tree.sourceFramework === 'vue3') {
        // Infer dependencies from the expression by finding ref variable references
        deps = Array.from(refNames).filter(refName => {
          const escaped = escapeRegex(refName);
          const pattern = new RegExp(`(?<![a-zA-Z0-9_])${escaped}(?![a-zA-Z0-9_])`);
          return pattern.test(expressionStripped);
        });
      } else {
        deps = node.dependencies;
      }

      const depsStr = deps.join(', ');
      const needsBlock = isBlockExpression(expressionStripped);

      if (needsBlock) {
        // Multi-statement body: wrap in block { ... }
        lines.push(`  const ${node.name} = useMemo(() => {`);
        lines.push(`    ${expressionStripped}`);
        lines.push(`  }, [${depsStr}]);`);
      } else {
        lines.push(`  const ${node.name} = useMemo(() => ${expressionStripped}, [${depsStr}]);`);
      }

      if (node.hasSetter) {
        warnings.push(generateWarning(
          `Vue computed 的 setter 在 React 中无直接等价，需要手动实现状态更新逻辑`,
          0.5,
          'pattern-unsupported',
          `computed({ get, set })`,
          `useMemo + useState`,
        ));
      }
    }
  }

  // 生成 useEffect
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'watch-effect') {
      lines.push('');
      
      if (node.effectKind === 'lifecycle' && node.lifecycleKind === 'onMounted') {
        // onMounted → useEffect([], ...)
        lines.push('  useEffect(() => {');
        lines.push(`    ${node.callbackBody.replace(/^\{|\}$/g, '').trim() || '// 组件挂载后执行'}`);
        if (node.cleanupBody) {
          lines.push('    return () => {');
          lines.push(`      ${node.cleanupBody.replace(/^\{|\}$/g, '').trim()}`);
          lines.push('    };');
        }
        lines.push('  }, []);');
      } else if (node.effectKind === 'lifecycle' && node.lifecycleKind === 'onUnmounted') {
        // onUnmounted → useEffect return cleanup
        lines.push('  useEffect(() => {');
        lines.push('    return () => {');
        lines.push(`      ${node.callbackBody.replace(/^\{|\}$/g, '').trim() || '// 组件卸载前执行'}`);
        lines.push('    };');
        lines.push('  }, []);');
      } else if (node.effectKind === 'watch') {
        // watch → useEffect with deps
        const deps = node.sources.length > 0 ? node.sources.join(', ') : '';
        lines.push(`  useEffect(() => {`);
        lines.push(`    ${node.callbackBody.replace(/^\{|\}$/g, '').trim() || '// watch 回调'}`);
        if (node.cleanupBody) {
          lines.push('    return () => {');
          lines.push(`      ${node.cleanupBody.replace(/^\{|\}$/g, '').trim()}`);
          lines.push('    };');
        }
        lines.push(`  }, [${deps}]);`);
      } else if (node.effectKind === 'effect') {
        // watchEffect → useEffect (需要手动指定依赖)
        lines.push('  useEffect(() => {');
        lines.push(`    ${node.callbackBody.replace(/^\{|\}$/g, '').trim() || '// watchEffect 回调'}`);
        lines.push('    // 注意：Vue 的 watchEffect 自动追踪依赖，React 需手动指定依赖数组');
        lines.push('  }); // TODO: 请补充依赖数组');
        
        warnings.push(generateWarning(
          `Vue watchEffect 自动追踪依赖，在 React useEffect 中需要手动指定依赖数组`,
          0.5,
          'pattern-unsupported',
          `watchEffect(() => { ... })`,
          `useEffect(() => { ... }, [/* TODO */])`,
        ));
      }
    }
  }

  // 生成事件处理函数
  const generatedHandlers = new Set<string>();
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'event-handler') {
      if (generatedHandlers.has(node.handlerName)) continue;
      generatedHandlers.add(node.handlerName);

      // 跳过内联短函数
      if (node.isInline && node.handlerBody.length < 40) continue;

      lines.push('');
      const param = node.eventParam || 'event';
      lines.push(`  const ${node.handlerName} = (${param}) => {`);
      lines.push(`    ${node.handlerBody.replace(/^\{|\}$/g, '').trim() || '// TODO: 实现事件处理'}`);
      lines.push('  };');
    }
  }

  // 生成 return JSX
  lines.push('');
  lines.push('  return (');
  const jsxContent = generateNodeJsx(rootNode.body, tree, warnings, 0);
  lines.push(indent(2, jsxContent));
  lines.push('  );');

  lines.push('}');

  // 如果有未被 AST 白名单处理的原始代码，添加为注释块
  if (tree.rawScriptCode && tree.rawScriptCode.trim()) {
    const rawCodeLines = tree.rawScriptCode.trim().split('\n');
    // 只在有实质内容（非空行）时添加
    const nonEmptyLines = rawCodeLines.filter(l => l.trim().length > 0);
    if (nonEmptyLines.length > 0) {
      lines.push('');
      lines.push('/* ========================');
      lines.push(' * 以下代码来自 Vue 源码中未被自动转换的部分');
      lines.push(' * 请根据 React 语法手动调整后移入组件内部');
      lines.push(' * ========================');
      lines.push('');
      for (const rawLine of rawCodeLines) {
        lines.push(` * ${rawLine}`);
      }
      lines.push('');
      lines.push(' * ======================== */');
    }
  }

  return lines.join('\n');
}
