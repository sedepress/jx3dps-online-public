import { describe, expect, it } from '@jest/globals'
import { 创建问水起手状态 } from './create-state'
import { 执行动作 } from './engine'
import { 推进到帧 } from './time'
import { 获取实际帧数 } from '@/工具函数/data'

const 创建重剑状态 = () => ({
  ...创建问水起手状态({ 战斗秒数: 30, 加速值: 9232, 网络延迟: 0 }),
  姿态: '重剑' as const,
  剑气: 100,
})

describe('问水诀重剑动作', () => {
  it('夕照按加速读条命中并应用造化剑气消耗', () => {
    const result = 执行动作(创建重剑状态(), '夕照雷峰', {
      奇穴: ['造化', '怜光', '雾锁'],
      秘籍: { 夕照雷峰: ['4%伤害', '3%伤害'] },
    })

    expect(result.成功).toBe(true)
    expect(result.状态.剑气).toBe(87)
    const 命中帧 = 获取实际帧数(20, 9232)
    expect(result.状态.技能记录[0]).toMatchObject({ 开始帧: 0, 命中帧, 结束帧: 命中帧 })
    expect(result.状态.待生效事件.find((item) => item.事件类型 === '伤害')).toMatchObject({
      技能名称: '夕照雷峰',
      生效帧: 命中帧,
      增益签名: ['怜光', '造化2'],
    })
  })

  it('云飞产生两段伤害并记录 4 秒基础 CD', () => {
    const result = 执行动作(创建重剑状态(), '云飞玉皇')
    const damageNames = result.状态.待生效事件
      .filter((item) => item.事件类型 === '伤害')
      .map((item) => item.技能名称)

    expect(result.状态.剑气).toBe(85)
    expect(result.状态.技能CD.云飞玉皇).toBe(64)
    expect(damageNames).toEqual(['云飞玉皇', '云飞玉皇·二段'])
  })

  it('鹤归产生九皋区域，区域内夕照追加落剑', () => {
    const 鹤归 = 执行动作(创建重剑状态(), '鹤归孤山', { 奇穴: ['山倾'] })
    const 鹤归命中帧 = 鹤归.状态.技能记录[0].命中帧
    const 区域状态 = 推进到帧(鹤归.状态, 鹤归命中帧)
    const 夕照 = 执行动作({ ...区域状态, 当前帧: 区域状态.GCD.公共, 剑气: 100 }, '夕照雷峰', {
      奇穴: ['山倾'],
    })

    expect(区域状态.目标Buff.九皋鹤野).toMatchObject({ 层数: 5 })
    expect(鹤归.状态.待生效事件.some((item) => item.技能名称 === '鹤归孤山·山倾')).toBe(true)
    expect(夕照.状态.待生效事件.some((item) => item.技能名称 === '九皋鹤野·落剑')).toBe(true)
  })

  it('九皋落剑使云飞剩余调息降低 2 秒', () => {
    const state = {
      ...创建重剑状态(),
      目标Buff: { 九皋鹤野: { 层数: 5, 获得帧: 0, 结束帧: 112 } },
    }
    const 云飞 = 执行动作(state, '云飞玉皇', { 奇穴: ['山倾'] })

    expect(云飞.状态.技能CD.云飞玉皇).toBe(32)
  })

  it('风来生成八次伤害，显式玉山触发追加派生事件', () => {
    const 风来 = 执行动作(创建重剑状态(), '风来吴山')
    const 玉山 = 执行动作(创建重剑状态(), '云飞玉皇', { 触发玉山揽云: true })

    expect(风来.状态.待生效事件.filter((item) => item.技能名称 === '风来吴山')).toHaveLength(8)
    expect(玉山.状态.待生效事件.some((item) => item.技能名称 === '玉山揽云')).toBe(true)
  })

  it('层云按风来命中次数递增并在第五层封顶', () => {
    const 风来 = 执行动作(创建重剑状态(), '风来吴山', { 奇穴: ['层云'] })
    const signatures = 风来.状态.待生效事件
      .filter((item) => item.技能名称 === '风来吴山')
      .map((item) => item.增益签名)

    expect(signatures).toEqual([
      [],
      ['层云1'],
      ['层云2'],
      ['层云3'],
      ['层云4'],
      ['层云5'],
      ['层云5'],
      ['层云5'],
    ])
  })

  it('碧归风来逐跳恢复剑气并每两跳叠加一层碧归', () => {
    const 风来 = 执行动作({ ...创建重剑状态(), 剑气: 0 }, '风来吴山', { 奇穴: ['碧归'] })
    const 结算后 = 推进到帧(风来.状态, 70)

    expect(风来.状态.剑气).toBe(0)
    expect(结算后.剑气).toBe(40)
    expect(结算后.自身Buff.碧归).toMatchObject({ 层数: 4, 结束帧: 214 })
  })
})
