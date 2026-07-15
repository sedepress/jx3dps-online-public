import { 问水动作上下文, 问水待生效事件, 问水模拟状态 } from '../types'
import { 创建带增益签名的伤害事件 } from './team-buffs'
import { 获取职业增益签名 } from './buffs'

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
  Array.from({ length: 8 }, (_, index) => {
    const 命中帧 = 开始帧 + index * 10
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
      events.push({
        事件类型: '资源',
        生效帧: 命中帧,
        序号: 100 + index,
        事件数据: { 剑气变化: 5 },
      })
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

export const 创建重剑伤害事件 = (
  state: 问水模拟状态,
  参数: { 技能名称: string; 开始帧: number; 命中帧: number; context: 问水动作上下文 },
): 问水待生效事件[] => {
  const { 技能名称, 开始帧, 命中帧, context } = 参数
  if (技能名称 === '风来吴山') return 创建风来事件(state, 开始帧, context)
  const events = [创建伤害(state, { 技能名称, 命中帧, 序号: 0, context })]
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
  if (技能名称 === '云飞玉皇') {
    events.push(
      创建伤害(state, {
        技能名称: '云飞玉皇·二段',
        命中帧,
        序号: 2,
        context,
        增益来源技能名称: '云飞玉皇',
      }),
    )
  }
  if (技能名称 === '云飞玉皇' && context.触发玉山揽云) {
    events.push(创建伤害(state, { 技能名称: '玉山揽云', 命中帧, 序号: 3, context }))
  }
  if (['夕照雷峰', '云飞玉皇'].includes(技能名称) && state.目标Buff.九皋鹤野?.层数 > 0) {
    events.push(创建伤害(state, { 技能名称: '九皋鹤野·落剑', 命中帧, 序号: 4, context }))
  }
  return events
}

export const 应用九皋落剑效果 = (state: 问水模拟状态, 技能名称: string) => {
  const 九皋 = state.目标Buff.九皋鹤野
  if (!九皋 || !['夕照雷峰', '云飞玉皇'].includes(技能名称)) return state
  const 新层数 = 九皋.层数 - 1
  const 目标Buff = { ...state.目标Buff }
  if (新层数 > 0) 目标Buff.九皋鹤野 = { ...九皋, 层数: 新层数 }
  else delete 目标Buff.九皋鹤野
  const 技能CD = state.技能CD.云飞玉皇
    ? { ...state.技能CD, 云飞玉皇: Math.max(state.当前帧, state.技能CD.云飞玉皇 - 32) }
    : state.技能CD
  return { ...state, 目标Buff, 技能CD }
}
