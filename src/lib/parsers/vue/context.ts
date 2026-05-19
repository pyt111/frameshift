/**
 * Vue 解析器上下文类型定义
 * 包含解析器上下文接口、Vue 模板 AST 类型、语句标记工具
 */

import type * as BabelTypes from '@babel/types';
import type {
  SemanticNodeId,
  SemanticNode,
  PropDefinition,
  StyleNode,
  ParseWarning,
} from '../../semantic-tree/types';

/** 解析器上下文 */
export interface VueParserContext {
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
  /** emit 事件名 */
  emitNames: string[];
  /** 原始 import 语句（从 <script setup> 中提取） */
  importStatements: string[];
  /** 原始脚本代码（未被 AST 解析器处理的部分，供生成器保留） */
  rawScriptCode: string;
}

/** Vue 模板 AST 节点类型（简化） */
export interface VueTemplateNode {
  type: number;
  tag?: string;
  props?: VueTemplateProp[];
  children?: VueTemplateNode[];
  content?: string;
  loc?: { start: { line: number; column: number }; end: { line: number; column: number } };
  // v-if 条件
  directives?: VueDirective[];
  // 循环
  isSelfClosing?: boolean;
}

export interface VueTemplateProp {
  type: number;
  name: string;
  value?: string;
  loc?: { start: { line: number; column: number }; end: { line: number; column: number } };
  // 对于指令
  arg?: { content: string; type: number };
  exp?: { content: string; type: number; loc?: { start: { line: number; column: number }; end: { line: number; column: number } } };
  modifiers?: string[];
}

export interface VueDirective {
  type: number;
  name: string;
  arg?: { content: string; type: number };
  exp?: { content: string; type: number };
  modifiers?: string[];
}

/**
 * 标记一个语句的所有行为已处理
 * 从当前路径向上查找到顶层语句节点
 */
export function markStatementHandled(
  path: { node: BabelTypes.Node; parentPath: { node: BabelTypes.Node; parentPath: { node: BabelTypes.Node } | null } | null },
  handledLineNumbers: Set<number>,
): void {
  // 向上找到顶层语句（Program 的直接子节点）
  let currentNode: BabelTypes.Node = path.node;
  let parent = path.parentPath;
  while (parent && parent.node.type !== 'Program') {
    currentNode = parent.node;
    parent = (parent as { parentPath: { node: BabelTypes.Node; parentPath: { node: BabelTypes.Node } | null } | null }).parentPath;
  }

  // 标记此节点的所有行
  if ('loc' in currentNode && currentNode.loc) {
    const loc = currentNode.loc as BabelTypes.SourceLocation;
    for (let line = loc.start.line; line <= loc.end.line; line++) {
      handledLineNumbers.add(line);
    }
  }
}
