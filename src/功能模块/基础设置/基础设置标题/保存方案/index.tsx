import { Button } from 'antd'
import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { 方案数据类型 } from '@/@types/方案'
import { 更新全部方案数据, 更新当前方案名称 } from '@/store/data'
import SaveCustomProjectModal from './SaveCustomProjectModal'

function SaveProject() {
  const [自定义方案保存弹窗, 设置自定义方案保存弹窗] = useState<boolean>(false)
  const 装备信息 = useAppSelector((state) => state.data.装备信息)
  const 当前计算循环名称 = useAppSelector((state) => state.data.当前计算循环名称)
  const 当前战斗时间 = useAppSelector((state) => state.data.当前战斗时间)
  const 当前奇穴信息 = useAppSelector((state) => state.data.当前奇穴信息)
  const 当前秘籍信息 = useAppSelector((state) => state.data.当前秘籍信息)
  const 增益启用 = useAppSelector((state) => state.data.增益启用)
  const 增益数据 = useAppSelector((state) => state.data.增益数据)
  const 全部方案数据 = useAppSelector((state) => state.data.全部方案数据)
  const dispatch = useAppDispatch()

  const 保存方案 = (名称) => {
    const 新方案: 方案数据类型 = {
      方案名称: 名称,
      装备信息,
      当前计算循环名称,
      当前战斗时间,
      当前奇穴信息,
      当前秘籍信息,
      增益启用,
      增益数据,
    }
    const 新全部方案数据 = { ...全部方案数据 }
    新全部方案数据[名称] = 新方案

    dispatch(更新当前方案名称(名称))
    dispatch(更新全部方案数据(新全部方案数据))
    设置自定义方案保存弹窗(false)
  }
  return (
    <>
      <Button
        size='small'
        className={'common-title-project'}
        onClick={() => 设置自定义方案保存弹窗(true)}
        id='Guide_10'
      >
        保存方案
      </Button>
      <SaveCustomProjectModal
        自定义方案保存弹窗={自定义方案保存弹窗}
        设置自定义方案保存弹窗={设置自定义方案保存弹窗}
        保存自定义方案={保存方案}
      />
    </>
  )
}

export default SaveProject
