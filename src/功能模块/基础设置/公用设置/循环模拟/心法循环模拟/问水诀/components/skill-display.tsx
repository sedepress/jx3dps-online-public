import React from 'react'
import styles from './OptimalSequenceModal/index.module.less'
import { 获取默认问水图标, 技能图标地址 } from './skill-icons'

export { 技能图标地址 } from './skill-icons'

interface 技能序列展示Props {
  技能序列: string[]
}

export const 技能序列展示 = ({ 技能序列 }: 技能序列展示Props) => (
  <div className={styles.sequenceFlow} aria-label='完整技能按键序列'>
    {技能序列.map((技能名称, index) => (
      <div className={styles.skillToken} key={`${技能名称}-${index}`}>
        <span className={styles.skillIndex}>{index + 1}</span>
        <img
          className={styles.skillIcon}
          src={技能图标地址(技能名称)}
          alt={技能名称}
          loading='lazy'
          onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = 获取默认问水图标()
          }}
        />
        <span className={styles.skillName}>{技能名称}</span>
      </div>
    ))}
  </div>
)
