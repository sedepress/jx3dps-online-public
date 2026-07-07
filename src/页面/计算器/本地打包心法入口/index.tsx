import 心法数据 from '@/数据/静态数据/心法数据.json'
import styles from './index.module.less'

const 可选心法名称 = '问水诀'

const 本地打包心法入口 = () => {
  const 切换至对应心法 = (目标心法简写) => {
    if (window) {
      // 兼容本地打包跳转
      const href = window.location.href
      const search = window.location.search
      const baseHref = href?.replace(search, '')
      const newHref = `${baseHref}?xf=${目标心法简写}`
      window.location.href = newHref
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.xfList}>
        {Object.values(心法数据)
          .filter((心法) => 心法?.名称 === 可选心法名称)
          .map((心法) => {
            return (
              <div
                className={styles.xf}
                key={心法?.简写}
                onClick={() => 切换至对应心法(心法?.简写)}
              >
                <img className={styles.xfIcon} src={心法?.系统配置?.心法图标} />
                {心法?.名称}
              </div>
            )
          })}
      </div>
    </div>
  )
}

export default 本地打包心法入口
