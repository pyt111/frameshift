/**
 * 语义树校验器
 * 用于校验语义树的完整性和一致性
 */

import type {
  UISemanticTree,
  SemanticNode,
  SemanticNodeId,
  ParseWarning,
} from './types';

/** 校验结果 */
export interface ValidationResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 校验警告 */
  warnings: ParseWarning[];
  /** 校验错误 */
  errors: ParseWarning[];
}

/**
 * 校验语义树的完整性和一致性
 */
export function validateSemanticTree(tree: UISemanticTree): ValidationResult {
  const warnings: ParseWarning[] = [];
  const errors: ParseWarning[] = [];

  // 检查根节点是否存在
  if (!tree.nodes[tree.rootId]) {
    errors.push({
      message: `根节点 ${tree.rootId} 不存在于节点映射中`,
      level: 'error',
    });
  }

  // 检查所有节点的引用完整性
  for (const [id, node] of Object.entries(tree.nodes)) {
    // 检查节点 ID 一致性
    if (node.id !== id) {
      errors.push({
        message: `节点 ID 不一致：映射键为 ${id}，但节点 ID 为 ${node.id}`,
        level: 'error',
        nodeId: id,
      });
    }

    // 检查子节点引用
    const childIds = getChildIds(node);
    for (const childId of childIds) {
      if (!tree.nodes[childId]) {
        warnings.push({
          message: `节点 ${id} 引用了不存在的子节点 ${childId}`,
          level: 'warning',
          nodeId: id,
        });
      }
    }

    // 检查置信度范围
    if (node.confidence < 0 || node.confidence > 1) {
      errors.push({
        message: `节点 ${id} 的置信度 ${node.confidence} 超出范围 [0, 1]`,
        level: 'error',
        nodeId: id,
      });
    }
  }

  // 检查孤立节点（没有被任何节点引用的节点，除了根节点）
  const referencedIds = new Set<SemanticNodeId>();
  referencedIds.add(tree.rootId);
  for (const node of Object.values(tree.nodes)) {
    const childIds = getChildIds(node);
    childIds.forEach(id => referencedIds.add(id));
  }

  for (const id of Object.keys(tree.nodes)) {
    if (!referencedIds.has(id) && id !== tree.rootId) {
      warnings.push({
        message: `孤立节点 ${id} 未被任何节点引用`,
        level: 'warning',
        nodeId: id,
      });
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * 获取节点的所有子节点 ID
 */
function getChildIds(node: SemanticNode): SemanticNodeId[] {
  const ids: SemanticNodeId[] = [];

  switch (node.nodeType) {
    case 'root':
      ids.push(node.body);
      break;
    case 'component':
      ids.push(...node.children);
      break;
    case 'conditional-render':
      ids.push(node.trueBranch);
      if (node.falseBranch) ids.push(node.falseBranch);
      break;
    case 'list-render':
      ids.push(node.body);
      break;
  }

  return ids;
}
