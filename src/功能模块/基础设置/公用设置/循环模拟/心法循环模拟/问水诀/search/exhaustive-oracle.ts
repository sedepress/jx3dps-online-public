import { 聚合问水策略 } from '../damage/aggregate-policy'
import { 计算问水聚合期望伤害, 问水伤害表项 } from '../damage/build-damage-table'
import { 动作当前可执行, 执行动作 } from '../simulator/engine'
import {
  压缩已结算伤害,
  合并可观察分支,
  处理断潮触发,
  选择断潮条件动作,
  问水概率分支,
  执行断潮条件规则,
} from '../simulator/stochastic'
import { 问水动作上下文, 问水模拟状态 } from '../types'
import { 推进到帧 } from '../simulator/time'
import { 获取问水状态键 } from './state-key'
import { 计算问水乐观上界 } from './upper-bound'

export interface 问水搜索条件规则 {
  技能名称: string
  回退动作?: string
}

export interface 问水搜索配置 {
  初始状态: 问水模拟状态
  主技能: string[]
  条件动作?: 问水搜索条件规则[]
  动作上下文?: 问水动作上下文
  触发断潮技能?: string[]
  自动施放断潮?: boolean
  断潮固定触发率?: number
  会心率?: number
  会心率映射?: Record<string, number>
  伤害表: 问水伤害表项[]
  最大理论每帧伤害: number
}

export interface 问水搜索候选 {
  主序列: string[]
  条件规则: 问水搜索条件规则[]
  分支: 问水概率分支[]
  期望总伤: number
  乐观上界: number
  稳定序号: number
}

interface 穷举问水最优策略参数 extends 问水搜索配置 {
  最大扩展数: number
}

export type 问水候选结果 = { 成功: true; 候选: 问水搜索候选 } | { 成功: false; 失败原因: string }
type 问水搜索结果 =
  | { 成功: true; 最佳候选: 问水搜索候选; 扩展节点数: number; 是否达到预算: boolean }
  | { 成功: false; 失败原因: string }

export type 问水策略动作 =
  | { 类型: '主技能'; 技能名称: string }
  | { 类型: '条件规则'; 规则: 问水搜索条件规则 }
  | { 类型: '等待' }

interface 执行策略动作参数 {
  config: 问水搜索配置
  稳定序号: number
}

interface 扩展问水搜索候选参数 {
  稳定序号: number
  最多尝试: number
  起始动作索引?: number
}

type 问水候选扩展结果 =
  | {
      成功: true
      候选: 问水搜索候选[]
      下一稳定序号: number
      消耗扩展数: number
      下一动作索引: number
      是否完成: boolean
    }
  | { 成功: false; 失败原因: string }

const 创建初始分支 = (state: 问水模拟状态): 问水概率分支 => ({
  状态: state,
  概率: 1,
  期望伤害: 0,
  压缩伤害: {},
})

const 计算策略伤害 = (branches: 问水概率分支[], table: 问水伤害表项[]) => {
  const aggregated = 聚合问水策略({ 分支: branches })
  if (!aggregated.成功) return aggregated
  return 计算问水聚合期望伤害({ 项目: aggregated.项目, 伤害表: table })
}

const 计算策略上界 = (candidateDamage: number, branches: 问水概率分支[], maxDamage: number) =>
  candidateDamage +
  branches.reduce(
    (sum, branch) =>
      sum +
      branch.概率 *
        计算问水乐观上界({ 状态: branch.状态, 已累积伤害: 0, 最大理论每帧伤害: maxDamage }),
    0,
  )

const 创建候选 = (
  branches: 问水概率分支[],
  data: { 主序列: string[]; 条件规则: 问水搜索条件规则[]; 稳定序号: number },
  config: 问水搜索配置,
): 问水候选结果 => {
  const damage = 计算策略伤害(branches, config.伤害表)
  if (!damage.成功) return damage
  return {
    成功: true,
    候选: {
      ...data,
      分支: branches,
      期望总伤: damage.期望总伤,
      乐观上界: 计算策略上界(damage.期望总伤, branches, config.最大理论每帧伤害),
    },
  }
}

const 获取断潮触发率 = (config: 问水搜索配置, skill: string, state: 问水模拟状态) => {
  const 会心率 = config.会心率映射?.[skill] ?? config.会心率 ?? 0
  const 叠锋意层数 = state.自身Buff.叠锋意?.层数 || 0
  return Math.min(1, Math.max(0, 会心率 + (config.断潮固定触发率 || 0) + 叠锋意层数 * 0.1))
}

const 应用自动断潮 = (branches: 问水概率分支[], config: 问水搜索配置, 触发技能: string) => {
  if (!config.自动施放断潮) return branches
  return branches.map((branch) => {
    const 施放权重 = 获取断潮触发率(config, 触发技能, branch.状态)
    const result = 执行断潮条件规则(
      { ...branch.状态, 断潮可用: true },
      { 技能名称: '断潮' },
      config.动作上下文,
      施放权重,
    )
    return result.成功 ? { ...branch, 状态: result.状态 } : branch
  })
}

const 执行主技能 = (branch: 问水概率分支, skill: string, config: 问水搜索配置) => {
  const result = 执行动作(branch.状态, skill, config.动作上下文)
  if (!result.成功) return undefined
  const next = 压缩已结算伤害({ ...branch, 状态: result.状态 })
  if (!config.触发断潮技能?.includes(skill)) return [next]
  if (config.自动施放断潮) return 应用自动断潮([next], config, skill)
  return 处理断潮触发(next, 获取断潮触发率(config, skill, branch.状态))
}

const 执行条件动作 = (branch: 问水概率分支, rule: 问水搜索条件规则, config: 问水搜索配置) => {
  const action = 选择断潮条件动作(branch.状态, rule)
  const result = 执行断潮条件规则(branch.状态, rule, config.动作上下文)
  if (!result.成功) return undefined
  const next = 压缩已结算伤害({ ...branch, 状态: result.状态 })
  if (!action || !config.触发断潮技能?.includes(action)) return [next]
  if (config.自动施放断潮) return 应用自动断潮([next], config, action)
  return 处理断潮触发(next, 获取断潮触发率(config, action, branch.状态))
}

const 获取下一等待帧 = (state: 问水模拟状态) => {
  const buffFrames = Object.values(state.自身Buff)
    .concat(Object.values(state.目标Buff), Object.values(state.团队增益))
    .map((buff) => buff.结束帧)
  const frames = [
    state.GCD.公共,
    ...Object.values(state.技能CD),
    ...Object.values(state.技能充能).flatMap((item) => item.充能结束帧),
    ...state.待生效事件.map((event) => event.生效帧),
    ...buffFrames,
  ]
  return frames
    .filter((frame) => frame > state.当前帧 && frame <= state.结束帧)
    .sort((a, b) => a - b)[0]
}

const 执行等待 = (branch: 问水概率分支) => {
  const 目标帧 = 获取下一等待帧(branch.状态)
  if (目标帧 === undefined) return undefined
  return [压缩已结算伤害({ ...branch, 状态: 推进到帧(branch.状态, 目标帧) })]
}

const 执行策略动作 = (
  candidate: 问水搜索候选,
  action: 问水策略动作,
  参数: 执行策略动作参数,
): 问水候选结果 | undefined => {
  const { config, 稳定序号 } = 参数
  const branches: 问水概率分支[] = []
  for (const branch of candidate.分支) {
    const next =
      action.类型 === '主技能'
        ? 执行主技能(branch, action.技能名称, config)
        : action.类型 === '条件规则'
          ? 执行条件动作(branch, action.规则, config)
          : 执行等待(branch)
    if (!next) return undefined
    branches.push(...next)
  }
  const merged = 合并可观察分支(branches, 获取问水状态键)
  if (获取问水策略状态键(merged) === 获取问水策略状态键(candidate.分支)) return undefined
  return 创建候选(
    merged,
    {
      主序列:
        action.类型 === '主技能' ? candidate.主序列.concat(action.技能名称) : candidate.主序列,
      条件规则:
        action.类型 === '条件规则' ? candidate.条件规则.concat(action.规则) : candidate.条件规则,
      稳定序号,
    },
    config,
  )
}

const 获取策略动作 = (config: 问水搜索配置, candidate: 问水搜索候选): 问水策略动作[] =>
  config.主技能
    .filter((技能名称) =>
      candidate.分支.every((branch) => 动作当前可执行(branch.状态, 技能名称, config.动作上下文)),
    )
    .map((技能名称): 问水策略动作 => ({ 类型: '主技能', 技能名称 }))
    .concat((config.条件动作 || []).map((规则) => ({ 类型: '条件规则' as const, 规则 })))
    .concat({ 类型: '等待' })

export const 比较问水搜索候选 = (left: 问水搜索候选, right: 问水搜索候选) =>
  right.期望总伤 - left.期望总伤 ||
  left.主序列.length + left.条件规则.length - right.主序列.length - right.条件规则.length ||
  JSON.stringify(left.主序列).localeCompare(JSON.stringify(right.主序列)) ||
  JSON.stringify(left.条件规则).localeCompare(JSON.stringify(right.条件规则)) ||
  left.稳定序号 - right.稳定序号

export const 获取问水策略状态键 = (branches: 问水概率分支[]) =>
  JSON.stringify(
    branches
      .map((branch) => ({ key: 获取问水状态键(branch.状态), probability: branch.概率 }))
      .sort(
        (left, right) => left.key.localeCompare(right.key) || left.probability - right.probability,
      ),
  )

export const 创建问水搜索起点 = (config: 问水搜索配置): 问水候选结果 =>
  创建候选([创建初始分支(config.初始状态)], { 主序列: [], 条件规则: [], 稳定序号: 0 }, config)

export const 扩展问水搜索候选 = (
  candidate: 问水搜索候选,
  config: 问水搜索配置,
  参数: 扩展问水搜索候选参数,
): 问水候选扩展结果 => {
  let order = 参数.稳定序号
  let attempts = 0
  const candidates: 问水搜索候选[] = []
  const actions = 获取策略动作(config, candidate)
  let index = 参数.起始动作索引 || 0
  for (; index < actions.length; index += 1) {
    if (attempts >= 参数.最多尝试) break
    const action = actions[index]
    const result = 执行策略动作(candidate, action, { config, 稳定序号: order })
    order += 1
    attempts += 1
    if (!result) continue
    if (!result.成功) return result
    candidates.push(result.候选)
  }
  return {
    成功: true,
    候选: candidates,
    下一稳定序号: order,
    消耗扩展数: attempts,
    下一动作索引: index,
    是否完成: index >= actions.length,
  }
}

export const 评估问水策略步骤 = (config: 问水搜索配置, steps: 问水策略动作[]): 问水候选结果 => {
  const initial = 创建问水搜索起点(config)
  if (!initial.成功) return initial
  let candidate = initial.候选
  for (let index = 0; index < steps.length; index += 1) {
    const result = 执行策略动作(candidate, steps[index], {
      config,
      稳定序号: index + 1,
    })
    if (!result) return { 成功: false, 失败原因: `第 ${index + 1} 个策略动作不可执行` }
    if (!result.成功) return result
    candidate = result.候选
  }
  return { 成功: true, 候选: candidate }
}

export const 评估问水动作序列 = (config: 问水搜索配置, sequence: string[]): 问水候选结果 =>
  评估问水策略步骤(
    config,
    sequence.map((技能名称) => ({ 类型: '主技能', 技能名称 })),
  )

export const 穷举问水最优策略 = ({ 最大扩展数, ...config }: 穷举问水最优策略参数): 问水搜索结果 => {
  if (!Number.isInteger(最大扩展数) || 最大扩展数 < 1) {
    return { 成功: false, 失败原因: '最大扩展数必须为正整数' }
  }
  const initial = 创建问水搜索起点(config)
  if (!initial.成功) return initial
  let best = initial.候选
  let expanded = 0
  let stableOrder = 1
  let failureReason: string | undefined
  const visit = (candidate: 问水搜索候选, path: Set<string>) => {
    if (expanded >= 最大扩展数 || failureReason) return
    const children = 扩展问水搜索候选(candidate, config, {
      稳定序号: stableOrder,
      最多尝试: 最大扩展数 - expanded,
    })
    if (!children.成功) {
      failureReason = children.失败原因
      return
    }
    stableOrder = children.下一稳定序号
    expanded += children.消耗扩展数
    for (const child of children.候选) {
      if (比较问水搜索候选(child, best) < 0) best = child
      const key = 获取问水策略状态键(child.分支)
      if (path.has(key)) continue
      visit(child, new Set(path).add(key))
    }
  }
  visit(initial.候选, new Set([获取问水策略状态键(initial.候选.分支)]))
  if (failureReason) return { 成功: false, 失败原因: failureReason }
  return { 成功: true, 最佳候选: best, 扩展节点数: expanded, 是否达到预算: expanded >= 最大扩展数 }
}
