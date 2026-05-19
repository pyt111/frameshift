/**
 * React 代码生成器 - 主入口
 * 将 UISemanticTree 语义树生成为 React 函数组件代码
 * 支持 TypeScript + 函数组件 + Hooks
 */

import type { UISemanticTree, TranslationWarning } from '../../semantic-tree/types';
import { generateWarning } from '../../translator/confidence';
import { generateComponentCode } from './component';
import { convertVueRefMutations, type ReactGenerateResult } from './utils';
import { generateStyleBlock } from './styles';

export type { ReactGenerateResult };

/**
 * 主生成函数：从 UISemanticTree 生成 React 函数组件代码
 */
export function generateReact(tree: UISemanticTree): ReactGenerateResult {
  const warnings: TranslationWarning[] = [];

  // 生成 React 组件代码
  let code = generateComponentCode(tree, warnings);

  // 后处理：将 Vue ref 变更转换为 React setter 调用
  code = convertVueRefMutations(tree, code);

  // 生成样式
  const styleContent = generateStyleBlock(tree);

  // 收集 import 语句
  const imports: string[] = [];
  const reactImportMatch = code.match(/import\s+\{[^}]+\}\s+from\s+'react'/);
  if (reactImportMatch) {
    imports.push(reactImportMatch[0]);
  }

  // 添加源框架特定警告
  if (tree.sourceFramework === 'vue3') {
    warnings.push(generateWarning(
      'Vue 模板语法已转换为 React JSX 语法',
      0.9,
      'mapping-uncertain',
    ));
  }

  return {
    code,
    styles: styleContent,
    imports,
    warnings,
  };
}
