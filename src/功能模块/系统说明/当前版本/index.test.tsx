import React from 'react'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import 当前版本 from './index'

const mockDispatch = jest.fn()

jest.mock('./index.css', () => ({}))
jest.mock('./计算记录对比', () => () => null)

jest.mock('@/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}))

jest.mock('@/store/system', () => ({
  更新当前引导步骤: (payload) => ({ type: 'system/更新当前引导步骤', payload }),
  更新新手引导流程状态: (payload) => ({ type: 'system/更新新手引导流程状态', payload }),
}))

jest.mock('@/数据/数据工具/获取当前数据', () => () => ({
  缓存映射: {
    日志版本: '日志版本',
    使用说明: '使用说明',
    新手引导: '新手引导',
  },
}))

jest.mock('@/更新日志', () => [
  {
    version: 'test-version',
    date: '2026-07-10',
    content: [],
  },
])

describe('首次进入网页的新手引导', () => {
  beforeEach(() => {
    localStorage.clear()
    mockDispatch.mockClear()
  })

  afterEach(() => cleanup())

  it('关闭首次使用声明后不自动开启新手引导', async () => {
    render(<当前版本 />)

    fireEvent.click(
      await screen.findByRole('button', { name: '使用本计算器则视作你已经知晓并同意此声明。' }),
    )

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('关闭版本公告后不自动开启新手引导', async () => {
    localStorage.setItem('使用说明', '1')
    render(<当前版本 />)

    fireEvent.click(await screen.findByRole('button', { name: '知道了' }))

    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
