import React from 'react'
import { Alert, Tabs, Tag } from 'antd'
import { 循环技能详情 } from '@/@types/循环'
import { 问水搜索条件规则 } from '../search/exhaustive-oracle'
import styles from './OptimalSequenceModal/index.module.less'

export interface 问水优化展示结果 {
  战斗时间: number
  配置指纹: string
  技能序列: string[]
  条件规则: 问水搜索条件规则[]
  技能详情: 循环技能详情[]
  预期DPS: number
  搜索耗时: number
  扩展节点数: number
  扩展预算: number
  提前结束: boolean
  结束原因: string
}

interface SearchResultProps {
  结果: 问水优化展示结果
  配置已过期: boolean
}

const 格式化数量 = (value: number) => Number(value.toFixed(4)).toString()

const 条件规则文案 = (rule: 问水搜索条件规则) =>
  `断潮可用时使用${rule.技能名称}${rule.回退动作 ? `，否则${rule.回退动作}` : ''}`

const 技能序列 = ({ 结果 }: SearchResultProps) => (
  <div className={styles.sequencePanel}>
    <ol className={styles.sequenceList}>
      {结果.技能序列.map((skill, index) => (
        <li key={`${skill}-${index}`}>{skill}</li>
      ))}
    </ol>
    {结果.条件规则.length ? (
      <div className={styles.rules}>
        <h4>条件规则</h4>
        {结果.条件规则.map((rule, index) => (
          <p key={`${rule.技能名称}-${index}`}>{条件规则文案(rule)}</p>
        ))}
      </div>
    ) : null}
  </div>
)

const 技能统计 = ({ 结果 }: SearchResultProps) => (
  <div className={styles.statistics}>
    <div className={styles.statisticsHeader}>
      <span>技能</span>
      <span>期望数量</span>
    </div>
    {结果.技能详情.map((skill, index) => (
      <div className={styles.statisticsRow} key={`${skill.技能名称}-${index}`}>
        <span>{skill.技能名称}</span>
        <span>{格式化数量(skill.技能数量)}</span>
      </div>
    ))}
  </div>
)

function SearchResult(props: SearchResultProps) {
  const { 结果, 配置已过期 } = props
  return (
    <div className={styles.result}>
      <div className={styles.resultSummary}>
        <strong>{`${Math.round(结果.预期DPS).toLocaleString()} DPS`}</strong>
        <span>{`${结果.扩展节点数.toLocaleString()} 次扩展`}</span>
        <span>{`${(结果.搜索耗时 / 1000).toFixed(1)}s`}</span>
        {结果.提前结束 ? <Tag color='gold'>提前结束</Tag> : null}
      </div>
      {配置已过期 ? <Alert type='warning' showIcon message='当前配置已变化，请重新搜索' /> : null}
      <Tabs
        items={[
          { key: 'sequence', label: '技能序列', children: <技能序列 {...props} /> },
          { key: 'statistics', label: '技能统计', children: <技能统计 {...props} /> },
        ]}
      />
    </div>
  )
}

export default React.memo(SearchResult)
