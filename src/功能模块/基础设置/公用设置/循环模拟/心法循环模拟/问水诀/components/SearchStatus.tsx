import React from 'react'
import { Progress } from 'antd'
import styles from './OptimalSequenceModal/index.module.less'

interface SearchStatusProps {
  扩展节点数: number
  扩展预算: number
  当前最佳伤害: number
  战斗时间: number
  当前DPS: number
  已用毫秒: number
}

const 格式化DPS = (value: number) => Math.round(value).toLocaleString()

function SearchStatus(props: SearchStatusProps) {
  const { 扩展节点数, 扩展预算, 当前最佳伤害, 战斗时间, 当前DPS, 已用毫秒 } = props
  const 当前最佳DPS = 战斗时间 > 0 ? 当前最佳伤害 / 战斗时间 : 0
  const 提升 = 当前DPS > 0 ? ((当前最佳DPS / 当前DPS - 1) * 100).toFixed(2) : undefined
  const percent = 扩展预算 > 0 ? Math.min(100, (扩展节点数 / 扩展预算) * 100) : 0

  return (
    <div className={styles.status} aria-label='搜索进度'>
      <Progress percent={percent} showInfo={false} size='small' />
      <div className={styles.metrics}>
        <span>
          扩展进度 <strong>{`${扩展节点数} / ${扩展预算}`}</strong>
        </span>
        <span>
          已用时间 <strong>{`${(已用毫秒 / 1000).toFixed(1)}s`}</strong>
        </span>
        <span>
          当前最佳 DPS <strong>{格式化DPS(当前最佳DPS)}</strong>
        </span>
        {提升 !== undefined ? (
          <span>
            相对当前循环 <strong>{`${Number(提升) >= 0 ? '+' : ''}${提升}%`}</strong>
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default React.memo(SearchStatus)
