import {
  创建问水搜索起点,
  扩展问水搜索候选,
  比较问水搜索候选,
  获取问水策略状态键,
  评估问水动作序列,
  问水搜索候选,
  问水搜索配置,
} from './exhaustive-oracle'

interface 搜索问水Beam策略参数 extends 问水搜索配置 {
  Beam宽度: number
  扩展预算: number
  基线动作序列?: string[]
}

type 问水Beam搜索结果 =
  | {
      成功: true
      最佳候选: 问水搜索候选
      扩展节点数: number
      结束原因: '空间收敛' | '扩展预算'
      基线失败原因?: string
    }
  | { 成功: false; 失败原因: string }

interface Beam运行状态 {
  frontier: 问水搜索候选[]
  best: 问水搜索候选
  expanded: number
  stableOrder: number
  bestByState: Map<string, 问水搜索候选>
  failureReason?: string
}

interface Beam控制参数 {
  width: number
  budget: number
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

const 执行Beam轮次 = (
  runtime: Beam运行状态,
  config: 问水搜索配置,
  control: Beam控制参数,
): Beam运行状态 => {
  const next: 问水搜索候选[] = []
  let { best, expanded, stableOrder } = runtime
  const bestByState = new Map(runtime.bestByState)
  outer: for (const candidate of runtime.frontier) {
    const children = 扩展问水搜索候选(candidate, config, {
      稳定序号: stableOrder,
      最多尝试: control.budget - expanded,
    })
    if (!children.成功) return { ...runtime, failureReason: children.失败原因 }
    stableOrder = children.下一稳定序号
    expanded += children.消耗扩展数
    for (const child of children.候选) {
      if (比较问水搜索候选(child, best) < 0) best = child
      const key = 获取问水策略状态键(child.分支)
      const previous = bestByState.get(key)
      if (previous && 比较问水搜索候选(child, previous) >= 0) continue
      bestByState.set(key, child)
      if (child.乐观上界 >= best.期望总伤) next.push(child)
    }
    if (expanded >= control.budget) break outer
  }
  return {
    frontier: 选择分组Beam(按状态去重(next), control.width),
    best,
    expanded,
    stableOrder,
    bestByState,
  }
}

export const 搜索问水Beam策略 = ({
  Beam宽度,
  扩展预算,
  ...config
}: 搜索问水Beam策略参数): 问水Beam搜索结果 => {
  const validationError = 校验Beam参数(Beam宽度, 扩展预算)
  if (validationError) return { 成功: false, 失败原因: validationError }
  const initial = 创建问水搜索起点(config)
  if (!initial.成功) return initial
  const seeded = 获取初始最佳({ ...config, Beam宽度, 扩展预算 }, initial.候选)
  let runtime: Beam运行状态 = {
    frontier: [initial.候选],
    best: seeded.候选,
    expanded: 0,
    stableOrder: 1,
    bestByState: new Map([[获取问水策略状态键(initial.候选.分支), initial.候选]]),
  }
  while (runtime.frontier.length && runtime.expanded < 扩展预算) {
    runtime = 执行Beam轮次(runtime, config, { width: Beam宽度, budget: 扩展预算 })
    if (runtime.failureReason) return { 成功: false, 失败原因: runtime.failureReason }
  }
  return {
    成功: true,
    最佳候选: runtime.best,
    扩展节点数: runtime.expanded,
    结束原因: runtime.frontier.length ? '扩展预算' : '空间收敛',
    ...(seeded.失败原因 ? { 基线失败原因: seeded.失败原因 } : {}),
  }
}
