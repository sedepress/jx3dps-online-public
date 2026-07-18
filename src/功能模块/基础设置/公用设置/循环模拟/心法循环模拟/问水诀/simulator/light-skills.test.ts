import { describe, expect, it } from '@jest/globals'
import { 创建问水起手状态 } from './create-state'
import { 执行动作 } from './engine'
import { 获取轻剑动作 } from './light-skills'

describe('问水诀轻剑动作', () => {
  it('轻剑起手只枚举主动技能和啸日，不把三柴普通攻击放入动作空间', () => {
    const state = 创建问水起手状态({ 战斗秒数: 10, 加速值: 0, 网络延迟: 1 })
    const names = 获取轻剑动作(state).map((item) => item.名称)

    expect(names).toEqual(expect.arrayContaining(['听雷-轻', '黄龙吐翠', '平湖断月', '啸日']))
    expect(names).not.toContain('三柴剑法')
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
    expect(平湖后.状态.剑气).toBe(25)
    expect(平湖后.状态.待生效事件).toEqual(
      expect.arrayContaining([expect.objectContaining({ 事件类型: '伤害', 技能名称: '平湖断月' })]),
    )
  })

  it('三柴普通攻击不能作为玩家主动动作，且姿态不符时拒绝重剑技能', () => {
    const state = 创建问水起手状态({ 战斗秒数: 10, 加速值: 0, 网络延迟: 0 })
    const 三柴后 = 执行动作(state, '三柴剑法')
    const 重剑结果 = 执行动作(state, '夕照雷峰')

    expect(三柴后).toMatchObject({ 成功: false, 失败原因: '技能未建模' })
    expect(重剑结果).toMatchObject({ 成功: false, 失败原因: '姿态不满足技能要求' })
  })

  it('听雷轻剑段的听雷和两次三柴都按近身命中回剑', () => {
    const initial = {
      ...创建问水起手状态({ 战斗秒数: 10, 加速值: 0, 网络延迟: 0 }),
      姿态: '重剑' as const,
      剑气: 3,
    }
    const 切轻剑 = 执行动作(initial, '啸日')
    const 听雷 = 执行动作(切轻剑.状态, '听雷-轻')
    const 切重剑 = 执行动作(听雷.状态, '啸日')
    const 结算后 = 执行动作({ ...切重剑.状态, 当前帧: 切重剑.状态.GCD.公共 }, '夕照雷峰', {
      奇穴: ['造化'],
    })

    expect(结算后.成功).toBe(true)
    expect(结算后.状态.剑气).toBe(23)
    expect(结算后.状态.伤害事件).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ 技能名称: '听雷-轻', 伤害次数: 1 }),
        expect.objectContaining({ 技能名称: '三柴剑法', 伤害次数: 2 }),
      ]),
    )
  })

  it('啸日切换到重剑姿态，再次施展切回轻剑', () => {
    const state = 创建问水起手状态({ 战斗秒数: 10, 加速值: 0, 网络延迟: 0 })
    const 重剑 = 执行动作(state, '啸日')
    const 轻剑 = 执行动作({ ...重剑.状态, 当前帧: 重剑.状态.GCD.公共 }, '啸日')

    expect(重剑.状态.姿态).toBe('重剑')
    expect(轻剑.状态.姿态).toBe('轻剑')
  })

  it('平湖和黄龙使用 8 秒 CD，九溪使用 1.5 秒 CD', () => {
    const state = 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 })
    const 平湖 = 执行动作(state, '平湖断月')
    const 平湖CD中 = 执行动作(平湖.状态, '平湖断月')
    const 平湖再次 = 执行动作({ ...平湖.状态, 当前帧: 8 * 16 }, '平湖断月')
    const 黄龙 = 执行动作(state, '黄龙吐翠')
    const 黄龙CD中 = 执行动作(黄龙.状态, '黄龙吐翠')
    const 黄龙再次 = 执行动作({ ...黄龙.状态, 当前帧: 8 * 16 }, '黄龙吐翠')
    const 九溪 = 执行动作(state, '九溪弥烟-轻')
    const 九溪再次 = 执行动作(九溪.状态, '九溪弥烟-轻')

    expect(平湖CD中).toMatchObject({ 成功: false, 失败原因: '技能CD未结束' })
    expect(黄龙CD中).toMatchObject({ 成功: false, 失败原因: '技能CD未结束' })
    expect(平湖再次.状态.技能记录.at(-1)?.开始帧).toBe(8 * 16)
    expect(黄龙再次.状态.技能记录.at(-1)?.开始帧).toBe(8 * 16)
    expect(九溪再次.状态.技能记录.at(-1)?.开始帧).toBe(24)
  })
})
