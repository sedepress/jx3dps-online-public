import { describe, expect, it } from '@jest/globals'
import { 创建问水起手状态 } from './create-state'
import { 执行动作 } from './engine'
import { 获取轻剑动作 } from './light-skills'

describe('问水诀轻剑动作', () => {
  it('轻剑起手只枚举轻剑动作和啸日，不枚举重剑输出', () => {
    const state = 创建问水起手状态({ 战斗秒数: 10, 加速值: 0, 网络延迟: 1 })
    const names = 获取轻剑动作(state).map((item) => item.名称)

    expect(names).toEqual(
      expect.arrayContaining(['听雷-轻', '三柴剑法', '黄龙吐翠', '平湖断月', '啸日']),
    )
    expect(names).not.toContain('夕照雷峰')
  })

  it('听雷、平湖和黄龙按公开技能说明获得剑气且不越界', () => {
    const state = 创建问水起手状态({ 战斗秒数: 10, 加速值: 0, 网络延迟: 0 })
    const 听雷后 = 执行动作(state, '听雷-轻')
    const 黄龙前 = { ...听雷后.状态, 剑气: 90, 当前帧: 听雷后.状态.GCD.公共 }
    const 黄龙后 = 执行动作(黄龙前, '黄龙吐翠')
    const 平湖前 = { ...黄龙后.状态, 剑气: 0, 当前帧: 黄龙后.状态.GCD.公共 }
    const 平湖后 = 执行动作(平湖前, '平湖断月')

    expect(听雷后.成功).toBe(true)
    expect(听雷后.状态.剑气).toBe(20)
    expect(黄龙后.状态.剑气).toBe(100)
    expect(平湖后.状态.剑气).toBe(20)
    expect(平湖后.状态.待生效事件.at(-1)).toMatchObject({ 技能名称: '平湖断月' })
  })

  it('三柴不改变剑气，且姿态不符时拒绝重剑技能', () => {
    const state = 创建问水起手状态({ 战斗秒数: 10, 加速值: 0, 网络延迟: 0 })
    const 三柴后 = 执行动作(state, '三柴剑法')
    const 重剑结果 = 执行动作(三柴后.状态, '夕照雷峰')

    expect(三柴后.成功).toBe(true)
    expect(三柴后.状态.剑气).toBe(0)
    expect(重剑结果).toMatchObject({ 成功: false, 失败原因: '姿态不满足技能要求' })
  })

  it('啸日切换到重剑姿态，再次施展切回轻剑', () => {
    const state = 创建问水起手状态({ 战斗秒数: 10, 加速值: 0, 网络延迟: 0 })
    const 重剑 = 执行动作(state, '啸日')
    const 轻剑 = 执行动作({ ...重剑.状态, 当前帧: 重剑.状态.GCD.公共 }, '啸日')

    expect(重剑.状态.姿态).toBe('重剑')
    expect(轻剑.状态.姿态).toBe('轻剑')
  })
})
