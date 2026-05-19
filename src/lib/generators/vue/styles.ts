/**
 * Vue 3 代码生成器 - Style 块生成
 */

import type {
  UISemanticTree,
  StyleNode,
} from '../../semantic-tree/types';

/**
 * 从语义树生成 Vue 3 <style> 代码
 */
export function generateStyleBlock(tree: UISemanticTree): string {
  const styleNodes = Object.values(tree.nodes).filter(
    (node): node is StyleNode => node.nodeType === 'style'
  );

  if (styleNodes.length === 0) return '';

  // 合并所有样式内容
  const contents = styleNodes
    .map(node => {
      // 将 React 的 camelCase CSS 属性转换为 kebab-case
      let content = node.content;
      content = convertCssToKebabCase(content);
      return content;
    })
    .filter(Boolean);

  return contents.join('\n\n');
}

/**
 * 将 camelCase CSS 属性转换为 kebab-case
 */
export function convertCssToKebabCase(cssContent: string): string {
  // 简单的 camelCase → kebab-case 转换
  // 只转换 CSS 属性名，不转换值
  return cssContent.replace(
    /([a-z])([A-Z])/g,
    (_, lower, upper) => `${lower}-${upper.toLowerCase()}`
  );
}
