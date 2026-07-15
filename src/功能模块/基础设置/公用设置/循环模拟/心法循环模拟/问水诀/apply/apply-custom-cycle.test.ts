import { configureStore, Middleware } from '@reduxjs/toolkit'
import { describe, expect, it, jest } from '@jest/globals'
import { 循环数据 } from '@/@types/循环'
import 数据Reducer from '@/store/data'
import { 初始化心法数据 } from '@/数据/数据工具/获取当前数据'
import 获取当前数据 from '@/数据/数据工具/获取当前数据'
import { 构建问水优化循环 } from './build-custom-cycle'
import { 应用问水优化循环 } from './apply-custom-cycle'

jest.mock('@/计算模块/计算函数', () => ({
  触发秒伤计算: (payload) => ({ type: 'test/触发秒伤计算', payload }),
}))

const 构建参数 = {
  战斗时间: 219.51,
  奇穴: ['夜雨', '碧归'],
  秘籍: { 夕照雷峰: ['5%伤害'] },
  技能序列: ['听雷-轻', '啸日', '云飞玉皇'],
  条件规则: [{ 技能名称: '断潮', 回退动作: '听雷-重' }],
  技能详情: [
    { 技能名称: '云飞玉皇', 技能数量: 2.5 },
    { 技能名称: '断潮', 技能数量: 0.75 },
  ],
  加速值: 9232,
  网络延迟: 1,
  配置指纹: 'fingerprint-1',
  扩展预算: 50_000,
  提前结束: false,
  搜索耗时: 1234,
  预期DPS: 8_765_432.1,
}

describe('问水诀优化循环应用', () => {
  it('构建包含搜索结果和当前配置的自定义循环且没有副作用', () => {
    localStorage.clear()
    localStorage.setItem('existing', 'value')
    const before = JSON.stringify(localStorage)

    const cycle = 构建问水优化循环(构建参数)

    expect(cycle).toMatchObject({
      名称: '最优序列-219.51s',
      类型: '自定义',
      标记: '自定义',
      强制加速要求: true,
      奇穴: 构建参数.奇穴,
      秘籍: 构建参数.秘籍,
      技能序列: 构建参数.技能序列,
      条件规则: [
        {
          技能名称: '断潮',
          触发条件: '断潮可用',
          优先级: 0,
          回退动作: '听雷-重',
        },
      ],
      循环详情: [
        {
          战斗时间: 219.51,
          循环加速值范围: [9232, 9233],
          循环延迟要求: 1,
          技能详情: 构建参数.技能详情,
        },
      ],
      优化信息: {
        配置指纹: 'fingerprint-1',
        扩展预算: 50_000,
        提前结束: false,
        搜索耗时: 1234,
        预期DPS: 8_765_432.1,
      },
    })
    expect(JSON.stringify(localStorage)).toBe(before)
  })

  it('原子替换同名循环并只触发一次正式 DPS 计算', async () => {
    await 初始化心法数据('问水诀')
    localStorage.clear()
    const oldCycle = 创建旧循环('最优序列-219.51s')
    const anotherCycle = 创建旧循环('保留循环')
    const actions: unknown[] = []
    const actionRecorder: Middleware = () => (next) => (action) => {
      actions.push(action)
      return next(action)
    }
    const store = configureStore({
      reducer: { data: 数据Reducer },
      middleware: (defaults) => defaults().concat(actionRecorder),
      preloadedState: {
        data: 创建初始数据([oldCycle, anotherCycle]),
      },
    })
    const before = store.getState().data
    expect(localStorage.length).toBe(0)

    const cycle = 构建问水优化循环(构建参数)
    expect(store.getState().data).toBe(before)
    expect(localStorage.length).toBe(0)
    store.dispatch(应用问水优化循环(cycle) as never)

    const state = store.getState().data
    expect(state.自定义循环列表).toEqual([cycle, anotherCycle])
    expect(state.当前计算循环名称).toBe(cycle.名称)
    expect(state.当前奇穴信息).toEqual(cycle.奇穴)
    expect(state.当前秘籍信息).toEqual(cycle.秘籍)
    expect(state.当前战斗时间).toBeUndefined()
    expect(state.全部方案数据.测试方案).toMatchObject({
      当前计算循环名称: cycle.名称,
      当前奇穴信息: cycle.奇穴,
      当前秘籍信息: cycle.秘籍,
    })
    expect(state.全部方案数据.测试方案.当前战斗时间).toBeUndefined()
    expect(actions.filter((action: any) => action.type === 'data/应用优化循环数据')).toHaveLength(1)
    expect(actions.filter((action: any) => action.type === 'test/触发秒伤计算')).toEqual([
      { type: 'test/触发秒伤计算', payload: { 是否更新显示计算结果: true } },
    ])
    断言缓存(cycle, state.全部方案数据)
  })

  it('名称不存在时追加优化循环', async () => {
    await 初始化心法数据('问水诀')
    localStorage.clear()
    const oldCycle = 创建旧循环('保留循环')
    const store = configureStore({
      reducer: { data: 数据Reducer },
      preloadedState: { data: 创建初始数据([oldCycle]) },
    })
    const cycle = 构建问水优化循环(构建参数)

    store.dispatch(应用问水优化循环(cycle) as never)

    expect(store.getState().data.自定义循环列表).toEqual([oldCycle, cycle])
  })
})

const 创建旧循环 = (名称: string): 循环数据 => ({
  名称,
  类型: '自定义',
  奇穴: ['旧奇穴'],
  循环详情: [{ 战斗时间: 10, 技能详情: [{ 技能名称: '听雷-轻', 技能数量: 1 }] }],
})

const 创建初始数据 = (cycles: 循环数据[]) =>
  ({
    当前方案名称: '测试方案',
    全部方案数据: {
      测试方案: {
        方案名称: '测试方案',
        装备信息: {},
        当前计算循环名称: '旧循环',
        当前战斗时间: '300s',
        当前奇穴信息: ['旧奇穴'],
        当前秘籍信息: {},
        增益启用: false,
        增益数据: { 阵眼: '', 小吃: [], 团队增益: [] },
      },
    },
    角色基础属性: {},
    装备信息: {},
    当前计算循环名称: '旧循环',
    当前战斗时间: '300s',
    当前输出计算目标名称: '',
    当前计算结果: { 总伤: 0, 秒伤: 0, 秒伤计算时间: 0, 计算结果技能列表: [] },
    网络延迟: 1,
    当前奇穴信息: ['旧奇穴'],
    自定义循环列表: cycles,
    增益数据: { 阵眼: '', 小吃: [], 团队增益: [] },
    增益启用: false,
    当前秘籍信息: {},
    团队增益轴: [],
  }) as any

const 断言缓存 = (cycle: 循环数据, schemes: unknown) => {
  const { 缓存映射 } = 获取当前数据()
  expect(localStorage.getItem(缓存映射.当前计算循环名称)).toBe(cycle.名称)
  expect(JSON.parse(localStorage.getItem(缓存映射.当前奇穴信息) || 'null')).toEqual(cycle.奇穴)
  expect(JSON.parse(localStorage.getItem(缓存映射.当前秘籍信息) || 'null')).toEqual(cycle.秘籍)
  expect(JSON.parse(localStorage.getItem(缓存映射.自定义循环) || '{}')).toEqual({
    '最优序列-219.51s': cycle,
    保留循环: expect.any(Object),
  })
  expect(JSON.parse(localStorage.getItem(缓存映射.全部方案数据) || 'null')).toEqual(schemes)
}
