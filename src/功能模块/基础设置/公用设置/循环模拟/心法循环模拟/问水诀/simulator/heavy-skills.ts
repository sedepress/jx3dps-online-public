import { 问水动作上下文, 问水待生效事件, 问水模拟状态 } from '../types'
import { 创建带增益签名的伤害事件 } from './team-buffs'
import { 获取职业增益签名 } from './buffs'

const 云飞技能 = ['云飞玉皇', '云景·云飞玉皇']
const 触发四季计数技能 = ['夕照雷峰', ...云飞技能]

interface 创建伤害参数 {
  技能名称: string
  命中帧: number
  序号: number
  context: 问水动作上下文
  额外增益签名?: string[]
  增益来源技能名称?: string
}

const 创建伤害 = (state: 问水模拟状态, 参数: 创建伤害参数) =>
  创建带增益签名的伤害事件(state, {
    技能名称: 参数.技能名称,
    命中帧: 参数.命中帧,
    序号: 参数.序号,
    额外增益签名: 获取职业增益签名(
      state,
      参数.增益来源技能名称 || 参数.技能名称,
      参数.context,
    ).concat(参数.额外增益签名 || []),
  })

const 创建风来事件 = (state: 问水模拟状态, 开始帧: number, context: 问水动作上下文) =>
  Array.from({ length: 16 }, (_, index) => {
    const 命中帧 = 开始帧 + index * 5
    const 层云层数 = context.奇穴?.includes('层云') ? Math.min(5, index) : 0
    const events: 问水待生效事件[] = [
      创建伤害(state, {
        技能名称: '风来吴山',
        命中帧,
        序号: index,
        context,
        额外增益签名: 层云层数 ? [`层云${层云层数}`] : [],
      }),
    ]
    if (context.奇穴?.includes('碧归')) {
      if (index % 2 === 1) {
        events.push({
          事件类型: 'Buff',
          生效帧: 命中帧,
          序号: 200 + index,
          技能名称: '碧归',
          事件数据: {
            操作: '叠加',
            作用对象: '自身',
            层数变化: 1,
            最大层数: 4,
            结束帧: 命中帧 + 144,
          },
        })
      }
    }
    return events
  }).flat()

const 创建四季事件 = (
  state: 问水模拟状态,
  技能名称: string,
  命中帧: number,
  context: 问水动作上下文,
): 问水待生效事件[] => {
  const 已施展计数 = state.技能记录.filter((item) =>
    触发四季计数技能.includes(item.技能名称),
  ).length
  const 是否触发 =
    技能名称 === '鹤归孤山' || (触发四季计数技能.includes(技能名称) && 已施展计数 % 2 === 1)
  if (!是否触发) return []
  return [创建伤害(state, { 技能名称: '四季剑法', 命中帧, 序号: 10, context })]
}

export const 创建重剑伤害事件 = (
  state: 问水模拟状态,
  参数: { 技能名称: string; 开始帧: number; 命中帧: number; context: 问水动作上下文 },
): 问水待生效事件[] => {
  const { 技能名称, 开始帧, 命中帧, context } = 参数
  if (技能名称 === '风来吴山') {
    return 创建风来事件(state, 开始帧, context).concat(
      创建伤害(state, { 技能名称: '四季剑法', 命中帧: 开始帧 + 75, 序号: 500, context }),
    )
  }
  const events = [创建伤害(state, { 技能名称, 命中帧, 序号: 0, context })]
  if (技能名称 === '夕照雷峰') {
    events.push(创建伤害(state, { 技能名称: '新破招(夕)', 命中帧, 序号: 1, context }))
  }
  if (技能名称 === '鹤归孤山' && context.奇穴?.includes('山倾')) {
    events.push(
      创建伤害(state, {
        技能名称: '鹤归孤山·山倾',
        命中帧,
        序号: 1,
        context,
        增益来源技能名称: '鹤归孤山',
      }),
    )
  }
  if (云飞技能.includes(技能名称)) {
    events.push(
      创建伤害(state, {
        技能名称: '云飞玉皇·二段',
        命中帧,
        序号: 2,
        context,
        增益来源技能名称: '云飞玉皇',
      }),
      创建伤害(state, { 技能名称: '新破招(云)', 命中帧, 序号: 3, context }),
    )
  }
  if (云飞技能.includes(技能名称) && context.触发玉山揽云) {
    events.push(创建伤害(state, { 技能名称: '玉山揽云', 命中帧, 序号: 3, context }))
  }
  if (['夕照雷峰', ...云飞技能].includes(技能名称) && state.目标Buff.九皋鹤野?.层数 > 0) {
    events.push(创建伤害(state, { 技能名称: '九皋鹤野·落剑', 命中帧, 序号: 4, context }))
  }
  events.push(...创建四季事件(state, 技能名称, 命中帧, context))
  return events
}

export const 应用九皋落剑效果 = (state: 问水模拟状态, 技能名称: string) => {
  const 九皋 = state.目标Buff.九皋鹤野
  if (!九皋 || !['夕照雷峰', ...云飞技能].includes(技能名称)) return state
  const 新层数 = 九皋.层数 - 1
  const 目标Buff = { ...state.目标Buff }
  if (新层数 > 0) 目标Buff.九皋鹤野 = { ...九皋, 层数: 新层数 }
  else delete 目标Buff.九皋鹤野
  const 技能CD = state.技能CD.云飞玉皇
    ? { ...state.技能CD, 云飞玉皇: Math.max(state.当前帧, state.技能CD.云飞玉皇 - 32) }
    : state.技能CD
  return { ...state, 目标Buff, 技能CD }
}

export const 检查重剑特殊动作 = (state: 问水模拟状态, 技能名称: string) => {
  if (技能名称 !== '云景·云飞玉皇') return undefined
  return state.自身Buff.云景 ? undefined : '缺少云景瞬发效果'
}

export const 应用重剑辅助动作 = (
  state: 问水模拟状态,
  技能名称: string,
  context: 问水动作上下文,
) => {
  if (技能名称 !== '峰插云景') return state
  const 技能CD = context.奇穴?.includes('斩岳')
    ? { ...state.技能CD, 云飞玉皇: 0, 鹤归孤山: 0 }
    : state.技能CD
  return {
    ...state,
    技能CD,
    自身Buff: {
      ...state.自身Buff,
      云景: { 层数: 1, 获得帧: state.当前帧, 结束帧: state.当前帧 + 64 },
    },
  }
}

export const 消耗重剑瞬发Buff = (state: 问水模拟状态, 技能名称: string) => {
  if (技能名称 !== '云景·云飞玉皇' || !state.自身Buff.云景) return state
  const 自身Buff = { ...state.自身Buff }
  delete 自身Buff.云景
  return { ...state, 自身Buff }
}
