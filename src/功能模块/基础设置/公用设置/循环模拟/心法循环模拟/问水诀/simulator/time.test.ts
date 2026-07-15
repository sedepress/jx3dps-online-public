import { describe, expect, it } from '@jest/globals'
import { 获取实际帧数 } from '@/工具函数/data'
import { 创建问水起手状态 } from './create-state'
import { 执行同帧, 推进到帧, 获取问水实际帧数, 伤害是否计入 } from './time'

describe('问水诀时间推进', () => {
  it('复用项目现有加速取整口径', () => {
    expect(获取问水实际帧数(24, 9232)).toBe(获取实际帧数(24, 9232))
    expect(获取问水实际帧数(48, 0)).toBe(48)
  })

  it('同帧先结算事件，再执行玩家动作，最后清理过期 Buff', () => {
    const state = 创建问水起手状态({ 战斗秒数: 1, 加速值: 0, 网络延迟: 0 })
    state.自身Buff.测试Buff = { 层数: 1, 获得帧: 0, 结束帧: 4 }
    state.待生效事件.push({
      事件类型: '资源',
      生效帧: 4,
      序号: 1,
      事件数据: { 剑气变化: 10 },
    })

    let 动作观察: { 剑气: number; Buff存在: boolean } | undefined
    const result = 执行同帧(state, 4, (当前状态) => {
      动作观察 = { 剑气: 当前状态.剑气, Buff存在: !!当前状态.自身Buff.测试Buff }
      return 当前状态
    })

    expect(动作观察).toEqual({ 剑气: 10, Buff存在: true })
    expect(result.自身Buff.测试Buff).toBeUndefined()
    expect(state.剑气).toBe(0)
    expect(state.自身Buff.测试Buff).toBeDefined()
  })

  it('结束帧命中计伤，晚一帧不计伤', () => {
    const state = 创建问水起手状态({ 战斗秒数: 1, 加速值: 0, 网络延迟: 0 })
    state.待生效事件.push(
      { 事件类型: '伤害', 生效帧: 16, 序号: 1, 技能名称: '听雷', 事件数据: { 伤害次数: 1 } },
      { 事件类型: '伤害', 生效帧: 17, 序号: 2, 技能名称: '夕照雷峰', 事件数据: { 伤害次数: 1 } },
    )

    const result = 推进到帧(state, 17)

    expect(伤害是否计入(16, 16)).toBe(true)
    expect(伤害是否计入(17, 16)).toBe(false)
    expect(result.伤害事件.map((事件) => 事件.技能名称)).toEqual(['听雷'])
  })

  it('保留结束帧前开始的读条日志，但丢弃结束帧后命中的伤害', () => {
    const state = 创建问水起手状态({ 战斗秒数: 1, 加速值: 0, 网络延迟: 0 })
    state.技能记录.push({ 技能名称: '夕照雷峰', 开始帧: 15, 命中帧: 17, 结束帧: 17 })
    state.待生效事件.push({
      事件类型: '伤害',
      生效帧: 17,
      序号: 1,
      技能名称: '夕照雷峰',
      事件数据: { 伤害次数: 1 },
    })

    const result = 推进到帧(state, 17)

    expect(result.技能记录).toEqual(state.技能记录)
    expect(result.伤害事件).toEqual([])
  })
})
