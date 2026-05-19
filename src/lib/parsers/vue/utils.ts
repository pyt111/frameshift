/**
 * Vue 解析器工具函数
 * ID 生成、源码位置提取、AST 节点代码转换、表达式类型判断、原生元素检测
 */

import type * as BabelTypes from '@babel/types';
import type {
  SemanticNodeId,
  RootComponentNode,
  ExpressionValue,
} from '../../semantic-tree/types';

/** 生成唯一节点 ID 的计数器 */
let nodeIdCounter = 0;

/** 生成唯一节点 ID */
export function generateNodeId(prefix: string): SemanticNodeId {
  nodeIdCounter += 1;
  return `${prefix}-${nodeIdCounter}`;
}

/** 重置 ID 计数器 */
export function resetIdCounter(): void {
  nodeIdCounter = 0;
}

/** 从 Babel AST 节点获取源码位置信息 */
export function getSourceLocation(loc: BabelTypes.SourceLocation | null | undefined): RootComponentNode['sourceLocation'] {
  if (!loc) return undefined;
  return {
    startLine: loc.start.line,
    startColumn: loc.start.column,
    endLine: loc.end.line,
    endColumn: loc.end.column,
  };
}

/**
 * 获取 AST 节点的源码文本表示（简化版）
 */
export function getNodeCode(node: BabelTypes.Node): string {
  try {
    switch (node.type) {
      case 'Identifier':
        return (node as BabelTypes.Identifier).name;
      case 'StringLiteral':
        return `"${(node as BabelTypes.StringLiteral).value}"`;
      case 'NumericLiteral':
        return String((node as BabelTypes.NumericLiteral).value);
      case 'BooleanLiteral':
        return String((node as BabelTypes.BooleanLiteral).value);
      case 'NullLiteral':
        return 'null';
      case 'MemberExpression': {
        const mem = node as BabelTypes.MemberExpression;
        const obj = getNodeCode(mem.object);
        const prop = mem.computed ? `[${getNodeCode(mem.property)}]` : `.${getNodeCode(mem.property)}`;
        return `${obj}${prop}`;
      }
      case 'CallExpression': {
        const call = node as BabelTypes.CallExpression;
        const callee = getNodeCode(call.callee);
        const args = call.arguments.map(arg => {
          if (arg.type === 'SpreadElement') return `...${getNodeCode(arg.argument)}`;
          return getNodeCode(arg as BabelTypes.Expression);
        }).join(', ');
        return `${callee}(${args})`;
      }
      case 'ArrowFunctionExpression': {
        const arrow = node as BabelTypes.ArrowFunctionExpression;
        const params = arrow.params.map(p => getNodeCode(p)).join(', ');
        const body = arrow.body.type === 'BlockStatement'
          ? '{ ... }'
          : getNodeCode(arrow.body as BabelTypes.Expression);
        return `(${params}) => ${body}`;
      }
      case 'BinaryExpression': {
        const bin = node as BabelTypes.BinaryExpression;
        return `${getNodeCode(bin.left)} ${bin.operator} ${getNodeCode(bin.right)}`;
      }
      case 'ConditionalExpression': {
        const cond = node as BabelTypes.ConditionalExpression;
        return `${getNodeCode(cond.test)} ? ${getNodeCode(cond.consequent)} : ${getNodeCode(cond.alternate)}`;
      }
      case 'TemplateLiteral': {
        const tmpl = node as BabelTypes.TemplateLiteral;
        return `\`${tmpl.quasis.map(q => q.value.cooked ?? '').join('${...}')}\``;
      }
      case 'ObjectExpression': {
        const obj = node as BabelTypes.ObjectExpression;
        const props = obj.properties.map(p => {
          if (p.type === 'ObjectProperty') {
            const key = p.computed ? `[${getNodeCode(p.key as BabelTypes.Expression)}]` : getNodeCode(p.key as BabelTypes.Expression);
            return `${key}: ${getNodeCode(p.value as BabelTypes.Expression)}`;
          }
          return '...';
        }).join(', ');
        return `{ ${props} }`;
      }
      case 'ArrayExpression': {
        const arr = node as BabelTypes.ArrayExpression;
        const elems = arr.elements.map(e => e ? (e.type === 'SpreadElement' ? `...${getNodeCode(e.argument)}` : getNodeCode(e as BabelTypes.Expression)) : '').join(', ');
        return `[${elems}]`;
      }
      case 'LogicalExpression': {
        const logical = node as BabelTypes.LogicalExpression;
        return `${getNodeCode(logical.left)} ${logical.operator} ${getNodeCode(logical.right)}`;
      }
      case 'UnaryExpression': {
        const unary = node as BabelTypes.UnaryExpression;
        return `${unary.operator}${getNodeCode(unary.argument)}`;
      }
      case 'UpdateExpression': {
        const update = node as BabelTypes.UpdateExpression;
        return update.prefix ? `${update.operator}${getNodeCode(update.argument)}` : `${getNodeCode(update.argument)}${update.operator}`;
      }
      case 'AssignmentExpression': {
        const assign = node as BabelTypes.AssignmentExpression;
        return `${getNodeCode(assign.left)} ${assign.operator} ${getNodeCode(assign.right)}`;
      }
      default:
        return node.type;
    }
  } catch {
    return node.type;
  }
}

/**
 * 判断表达式类型
 */
export function getExpressionType(node: BabelTypes.Node): ExpressionValue['type'] {
  switch (node.type) {
    case 'Identifier':
      return 'identifier';
    case 'MemberExpression':
      return 'member';
    case 'CallExpression':
      return 'call';
    case 'BinaryExpression':
    case 'LogicalExpression':
      return 'binary';
    case 'ConditionalExpression':
      return 'ternary';
    case 'TemplateLiteral':
      return 'template';
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return 'arrow-function';
    default:
      return 'other';
  }
}

/**
 * 判断标签名是否为原生 HTML 元素
 */
export function isNativeElement(tagName: string): boolean {
  const nativeTags = new Set([
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'button', 'input', 'form', 'label',
    'select', 'option', 'textarea', 'img', 'video', 'audio',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'header', 'footer', 'nav', 'main', 'section', 'article', 'aside',
    'br', 'hr', 'strong', 'em', 'code', 'pre',
  ]);
  return nativeTags.has(tagName.toLowerCase());
}
