import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, jest } from '@jest/globals'
import { 技能序列展示 } from './skill-display'

jest.mock('./OptimalSequenceModal/index.module.less', () => new Proxy({}, { get: (_, key) => key }))

describe('问水技能序列展示', () => {
  it('按顺序展示技能名称、编号和技能图标', () => {
    render(<技能序列展示 技能序列={['听雷-轻', '夕照雷峰', '未知技能']} />)

    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('听雷-轻')).toBeTruthy()
    expect(screen.getByText('夕照雷峰')).toBeTruthy()
    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.getByRole('img', { name: '听雷-轻' }).getAttribute('src')).toBe(
      'https://icon.jx3box.com/icon/2363.png',
    )
    expect(screen.getByRole('img', { name: '未知技能' }).getAttribute('src')).toBe(
      'https://img.jx3box.com/image/xf/10144.png',
    )
  })
})
