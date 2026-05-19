/**
 * Vue 3 代码生成器 - Script Setup 块生成
 */

import type {
  UISemanticTree,
  RootComponentNode,
  ReactiveStateNode,
  TranslationWarning,
} from '../../semantic-tree/types';
import { generateWarning } from '../../translator/confidence';
import { findMapping } from '../../translator/mappings';
import {
  formatCallbackBody,
  toVuePropType,
  addValueAccessForRefs,
  isBlockExpression,
} from './utils';

/**
 * 从语义树生成 Vue 3 <script setup> 代码
 */
export function generateScriptSetup(tree: UISemanticTree, warnings: TranslationWarning[]): string {
  const lines: string[] = [];
  const imports: string[] = [];
  const vueImports: Set<string> = new Set();

  // 收集所有需要的 Vue 导入
  for (const node of Object.values(tree.nodes)) {
    switch (node.nodeType) {
      case 'reactive-state':
        if (node.stateKind === 'ref') {
          vueImports.add('ref');
        } else if (node.stateKind === 'reactive') {
          vueImports.add('reactive');
        } else if (node.stateKind === 'state') {
          // React 的 useState → Vue 的 ref
          vueImports.add('ref');
        }
        break;
      case 'computed-prop':
        vueImports.add('computed');
        break;
      case 'watch-effect':
        if (node.effectKind === 'watch') {
          vueImports.add('watch');
        } else if (node.effectKind === 'effect') {
          vueImports.add('watchEffect');
        } else if (node.effectKind === 'lifecycle') {
          if (node.lifecycleKind === 'onMounted') {
            vueImports.add('onMounted');
          } else if (node.lifecycleKind === 'onUnmounted') {
            vueImports.add('onUnmounted');
          } else if (node.lifecycleKind === 'onUpdated') {
            vueImports.add('onUpdated');
          }
        }
        break;
    }
  }

  // 获取根节点信息
  const rootNode = tree.nodes[tree.rootId] as RootComponentNode;

  // 生成 Vue 导入语句
  if (vueImports.size > 0) {
    const importList = Array.from(vueImports).sort().join(', ');
    lines.push(`import { ${importList} } from 'vue'`);
    imports.push(`import { ${importList} } from 'vue'`);
  }

  // 生成 defineProps
  if (rootNode.propsDefinition.length > 0) {
    lines.push('');
    const propsLines = rootNode.propsDefinition.map(prop => {
      // Map JS/TS type names to Vue prop type constructors
      const vueType = toVuePropType(prop.type);
      let propDef = `  ${prop.name}: { type: ${vueType}`;
      if (prop.required) {
        propDef += ', required: true';
      }
      if (prop.defaultValue !== undefined) {
        propDef += `, default: ${prop.defaultValue}`;
      }
      propDef += ' }';
      return propDef;
    });
    lines.push('const props = defineProps({');
    lines.push(propsLines.join(',\n'));
    lines.push('})');
  }

  // 生成 defineEmits（如果有）
  const emitEvents: string[] = [];
  // 从事件处理节点中收集需要 emit 的事件
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'event-handler' && node.handlerName.startsWith('emit')) {
      emitEvents.push(node.eventName);
    }
  }
  if (emitEvents.length > 0) {
    lines.push('');
    lines.push(`const emit = defineEmits([${emitEvents.map(e => `'${e}'`).join(', ')}])`);
  }

  // 生成响应式状态
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'reactive-state') {
      lines.push('');
      if (node.stateKind === 'ref' || node.stateKind === 'state') {
        // useState → ref
        const initValue = node.initialValue || 'undefined';
        lines.push(`const ${node.name} = ref(${initValue})`);

        // 检查映射置信度
        if (node.stateKind === 'state') {
          const mapping = findMapping('useState', tree.sourceFramework, 'vue3');
          if (mapping && mapping.confidence < 0.9) {
            warnings.push(generateWarning(
              `useState → ref 的转换可能需要手动调整 setter 调用方式`,
              mapping.confidence,
              'mapping-uncertain',
              `useState(${initValue})`,
              `ref(${initValue})`,
            ));
          }
        }
      } else if (node.stateKind === 'reactive') {
        lines.push(`const ${node.name} = reactive(${node.initialValue || '{}'})`);
      }
    }
  }

  // 生成计算属性
  // 收集所有 ref 变量名，用于在计算属性表达式中添加 .value
  const refNames = new Set<string>();
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'reactive-state' && (node.stateKind === 'ref' || node.stateKind === 'state')) {
      refNames.add(node.name);
    }
  }

  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'computed-prop') {
      lines.push('');
      // Add .value access for ref variables in the expression (script setup context)
      const expressionWithDotValue = tree.sourceFramework === 'react'
        ? addValueAccessForRefs(node.expression, refNames)
        : node.expression;

      const needsBlock = isBlockExpression(expressionWithDotValue);

      if (node.hasSetter && node.setterExpression) {
        lines.push(`const ${node.name} = computed({`);
        lines.push(`  get() { return ${expressionWithDotValue} },`);
        lines.push(`  set(val) { ${node.setterExpression} }`);
        lines.push('})');
      } else if (needsBlock) {
        // Multi-statement body: wrap in block { ... }
        lines.push(`const ${node.name} = computed(() => {`);
        lines.push(`  ${expressionWithDotValue}`);
        lines.push('})');
      } else {
        lines.push(`const ${node.name} = computed(() => ${expressionWithDotValue})`);
      }
    }
  }

  // 生成 watch / 生命周期钩子
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'watch-effect') {
      lines.push('');
      if (node.effectKind === 'watch') {
        const sources = node.sources.length > 0
          ? node.sources.length === 1
            ? node.sources[0]
            : `[${node.sources.join(', ')}]`
          : '() => {}';
        const options: string[] = [];
        if (node.immediate) options.push('immediate: true');
        if (node.deep) options.push('deep: true');

        lines.push(`watch(${sources}, (${node.sources.length > 1 ? 'newVals' : 'newVal'}) => {`);
        lines.push(formatCallbackBody(node.callbackBody));
        if (options.length > 0) {
          lines.push(`}, { ${options.join(', ')} })`);
        } else {
          lines.push('})');
        }
      } else if (node.effectKind === 'effect') {
        lines.push('watchEffect(() => {');
        lines.push(formatCallbackBody(node.callbackBody));
        lines.push('})');
      } else if (node.effectKind === 'lifecycle') {
        if (node.lifecycleKind === 'onMounted') {
          lines.push('onMounted(() => {');
          lines.push(formatCallbackBody(node.callbackBody));
          lines.push('})');
        } else if (node.lifecycleKind === 'onUnmounted') {
          lines.push('onUnmounted(() => {');
          lines.push(formatCallbackBody(node.callbackBody));
          lines.push('})');
        } else if (node.lifecycleKind === 'onUpdated') {
          lines.push('onUpdated(() => {');
          lines.push(formatCallbackBody(node.callbackBody));
          lines.push('})');
        }
      }
    }
  }

  // 生成事件处理函数
  const generatedHandlers = new Set<string>();
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'event-handler') {
      // 避免重复生成
      if (generatedHandlers.has(node.handlerName)) continue;
      generatedHandlers.add(node.handlerName);

      // 跳过内联函数（已在模板中生成）
      if (node.isInline && node.handlerBody.length < 40) continue;

      lines.push('');
      const param = node.eventParam || 'event';
      lines.push(`const ${node.handlerName} = (${param}) => {`);
      lines.push(formatCallbackBody(node.handlerBody));
      lines.push('}');
    }
  }

  return lines.join('\n');
}
