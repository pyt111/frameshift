/**
 * 翻译置信度评估模块
 * 用于计算翻译结果的整体置信度和各部分的置信度
 */

import type {
  TranslationWarning,
  ConfidenceLevel,
} from '../semantic-tree/types';

/**
 * 根据置信度数值获取等级
 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * 计算整体翻译置信度
 * 基于所有警告的置信度加权平均
 */
export function calculateOverallConfidence(warnings: TranslationWarning[]): number {
  if (warnings.length === 0) return 1.0;

  // 按置信度加权：低置信度的警告对整体评分影响更大
  const totalWeight = warnings.reduce((sum, w) => sum + w.confidence, 0);
  const averageConfidence = totalWeight / warnings.length;

  // 惩罚因子：警告越多，置信度越低
  const penaltyFactor = Math.max(0.3, 1 - warnings.length * 0.05);

  // 对低置信度警告额外惩罚
  const lowConfidenceCount = warnings.filter(w => w.confidence < 0.5).length;
  const lowConfidencePenalty = Math.max(0.2, 1 - lowConfidenceCount * 0.1);

  return Math.min(1.0, averageConfidence * penaltyFactor * lowConfidencePenalty);
}

/**
 * 为不确定的映射生成翻译警告
 */
export function generateWarning(
  message: string,
  confidence: number,
  warningType: TranslationWarning['warningType'],
  sourceSnippet?: string,
  targetSnippet?: string,
  sourceLocation?: { startLine: number; startColumn: number; endLine: number; endColumn: number }
): TranslationWarning {
  return {
    id: `warn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    warningType,
    sourceLocation,
    sourceSnippet,
    targetSnippet,
  };
}
