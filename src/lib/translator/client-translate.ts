/**
 * 客户端 AST 翻译模块
 * 
 * 纯浏览器端执行的 AST 翻译管线，无需调用服务端 API。
 * 仅支持 AST 管线模式（enableAI=false）。
 * 
 * ⚠️ 注意：此模块不能导入 `../ai/assistant`（使用了 server-only SDK）
 * 
 * 客户端限制：
 * - @vue/compiler-sfc 在客户端无法直接使用（依赖 Node.js fs/path 模块）
 * - 当源框架为 Vue 3 时，回退到服务端 API
 * - React 和 Angular 解析器使用 @babel/parser，可在客户端正常工作
 */

import type {
  Framework,
  TranslationResult,
  TranslationWarning,
  UISemanticTree,
  PipelineStep,
} from '../semantic-tree/types';
import { parseReact } from '../parsers/react';
import { parseAngular } from '../parsers/angular';
import { generateVue } from '../generators/vue';
import { generateReact } from '../generators/react';
import { generateAngular } from '../generators/angular';
import { validateSemanticTree } from '../semantic-tree/validator';
import { calculateOverallConfidence, getConfidenceLevel, generateWarning } from './confidence';

function getParser(framework: Framework): (code: string) => UISemanticTree {
  switch (framework) {
    case 'react': return parseReact;
    // Vue 3 解析器需要 @vue/compiler-sfc，客户端不支持，回退到服务端
    case 'vue3': throw new Error('CLIENT_VUE3_UNSUPPORTED');
    case 'angular': return parseAngular;
    default: throw new Error(`不支持的源框架: ${framework}`);
  }
}

function getGenerator(framework: Framework): (tree: UISemanticTree) => { code: string; styles: string; imports: string[]; warnings: TranslationWarning[] } {
  switch (framework) {
    case 'vue3': return generateVue;
    case 'react': return generateReact;
    case 'angular': return generateAngular;
    default: throw new Error(`不支持的目标框架: ${framework}`);
  }
}

/** 框架标签映射 */
const FRAMEWORK_LABELS: Record<Framework, string> = {
  react: 'React (JSX/TSX)',
  vue3: 'Vue 3 (SFC)',
  angular: 'Angular (TypeScript)',
};

/** 检查指定框架是否支持客户端翻译 */
export function isClientTranslationSupported(sourceFramework: Framework): boolean {
  // Vue 3 解析器依赖 @vue/compiler-sfc，需要 Node.js 环境
  return sourceFramework !== 'vue3'
}

/**
 * 客户端 AST 翻译
 * 纯本地执行，不调用任何服务端 API
 * 
 * 注意：当源框架为 Vue 3 时，抛出 'CLIENT_VUE3_UNSUPPORTED' 错误，
 * 调用方应回退到服务端 API
 */
export async function clientTranslate(
  sourceCode: string,
  sourceFramework: Framework,
  targetFramework: Framework,
): Promise<TranslationResult> {
  const startTime = Date.now();

  // 初始化流水线步骤
  const pipelineSteps: PipelineStep[] = [
    {
      id: 'parse',
      name: '源代码解析',
      description: `解析 ${FRAMEWORK_LABELS[sourceFramework]} 源代码，提取语法结构`,
      status: 'pending',
      icon: 'FileSearch',
    },
    {
      id: 'semantic-tree',
      name: '构建语义树',
      description: '构建框架无关的 UI 语义树，建立四层结构映射',
      status: 'pending',
      icon: 'GitBranch',
    },
    {
      id: 'generate',
      name: '目标代码生成',
      description: `基于语义树生成 ${FRAMEWORK_LABELS[targetFramework]} 代码`,
      status: 'pending',
      icon: 'Code2',
    },
    {
      id: 'confidence',
      name: '置信度评估',
      description: '计算整体翻译置信度，生成审查建议',
      status: 'pending',
      icon: 'ShieldCheck',
    },
  ];

  /** 标记步骤开始 */
  const startStep = (id: string) => {
    const step = pipelineSteps.find(s => s.id === id);
    if (step) step.status = 'running';
  };

  /** 标记步骤完成 */
  const completeStep = (id: string, summary: string, detail?: Record<string, unknown>) => {
    const step = pipelineSteps.find(s => s.id === id);
    if (step) {
      step.status = 'completed';
      step.duration = Date.now() - startTime;
      step.summary = summary;
      step.detail = detail;
    }
  };

  /** 标记步骤错误 */
  const errorStep = (id: string, errorMsg: string) => {
    const step = pipelineSteps.find(s => s.id === id);
    if (step) {
      step.status = 'error';
      step.summary = errorMsg;
    }
  };

  if (!sourceCode.trim()) {
    return { code: '', targetFramework, overallConfidence: 0, confidenceLevel: 'low', warnings: [generateWarning('源代码为空', 0, 'manual-review')], duration: Date.now() - startTime, pipeline: { steps: pipelineSteps, totalDuration: Date.now() - startTime } };
  }

  if (sourceFramework === targetFramework) {
    return { code: sourceCode, targetFramework, overallConfidence: 1.0, confidenceLevel: 'high', warnings: [generateWarning('源框架和目标框架相同', 1.0, 'manual-review')], duration: Date.now() - startTime, pipeline: { steps: pipelineSteps, totalDuration: Date.now() - startTime } };
  }

  try {
    // ===== 步骤1：解析源代码 =====
    startStep('parse');
    const parseStartTime = Date.now();
    const parser = getParser(sourceFramework);
    const semanticTree = parser(sourceCode);
    const parseDuration = Date.now() - parseStartTime;

    const nodeCount = Object.keys(semanticTree.nodes).length;
    completeStep('parse', `解析成功，发现 ${nodeCount} 个语义节点`, {
      sourceFramework,
      nodeCount,
      parseWarnings: semanticTree.parseWarnings.length,
      duration: parseDuration,
    });

    // ===== 步骤2：构建语义树 & 校验 =====
    startStep('semantic-tree');
    const treeStartTime = Date.now();
    const validation = validateSemanticTree(semanticTree);
    if (!validation.valid) {
      for (const error of validation.errors) { semanticTree.parseWarnings.push(error); }
    }

    const rootNode = semanticTree.nodes[semanticTree.rootId];
    if (!rootNode) {
      errorStep('semantic-tree', '根节点缺失，解析失败');
      return {
        code: `// 解析失败\n\n/* 原始代码 */\n${sourceCode}`,
        targetFramework, overallConfidence: 0, confidenceLevel: 'low',
        warnings: [generateWarning('源代码解析失败', 0, 'manual-review'), ...semanticTree.parseWarnings.map(w => generateWarning(w.message, 0.3, 'pattern-unsupported'))],
        duration: Date.now() - startTime, semanticTree,
        pipeline: { steps: pipelineSteps, totalDuration: Date.now() - startTime },
      };
    }

    const treeDuration = Date.now() - treeStartTime;
    const nodeTypeCounts: Record<string, number> = {};
    for (const node of Object.values(semanticTree.nodes)) {
      nodeTypeCounts[node.nodeType] = (nodeTypeCounts[node.nodeType] || 0) + 1;
    }
    completeStep('semantic-tree', `语义树构建完成，${nodeCount} 个节点，${Object.keys(nodeTypeCounts).length} 种类型`, {
      nodeTypeCounts,
      validationErrors: validation.errors.length,
      componentName: (rootNode as { componentName?: string }).componentName || 'Unknown',
      duration: treeDuration,
    });

    // ===== 步骤3：AST 代码生成 =====
    startStep('generate');
    const genStartTime = Date.now();
    const generator = getGenerator(targetFramework);
    const generateResult = generator(semanticTree);
    const genDuration = Date.now() - genStartTime;

    const generatedCode = generateResult.code;
    const generatedStyles = generateResult.styles || undefined;
    const generatedImports = generateResult.imports.length > 0 ? generateResult.imports : undefined;

    const codeLineCount = generatedCode.split('\n').length;
    completeStep('generate', `生成 ${FRAMEWORK_LABELS[targetFramework]} 代码，${codeLineCount} 行`, {
      targetFramework,
      lineCount: codeLineCount,
      charCount: generatedCode.length,
      importCount: generateResult.imports.length,
      warningCount: generateResult.warnings.length,
      mode: 'ast',
      duration: genDuration,
    });

    const allWarnings: TranslationWarning[] = [
      ...generateResult.warnings,
      ...semanticTree.parseWarnings.filter(w => w.level !== 'info').map(w => generateWarning(`[解析] ${w.message}`, w.level === 'error' ? 0.2 : 0.6, 'pattern-unsupported')),
    ];

    // ===== 步骤4：置信度评估 =====
    startStep('confidence');
    const overallConfidence = calculateOverallConfidence(allWarnings);
    const highCount = allWarnings.filter(w => w.confidenceLevel === 'high').length;
    const mediumCount = allWarnings.filter(w => w.confidenceLevel === 'medium').length;
    const lowCount = allWarnings.filter(w => w.confidenceLevel === 'low').length;
    completeStep('confidence', `置信度 ${Math.round(overallConfidence * 100)}%，高/中/低: ${highCount}/${mediumCount}/${lowCount}`, {
      overallConfidence,
      confidenceLevel: getConfidenceLevel(overallConfidence),
      highCount,
      mediumCount,
      lowCount,
      totalWarnings: allWarnings.length,
    });

    return {
      code: generatedCode, targetFramework, overallConfidence,
      confidenceLevel: getConfidenceLevel(overallConfidence),
      warnings: allWarnings, duration: Date.now() - startTime, semanticTree,
      styles: generatedStyles,
      imports: generatedImports,
      pipeline: { steps: pipelineSteps, totalDuration: Date.now() - startTime },
    };
  } catch (error) {
    // 标记当前运行中的步骤为错误
    for (const step of pipelineSteps) {
      if (step.status === 'running') {
        step.status = 'error';
        step.summary = error instanceof Error ? error.message : String(error);
      }
    }
    return {
      code: `// 翻译错误: ${error instanceof Error ? error.message : String(error)}\n\n/* 原始代码 */\n${sourceCode}`,
      targetFramework, overallConfidence: 0, confidenceLevel: 'low',
      warnings: [generateWarning(`翻译引擎错误: ${error instanceof Error ? error.message : String(error)}`, 0, 'manual-review')],
      duration: Date.now() - startTime,
      pipeline: { steps: pipelineSteps, totalDuration: Date.now() - startTime },
    };
  }
}
