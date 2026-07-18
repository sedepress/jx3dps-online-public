import { 获取实际帧数 } from '@/工具函数/data'
import { 问水Buff状态, 问水模拟状态 } from '../types'
import { 比较问水事件, 结算问水事件 } from './events'
import { 获取技能充能结束帧, 恢复到时技能充能 } from './resources'

type 问水玩家动作 = (state: 问水模拟状态) => 问水模拟状态

export const 获取问水实际帧数 = (原始帧数: number, 加速值: number, 郭氏加速 = 0) =>
  获取实际帧数(原始帧数, 加速值, 郭氏加速)

export const 伤害是否计入 = (命中帧: number, 结束帧: number) => 命中帧 <= 结束帧

const 获取Buff结束帧 = (Buff集合: Record<string, 问水Buff状态>) =>
  Object.values(Buff集合).map((Buff) => Buff.结束帧)

const 获取中间帧 = (state: 问水模拟状态, targetFrame: number) => {
  const 事件帧 = state.待生效事件.map((事件) => 事件.生效帧)
  const Buff帧 = 获取Buff结束帧(state.自身Buff)
    .concat(获取Buff结束帧(state.目标Buff))
    .concat(获取Buff结束帧(state.团队增益))
  return Array.from(new Set(事件帧.concat(Buff帧, 获取技能充能结束帧(state))))
    .filter((frame) => frame > state.当前帧 && frame < targetFrame)
    .sort((a, b) => a - b)
}

export const 结算到时事件 = (state: 问水模拟状态, frame: number): 问水模拟状态 => {
  const 已到时事件 = state.待生效事件.filter((事件) => 事件.生效帧 <= frame).sort(比较问水事件)
  const 未到时事件 = state.待生效事件.filter((事件) => 事件.生效帧 > frame)
  return 已到时事件.reduce(结算问水事件, { ...state, 当前帧: frame, 待生效事件: 未到时事件 })
}

const 清理Buff集合 = (Buff集合: Record<string, 问水Buff状态>, frame: number) =>
  Object.fromEntries(Object.entries(Buff集合).filter(([, Buff]) => Buff.结束帧 > frame))

export const 清理过期Buff = (state: 问水模拟状态, frame: number): 问水模拟状态 => ({
  ...state,
  自身Buff: 清理Buff集合(state.自身Buff, frame),
  目标Buff: 清理Buff集合(state.目标Buff, frame),
  团队增益: 清理Buff集合(state.团队增益, frame),
})

const 执行空动作帧 = (state: 问水模拟状态, frame: number) =>
  清理过期Buff(恢复到时技能充能(结算到时事件(state, frame), frame), frame)

const 校验目标帧 = (state: 问水模拟状态, targetFrame: number) => {
  if (!Number.isInteger(targetFrame) || targetFrame < state.当前帧) {
    throw new Error('目标帧必须是不早于当前帧的整数')
  }
}

export const 执行同帧 = (
  state: 问水模拟状态,
  targetFrame: number,
  玩家动作: 问水玩家动作,
): 问水模拟状态 => {
  校验目标帧(state, targetFrame)
  const 到达目标前 = 获取中间帧(state, targetFrame).reduce(执行空动作帧, state)
  const 已结算事件 = 恢复到时技能充能(结算到时事件(到达目标前, targetFrame), targetFrame)
  return 清理过期Buff(玩家动作(已结算事件), targetFrame)
}

export const 推进到帧 = (state: 问水模拟状态, targetFrame: number): 问水模拟状态 =>
  执行同帧(state, targetFrame, (当前状态) => 当前状态)
