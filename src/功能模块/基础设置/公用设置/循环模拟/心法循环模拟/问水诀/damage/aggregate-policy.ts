import { 循环技能详情 } from '@/@types/循环'
import { 压缩已结算伤害, 合并可观察分支, 问水分支历史, 问水概率分支 } from '../simulator/stochastic'
import { 推进到帧 } from '../simulator/time'
import {
  从问水伤害事件创建聚合项,
  标准化问水签名,
  获取问水伤害键,
  获取问水聚合项键,
  type 问水聚合项,
} from './damage-key'

export { 获取问水伤害键, 获取问水聚合项键 } from './damage-key'
export type { 问水聚合项 } from './damage-key'

const 概率容差 = 1e-9

interface 聚合问水策略参数 {
  分支: 问水概率分支[]
  允许未终止概率?: boolean
}

interface 聚合成功结果 {
  成功: true
  总概率: number
  项目: 问水聚合项[]
}

interface 聚合失败结果 {
  成功: false
  失败原因: string
}

export type 问水策略聚合结果 = 聚合成功结果 | 聚合失败结果

interface 转换问水聚合项参数 {
  项目: 问水聚合项[]
  解析增益签名?: (item: 问水聚合项) => string[] | undefined
}

type 问水循环转换结果 = { 成功: true; 技能详情: 循环技能详情[] } | { 成功: false; 失败原因: string }

type 问水增益解析结果 = { 成功: true; 增益: string[] } | { 成功: false; 失败原因: string }

const 物化终止分支 = (branches: 问水概率分支[]) => {
  const flushed = branches.map((branch) => ({
    ...branch,
    状态: 推进到帧(branch.状态, Math.max(branch.状态.当前帧, branch.状态.结束帧)),
  }))
  return 合并可观察分支(flushed.map(压缩已结算伤害))
}

const 聚合历史事件 = (histories: 问水分支历史[]) => {
  const grouped = new Map<string, 问水聚合项>()
  histories.forEach((history) => {
    if (history.概率 <= 0) return
    history.伤害事件.forEach((event) => {
      const key = 获取问水伤害键(event)
      const current = grouped.get(key) || 从问水伤害事件创建聚合项(event)
      grouped.set(key, {
        ...current,
        施放数量: current.施放数量 + history.概率,
        伤害次数: current.伤害次数 + history.概率 * event.伤害次数,
      })
    })
  })
  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, item]) => item)
}

const 合并聚合项 = (items: 问水聚合项[]) => {
  const grouped = new Map<string, 问水聚合项>()
  items.forEach((item) => {
    const key = 获取问水聚合项键(item)
    const current = grouped.get(key)
    grouped.set(
      key,
      current
        ? {
            ...current,
            施放数量: current.施放数量 + item.施放数量,
            伤害次数: current.伤害次数 + item.伤害次数,
          }
        : item,
    )
  })
  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, item]) => item)
}

const 获取终止数据 = (branches: 问水概率分支[]) => {
  const histories = branches.flatMap((branch) => branch.历史分支 || [])
  const compact = branches.flatMap((branch) => Object.values(branch.压缩伤害 || {}))
  const compactProbability = branches
    .filter((branch) => branch.压缩伤害 !== undefined)
    .reduce((sum, branch) => sum + branch.概率, 0)
  return {
    histories,
    compactProbability,
    items: 合并聚合项(聚合历史事件(histories).concat(compact)),
  }
}

const 校验历史概率 = (histories: 问水分支历史[]) => {
  if (histories.some((history) => !Number.isFinite(history.概率) || history.概率 < 0)) {
    return { 成功: false as const, 失败原因: '终止路径概率必须为非负有限数' }
  }
  const 总概率 = histories.reduce((sum, history) => sum + history.概率, 0)
  return { 成功: true as const, 总概率 }
}

export const 聚合问水策略 = ({
  分支,
  允许未终止概率 = false,
}: 聚合问水策略参数): 问水策略聚合结果 => {
  const terminal = 获取终止数据(物化终止分支(分支))
  const validation = 校验历史概率(terminal.histories)
  if (!validation.成功) return validation
  const 总概率 = validation.总概率 + terminal.compactProbability
  if (总概率 > 1 + 概率容差) {
    return { 成功: false, 失败原因: `终止路径总概率不能超过 1，当前为 ${总概率}` }
  }
  if (!允许未终止概率 && Math.abs(总概率 - 1) > 概率容差) {
    return {
      成功: false,
      失败原因: `终止路径总概率必须为 1，当前为 ${总概率}`,
    }
  }
  return { 成功: true, 总概率, 项目: terminal.items }
}

const 创建循环技能 = (item: 问水聚合项, gains: string[]): 循环技能详情 => {
  const 伤害层数 = item.伤害次数 / item.施放数量
  return {
    技能名称: item.技能名称,
    技能数量: item.施放数量,
    ...(item.技能等级 === null ? {} : { 技能等级: item.技能等级 }),
    ...(Math.abs(伤害层数 - 1) <= 概率容差 ? {} : { 伤害层数 }),
    ...(gains.length
      ? { 技能增益列表: [{ 增益名称: gains.join(','), 增益技能数: item.施放数量 }] }
      : {}),
  }
}

const 校验问水聚合项 = (item: 问水聚合项) => {
  if (!Number.isFinite(item.施放数量) || item.施放数量 <= 0) {
    return `${item.技能名称}: 施放数量必须为正有限数`
  }
  if (!Number.isFinite(item.伤害次数) || item.伤害次数 <= 0) {
    return `${item.技能名称}: 伤害次数必须为正有限数`
  }
  return undefined
}

const 解析问水聚合项增益 = (
  item: 问水聚合项,
  resolver?: (item: 问水聚合项) => string[] | undefined,
): 问水增益解析结果 => {
  const hasSignature = item.增益签名.length > 0 || item.快照签名.length > 0
  if (hasSignature && !resolver) {
    return { 成功: false, 失败原因: `${item.技能名称}: 缺少增益签名解析器` }
  }
  const resolved = resolver?.(item)
  if (hasSignature && !resolved) {
    const signatures = 标准化问水签名(item.增益签名.concat(item.快照签名))
    return { 成功: false, 失败原因: `${item.技能名称}: 无法解析增益签名 ${signatures.join(',')}` }
  }
  return { 成功: true, 增益: Array.from(new Set(resolved || [])).sort() }
}

export const 转换问水聚合项为循环 = ({
  项目,
  解析增益签名,
}: 转换问水聚合项参数): 问水循环转换结果 => {
  const 技能详情: 循环技能详情[] = []
  for (const item of 项目) {
    const validationError = 校验问水聚合项(item)
    if (validationError) return { 成功: false, 失败原因: validationError }
    const gains = 解析问水聚合项增益(item, 解析增益签名)
    if (!gains.成功) return gains
    技能详情.push(创建循环技能(item, gains.增益))
  }
  return { 成功: true, 技能详情 }
}
