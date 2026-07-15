import { 问水动作上下文, 问水待生效事件, 问水模拟状态 } from '../types'

const 消耗剑气技能 = ['夕照雷峰', '云飞玉皇']
const 碧归生效技能 = ['夕照雷峰', '云飞玉皇', '鹤归孤山']

export const 获取重剑剑气变化 = (
  state: 问水模拟状态,
  参数: { 技能名称: string; 基础变化: number; context: 问水动作上下文 },
) => {
  const { 技能名称, 基础变化, context } = 参数
  if (技能名称 === '风来吴山' && context.奇穴?.includes('碧归')) return 0
  const 启用造化 = context.奇穴?.includes('造化') && 消耗剑气技能.includes(技能名称)
  return 启用造化 && state.剑气 > 50 ? 基础变化 + 2 : 基础变化
}

export const 获取职业增益签名 = (
  state: 问水模拟状态,
  技能名称: string,
  context: 问水动作上下文,
) => {
  const 签名: string[] = []
  if (context.奇穴?.includes('怜光')) 签名.push('怜光')
  if (state.自身Buff.碧归 && 碧归生效技能.includes(技能名称) && context.奇穴?.includes('碧归')) {
    签名.push('碧归')
  }
  if (消耗剑气技能.includes(技能名称) && context.奇穴?.includes('造化') && state.剑气 > 50) {
    签名.push(state.剑气 > 75 ? '造化2' : '造化1')
  }
  return Array.from(new Set(签名)).sort()
}

export const 消耗碧归层数 = (state: 问水模拟状态, 技能名称: string, context: 问水动作上下文) => {
  const 碧归 = state.自身Buff.碧归
  if (!碧归 || !碧归生效技能.includes(技能名称) || !context.奇穴?.includes('碧归')) return state
  const 自身Buff = { ...state.自身Buff }
  if (碧归.层数 > 1) 自身Buff.碧归 = { ...碧归, 层数: 碧归.层数 - 1 }
  else delete 自身Buff.碧归
  return { ...state, 自身Buff }
}

export const 创建命中Buff事件 = (
  技能名称: string,
  命中帧: number,
  context: 问水动作上下文,
): 问水待生效事件[] => {
  const events: 问水待生效事件[] = []
  if (技能名称 === '夕照雷峰' && context.奇穴?.includes('雾锁')) {
    events.push({
      事件类型: 'Buff',
      生效帧: 命中帧,
      序号: 900,
      技能名称: '雾锁',
      事件数据: { 操作: '开始', 作用对象: '自身', 层数: 1, 结束帧: 命中帧 + 240 },
    })
  }
  if (技能名称 === '鹤归孤山' && context.奇穴?.includes('山倾')) {
    events.push({
      事件类型: 'Buff',
      生效帧: 命中帧,
      序号: 901,
      技能名称: '九皋鹤野',
      事件数据: { 操作: '开始', 作用对象: '目标', 层数: 5, 结束帧: 命中帧 + 112 },
    })
  }
  return events
}
