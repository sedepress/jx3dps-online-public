import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, jest } from '@jest/globals'
import 循环模拟 from './index'

jest.mock('@/数据/数据工具/获取当前数据', () => ({
  __esModule: true,
  default: () => ({ 名称: '无方', 缓存映射: {} }),
}))

jest.mock('./心法循环模拟/问水诀/components/OptimalSequenceModal', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('./心法循环模拟/问水诀/worker/client', () => ({
  创建问水搜索客户端: () => undefined,
}))

jest.mock('./心法循环模拟/问水诀/components/adapter', () => ({
  创建当前问水搜索任务: () => undefined,
  应用当前问水搜索结果: () => undefined,
  获取当前问水配置指纹: () => undefined,
  转换当前问水搜索结果: () => undefined,
}))

jest.mock('@/hooks', () => {
  const state = {
    data: {
      装备信息: { 装备基础属性: {}, 装备增益: {} },
      网络延迟: 0,
      当前奇穴信息: [],
      当前秘籍信息: {},
      增益启用: false,
      增益数据: {},
    },
  }
  return {
    useAppDispatch: () => () => undefined,
    useAppSelector: (selector) => selector(state),
  }
})

describe('循环模拟入口', () => {
  it('非问水诀心法保留原循环模拟按钮', () => {
    render(<循环模拟 />)

    expect((screen.getByRole('button', { name: '循环模拟' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })
})
