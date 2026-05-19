/**
 * Vue 模板解析器
 * 解析 Vue template AST 为语义树节点
 * 包含元素节点解析和所有 Vue 指令解析逻辑
 */

import type {
  SemanticNodeId,
  TextNode,
  ComponentNode,
  ConditionalRenderNode,
  ListRenderNode,
  StyleNode,
  ComponentProp,
  VModelInfo,
  EventHandlerNode,
} from '../../semantic-tree/types';

import { generateNodeId, isNativeElement } from './utils';
import type { VueParserContext, VueTemplateNode, VueTemplateProp } from './context';

/**
 * 解析 Vue 模板节点为语义树节点
 * 这里我们使用简化的模板解析 - 从 @vue/compiler-sfc 的模板 AST 获取信息
 */
export function parseTemplateAst(
  templateAst: unknown,
  ctx: VueParserContext,
  sourceCode: string
): SemanticNodeId | null {
  if (!templateAst || typeof templateAst !== 'object') return null;

  const node = templateAst as Record<string, unknown>;
  const nodeType = node.type as number;

  // Vue 模板 AST 节点类型常量
  const ELEMENT = 1;
  const TEXT = 2;
  const INTERPOLATION = 5;
  const COMMENT = 3;

  // 文本节点
  if (nodeType === TEXT || nodeType === COMMENT) {
    const content = (node as Record<string, unknown>).content as string;
    if (!content || !content.trim()) return null;

    const textId = generateNodeId('text');
    const textNode: TextNode = {
      id: textId,
      nodeType: 'text',
      content: content.trim(),
      confidence: 1.0,
      confidenceLevel: 'high',
    };
    ctx.nodes[textId] = textNode;
    return textId;
  }

  // 插值表达式 {{ expression }}
  if (nodeType === INTERPOLATION) {
    const innerNode = (node as Record<string, unknown>).content as Record<string, unknown>;
    const expression = innerNode?.content as string;
    if (!expression) return null;

    const textId = generateNodeId('text');
    const textNode: TextNode = {
      id: textId,
      nodeType: 'text',
      content: `{{${expression}}}`,
      interpolations: [{
        expression,
        startIndex: 0,
        endIndex: expression.length + 4,
      }],
      confidence: 0.95,
      confidenceLevel: 'high',
    };
    ctx.nodes[textId] = textNode;
    return textId;
  }

  // 元素节点
  if (nodeType === ELEMENT) {
    return parseVueElementNode(node, ctx, sourceCode);
  }

  return null;
}

/**
 * 解析 Vue 元素节点
 */
function parseVueElementNode(
  element: Record<string, unknown>,
  ctx: VueParserContext,
  sourceCode: string
): SemanticNodeId {
  const tag = (element.tag as string) || 'div';
  const props = (element.props as VueTemplateProp[]) || [];
  const children = (element.children as VueTemplateNode[]) || [];

  // 解析各种指令和属性
  const componentProps: ComponentProp[] = [];
  let conditionalNode: ConditionalRenderNode | null = null;
  let listNode: ListRenderNode | null = null;
  let vModelInfo: VModelInfo | null = null;

  // 用于检测 input 的 type 属性
  let inputType: string | undefined;

  // 用于存储 v-if/v-else-if/v-else 相关信息
  let vIfCondition: string | null = null;
  let vElseBranch = false;
  let vForExpression: string | null = null;
  let vForItemName = 'item';
  let vForIndexName: string | undefined;
  let vForKey: string | undefined;

  for (const prop of props) {
    const propType = prop.type;

    // 普通属性 (type 6 = attribute, type 7 = directive)
    if (propType === 6) {
      // 静态属性
      // @vue/compiler-sfc 的 prop.value 可能是 TextNode 对象 { type:2, content:"..." } 或字符串
      const rawValue = prop.value;
      const stringValue = typeof rawValue === 'string'
        ? rawValue
        : (rawValue as unknown as Record<string, unknown>)?.content as string ?? '';
      componentProps.push({
        name: prop.name,
        value: stringValue,
        isDynamic: false,
      });

      // 检测 input 元素的 type 属性，供 v-model 转换使用
      if (prop.name === 'type' && tag.toLowerCase() === 'input') {
        inputType = stringValue;
      }
      continue;
    }

    if (propType === 7) {
      // Vue 指令
      const directiveName = prop.name;

      // v-if 指令
      if (directiveName === 'if') {
        vIfCondition = prop.exp?.content ?? '';
        continue;
      }

      // v-else-if 指令
      if (directiveName === 'else-if') {
        vIfCondition = prop.exp?.content ?? '';
        continue;
      }

      // v-else 指令
      if (directiveName === 'else') {
        vElseBranch = true;
        continue;
      }

      // v-for 指令
      if (directiveName === 'for') {
        const forExp = prop.exp?.content ?? '';
        vForExpression = forExp;
        // 解析 v-for 表达式，如 "item in items" 或 "(item, index) in items"
        const inMatch = forExp.match(/^\s*(?:\(([^)]+)\)|(\S+))\s+in\s+(.+)$/);
        if (inMatch) {
          if (inMatch[1]) {
            // (item, index) in items
            const parts = inMatch[1].split(',').map(s => s.trim());
            vForItemName = parts[0] || 'item';
            vForIndexName = parts[1];
          } else {
            // item in items
            vForItemName = inMatch[2] || 'item';
          }
        }
        continue;
      }

      // v-model 指令
      if (directiveName === 'model') {
        const modelValue = prop.exp?.content ?? '';
        const modelArg = prop.arg?.content;
        const modelModifiers = prop.modifiers;

        // v-model 绑定的变量名（如 v-model="email" 中的 "email"）
        const modelVarName = modelArg ? `${modelValue}.${modelArg}` : modelValue;
        // 生成 React 对应的 setter 名
        const setterName = `set${modelVarName.charAt(0).toUpperCase() + modelVarName.slice(1)}`;

        // 创建 VModelInfo，存储到 ComponentNode 上供 React 生成器使用
        vModelInfo = {
          modelVarName,
          setterName,
          tagName: tag.toLowerCase(),
          inputType: tag.toLowerCase() === 'input' ? (inputType || 'text') : undefined,
          modifiers: modelModifiers,
          arg: modelArg,
        };

        // 注意：不再创建重复的 ReactiveStateNode，因为 script setup 解析时已经创建了
        // 也不再创建 EventHandlerNode，v-model 的 onChange 在 React 生成器中直接生成

        // 将 v-model 转换为 value prop（React 受控组件）
        componentProps.push({
          name: 'v-model',
          value: { expression: modelVarName, type: 'identifier' },
          isDynamic: true,
        });
        continue;
      }

      // v-bind 指令 (:attr)
      if (directiveName === 'bind') {
        const bindArg = prop.arg?.content ?? '';
        const bindExp = prop.exp?.content ?? '';

        // :class 处理
        if (bindArg === 'class') {
          componentProps.push({
            name: 'class',
            value: { expression: bindExp, type: 'other' },
            isDynamic: true,
            originalName: 'class',
          });
          continue;
        }

        // :style 处理
        if (bindArg === 'style') {
          const styleId = generateNodeId('style');
          const styleNode: StyleNode = {
            id: styleId,
            nodeType: 'style',
            styleKind: 'inline',
            content: bindExp,
            preprocessor: 'css',
            confidence: 0.9,
            confidenceLevel: 'high',
          };
          ctx.nodes[styleId] = styleNode;

          componentProps.push({
            name: 'style',
            value: { expression: bindExp, type: 'other' },
            isDynamic: true,
          });
          continue;
        }

        // :key 处理
        if (bindArg === 'key') {
          vForKey = bindExp;
          continue;
        }

        // 其他动态绑定
        componentProps.push({
          name: bindArg ? `:${bindArg}` : 'v-bind',
          value: { expression: bindExp, type: 'other' },
          isDynamic: true,
        });
        continue;
      }

      // v-on 指令 (@event)
      if (directiveName === 'on') {
        const eventArg = prop.arg?.content ?? '';
        const eventExp = prop.exp?.content ?? '';
        const eventModifiers = prop.modifiers ?? [];

        // 处理事件修饰符
        let vueEventName = eventArg;
        if (eventModifiers.length > 0) {
          // 保留修饰符信息
          vueEventName = `${eventArg}`;
        }

        // 创建事件处理节点
        const handlerId = generateNodeId('handler');
        const isInline = !eventExp.includes('(') && eventExp.length < 30;
        const handlerNode: EventHandlerNode = {
          id: handlerId,
          nodeType: 'event-handler',
          eventName: eventArg,
          handlerName: eventExp || `handle${eventArg.charAt(0).toUpperCase() + eventArg.slice(1)}`,
          handlerBody: eventExp || '{ ... }',
          isInline,
          modifiers: eventModifiers,
          confidence: 0.95,
          confidenceLevel: 'high',
        };
        ctx.nodes[handlerId] = handlerNode;

        componentProps.push({
          name: `@${vueEventName}`,
          value: { expression: eventExp, type: 'other' },
          isDynamic: true,
          originalName: `@${vueEventName}`,
        });
        continue;
      }

      // v-show 指令
      if (directiveName === 'show') {
        const showExp = prop.exp?.content ?? '';
        componentProps.push({
          name: 'v-show',
          value: { expression: showExp, type: 'other' },
          isDynamic: true,
        });
        continue;
      }

      // v-html 指令
      if (directiveName === 'html') {
        const htmlExp = prop.exp?.content ?? '';
        componentProps.push({
          name: 'v-html',
          value: { expression: htmlExp, type: 'other' },
          isDynamic: true,
        });
        continue;
      }

      // v-text 指令
      if (directiveName === 'text') {
        const textExp = prop.exp?.content ?? '';
        componentProps.push({
          name: 'v-text',
          value: { expression: textExp, type: 'other' },
          isDynamic: true,
        });
        continue;
      }

      // 其他未处理的指令
      ctx.warnings.push({
        message: `未处理的 Vue 指令: v-${directiveName}`,
        level: 'info',
      });
    }
  }

  // 解析子节点
  const childIds: SemanticNodeId[] = [];
  for (const child of children) {
    const childId = parseTemplateAst(child, ctx, sourceCode);
    if (childId) childIds.push(childId);
  }

  // 创建组件节点
  const componentId = generateNodeId('component');
  const componentNode: ComponentNode = {
    id: componentId,
    nodeType: 'component',
    tagName: tag,
    isNativeElement: isNativeElement(tag),
    props: componentProps,
    children: childIds,
    confidence: isNativeElement(tag) ? 1.0 : 0.85,
    confidenceLevel: 'high',
    vModelInfo: vModelInfo ?? undefined,
  };
  ctx.nodes[componentId] = componentNode;

  // 如果有 v-for，创建列表渲染节点
  if (vForExpression) {
    const iterableMatch = vForExpression.match(/^\s*(?:\([^)]+\)|\S+)\s+in\s+(.+)$/);
    const iterableExpression = iterableMatch ? iterableMatch[1].trim() : vForExpression;

    const listId = generateNodeId('list');
    const listRenderNode: ListRenderNode = {
      id: listId,
      nodeType: 'list-render',
      iterableExpression,
      itemName: vForItemName,
      indexName: vForIndexName,
      keyExpression: vForKey,
      body: componentId,
      confidence: 0.9,
      confidenceLevel: 'high',
    };
    ctx.nodes[listId] = listRenderNode;
    return listId;
  }

  // 如果有 v-if，创建条件渲染节点
  if (vIfCondition) {
    let falseBranchId: SemanticNodeId | undefined;
    // v-else 分支暂时无法在单节点解析中处理，需要上下文关联

    const condId = generateNodeId('conditional');
    const condNode: ConditionalRenderNode = {
      id: condId,
      nodeType: 'conditional-render',
      condition: vIfCondition,
      trueBranch: componentId,
      falseBranch: falseBranchId,
      conditionalKind: 'if',
      confidence: 0.9,
      confidenceLevel: 'high',
    };
    ctx.nodes[condId] = condNode;
    return condId;
  }

  return componentId;
}
