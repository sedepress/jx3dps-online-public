import React, { useState } from 'react'
import 获取当前数据 from '@/数据/数据工具/获取当前数据'
import { useAppSelector } from '@/hooks'
import 心法数据 from '@/数据/静态数据/心法数据.json'
import 心法切换弹窗 from './心法切换弹窗'

import './index.css'

const 当前数据 = 获取当前数据()
const 可选心法名称 = '问水诀'
const 可选心法数量 = Object.values(心法数据).filter(
  (心法: any) => 心法?.名称 === 可选心法名称,
).length

function 心法切换() {
  const 新手引导流程状态 = useAppSelector((state) => state.system.新手引导流程状态)
  const 当前Logo = 当前数据?.系统配置?.心法图标
  const [心法切换弹窗展示, 设置心法切换弹窗展示] = useState(false)
  const 允许切换心法 = 可选心法数量 > 1

  return (
    <div className='school-switch'>
      {/* <Dropdown overlay={menu} disabled={新手引导流程状态}> */}
      <img
        id='Guide_16'
        src={当前Logo}
        className={`school-switch-img ${允许切换心法 ? '' : 'school-switch-img-disabled'}`}
        aria-disabled={!允许切换心法 || 新手引导流程状态}
        onClick={() => {
          if (新手引导流程状态 || !允许切换心法) {
            return
          }
          设置心法切换弹窗展示(true)
        }}
      />
      {允许切换心法 ? (
        <心法切换弹窗 open={心法切换弹窗展示} onCancel={() => 设置心法切换弹窗展示(false)} />
      ) : null}
      {/* </Dropdown> */}
      {/* {当前数据?.心法所属端 === '无界' ? <div className='school-switch-wujie-bg' /> : null} */}
    </div>
  )
}

export default 心法切换
