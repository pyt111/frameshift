/**
 * React 解析器 - 上下文类型定义
 * 定义解析器在遍历过程中使用的上下文结构
 */

import type {
  SemanticNode,
  SemanticNodeId,
  PropDefinition,
  ParseWarning,
  StyleNode,
} from '../../semantic-tree/types';

/** 解析器上下文 - 在遍历过程中收集信息 */
export interface ParserContext {
  /** 所有语义节点 */
  nodes: Record<SemanticNodeId, SemanticNode>;
  /** 解析警告 */
  warnings: ParseWarning[];
  /** 组件名称 */
  componentName: string;
  /** Props 定义 */
  propsDefinition: PropDefinition[];
  /** 收集的 React hooks（useState 等） */
  hooks: Map<string, { names: string[]; nodeId: SemanticNodeId }>;
  /** 事件处理函数映射 */
  eventHandlers: Map<string, { handlerName: string; handlerBody: string; eventParam?: string; isInline: boolean }>;
  /** 自定义函数声明 */
  functionDeclarations: Map<string, string>;
  /** 导入语句 */
  imports: string[];
  /** 样式节点 */
  styleNodes: StyleNode[];
}
