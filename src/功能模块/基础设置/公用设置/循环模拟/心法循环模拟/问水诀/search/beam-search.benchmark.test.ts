import { describe, expect, it } from '@jest/globals'
import { 问水聚合项 } from '../damage/aggregate-policy'
import { 创建问水优化搜索任务 } from '../components/controller'
import { 评估问水动作序列 } from './exhaustive-oracle'
import { 运行问水分块搜索 } from './runner'

const 基准已启用 = process.env.RUN_WENSHUI_OPTIMIZER_BENCHMARK === '1'
const 运行基准 = 基准已启用 ? it : it.skip
const 最长耗时毫秒 = 60_000
const 测试超时毫秒 = 70_000
const 字节每MiB = 1024 * 1024

const 计算确定性伤害 = (item: 问水聚合项) => {
  const nameScore = Array.from(item.技能名称).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const signatureScore = item.增益签名.length * 100 + item.快照签名.length * 50
  return { 伤害: 10_000 + nameScore + signatureScore, 会心率: 0.37 }
}

const 创建六百秒搜索任务 = () =>
  创建问水优化搜索任务({
    战斗时间: 600,
    加速值: 9_232,
    网络延迟: 1,
    奇穴: ['斩岳'],
    秘籍: {},
    团队增益轴: {},
    武器类型: '紫武',
    配置指纹: 'beam-search-benchmark-600s',
    计算单次伤害: 计算确定性伤害,
  })

const 转换MiB = (bytes: number) => Number((bytes / 字节每MiB).toFixed(2))

const 输出指标 = (metrics: Record<string, number | string>) => {
  console.info(`[wenshui-beam-benchmark] ${JSON.stringify(metrics)}`)
}

describe('问水诀 Beam Search 600 秒性能基准', () => {
  运行基准(
    '在 60 秒内完成确定性预算并保持合法性和基线下界',
    async () => {
      const task = 创建六百秒搜索任务()
      const baselineSequence = task.搜索参数.基线动作序列 || []
      const baseline = 评估问水动作序列(task.搜索参数, baselineSequence)
      const initialHeapBytes = process.memoryUsage().heapUsed
      let peakHeapBytes = initialHeapBytes
      const startedAt = Date.now()
      const result = await 运行问水分块搜索({
        搜索参数: task.搜索参数,
        每块扩展数: task.每块扩展数,
        紧急上限毫秒: 最长耗时毫秒,
        让出事件循环: async () => undefined,
        报告进度: () => {
          peakHeapBytes = Math.max(peakHeapBytes, process.memoryUsage().heapUsed)
        },
      })
      const elapsedMs = Date.now() - startedAt
      peakHeapBytes = Math.max(peakHeapBytes, process.memoryUsage().heapUsed)

      expect(baselineSequence.length).toBeGreaterThan(0)
      expect(baseline.成功).toBe(true)
      expect(result.成功).toBe(true)
      if (!baseline.成功 || !result.成功) return
      const probability = result.最佳候选.分支.reduce((sum, branch) => sum + branch.概率, 0)
      const improvement = (result.最佳候选.期望总伤 / baseline.候选.期望总伤 - 1) * 100
      输出指标({
        elapsedMs,
        workerElapsedMs: result.workerElapsedMs,
        expandedNodes: result.扩展节点数,
        beamWidth: task.搜索参数.Beam宽度,
        peakHeapMiB: 转换MiB(peakHeapBytes),
        heapGrowthMiB: 转换MiB(peakHeapBytes - initialHeapBytes),
        baselineDamage: Number(baseline.候选.期望总伤.toFixed(2)),
        bestDamage: Number(result.最佳候选.期望总伤.toFixed(2)),
        improvementPercent: Number(improvement.toFixed(4)),
      })

      expect(elapsedMs).toBeLessThan(最长耗时毫秒)
      expect(result.workerElapsedMs).toBeLessThan(最长耗时毫秒)
      expect(probability).toBeCloseTo(1)
      expect(result.最佳候选.期望总伤).toBeGreaterThanOrEqual(baseline.候选.期望总伤)
      expect(result.扩展节点数).toBe(task.搜索参数.扩展预算)
      expect(result.结束原因).toBe('确定性预算')
      expect(result.是否提前结束).toBe(false)
    },
    测试超时毫秒,
  )
})
