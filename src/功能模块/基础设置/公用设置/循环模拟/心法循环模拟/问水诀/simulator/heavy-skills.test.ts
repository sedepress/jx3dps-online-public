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
  it('如风八点加速率进入云飞公共 GCD 和读条帧', () => {
    const state = { ...创建重剑状态(), 加速值: 13739 }
    const 普通 = 执行动作(state, '云飞玉皇')
    const 如风 = 执行动作(state, '云飞玉皇', { 奇穴: ['如风'] })

    expect(普通.状态.GCD.公共).toBe(22)
    expect(如风.状态.GCD.公共).toBe(20)
    expect(如风.状态.技能记录[0].命中帧).toBe(20)
  })

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
    expect(推进到帧(result.状态, 命中帧).剑气).toBe(92)
  })

  it('下一动作校验前先结算上一技能的同帧命中回剑', () => {
    const state = { ...创建重剑状态(), 剑气: 25 }
    const 第一次 = 执行动作(state, '夕照雷峰')
    const 第二次 = 执行动作(第一次.状态, '夕照雷峰')

    expect(第一次.状态.剑气).toBe(10)
    expect(第二次.成功).toBe(true)
    expect(第二次.状态.技能记录).toHaveLength(2)
  })

  it('云飞产生两段伤害、新破招并记录 4 秒基础 CD', () => {
    const result = 执行动作(创建重剑状态(), '云飞玉皇')
    const damageNames = result.状态.待生效事件
      .filter((item) => item.事件类型 === '伤害')
      .map((item) => item.技能名称)

    expect(result.状态.剑气).toBe(85)
    expect(result.状态.技能CD.云飞玉皇).toBe(64)
    expect(damageNames).toEqual(['云飞玉皇', '云飞玉皇·二段', '新破招(云)'])
    expect(推进到帧(result.状态, result.状态.技能记录[0].命中帧).剑气).toBe(95)
  })

  it('重剑普通攻击按两次夕云触发一次四季并按命中回剑', () => {
    const 第一次 = 执行动作(创建重剑状态(), '夕照雷峰')
    const 第二次 = 执行动作({ ...第一次.状态, 当前帧: 第一次.状态.GCD.公共 }, '夕照雷峰')
    expect(第二次.状态.待生效事件).toEqual(
      expect.arrayContaining([expect.objectContaining({ 事件类型: '伤害', 技能名称: '四季剑法' })]),
    )
    expect(第二次.状态.待生效事件).toEqual(
      expect.arrayContaining([expect.objectContaining({ 事件类型: '资源', 技能名称: '四季剑法' })]),
    )
  })

  it('鹤归每次额外触发一次四季普通攻击', () => {
    const 鹤归 = 执行动作(创建重剑状态(), '鹤归孤山')

    expect(鹤归.状态.待生效事件).toEqual(
      expect.arrayContaining([expect.objectContaining({ 事件类型: '伤害', 技能名称: '四季剑法' })]),
    )
  })

  it('斩岳峰插重置云飞和鹤归并使下一次云飞变为云景瞬发', () => {
    const state = {
      ...创建重剑状态(),
      技能CD: { 云飞玉皇: 64, 鹤归孤山: 256 },
    }
    const 峰插 = 执行动作(state, '峰插云景', { 奇穴: ['斩岳'] })
    expect(峰插.成功).toBe(true)
    expect(峰插.状态.剑气).toBe(90)
    expect(峰插.状态.技能CD).toMatchObject({ 云飞玉皇: 0, 鹤归孤山: 0, 峰插云景: 240 })
    expect(峰插.状态.自身Buff.云景).toMatchObject({ 层数: 1, 结束帧: 64 })

    const 云景 = 执行动作({ ...峰插.状态, 当前帧: 峰插.状态.GCD.公共 }, '云景·云飞玉皇')
    const damageNames = 云景.状态.待生效事件
      .filter((item) => item.事件类型 === '伤害')
      .map((item) => item.技能名称)
    expect(云景.成功).toBe(true)
    expect(云景.状态.技能记录.at(-1)).toMatchObject({ 开始帧: 0, 命中帧: 0 })
    expect(damageNames).toEqual(['云景·云飞玉皇', '云飞玉皇·二段', '新破招(云)'])
    expect(云景.状态.自身Buff.云景).toBeUndefined()
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

  it('鹤归孤山使用 16 秒 CD', () => {
    const 第一次 = 执行动作(创建重剑状态(), '鹤归孤山')
    const CD中 = 执行动作({ ...第一次.状态, 剑气: 100 }, '鹤归孤山')
    const 第二次 = 执行动作({ ...第一次.状态, 当前帧: 16 * 16, 剑气: 100 }, '鹤归孤山')

    expect(CD中).toMatchObject({ 成功: false, 失败原因: '技能CD未结束' })
    expect(第二次.状态.技能记录.at(-1)?.开始帧).toBe(16 * 16)
  })

  it('九皋落剑使云飞剩余调息降低 2 秒', () => {
    const state = {
      ...创建重剑状态(),
      目标Buff: { 九皋鹤野: { 层数: 5, 获得帧: 0, 结束帧: 112 } },
    }
    const 云飞 = 执行动作(state, '云飞玉皇', { 奇穴: ['山倾'] })

    expect(云飞.状态.技能CD.云飞玉皇).toBe(32)
  })

  it('夕照产生新破招，风来生成十六次后台伤害并记录九十秒 CD', () => {
    const 夕照 = 执行动作(创建重剑状态(), '夕照雷峰')
    const 风来 = 执行动作(创建重剑状态(), '风来吴山')
    const 风来后云飞 = 执行动作(风来.状态, '云飞玉皇')

    expect(夕照.状态.待生效事件.some((item) => item.技能名称 === '新破招(夕)')).toBe(true)
    expect(
      风来.状态.待生效事件.filter(
        (item) => item.事件类型 === '伤害' && item.技能名称 === '风来吴山',
      ),
    ).toHaveLength(16)
    expect(
      风来.状态.待生效事件.filter(
        (item) => item.事件类型 === '伤害' && item.技能名称 === '四季剑法',
      ),
    ).toHaveLength(1)
    expect(风来.状态.技能CD.风来吴山).toBe(90 * 16)
    expect(风来后云飞.成功).toBe(true)
    expect(风来后云飞.状态.技能记录.at(-1)?.开始帧).toBeLessThan(75)
    expect(推进到帧(风来.状态, 75).剑气).toBe(100)
  })

  it('层云按风来命中次数递增并在第五层封顶', () => {
    const 风来 = 执行动作(创建重剑状态(), '风来吴山', { 奇穴: ['层云'] })
    const signatures = 风来.状态.待生效事件
      .filter((item) => item.事件类型 === '伤害' && item.技能名称 === '风来吴山')
      .map((item) => item.增益签名)

    expect(signatures.slice(0, 7)).toEqual([
      [],
      ['层云1'],
      ['层云2'],
      ['层云3'],
      ['层云4'],
      ['层云5'],
      ['层云5'],
    ])
    expect(signatures).toHaveLength(16)
    expect(signatures.slice(5).every((item) => item?.includes('层云5'))).toBe(true)
  })

  it('碧归风来逐跳恢复剑气并每两跳叠加一层碧归', () => {
    const 风来 = 执行动作({ ...创建重剑状态(), 剑气: 0 }, '风来吴山', { 奇穴: ['碧归'] })
    const 结算后 = 推进到帧(风来.状态, 75)

    expect(风来.状态.剑气).toBe(0)
    expect(结算后.剑气).toBe(85)
    expect(结算后.自身Buff.碧归).toMatchObject({ 层数: 4, 结束帧: 219 })
  })
})
