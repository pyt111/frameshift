/**
 * Angular 解析器 - 上下文类型定义
 * 定义解析过程中使用的上下文对象和相关类型
 */

import type {
  SemanticNodeId,
  SemanticNode,
  StyleNode,
  PropDefinition,
  ParseWarning,
} from '../../semantic-tree/types';

/** Angular 解析器上下文 */
export interface AngularParserContext {
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
  /** 收集的 signal 名称 */
  signalNames: Set<string>;
  /** 收集的 computed 名称 */
  computedNames: Set<string>;
  /** 模板内容 */
  templateContent: string;
  /** 样式内容 */
  stylesContent: string;
  /** selector */
  selector: string;
}
