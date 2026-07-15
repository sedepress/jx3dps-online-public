import { 问水动作上下文, 问水待生效事件, 问水模拟状态 } from '../types'
import { 创建带增益签名的伤害事件 } from './team-buffs'
import { 获取职业增益签名 } from './buffs'

const 创建伤害 = (
  state: 问水模拟状态,
  技能名称: string,
  命中帧: number,
  序号: number,
  context: 问水动作上下文,
) =>
  创建带增益签名的伤害事件(state, {
    技能名称,
    命中帧,
    序号,
    额外增益签名: 获取职业增益签名(state, 技能名称, context),
  })

const 创建风来事件 = (state: 问水模拟状态, 开始帧: number, context: 问水动作上下文) =>
  Array.from({ length: 8 }, (_, index) =>
    创建伤害(state, '风来吴山', 开始帧 + index * 10, index, context),
  )

export const 创建重剑伤害事件 = (
  state: 问水模拟状态,
  技能名称: string,
  开始帧: number,
  命中帧: number,
  context: 问水动作上下文,
): 问水待生效事件[] => {
  if (技能名称 === '风来吴山') return 创建风来事件(state, 开始帧, context)
  const events = [创建伤害(state, 技能名称, 命中帧, 0, context)]
  if (技能名称 === '云飞玉皇') {
    events.push(创建伤害(state, '云飞玉皇·二段', 命中帧, 1, context))
  }
  if (技能名称 === '云飞玉皇' && context.触发玉山揽云) {
    events.push(创建伤害(state, '玉山揽云', 命中帧, 2, context))
  }
  if (['夕照雷峰', '云飞玉皇'].includes(技能名称) && state.目标Buff.九皋鹤野?.层数 > 0) {
    events.push(创建伤害(state, '九皋鹤野·落剑', 命中帧, 3, context))
  }
  return events
}

export const 消耗九皋层数 = (state: 问水模拟状态, 技能名称: string) => {
  const 九皋 = state.目标Buff.九皋鹤野
  if (!九皋 || !['夕照雷峰', '云飞玉皇'].includes(技能名称)) return state
  const 新层数 = 九皋.层数 - 1
  const 目标Buff = { ...state.目标Buff }
  if (新层数 > 0) 目标Buff.九皋鹤野 = { ...九皋, 层数: 新层数 }
  else delete 目标Buff.九皋鹤野
  return { ...state, 目标Buff }
}
