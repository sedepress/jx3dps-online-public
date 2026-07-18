import { 问水待生效事件, 问水模拟状态 } from '../types'
import { 获取当前剑气上限 } from './resources'

const 获取事件数字 = (事件: 问水待生效事件, key: string, 默认值 = 0) => {
  const value = 事件.事件数据?.[key]
  return typeof value === 'number' ? value : 默认值
}

const 获取伤害增益签名 = (state: 问水模拟状态, 事件: 问水待生效事件) => {
  if (!事件.命中时读取增益) return 事件.增益签名
  const 内部状态 = new Set(['碧归', '叠锋意', '云景'])
  const 动态签名 = Object.keys(state.团队增益)
    .concat(Object.keys(state.自身Buff).filter((名称) => !内部状态.has(名称)))
    .concat(事件.增益签名 || [])
  return Array.from(new Set(动态签名)).sort()
}

const 结算伤害事件 = (state: 问水模拟状态, 事件: 问水待生效事件): 问水模拟状态 => {
  if (!事件.技能名称 || 事件.生效帧 > state.结束帧) {
    return state
  }
  return {
    ...state,
    伤害事件: state.伤害事件.concat({
      技能名称: 事件.技能名称,
      命中帧: 事件.生效帧,
      伤害次数: 获取事件数字(事件, '伤害次数', 1),
      技能等级: 获取事件数字(事件, '技能等级') || undefined,
      增益签名: 获取伤害增益签名(state, 事件),
      快照签名: 事件.快照签名,
      权重: 获取事件数字(事件, '施放权重', 1),
    }),
  }
}

const 结算资源事件 = (state: 问水模拟状态, 事件: 问水待生效事件): 问水模拟状态 => ({
  ...state,
  剑气: Math.max(0, Math.min(获取当前剑气上限(state), state.剑气 + 获取事件数字(事件, '剑气变化'))),
})

const 结算Buff事件 = (state: 问水模拟状态, 事件: 问水待生效事件): 问水模拟状态 => {
  const 操作 = 事件.事件数据?.操作
  if (!事件.技能名称 || (操作 !== '开始' && 操作 !== '叠加')) {
    return state
  }
  const 作用对象 = 事件.事件数据?.作用对象
  const key = 作用对象 === '自身' ? '自身Buff' : 作用对象 === '目标' ? '目标Buff' : '团队增益'
  const 当前层数 = state[key][事件.技能名称]?.层数 || 0
  const 层数 =
    操作 === '叠加'
      ? Math.min(获取事件数字(事件, '最大层数', 99), 当前层数 + 获取事件数字(事件, '层数变化', 1))
      : 获取事件数字(事件, '层数', 1)
  return {
    ...state,
    [key]: {
      ...state[key],
      [事件.技能名称]: {
        层数,
        获得帧: 事件.生效帧,
        结束帧: 获取事件数字(事件, '结束帧', 事件.生效帧),
      },
    },
  }
}

export const 比较问水事件 = (左: 问水待生效事件, 右: 问水待生效事件) =>
  左.生效帧 - 右.生效帧 || 左.序号 - 右.序号

export const 结算问水事件 = (state: 问水模拟状态, 事件: 问水待生效事件) => {
  if (事件.事件类型 === '伤害') {
    return 结算伤害事件(state, 事件)
  }
  if (事件.事件类型 === '资源') {
    return 结算资源事件(state, 事件)
  }
  return 结算Buff事件(state, 事件)
}
