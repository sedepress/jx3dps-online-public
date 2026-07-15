import { describe, expect, it } from '@jest/globals'
import { 创建问水起手状态 } from './create-state'
import { 执行断潮条件规则, 合并可观察分支, 处理断潮触发, 选择断潮条件动作 } from './stochastic'

describe('问水诀随机分支', () => {
  it('会心触发将状态拆成断潮可用与不可用且总概率为 1', () => {
    const branches = 处理断潮触发(创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 }), 0.37)

    expect(branches.map((item) => item.概率)).toEqual([0.37, 0.63])
    expect(branches.map((item) => item.状态.分支概率)).toEqual([0.37, 0.63])
    expect(branches.map((item) => item.状态.断潮可用)).toEqual([true, false])
    expect(branches.reduce((sum, item) => sum + item.概率, 0)).toBeCloseTo(1)
  })

  it('断潮已经可用时不重复拆分状态', () => {
    const state = {
      ...创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 }),
      分支概率: 0.4,
      断潮可用: true,
    }

    expect(处理断潮触发(state, 0.37)).toEqual([{ 状态: state, 概率: 0.4, 期望伤害: 0 }])
  })

  it('条件规则只依据可观察的断潮状态选择动作', () => {
    const rule = { 技能名称: '断潮', 回退动作: '夕照雷峰' }
    const available = 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 })
    const unavailable = { ...available, 断潮可用: false }

    expect(选择断潮条件动作({ ...available, 断潮可用: true }, rule)).toBe('断潮')
    expect(选择断潮条件动作(unavailable, rule)).toBe('夕照雷峰')
  })

  it('触发分支插入断潮事件，未触发分支执行回退动作', () => {
    const state = {
      ...创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 }),
      姿态: '重剑' as const,
      剑气: 100,
    }
    const rule = { 技能名称: '断潮', 回退动作: '夕照雷峰' }
    const context = { 奇穴: ['造化', '怜光'] }
    const triggered = 执行断潮条件规则({ ...state, 断潮可用: true }, rule, context)
    const fallback = 执行断潮条件规则(state, rule, context)

    expect(triggered.成功).toBe(true)
    expect(triggered.状态.断潮可用).toBe(false)
    expect(triggered.状态.待生效事件.at(-1)).toMatchObject({ 技能名称: '断潮', 生效帧: 0 })
    expect(triggered.状态.待生效事件.at(-1)?.增益签名).toEqual(['怜光'])
    expect(triggered.状态.技能记录.at(-1)).toMatchObject({ 技能名称: '断潮', 是否条件动作: true })
    expect(fallback.状态.技能记录.at(-1)?.技能名称).toBe('夕照雷峰')
    expect(fallback.状态.剑气).toBe(87)
  })

  it('只合并未来决策等价的状态并按概率加权伤害', () => {
    const state = 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 })
    const merged = 合并可观察分支([
      { 状态: { ...state, 分支概率: 0.4 }, 概率: 0.4, 期望伤害: 100 },
      { 状态: { ...state, 分支概率: 0.6 }, 概率: 0.6, 期望伤害: 200 },
      { 状态: { ...state, 剑气: 1 }, 概率: 1, 期望伤害: 50 },
    ])

    expect(merged).toHaveLength(2)
    expect(merged.find((item) => item.状态.剑气 === 0)).toMatchObject({
      概率: 1,
      期望伤害: 160,
      状态: { 分支概率: 1 },
    })
  })

  it('待生效事件不同的状态不能合并', () => {
    const state = 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 })
    const merged = 合并可观察分支([
      { 状态: state, 概率: 0.5, 期望伤害: 0 },
      {
        状态: {
          ...state,
          待生效事件: [{ 事件类型: '伤害', 生效帧: 1, 序号: 0, 技能名称: '断潮' }],
        },
        概率: 0.5,
        期望伤害: 0,
      },
    ])

    expect(merged).toHaveLength(2)
  })

  it('技能记录数量不同的状态不能合并以保留首动作延迟语义', () => {
    const state = 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 })
    const merged = 合并可观察分支([
      { 状态: state, 概率: 0.5, 期望伤害: 0 },
      {
        状态: {
          ...state,
          技能记录: [{ 技能名称: '断潮', 开始帧: 0, 命中帧: 0, 结束帧: 0, 是否条件动作: true }],
          伤害事件: [{ 技能名称: '断潮', 命中帧: 0, 伤害次数: 1 }],
        },
        概率: 0.5,
        期望伤害: 0,
      },
    ])

    expect(merged).toHaveLength(2)
  })

  it('未来状态等价时合并并保留各自技能与伤害历史', () => {
    const state = 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 })
    const first = {
      ...state,
      技能记录: [{ 技能名称: '断潮', 开始帧: 0, 命中帧: 0, 结束帧: 0, 是否条件动作: true }],
      伤害事件: [{ 技能名称: '断潮', 命中帧: 0, 伤害次数: 1 }],
    }
    const second = {
      ...state,
      技能记录: [{ 技能名称: '夕照雷峰', 开始帧: 0, 命中帧: 0, 结束帧: 0 }],
      伤害事件: [{ 技能名称: '夕照雷峰', 命中帧: 0, 伤害次数: 1 }],
    }
    const merged = 合并可观察分支([
      { 状态: first, 概率: 0.4, 期望伤害: 100 },
      { 状态: second, 概率: 0.6, 期望伤害: 200 },
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0].历史分支).toHaveLength(2)
    expect(merged[0].历史分支?.map((item) => item.技能记录[0].技能名称)).toEqual([
      '断潮',
      '夕照雷峰',
    ])
  })

  it('重复合并时为既有历史补齐共同后缀', () => {
    const state = 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 })
    const createState = (技能名称: string) => ({
      ...state,
      技能记录: [{ 技能名称, 开始帧: 0, 命中帧: 0, 结束帧: 0 }],
      伤害事件: [{ 技能名称, 命中帧: 0, 伤害次数: 1 }],
    })
    const firstMerge = 合并可观察分支([
      { 状态: createState('断潮'), 概率: 0.2, 期望伤害: 100 },
      { 状态: createState('夕照雷峰'), 概率: 0.3, 期望伤害: 200 },
    ])[0]
    const commonSkill = { 技能名称: '听雷', 开始帧: 1, 命中帧: 1, 结束帧: 1 }
    const commonDamage = { 技能名称: '听雷', 命中帧: 1, 伤害次数: 1 }
    const advanced = {
      ...firstMerge,
      状态: {
        ...firstMerge.状态,
        技能记录: firstMerge.状态.技能记录.concat(commonSkill),
        伤害事件: firstMerge.状态.伤害事件.concat(commonDamage),
      },
    }
    const third = createState('云飞玉皇')
    const merged = 合并可观察分支([
      advanced,
      {
        状态: {
          ...third,
          技能记录: third.技能记录.concat(commonSkill),
          伤害事件: third.伤害事件.concat(commonDamage),
        },
        概率: 0.5,
        期望伤害: 300,
      },
    ])

    expect(merged).toHaveLength(1)
    expect(
      merged[0].历史分支?.map((item) => item.技能记录.map((record) => record.技能名称)),
    ).toEqual([
      ['断潮', '听雷'],
      ['夕照雷峰', '听雷'],
      ['云飞玉皇', '听雷'],
    ])
  })

  it('已合并分支再次拆分时按子分支概率缩放历史', () => {
    const state = 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 })
    const merged = 合并可观察分支([
      { 状态: state, 概率: 0.4, 期望伤害: 100 },
      { 状态: state, 概率: 0.6, 期望伤害: 200 },
    ])[0]
    const children = 处理断潮触发(merged, 0.5)

    expect(children.map((branch) => branch.概率)).toEqual([0.5, 0.5])
    children.forEach((branch) => {
      expect(branch.历史分支?.map((history) => history.概率)).toEqual([0.2, 0.3])
      expect(branch.历史分支?.reduce((sum, history) => sum + history.概率, 0)).toBeCloseTo(
        branch.概率,
      )
    })
  })
})
