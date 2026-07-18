import { 选中秘籍信息 } from '@/@types/秘籍'
import { 团队增益轴类型 } from '@/@types/团队增益'
import { 获取问水聚合项键, 问水聚合项 } from '../damage/aggregate-policy'
import { 问水伤害表项 } from '../damage/build-damage-table'
import { 获取Excel基线 } from '../rules/constants'
import { 问水技能定义 } from '../rules/skill-definitions'
import { 构建问水合法基线 } from '../search/baseline'
import { 创建问水起手状态 } from '../simulator/create-state'
import { 添加团队增益轴事件, 构建团队增益轴事件 } from '../simulator/team-buffs'
import type { 问水搜索任务 } from './OptimalSequenceModal'

type 武器类型 = '紫武' | '橙武'

interface 单次伤害结果 {
  伤害: number
  会心率: number
}

interface 创建问水优化搜索任务参数 {
  战斗时间: number
  加速值: number
  网络延迟: number
  奇穴: string[]
  秘籍: 选中秘籍信息
  团队增益轴: 团队增益轴类型
  武器类型: 武器类型
  配置指纹: string
  计算单次伤害: (item: 问水聚合项) => 单次伤害结果
}

const Beam宽度 = 32
const 扩展预算 = 50_000
const 每块扩展数 = 500
const 紧急上限毫秒 = 60_000
const 伤害技能 = [
  '听雷-轻',
  '三柴剑法',
  '黄龙吐翠',
  '平湖断月',
  '九溪弥烟-轻',
  '夕照雷峰',
  '云飞玉皇',
  '云景·云飞玉皇',
  '云飞玉皇·二段',
  '鹤归孤山',
  '鹤归孤山·山倾',
  '风来吴山',
  '玉山揽云',
  '九皋鹤野·落剑',
  '断潮',
  '断潮-轻',
  '四季剑法',
  '新破招(夕)',
  '新破招(云)',
]

const 稳定化数据 = (value: any): any => {
  if (Array.isArray(value)) return value.map(稳定化数据)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value)
    .sort()
    .reduce((result, key) => ({ ...result, [key]: 稳定化数据(value[key]) }), {})
}

export const 创建问水配置指纹 = (value: unknown) => {
  const source = JSON.stringify(稳定化数据(value))
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `wenshui-${(hash >>> 0).toString(16)}`
}

const 获取团队签名组合 = (axis: 团队增益轴类型, endFrame: number) => {
  const windows = 构建团队增益轴事件(axis, endFrame)
    .filter((event) => event.事件数据?.操作 === '开始' && event.技能名称)
    .map((event) => ({
      签名: event.技能名称 as string,
      开始帧: event.生效帧,
      结束帧: Number(event.事件数据?.结束帧 || event.生效帧),
    }))
  const points = Array.from(new Set([0, ...windows.flatMap((item) => [item.开始帧, item.结束帧])]))
  const combinations = points.map((frame) =>
    windows
      .filter((item) => item.开始帧 <= frame && item.结束帧 > frame)
      .map((item) => item.签名)
      .sort(),
  )
  return Array.from(new Map(combinations.map((item) => [item.join(','), item])).values())
}

const 追加可选签名 = (combinations: string[][], signature: string) =>
  combinations.concat(combinations.map((item) => item.concat(signature)))

const 获取职业签名组合 = (skill: string, talents: string[]) => {
  let combinations: string[][] = [[]]
  if (talents.includes('雾锁')) combinations = 追加可选签名(combinations, '雾锁')
  if (talents.includes('叠锋意')) {
    combinations = combinations.flatMap((item) => [
      item,
      item.concat('叠锋意·1'),
      item.concat('叠锋意·2'),
      item.concat('叠锋意·3'),
    ])
  }
  const isHeavy = ![
    '听雷-轻',
    '三柴剑法',
    '黄龙吐翠',
    '平湖断月',
    '九溪弥烟-轻',
    '断潮-轻',
  ].includes(skill)
  if (!isHeavy) return combinations
  if (talents.includes('怜光')) combinations = combinations.map((item) => item.concat('怜光'))
  if (talents.includes('碧归')) combinations = 追加可选签名(combinations, '碧归')
  if (talents.includes('造化')) {
    combinations = combinations.flatMap((item) => [
      item,
      item.concat('造化1'),
      item.concat('造化2'),
    ])
  }
  if (skill === '风来吴山' && talents.includes('层云')) {
    combinations = combinations.flatMap((item) => [
      item,
      ...[1, 2, 3, 4, 5].map((n) => item.concat(`层云${n}`)),
    ])
  }
  return combinations
}

const 获取全部聚合项 = (params: 创建问水优化搜索任务参数, endFrame: number) => {
  const team = 获取团队签名组合(params.团队增益轴, endFrame)
  const items = 伤害技能.flatMap((skill) =>
    获取职业签名组合(skill, params.奇穴).flatMap((career) =>
      team.map(
        (signatures): 问水聚合项 => ({
          技能名称: skill,
          技能等级: null,
          增益签名: Array.from(new Set(career.concat(signatures))).sort(),
          快照签名: [],
          施放数量: 1,
          伤害次数: 1,
        }),
      ),
    ),
  )
  return Array.from(new Map(items.map((item) => [获取问水聚合项键(item), item])).values())
}

const 构建伤害表 = (params: 创建问水优化搜索任务参数, endFrame: number) => {
  let 会心率: number | undefined
  const 会心率映射: Record<string, number> = {}
  const table: 问水伤害表项[] = 获取全部聚合项(params, endFrame).map((item) => {
    const result = params.计算单次伤害(item)
    if (!Number.isFinite(result.伤害) || result.伤害 < 0) {
      throw new Error(`${item.技能名称}: 单次伤害必须为非负有限数`)
    }
    const rate = Math.min(1, Math.max(0, result.会心率 || 0))
    if (会心率 === undefined) 会心率 = rate
    if (会心率映射[item.技能名称] === undefined) 会心率映射[item.技能名称] = rate
    return { ...item, key: 获取问水聚合项键(item), 单次施放伤害: result.伤害 }
  })
  return { table, 会心率: 会心率 || 0, 会心率映射 }
}

const 获取基线序列 = (params: 创建问水优化搜索任务参数, initialState) => {
  const talent = params.奇穴.includes('碧归') ? '碧归' : '斩岳'
  const baseline = 构建问水合法基线({
    初始状态: initialState,
    Excel基线: 获取Excel基线(params.武器类型, talent),
    贪心动作顺序: Object.keys(问水技能定义),
    动作上下文: { 奇穴: params.奇穴, 秘籍: params.秘籍 },
  })
  return baseline.成功 && baseline.来源 === 'Excel' ? baseline.动作序列 : undefined
}

export const 创建问水优化搜索任务 = (params: 创建问水优化搜索任务参数): 问水搜索任务 => {
  const emptyState = 创建问水起手状态({
    战斗秒数: params.战斗时间,
    加速值: params.加速值,
    网络延迟: params.网络延迟,
  })
  // Excel 问水循环以重剑满剑气作为战斗轴起点；从轻剑 0 剑气会退化成听雷填充循环。
  const initialState = 添加团队增益轴事件(
    { ...emptyState, 姿态: '重剑', 剑气: 100 },
    params.团队增益轴,
  )
  const { table, 会心率, 会心率映射 } = 构建伤害表(params, initialState.结束帧)
  const mainSkills = Object.values(问水技能定义).map((skill) => skill.名称)
  return {
    战斗时间: params.战斗时间,
    配置指纹: params.配置指纹,
    每块扩展数,
    紧急上限毫秒,
    搜索参数: {
      初始状态: initialState,
      主技能: mainSkills,
      条件动作: [],
      动作上下文: { 奇穴: params.奇穴, 秘籍: params.秘籍 },
      触发断潮技能: mainSkills.filter((name) => 问水技能定义[name]?.造成伤害),
      自动施放断潮: true,
      断潮固定触发率: 0.3,
      会心率,
      会心率映射,
      伤害表: table,
      最大理论每帧伤害: table.reduce((sum, item) => sum + item.单次施放伤害, 0),
      Beam宽度,
      扩展预算,
      基线动作序列: 获取基线序列(params, initialState),
    },
  }
}
