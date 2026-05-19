/**
 * 翻译引擎主入口
 * 串联解析器、生成器和 AI 辅助翻译
 * 
 * 翻译模式：
 * 1. AI 全量翻译模式（enableAI=true）：使用 LLM 直接翻译完整代码，AST 管线仅用于语义树可视化
 * 2. AST 管线模式（enableAI=false）：解析→语义树→生成→置信度评分
 */

import type {
  Framework,
  TranslationResult,
  TranslationRequest,
  TranslationWarning,
  UISemanticTree,
  PipelineStep,
  TranslationPipeline,
} from '../semantic-tree/types';
import { parseReact } from '../parsers/react';
import { parseVue } from '../parsers/vue';
import { parseAngular } from '../parsers/angular';
import { generateVue } from '../generators/vue';
import { generateReact } from '../generators/react';
import { generateAngular } from '../generators/angular';
import { validateSemanticTree } from '../semantic-tree/validator';
import { calculateOverallConfidence, getConfidenceLevel, generateWarning } from './confidence';
import { aiFullTranslation } from '../ai';
import type { AICustomConfig } from '../ai';

function getParser(framework: Framework): (code: string) => UISemanticTree {
  switch (framework) {
    case 'react': return parseReact;
    case 'vue3': return parseVue;
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

export async function translate(request: TranslationRequest): Promise<TranslationResult> {
  const startTime = Date.now();
  const { sourceCode, sourceFramework, targetFramework, enableAI = false, aiConfig } = request;

  // Convert aiConfig to AICustomConfig format for the assistant module
  const customAiConfig: AICustomConfig | undefined = aiConfig ? {
    provider: aiConfig.provider,
    apiProtocol: aiConfig.apiProtocol,
    baseUrl: aiConfig.baseUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
  } : undefined;

  // 日志：显示实际使用的 AI 配置
  if (enableAI) {
    const aiProvider = customAiConfig?.provider === 'custom' ? `自定义AI (${customAiConfig.model})` : '内置 GLM-4';
    console.log(`[FrameShift Engine] AI 翻译模式: ${aiProvider}`, customAiConfig?.provider === 'custom' ? `baseUrl: ${customAiConfig.baseUrl}` : '');
  }

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
      description: enableAI
        ? `AI 全量翻译为 ${FRAMEWORK_LABELS[targetFramework]} 代码`
        : `基于语义树生成 ${FRAMEWORK_LABELS[targetFramework]} 代码`,
      status: 'pending',
      icon: 'Code2',
    },
    {
      id: 'ai-assist',
      name: 'AI 辅助优化',
      description: 'AI 优化低置信度翻译点，提升代码质量',
      status: enableAI ? 'skipped' : 'skipped', // AI 全量翻译模式下此步骤已合并到 generate
      icon: 'Sparkles',
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
    // ===== 步骤1：解析源代码（用于语义树可视化）=====
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

    // ===== 步骤3：代码生成 =====
    let generatedCode: string;
    let generatedStyles: string | undefined;
    let generatedImports: string[] | undefined;
    let allWarnings: TranslationWarning[];

    if (enableAI) {
      // ===== AI 全量翻译模式 =====
      // 使用 LLM 直接翻译完整代码，AST 管线仅用于语义树可视化
      startStep('generate');
      const genStartTime = Date.now();

      const aiResult = await aiFullTranslation(sourceCode, sourceFramework, targetFramework, customAiConfig);

      if (aiResult.success && aiResult.code) {
        generatedCode = aiResult.code;
        generatedStyles = undefined;
        generatedImports = undefined;
        // 统计语义树节点数作为翻译单元数
        const aiUnitCount = Math.max(Object.keys(semanticTree.nodes).length, 1);
        allWarnings = [
          generateWarning(`代码由 AI 全量翻译生成（${aiUnitCount} 个翻译单元），建议人工审查`, 0.85, 'ai-assisted'),
          ...semanticTree.parseWarnings
            .filter(w => w.level !== 'info')
            .map(w => generateWarning(`[解析] ${w.message}`, w.level === 'error' ? 0.2 : 0.6, 'pattern-unsupported')),
        ];

        const codeLineCount = generatedCode.split('\n').length;
        const genDuration = Date.now() - genStartTime;
        const aiProviderInfo = customAiConfig?.provider === 'custom'
          ? `${customAiConfig.model} @ ${customAiConfig.baseUrl}`
          : 'GLM-4 (内置)';
        completeStep('generate', `AI 全量翻译完成，生成 ${FRAMEWORK_LABELS[targetFramework]} 代码，${codeLineCount} 行，${aiUnitCount} 个翻译单元`, {
          targetFramework,
          lineCount: codeLineCount,
          charCount: generatedCode.length,
          mode: 'ai-full',
          aiProvider: aiProviderInfo,
          aiUnitCount,
          duration: genDuration,
        });
      } else {
        // AI 翻译失败，回退到 AST 管线
        console.warn('AI 全量翻译失败，回退到 AST 管线');
        const generator = getGenerator(targetFramework);
        const generateResult = generator(semanticTree);
        generatedCode = generateResult.code;
        generatedStyles = generateResult.styles || undefined;
        generatedImports = generateResult.imports.length > 0 ? generateResult.imports : undefined;
        allWarnings = [
          generateWarning('AI 全量翻译失败，已回退到 AST 管线翻译，部分代码可能缺失', 0.5, 'manual-review'),
          ...generateResult.warnings,
          ...semanticTree.parseWarnings
            .filter(w => w.level !== 'info')
            .map(w => generateWarning(`[解析] ${w.message}`, w.level === 'error' ? 0.2 : 0.6, 'pattern-unsupported')),
        ];

        const codeLineCount = generatedCode.split('\n').length;
        const genDuration = Date.now() - genStartTime;
        completeStep('generate', `AI 翻译失败回退 AST 管线，生成 ${FRAMEWORK_LABELS[targetFramework]} 代码，${codeLineCount} 行`, {
          targetFramework,
          lineCount: codeLineCount,
          charCount: generatedCode.length,
          mode: 'ast-fallback',
          duration: genDuration,
        });
      }
    } else {
      // ===== AST 管线模式 =====
      startStep('generate');
      const genStartTime = Date.now();
      const generator = getGenerator(targetFramework);
      const generateResult = generator(semanticTree);
      const genDuration = Date.now() - genStartTime;

      generatedCode = generateResult.code;
      generatedStyles = generateResult.styles || undefined;
      generatedImports = generateResult.imports.length > 0 ? generateResult.imports : undefined;

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

      allWarnings = [
        ...generateResult.warnings,
        ...semanticTree.parseWarnings.filter(w => w.level !== 'info').map(w => generateWarning(`[解析] ${w.message}`, w.level === 'error' ? 0.2 : 0.6, 'pattern-unsupported')),
      ];
    }

    // ===== 步骤4：AI 辅助（仅 AST 模式且 AI 开启时） =====
    // 在 AI 全量翻译模式下，此步骤已跳过
    // 保留此步骤以备将来可能的混合模式使用

    // ===== 步骤5：置信度评估 =====
    startStep('confidence');
    const overallConfidence = enableAI
      ? 0.85  // AI 全量翻译默认置信度
      : calculateOverallConfidence(allWarnings);
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
