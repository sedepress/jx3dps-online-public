import React from 'react'
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import 大附魔选择 from './index'

jest.mock('./index.css', () => ({}))

jest.mock('@/hooks', () => ({
  useAppDispatch: () => () => undefined,
  useAppSelector: () => ({ 秒伤: 0 }),
}))

jest.mock('@/数据/数据工具/获取当前数据', () => () => ({
  装备数据: {
    帽子: [
      { id: 35300, 装备品级: 35300 },
      { id: 35900, 装备品级: 35900 },
      { id: 41400, 装备品级: 41400 },
    ],
  },
}))

jest.mock('@/组件/图片展示', () => () => null)

const 创建表单 = (装备ID: number) => ({
  getFieldValue: () => ({ id: 装备ID }),
  getFieldsValue: () => ({ _1: { id: 装备ID } }),
})

describe('大附魔选择品级限制', () => {
  afterEach(() => cleanup())

  it('英雄品装备不能选择普通大附魔', async () => {
    render(<大附魔选择 type='帽' 开启装备智能对比={false} form={创建表单(41400)} />)

    fireEvent.mouseDown(screen.getByRole('combobox'))

    expect(await screen.findByText('英雄·帽')).toBeTruthy()
    expect(screen.queryByText('普通·帽')).toBeNull()
  })

  it('低品装备可以选择普通或英雄大附魔', async () => {
    render(<大附魔选择 type='帽' 开启装备智能对比={false} form={创建表单(35300)} />)

    fireEvent.mouseDown(screen.getByRole('combobox'))

    expect(await screen.findByText('普通·帽')).toBeTruthy()
    expect(screen.getByText('英雄·帽')).toBeTruthy()
  })

  it('35900 边界装备可选择普通或英雄大附魔', async () => {
    render(<大附魔选择 type='帽' 开启装备智能对比={false} form={创建表单(35900)} />)

    fireEvent.mouseDown(screen.getByRole('combobox'))

    expect(await screen.findByText('普通·帽')).toBeTruthy()
    expect(screen.getByText('英雄·帽')).toBeTruthy()
  })
})
