import React from 'react'
import 当前版本 from './当前版本'
import 获取当前数据 from '@/数据/数据工具/获取当前数据'
import styles from './index.module.less'
import './index.css'

const { 模块负责人 } = 获取当前数据()

function 顶部说明() {
  return (
    <>
      <h1 className={'title-tip'}>
        <span className={styles.label}>模块负责人：{模块负责人 || '-'}；</span>
      </h1>
      <当前版本 />
    </>
  )
}

export default 顶部说明
