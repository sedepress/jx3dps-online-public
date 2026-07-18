import React from 'react'
import styles from './OptimalSequenceModal/index.module.less'

const 技能图标ID: Record<string, number> = {
  莺鸣柳: 2388,
  啸日: 2369,
  听雷: 2363,
  '听雷-轻': 2363,
  '听雷-重': 2363,
  黄龙吐翠: 2386,
  平湖断月: 2383,
  九溪弥烟: 2384,
  '九溪弥烟-轻': 2384,
  夕照雷峰: 2372,
  云飞玉皇: 2370,
  '云飞玉皇·二段': 2370,
  '云景·云飞玉皇': 2370,
  鹤归孤山: 2371,
  '鹤归孤山·山倾': 2371,
  风来吴山: 2375,
  峰插云景: 2374,
}

export const 技能图标地址 = (技能名称: string) =>
  技能图标ID[技能名称]
    ? `https://icon.jx3box.com/icon/${技能图标ID[技能名称]}.png`
    : 'https://img.jx3box.com/image/xf/10144.png'

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
            event.currentTarget.src = 'https://img.jx3box.com/image/xf/10144.png'
          }}
        />
        <span className={styles.skillName}>{技能名称}</span>
      </div>
    ))}
  </div>
)
