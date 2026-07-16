import React, { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals'
import OptimalSequenceModal, { 问水优化展示结果 } from '.'
import { 创建问水优化搜索任务, 创建问水配置指纹 } from '../controller'
import { 创建当前问水搜索任务, 转换当前问水搜索结果 } from '../adapter'
import 心法配置 from '@/心法模块/心法/问水诀'
import { 初始化心法数据 } from '@/数据/数据工具/获取当前数据'
import { 运行问水分块搜索 } from '../../search/runner'
import { 秒伤计算 } from '@/计算模块/计算函数'
import { 默认团队增益轴 } from '@/工具函数/init/默认数据'

jest.mock('./index.module.less', () => ({}))

const originalConsoleError = console.error
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('ReactDOMTestUtils.act')) return
    originalConsoleError(...args)
  })
})
afterAll(() => {
  jest.restoreAllMocks()
})
afterEach(cleanup)

describe('问水诀最优序列弹窗', () => {
  it('只接受 1-600 整数秒并管理 Worker 生命周期', () => {
    const client = 创建客户端()
    const props = 创建属性(client)
    const view = render(<OptimalSequenceModal {...props} />)
    const input = screen.getByRole('spinbutton')

    fireEvent.change(input, { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: /开始搜索/ }))
    expect(screen.getByText('战斗时长必须是 1-600 的整数秒')).toBeTruthy()
    expect(client.开始).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '220' } })
    fireEvent.click(screen.getByRole('button', { name: /开始搜索/ }))
    expect(client.开始).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /停止搜索/ })).toBeTruthy()
    expect(props.创建任务).toHaveBeenCalledWith(220)

    act(() => {
      client.回调?.进度?.({
        类型: '进度',
        任务ID: 'task-1',
        扩展节点数: 25,
        扩展预算: 100,
        当前最佳伤害: 220_000,
      })
    })
    expect(screen.getByText('25 / 100')).toBeTruthy()
    expect(props.读取当前循环()).toBe('原循环')

    fireEvent.click(screen.getByRole('button', { name: /停止搜索/ }))
    expect(client.取消).toHaveBeenCalledWith('task-1')
    act(() => client.回调?.完成?.(创建Worker结果(true)))
    expect(screen.getByText('提前结束')).toBeTruthy()
    expect(screen.getByText('听雷-轻')).toBeTruthy()

    view.unmount()
    expect(client.销毁).toHaveBeenCalledTimes(1)
  })

  it('展示序列、条件规则和技能统计并阻止应用过期结果', () => {
    const client = 创建客户端()
    const props = 创建属性(client, { 当前指纹: 'fingerprint-new' })
    render(<OptimalSequenceModal {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /开始搜索/ }))
    act(() => client.回调?.完成?.(创建Worker结果(true)))

    expect(screen.getByRole('tab', { name: '技能序列' })).toBeTruthy()
    expect(screen.getByText('断潮可用时使用断潮，否则听雷-重')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '技能统计' }))
    expect(screen.getAllByText('云飞玉皇').length).toBeGreaterThan(0)
    expect(screen.getByText('2.5')).toBeTruthy()
    expect(screen.getByText('当前配置已变化，请重新搜索')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /应用为当前循环/ }).disabled).toBe(
      true,
    )
  })

  it('应用当前配置的结果后关闭弹窗', () => {
    const client = 创建客户端()
    const props = 创建属性(client)
    render(<OptimalSequenceModal {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /开始搜索/ }))
    act(() => client.回调?.完成?.(创建Worker结果(false)))
    fireEvent.click(screen.getByRole('button', { name: /应用为当前循环/ }))

    expect(props.应用结果).toHaveBeenCalledWith(
      expect.objectContaining({ 配置指纹: 'fingerprint-1' }),
    )
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('Worker 同步启动失败后恢复为可重新开始状态', () => {
    const client = 创建客户端()
    client.开始.mockImplementationOnce(() => {
      throw new Error('Worker 创建失败')
    })
    render(<OptimalSequenceModal {...创建属性(client)} />)

    fireEvent.click(screen.getByRole('button', { name: /开始搜索/ }))

    expect(screen.getByText('Worker 创建失败')).toBeTruthy()
    expect(screen.getByRole('button', { name: /开始搜索/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /停止搜索/ })).toBeNull()
  })

  it('搜索完成后修改战斗时长会阻止应用旧结果', () => {
    const client = 创建客户端()
    render(<OptimalSequenceModal {...创建属性(client)} />)

    fireEvent.click(screen.getByRole('button', { name: /开始搜索/ }))
    act(() => client.回调?.完成?.(创建Worker结果(false)))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '300' } })

    expect(screen.getByText('当前配置已变化，请重新搜索')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /应用为当前循环/ }).disabled).toBe(
      true,
    )
  })
})

describe('问水诀最优序列控制器', () => {
  it('从当前配置生成可克隆的确定性 Worker 搜索任务', () => {
    const input = {
      战斗时间: 10,
      加速值: 9232,
      网络延迟: 1,
      奇穴: ['怜光', '碧归'],
      秘籍: { 夕照雷峰: ['5%伤害'] },
      团队增益轴: {},
      武器类型: '橙武' as const,
      配置指纹: 'fingerprint-1',
      计算单次伤害: (item) => ({ 伤害: item.技能名称.length * 100, 会心率: 0.37 }),
    }

    const task = 创建问水优化搜索任务(input)

    expect(task.战斗时间).toBe(10)
    expect(task.配置指纹).toBe('fingerprint-1')
    expect(task.搜索参数.初始状态).toMatchObject({ 结束帧: 160, 加速值: 9232, 网络延迟: 1 })
    expect(task.搜索参数.动作上下文).toEqual({ 奇穴: input.奇穴, 秘籍: input.秘籍 })
    expect(task.搜索参数.条件动作).toContainEqual({ 技能名称: '断潮' })
    expect(task.搜索参数.伤害表.length).toBeGreaterThan(0)
    expect(task.搜索参数.最大理论每帧伤害).toBeGreaterThan(0)
    expect(task.搜索参数.会心率).toBe(0.37)
    expect(task.搜索参数.会心率映射?.['听雷-轻']).toBe(0.37)
    expect(task.搜索参数.会心率映射?.['云飞玉皇']).toBe(0.37)
    expect(() => JSON.parse(JSON.stringify(task))).not.toThrow()
  })

  it('配置指纹不受对象键顺序影响', () => {
    expect(创建问水配置指纹({ b: 2, a: { d: 4, c: 3 } })).toBe(
      创建问水配置指纹({ a: { c: 3, d: 4 }, b: 2 }),
    )
  })

  it('用当前问水诀默认配置生成真实伤害快照', async () => {
    await 初始化心法数据('问水诀')
    const cycle = 心法配置.计算循环.find((item) => item.名称 === '叠锋意斩岳循环')
    const data = {
      网络延迟: 1,
      装备信息: 心法配置.默认数据.配装,
      当前输出计算目标名称: '134级木桩',
      增益启用: false,
      增益数据: { 阵眼: '', 小吃: [], 团队增益: [] },
      当前奇穴信息: cycle?.奇穴 || [],
      当前秘籍信息: 心法配置.默认数据.秘籍,
      当前计算循环名称: cycle?.名称 || '',
      自定义循环列表: [],
      团队增益轴: 默认团队增益轴,
      当前计算结果: { 秒伤: 0, 总伤: 0, 秒伤计算时间: 0, 计算结果技能列表: [] },
    } as any
    const dispatch = (action) =>
      typeof action === 'function' ? action(undefined, () => ({ data })) : action

    const task = 创建当前问水搜索任务({ data, dispatch, 战斗时间: 1 })

    expect(task.搜索参数.伤害表.length).toBeGreaterThan(10)
    expect(task.搜索参数.初始状态.待生效事件).toEqual([])
    expect(task.搜索参数.伤害表.every((item) => Number.isFinite(item.单次施放伤害))).toBe(true)
    ;['黄龙吐翠', '平湖断月', '九溪弥烟-轻'].forEach((技能名称) => {
      expect(
        task.搜索参数.伤害表.find((item) => item.技能名称 === 技能名称)?.单次施放伤害,
      ).toBeGreaterThan(0)
    })
    const testTask = {
      ...task,
      搜索参数: { ...task.搜索参数, Beam宽度: 8, 扩展预算: 50 },
    }
    const result = await 运行问水分块搜索({
      搜索参数: testTask.搜索参数,
      每块扩展数: 50,
      紧急上限毫秒: 60_000,
      获取当前时间: () => 0,
      让出事件循环: async () => undefined,
    })
    const display = 转换当前问水搜索结果(result, testTask, { data, dispatch })
    const official = dispatch(
      秒伤计算({
        更新计算循环详情: {
          战斗时间: display.战斗时间,
          技能详情: display.技能详情,
        },
        更新循环技能列表: display.技能详情,
        更新计算时间: display.战斗时间,
        更新奇穴数据: data.当前奇穴信息,
        更新秘籍信息: data.当前秘籍信息,
        计算技能详情: true,
      }),
    )
    expect(result.成功).toBe(true)
    expect(display.技能详情.length).toBeGreaterThan(0)
    expect(Number.isFinite(display.预期DPS)).toBe(true)
    expect(display.预期DPS).toBe(official.秒伤)
  })
})

const 创建客户端 = () => {
  const client = {
    回调: undefined as any,
    开始: jest.fn((_params, callbacks) => {
      client.回调 = callbacks
      return 'task-1'
    }),
    取消: jest.fn(),
    销毁: jest.fn(),
  }
  return client
}

const 创建属性 = (client: ReturnType<typeof 创建客户端>, options?: { 当前指纹?: string }) => {
  let 当前循环 = '原循环'
  return {
    open: true,
    onClose: jest.fn(),
    初始战斗时间: 220,
    当前DPS: 900,
    创建客户端: () => client,
    创建任务: jest.fn((战斗时间: number) => ({
      搜索参数: {} as any,
      每块扩展数: 100,
      紧急上限毫秒: 60_000,
      战斗时间,
      配置指纹: 'fingerprint-1',
    })),
    转换结果: jest.fn(() => 创建展示结果()),
    获取当前配置指纹: () => options?.当前指纹 || 'fingerprint-1',
    应用结果: jest.fn((_result: 问水优化展示结果) => {
      当前循环 = '最优序列-220s'
    }),
    读取当前循环: () => 当前循环,
  }
}

const 创建Worker结果 = (提前结束: boolean) =>
  ({
    成功: true,
    最佳候选: {
      主序列: ['听雷-轻', '啸日', '云飞玉皇'],
      条件规则: [{ 技能名称: '断潮', 回退动作: '听雷-重' }],
      分支: [],
      期望总伤: 220_000,
      乐观上界: 220_000,
      稳定序号: 1,
    },
    扩展节点数: 100,
    结束原因: 提前结束 ? '用户取消' : '确定性预算',
    是否提前结束: 提前结束,
    workerElapsedMs: 1200,
  }) as any

const 创建展示结果 = (): 问水优化展示结果 => ({
  战斗时间: 220,
  配置指纹: 'fingerprint-1',
  技能序列: ['听雷-轻', '啸日', '云飞玉皇'],
  条件规则: [{ 技能名称: '断潮', 回退动作: '听雷-重' }],
  技能详情: [
    { 技能名称: '云飞玉皇', 技能数量: 2.5 },
    { 技能名称: '断潮', 技能数量: 0.75 },
  ],
  预期DPS: 1000,
  搜索耗时: 1200,
  扩展节点数: 100,
  扩展预算: 100,
  提前结束: true,
  结束原因: '用户取消',
})
