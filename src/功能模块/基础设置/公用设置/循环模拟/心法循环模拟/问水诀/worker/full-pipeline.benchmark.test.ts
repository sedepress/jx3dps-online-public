import { describe, expect, it } from '@jest/globals'
import { MessageChannel } from 'node:worker_threads'
import { 技能基础数据模型 } from '@/@types/技能'
import { 获取计算目标信息 } from '@/计算模块/统一工具函数/工具函数'
import { 初始化心法数据 } from '@/数据/数据工具/获取当前数据'
import 心法配置 from '@/心法模块/心法/问水诀'
import { 默认团队增益轴 } from '@/工具函数/init/默认数据'
import { 创建当前问水搜索任务 } from '../components/adapter'
import { 聚合问水策略, 转换问水聚合项为循环 } from '../damage/aggregate-policy'
import { 问水伤害计算上下文 } from '../damage/build-damage-table'
import { 创建问水伤害快照, 创建问水增益签名解析器 } from '../damage/context'
import { 精确重排问水候选, 问水待复算候选 } from '../damage/rerank-candidates'
import { 评估问水动作序列, 问水搜索候选 } from '../search/exhaustive-oracle'
import { 运行问水分块搜索, 问水Runner结果 } from '../search/runner'
import { Worker入站消息, Worker出站消息 } from './protocol'

const 运行基准 = process.env.RUN_WENSHUI_OPTIMIZER_BENCHMARK === '1' ? it : it.skip
const 战斗时间 = 600
const 最长耗时毫秒 = 60_000
const 测试超时毫秒 = 140_000
const 最大复算数 = 2
const 字节每MiB = 1024 * 1024

const 创建真实数据 = () => {
  const cycle = 心法配置.计算循环.find((item) => item.名称 === '叠锋意斩岳循环')
  if (!cycle) throw new Error('缺少问水诀斩岳循环')
  return {
    cycle,
    data: {
      网络延迟: 1,
      装备信息: 心法配置.默认数据.配装,
      当前输出计算目标名称: '134级木桩',
      增益启用: false,
      增益数据: { 阵眼: '', 小吃: [], 团队增益: [] },
      当前奇穴信息: cycle.奇穴,
      当前秘籍信息: 心法配置.默认数据.秘籍,
      当前计算循环名称: cycle.名称,
      自定义循环列表: [],
      团队增益轴: 默认团队增益轴,
      当前计算结果: { 秒伤: 0, 总伤: 0, 秒伤计算时间: 0, 计算结果技能列表: [] },
    } as any,
  }
}

const 创建伤害上下文 = (data: any): 问水伤害计算上下文 => {
  const { 获取判断增益后技能系数 } = require('@/计算模块/统一工具函数/技能增益启用计算')
  const skills = 获取判断增益后技能系数({
    秘籍信息: data.当前秘籍信息,
    奇穴数据: data.当前奇穴信息,
    装备增益: data.装备信息.装备增益,
    团队增益: false,
    团队快照计算列表: [],
  })
  return {
    装备信息: data.装备信息,
    当前目标: 获取计算目标信息(data.当前输出计算目标名称),
    技能数据映射: new Map<string, 技能基础数据模型>(skills.map((item) => [item.技能名称, item])),
    增益启用: false,
    增益数据: data.增益数据,
    战斗时间,
    是否郭氏计算: true,
    快照计算: [],
    计算循环详情: { 战斗时间, 技能详情: [] },
    奇穴数据: data.当前奇穴信息,
    计算技能详情: true,
  }
}

const 创建待复算候选 = (
  id: string,
  candidate: 问水搜索候选,
  resolver: ReturnType<typeof 创建问水增益签名解析器>,
): 问水待复算候选 => {
  const aggregated = 聚合问水策略({ 分支: candidate.分支 })
  if (!aggregated.成功) throw new Error(aggregated.失败原因)
  expect(aggregated.总概率).toBeCloseTo(1)
  const cycle = 转换问水聚合项为循环({ 项目: aggregated.项目, 解析增益签名: resolver })
  if (!cycle.成功) throw new Error(cycle.失败原因)
  return { id, 近似期望伤害: candidate.期望总伤, 技能详情: cycle.技能详情 }
}

const 转换MiB = (bytes: number) => Number((bytes / 字节每MiB).toFixed(2))

// Jest 的 jsdom 全局未暴露 structuredClone，MessageChannel 使用同一原生克隆算法。
const 结构化克隆 = <T>(value: T) =>
  new Promise<T>((resolve, reject) => {
    const { port1, port2 } = new MessageChannel()
    const close = () => {
      port1.close()
      port2.close()
    }
    port2.once('message', (cloned) => {
      close()
      resolve(cloned)
    })
    port2.once('messageerror', (error) => {
      close()
      reject(error)
    })
    port1.postMessage(value)
  })

const 准备基准上下文 = async () => {
  await 初始化心法数据('问水诀')
  const { data } = 创建真实数据()
  const dispatch = (action) =>
    typeof action === 'function' ? action(undefined, () => ({ data })) : action
  const context = 创建伤害上下文(data)
  const task = 创建当前问水搜索任务({ data, dispatch, 战斗时间 })
  const resolver = 创建问水增益签名解析器(context)
  const snapshot = 创建问水伤害快照({
    项目: task.搜索参数.伤害表.map((item) => ({ ...item, 施放数量: 1, 伤害次数: 1 })),
    计算上下文: context,
    解析增益签名: resolver,
  })
  if (!snapshot.成功) throw new Error(snapshot.失败原因)
  expect(snapshot.成功).toBe(true)
  const clonedSnapshot = await 结构化克隆(snapshot.快照)
  expect(clonedSnapshot.伤害表).toHaveLength(task.搜索参数.伤害表.length)
  const inbound: Worker入站消息 = {
    类型: '开始',
    任务ID: 'full-pipeline-benchmark-600s',
    参数: {
      搜索参数: { ...task.搜索参数, 伤害表: clonedSnapshot.伤害表 },
      每块扩展数: task.每块扩展数,
      紧急上限毫秒: task.紧急上限毫秒,
    },
  }
  const clonedInbound = await 结构化克隆(inbound)
  if (clonedInbound.类型 !== '开始') throw new Error('Worker DTO 类型错误')
  expect(clonedInbound.参数.搜索参数.伤害表).toEqual(clonedSnapshot.伤害表)
  const baseline = 评估问水动作序列(
    clonedInbound.参数.搜索参数,
    clonedInbound.参数.搜索参数.基线动作序列 || [],
  )
  expect(baseline.成功).toBe(true)
  if (!baseline.成功) throw new Error(baseline.失败原因)
  return { context, task, resolver, clonedInbound, baseline: baseline.候选 }
}

const 执行Runner = async (
  inbound: Extract<Worker入站消息, { 类型: '开始' }>,
  记录内存: () => void,
) => {
  const startedAt = Date.now()
  const result = await 运行问水分块搜索({
    ...inbound.参数,
    让出事件循环: async () => undefined,
    报告进度: 记录内存,
  })
  expect(result.成功).toBe(true)
  if (!result.成功) throw new Error(result.失败原因)
  return { result, runnerElapsedMs: Date.now() - startedAt }
}

const 执行精确复算 = (
  best: 问水搜索候选,
  baseline: 问水搜索候选,
  resolver: ReturnType<typeof 创建问水增益签名解析器>,
  context: 问水伤害计算上下文,
) => {
  const aggregated = 聚合问水策略({ 分支: best.分支 })
  expect(aggregated.成功).toBe(true)
  if (!aggregated.成功) throw new Error(aggregated.失败原因)
  expect(aggregated.总概率).toBeCloseTo(1)
  const candidates = [
    创建待复算候选('搜索最优', best, resolver),
    创建待复算候选('合法基线', baseline, resolver),
  ]
  const startedAt = Date.now()
  const reranked = 精确重排问水候选({ 候选: candidates, 计算上下文: context, 最大复算数 })
  expect(reranked.成功).toBe(true)
  if (!reranked.成功) throw new Error(reranked.失败原因)
  expect(reranked.候选).toHaveLength(最大复算数)
  expect(reranked.候选.every((item) => Number.isFinite(item.精确DPS))).toBe(true)
  return { reranked: reranked.候选, rerankElapsedMs: Date.now() - startedAt }
}

const 验证完成消息 = async (taskId: string, result: 问水Runner结果) => {
  const completed: Worker出站消息 = { 类型: '完成', 任务ID: taskId, 结果: result }
  expect(await 结构化克隆(completed)).toEqual(completed)
  expect(() => JSON.parse(JSON.stringify(completed))).not.toThrow()
}

const 输出指标 = (metrics: Record<string, number | string>) => {
  console.info(`[wenshui-full-pipeline-benchmark] ${JSON.stringify(metrics)}`)
}

describe('问水诀 Worker 完整管线 600 秒性能基准', () => {
  运行基准(
    '在 60 秒内完成真实任务、搜索、聚合、精确复算和协议序列化',
    async () => {
      const totalStartedAt = Date.now()
      const prepared = await 准备基准上下文()
      const setupElapsedMs = Date.now() - totalStartedAt
      const initialHeap = process.memoryUsage().heapUsed
      let peakHeap = initialHeap
      const runner = await 执行Runner(prepared.clonedInbound, () => {
        peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed)
      })
      const { result } = runner
      peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed)
      const exact = 执行精确复算(
        result.最佳候选,
        prepared.baseline,
        prepared.resolver,
        prepared.context,
      )
      await 验证完成消息(prepared.clonedInbound.任务ID, result)
      const totalElapsedMs = Date.now() - totalStartedAt
      const exactBaseline = exact.reranked.find((item) => item.id === '合法基线')
      if (!exactBaseline) throw new Error('精确复算缺少合法基线')
      const improvement = (exact.reranked[0].精确DPS / exactBaseline.精确DPS - 1) * 100
      peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed)
      输出指标({
        totalElapsedMs,
        setupElapsedMs,
        runnerElapsedMs: runner.runnerElapsedMs,
        workerElapsedMs: result.workerElapsedMs,
        expandedNodes: result.扩展节点数,
        expandedBudget: prepared.task.搜索参数.扩展预算,
        beamWidth: prepared.task.搜索参数.Beam宽度,
        endingReason: result.结束原因,
        earlyEnded: String(result.是否提前结束),
        peakHeapMiB: 转换MiB(peakHeap),
        heapGrowthMiB: 转换MiB(peakHeap - initialHeap),
        exactRerankElapsedMs: exact.rerankElapsedMs,
        baselineDps: Number(exactBaseline.精确DPS.toFixed(2)),
        bestDps: Number(exact.reranked[0].精确DPS.toFixed(2)),
        improvementPercent: Number(improvement.toFixed(4)),
      })

      expect(result.最佳候选.期望总伤).toBeGreaterThanOrEqual(prepared.baseline.期望总伤)
      expect(totalElapsedMs).toBeLessThan(最长耗时毫秒)
      expect(result.workerElapsedMs).toBeLessThan(最长耗时毫秒)
      expect(result.扩展节点数).toBe(prepared.task.搜索参数.扩展预算)
      expect(result.结束原因).toBe('确定性预算')
      expect(result.是否提前结束).toBe(false)
      expect(improvement).toBeGreaterThanOrEqual(0)
    },
    测试超时毫秒,
  )
})
