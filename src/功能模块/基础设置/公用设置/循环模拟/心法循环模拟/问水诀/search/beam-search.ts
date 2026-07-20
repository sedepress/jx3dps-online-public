import {
  创建问水搜索起点,
  扩展问水搜索候选,
  比较问水搜索候选,
  获取问水策略状态键,
  评估问水动作序列,
  问水搜索候选,
  问水搜索配置,
} from './exhaustive-oracle'

export interface 搜索问水Beam策略参数 extends 问水搜索配置 {
  Beam宽度: number
  扩展预算: number
  基线动作序列?: string[]
}

export type 问水Beam搜索结果 =
  | {
      成功: true
      最佳候选: 问水搜索候选
      候选列表: 问水搜索候选[]
      扩展节点数: number
      结束原因: '空间收敛' | '扩展预算'
      基线失败原因?: string
    }
  | { 成功: false; 失败原因: string }

interface Beam运行状态 {
  frontier: 问水搜索候选[]
  frontierIndex: number
  actionIndex: number
  next: 问水搜索候选[]
  best: 问水搜索候选
  terminals: 问水搜索候选[]
  expanded: number
  stableOrder: number
  bestByState: Map<string, 问水搜索候选>
  failureReason?: string
}

const 最多候选数 = 16

const 获取候选序列键 = (candidate: 问水搜索候选) =>
  JSON.stringify({ 主序列: candidate.主序列, 条件规则: candidate.条件规则 })

const 记录终点候选 = (terminals: 问水搜索候选[], candidates: 问水搜索候选[]) => {
  const merged = new Map(terminals.map((item) => [获取候选序列键(item), item]))
  candidates.forEach((item) => {
    const key = 获取候选序列键(item)
    const previous = merged.get(key)
    if (!previous || 比较问水搜索候选(item, previous) < 0) merged.set(key, item)
  })
  return Array.from(merged.values()).sort(比较问水搜索候选).slice(0, 最多候选数)
}

export interface 问水Beam会话 {
  config: 问水搜索配置
  Beam宽度: number
  扩展预算: number
  runtime: Beam运行状态
  基线失败原因?: string
}

const 获取分支分组键 = (candidate: 问水搜索候选) =>
  candidate.分支
    .map(({ 状态 }) =>
      JSON.stringify({
        姿态: 状态.姿态,
        剑气区间: Math.floor(状态.剑气 / 25),
        断潮可用: 状态.断潮可用,
        自身Buff: Object.entries(状态.自身Buff)
          .map(([name, buff]) => `${name}:${buff.层数}`)
          .sort(),
        目标Buff: Object.keys(状态.目标Buff).sort(),
      }),
    )
    .sort()
    .join('|')

const 按状态去重 = (candidates: 问水搜索候选[]) => {
  const unique = new Map<string, 问水搜索候选>()
  candidates.forEach((candidate) => {
    const key = 获取问水策略状态键(candidate.分支)
    const current = unique.get(key)
    if (!current || 比较问水搜索候选(candidate, current) < 0) unique.set(key, candidate)
  })
  return Array.from(unique.values())
}

const 选择分组Beam = (candidates: 问水搜索候选[], width: number) => {
  const groups = new Map<string, 问水搜索候选[]>()
  candidates.forEach((candidate) => {
    const key = 获取分支分组键(candidate)
    groups.set(key, (groups.get(key) || []).concat(candidate))
  })
  const sortedGroups = Array.from(groups.entries())
    .map(([key, items]) => ({ key, items: items.sort(比较问水搜索候选) }))
    .sort(
      (left, right) =>
        比较问水搜索候选(left.items[0], right.items[0]) || left.key.localeCompare(right.key),
    )
  const selected = sortedGroups.slice(0, width).map((group) => group.items[0])
  const remaining = sortedGroups.flatMap((group, index) => group.items.slice(index < width ? 1 : 0))
  return selected.concat(remaining.sort(比较问水搜索候选)).slice(0, width)
}

const 获取初始最佳 = (config: 搜索问水Beam策略参数, initial: 问水搜索候选) => {
  if (!config.基线动作序列?.length) return { 候选: initial }
  const baseline = 评估问水动作序列(config, config.基线动作序列)
  if (!baseline.成功) return { 候选: initial, 失败原因: baseline.失败原因 }
  return {
    候选: 比较问水搜索候选(baseline.候选, initial) < 0 ? baseline.候选 : initial,
  }
}

const 校验Beam参数 = (width: number, budget: number) => {
  if (!Number.isInteger(width) || width < 1) return 'Beam宽度必须为正整数'
  if (!Number.isInteger(budget) || budget < 1) return '扩展预算必须为正整数'
  return undefined
}

const 接收Beam子节点 = (runtime: Beam运行状态, children: 问水搜索候选[]) => {
  let { best } = runtime
  const next = runtime.next.slice()
  const bestByState = new Map(runtime.bestByState)
  for (const child of children) {
    if (比较问水搜索候选(child, best) < 0) best = child
    const key = 获取问水策略状态键(child.分支)
    const previous = bestByState.get(key)
    if (previous && 比较问水搜索候选(child, previous) >= 0) continue
    bestByState.set(key, child)
    if (child.乐观上界 >= best.期望总伤) next.push(child)
  }
  return { best, next, bestByState }
}

const 完成Beam层 = (runtime: Beam运行状态, width: number): Beam运行状态 => ({
  ...runtime,
  frontier: 选择分组Beam(按状态去重(runtime.next), width),
  frontierIndex: 0,
  actionIndex: 0,
  next: [],
})

const 推进Beam到预算 = (session: 问水Beam会话, targetBudget: number): 问水Beam会话 => {
  let runtime = session.runtime
  while (runtime.frontier.length && runtime.expanded < targetBudget) {
    const candidate = runtime.frontier[runtime.frontierIndex]
    const expanded = 扩展问水搜索候选(candidate, session.config, {
      稳定序号: runtime.stableOrder,
      最多尝试: targetBudget - runtime.expanded,
      起始动作索引: runtime.actionIndex,
    })
    if (!expanded.成功)
      return { ...session, runtime: { ...runtime, failureReason: expanded.失败原因 } }
    const accepted = 接收Beam子节点(runtime, expanded.候选)
    runtime = {
      ...runtime,
      ...accepted,
      expanded: runtime.expanded + expanded.消耗扩展数,
      stableOrder: expanded.下一稳定序号,
      actionIndex: expanded.下一动作索引,
    }
    if (expanded.是否完成) {
      runtime = { ...runtime, frontierIndex: runtime.frontierIndex + 1, actionIndex: 0 }
      if (!expanded.候选.length) {
        runtime = { ...runtime, terminals: 记录终点候选(runtime.terminals, [candidate]) }
      }
    }
    if (runtime.frontierIndex >= runtime.frontier.length)
      runtime = 完成Beam层(runtime, session.Beam宽度)
  }
  return { ...session, runtime }
}

export const 创建问水Beam会话 = ({
  Beam宽度,
  扩展预算,
  ...config
}: 搜索问水Beam策略参数):
  | { 成功: true; 会话: 问水Beam会话 }
  | { 成功: false; 失败原因: string } => {
  const validationError = 校验Beam参数(Beam宽度, 扩展预算)
  if (validationError) return { 成功: false, 失败原因: validationError }
  const initial = 创建问水搜索起点(config)
  if (!initial.成功) return initial
  const seeded = 获取初始最佳({ ...config, Beam宽度, 扩展预算 }, initial.候选)
  return {
    成功: true,
    会话: {
      config,
      Beam宽度,
      扩展预算,
      runtime: {
        frontier: [initial.候选],
        frontierIndex: 0,
        actionIndex: 0,
        next: [],
        best: seeded.候选,
        terminals: [],
        expanded: 0,
        stableOrder: 1,
        bestByState: new Map([[获取问水策略状态键(initial.候选.分支), initial.候选]]),
      },
      ...(seeded.失败原因 ? { 基线失败原因: seeded.失败原因 } : {}),
    },
  }
}

export const 推进问水Beam会话 = (session: 问水Beam会话, chunkBudget: number) => {
  if (!Number.isInteger(chunkBudget) || chunkBudget < 1) {
    return { 成功: false as const, 失败原因: 'chunk扩展数必须为正整数' }
  }
  const target = Math.min(session.扩展预算, session.runtime.expanded + chunkBudget)
  const next = 推进Beam到预算(session, target)
  if (next.runtime.failureReason)
    return { 成功: false as const, 失败原因: next.runtime.failureReason }
  return { 成功: true as const, 会话: next }
}

export const 获取问水Beam会话结果 = (session: 问水Beam会话) => {
  const 候选列表 = 记录终点候选(session.runtime.terminals, [session.runtime.best])
  return {
    最佳候选: 候选列表[0],
    候选列表,
    扩展节点数: session.runtime.expanded,
    结束原因: session.runtime.frontier.length
      ? session.runtime.expanded >= session.扩展预算
        ? ('扩展预算' as const)
        : ('进行中' as const)
      : ('空间收敛' as const),
    ...(session.基线失败原因 ? { 基线失败原因: session.基线失败原因 } : {}),
  }
}

export const 搜索问水Beam策略 = (params: 搜索问水Beam策略参数): 问水Beam搜索结果 => {
  const created = 创建问水Beam会话(params)
  if (!created.成功) return created
  const advanced = 推进问水Beam会话(created.会话, params.扩展预算)
  if (!advanced.成功) return advanced
  const result = 获取问水Beam会话结果(advanced.会话)
  return {
    成功: true,
    ...result,
    结束原因: result.结束原因 === '进行中' ? '扩展预算' : result.结束原因,
  }
}
