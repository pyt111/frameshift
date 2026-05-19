/**
 * Vue 3 代码生成器 - Template 块生成
 */

import type {
  UISemanticTree,
  SemanticNodeId,
  RootComponentNode,
  ComponentNode,
  TextNode,
  ConditionalRenderNode,
  ListRenderNode,
  ComponentProp,
  TranslationWarning,
} from '../../semantic-tree/types';
import { generateWarning } from '../../translator/confidence';
import {
  indent,
  reactEventToVue,
  reactPropToVue,
  getPropValueString,
  isDynamicValue,
} from './utils';

/**
 * 从语义树生成 Vue 3 <template> 代码
 */
export function generateTemplate(tree: UISemanticTree, warnings: TranslationWarning[]): string {
  const rootNode = tree.nodes[tree.rootId] as RootComponentNode;
  const bodyNode = tree.nodes[rootNode.body];

  if (!bodyNode) {
    return '<div><!-- 解析错误：缺少组件体 --></div>';
  }

  return generateNodeTemplate(rootNode.body, tree, warnings, 0);
}

/**
 * 递归生成节点的模板代码
 */
export function generateNodeTemplate(
  nodeId: SemanticNodeId,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number
): string {
  const node = tree.nodes[nodeId];
  if (!node) return '';

  switch (node.nodeType) {
    case 'text':
      return generateTextTemplate(node as TextNode);
    case 'component':
      return generateComponentTemplate(node as ComponentNode, tree, warnings, indentLevel);
    case 'conditional-render':
      return generateConditionalTemplate(node as ConditionalRenderNode, tree, warnings, indentLevel);
    case 'list-render':
      return generateListTemplate(node as ListRenderNode, tree, warnings, indentLevel);
    default:
      return `<!-- 未支持的节点类型: ${node.nodeType} -->`;
  }
}

/**
 * 生成文本节点的模板
 */
export function generateTextTemplate(node: TextNode): string {
  return node.content;
}

/**
 * 生成组件节点的模板
 */
export function generateComponentTemplate(
  node: ComponentNode,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number
): string {
  // Fragment 节点特殊处理
  if (node.tagName === 'Fragment') {
    const children = node.children
      .map(id => generateNodeTemplate(id, tree, warnings, indentLevel))
      .filter(Boolean);
    return children.join('\n');
  }

  // 生成属性字符串
  const attrs: string[] = [];
  for (const prop of node.props) {
    const attrStr = generatePropTemplate(prop, warnings);
    if (attrStr) attrs.push(attrStr);
  }

  // 生成子节点内容
  const children = node.children
    .map(id => generateNodeTemplate(id, tree, warnings, indentLevel + 1))
    .filter(Boolean);

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  const tag = node.tagName;

  // 自闭合标签
  const selfClosingTags = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
  if (selfClosingTags.has(tag.toLowerCase()) && children.length === 0) {
    return `<${tag}${attrStr} />`;
  }

  // 没有子节点
  if (children.length === 0) {
    return `<${tag}${attrStr}></${tag}>`;
  }

  // 单行文本子节点
  if (children.length === 1 && tree.nodes[node.children[0]]?.nodeType === 'text') {
    return `<${tag}${attrStr}>${children[0]}</${tag}>`;
  }

  // 多行子节点：每个子元素缩进1级，闭合标签与开标签同层
  const indentedChildren = children
    .map(child => indent(1, child))
    .join('\n');
  return `<${tag}${attrStr}>\n${indentedChildren}\n</${tag}>`;
}

/**
 * 生成属性模板字符串
 */
export function generatePropTemplate(prop: ComponentProp, warnings: TranslationWarning[]): string {
  const name = prop.name;

  // className -> class
  if (name === 'className') {
    if (isDynamicValue(prop.value)) {
      const expr = getPropValueString(prop.value);
      return `:class="${expr}"`;
    }
    return `class="${prop.value}"`;
  }

  // style -> :style
  if (name === 'style') {
    if (isDynamicValue(prop.value)) {
      const expr = getPropValueString(prop.value);
      return `:style="${expr}"`;
    }
    return `style="${prop.value}"`;
  }

  // 事件属性
  if (name.startsWith('on')) {
    const vueEvent = reactEventToVue(name);
    if (isDynamicValue(prop.value)) {
      const expr = getPropValueString(prop.value);
      // 箭头函数直接作为内联处理
      if (prop.value && typeof prop.value !== 'string' && prop.value.type === 'arrow-function') {
        // 提取函数体
        const bodyMatch = expr.match(/^\(.*?\)\s*=>\s*(.+)$/);
        if (bodyMatch) {
          return `${vueEvent}="${bodyMatch[1]}"`;
        }
      }
      return `${vueEvent}="${expr}"`;
    }
    return `${vueEvent}="${prop.value}"`;
  }

  // key -> :key
  if (name === 'key') {
    if (isDynamicValue(prop.value)) {
      return `:key="${getPropValueString(prop.value)}"`;
    }
    return `:key="${prop.value}"`;
  }

  // htmlFor -> for
  const vueName = reactPropToVue(name);
  if (vueName !== name) {
    if (isDynamicValue(prop.value)) {
      return `:${vueName}="${getPropValueString(prop.value)}"`;
    }
    return `${vueName}="${prop.value}"`;
  }

  // 动态绑定
  if (isDynamicValue(prop.value)) {
    return `:${name}="${getPropValueString(prop.value)}"`;
  }

  // 布尔属性
  if (prop.value === 'true') {
    return name;
  }

  // 静态属性
  return `${name}="${prop.value}"`;
}

/**
 * 生成条件渲染模板
 */
export function generateConditionalTemplate(
  node: ConditionalRenderNode,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number
): string {
  const trueContent = generateNodeTemplate(node.trueBranch, tree, warnings, indentLevel);
  const falseContent = node.falseBranch
    ? generateNodeTemplate(node.falseBranch, tree, warnings, indentLevel)
    : null;

  // 根据条件类型生成不同的 Vue 模板
  // ternary 和 logical-and 都转换为 v-if
  if (node.conditionalKind === 'logical-and') {
    // && → v-if
    // 需要在子元素上添加 v-if 指令
    return addVIfDirective(trueContent, node.condition);
  }

  if (node.conditionalKind === 'ternary') {
    // 三元表达式 → v-if / v-else
    let result = addVIfDirective(trueContent, node.condition);
    if (falseContent) {
      result += '\n' + addVElseDirective(falseContent);
    }
    return result;
  }

  // if 类型
  let result = addVIfDirective(trueContent, node.condition);
  if (falseContent) {
    result += '\n' + addVElseDirective(falseContent);
  }
  return result;
}

/**
 * 在模板元素上添加 v-if 指令
 */
export function addVIfDirective(template: string, condition: string): string {
  // 找到第一个标签并添加 v-if
  const match = template.match(/^(<[a-zA-Z][^>]*?)(\s|\/|>)/);
  if (match) {
    return template.replace(/^(<[a-zA-Z][^>]*?)(\s|\/|>)/, `$1 v-if="${condition}"$2`);
  }
  // 如果不是标准元素，用 template 包裹
  return `<template v-if="${condition}">\n${template}\n</template>`;
}

/**
 * 在模板元素上添加 v-else 指令
 */
export function addVElseDirective(template: string): string {
  const match = template.match(/^(<[a-zA-Z][^>]*?)(\s|\/|>)/);
  if (match) {
    return template.replace(/^(<[a-zA-Z][^>]*?)(\s|\/|>)/, `$1 v-else$2`);
  }
  return `<template v-else>\n${template}\n</template>`;
}

/**
 * 生成列表渲染模板
 */
export function generateListTemplate(
  node: ListRenderNode,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number
): string {
  const bodyContent = generateNodeTemplate(node.body, tree, warnings, indentLevel + 1);

  // 构建 v-for 指令
  let vFor = node.indexName
    ? `(${node.itemName}, ${node.indexName}) in ${node.iterableExpression}`
    : `${node.itemName} in ${node.iterableExpression}`;

  // 在子元素上添加 v-for 和 :key
  let result = addVForDirective(bodyContent, vFor);

  // 添加 :key
  if (node.keyExpression) {
    result = addKeyDirective(result, node.keyExpression);
  } else {
    // 默认使用索引作为 key
    const defaultKey = node.indexName || 'index';
    result = addKeyDirective(result, defaultKey);
    warnings.push(generateWarning(
      '缺少 key 属性，默认使用索引作为 key',
      0.7,
      'mapping-uncertain',
      `.map()`,
      `v-for with :key="${defaultKey}"`,
    ));
  }

  return result;
}

/**
 * 在模板元素上添加 v-for 指令
 */
export function addVForDirective(template: string, vForExpr: string): string {
  const match = template.match(/^(<[a-zA-Z][^>]*?)(\s|\/|>)/);
  if (match) {
    return template.replace(/^(<[a-zA-Z][^>]*?)(\s|\/|>)/, `$1 v-for="${vForExpr}"$2`);
  }
  return `<template v-for="${vForExpr}">\n${template}\n</template>`;
}

/**
 * 在模板元素上添加 :key 指令
 */
export function addKeyDirective(template: string, keyExpr: string): string {
  const match = template.match(/^(<[a-zA-Z][^>]*?)(\s|\/|>)/);
  if (match) {
    return template.replace(/^(<[a-zA-Z][^>]*?)(\s|\/|>)/, `$1 :key="${keyExpr}"$2`);
  }
  return template;
}
