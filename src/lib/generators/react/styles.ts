/**
 * React 代码生成器 - Style 块生成
 */

import type {
  UISemanticTree,
  StyleNode,
} from '../../semantic-tree/types';

/**
 * 从语义树生成样式代码
 */
export function generateStyleBlock(tree: UISemanticTree): string {
  const styleNodes = Object.values(tree.nodes).filter(
    (node): node is StyleNode => node.nodeType === 'style'
  );

  if (styleNodes.length === 0) return '';

  return styleNodes
    .map(node => node.content)
    .filter(Boolean)
    .join('\n\n');
}
