import { createCommentVNode, defineComponent, TransitionGroup, h, ref, Ref, PropType, inject, nextTick, ComputedRef, onBeforeUnmount, onMounted, onUnmounted } from 'vue'
import XEUtils from 'xe-utils'
import { VxeUI } from '../../ui'
import { mergeBodyMethod, getRowid, getRefElem } from './util'
import { updateCellTitle, getPropClass, setScrollTop, setScrollLeft } from '../../ui/src/dom'
import { isEnableConf } from '../../ui/src/utils'
import { getSlotVNs } from '../../ui/src/vn'

import type { VxeTablePrivateMethods, VxeTableConstructor, VxeTableDefines, VxeTableMethods, VxeComponentSlotType, VxeComponentSizeType } from '../../../types'

const { getI18n, renderer, renderEmptyElement } = VxeUI

const renderType = 'body'

const lineOffsetSizes = {
  mini: 3,
  small: 2,
  medium: 1
}

export default defineComponent({
  name: 'VxeTableBody',
  props: {
    tableData: Array as PropType<any[]>,
    tableColumn: Array as PropType<VxeTableDefines.ColumnInfo[]>,
    fixedColumn: Array as PropType<VxeTableDefines.ColumnInfo[]>,
    fixedType: {
      type: String as PropType<'right' | 'left' | ''>,
      default: ''
    }
  },
  setup (props) {
    const $xeTable = inject('$xeTable', {} as VxeTableConstructor & VxeTableMethods & VxeTablePrivateMethods)

    const xesize = inject('xesize', null as ComputedRef<VxeComponentSizeType> | null)

    const { xID, props: tableProps, context: tableContext, reactData: tableReactData, internalData: tableInternalData } = $xeTable
    const { refTableBody, refTableHeader, refTableFooter, refTableLeftBody, refTableRightBody, refScrollXHandleElem, refScrollYHandleElem } = $xeTable.getRefMaps()
    const { computeEditOpts, computeMouseOpts, computeAreaOpts, computeSYOpts, computeEmptyOpts, computeKeyboardOpts, computeTooltipOpts, computeRadioOpts, computeExpandOpts, computeTreeOpts, computeCheckboxOpts, computeCellOpts, computeValidOpts, computeRowOpts, computeColumnOpts } = $xeTable.getComputeMaps()

    const refElem = ref() as Ref<HTMLDivElement>
    const refBodyTable = ref() as Ref<HTMLTableElement>
    const refBodyColgroup = ref() as Ref<HTMLTableColElement>
    const refBodyTBody = ref() as Ref<HTMLTableSectionElement>
    const refBodyXSpace = ref() as Ref<HTMLDivElement>
    const refBodyYSpace = ref() as Ref<HTMLDivElement>
    const refBodyEmptyBlock = ref() as Ref<HTMLDivElement>

    const getOffsetSize = () => {
      if (xesize) {
        const vSize = xesize.value
        if (vSize) {
          return lineOffsetSizes[vSize] || 0
        }
      }
      return 0
    }

    // 滚动、拖动过程中不需要触发
    const isVMScrollProcess = () => {
      const { delayHover } = tableProps
      const { lastScrollTime, _isResize } = tableReactData
      return !!(_isResize || (lastScrollTime && Date.now() < lastScrollTime + (delayHover as number)))
    }

    const countTreeExpand = (prevRow: any, params: any) => {
      let count = 1
      if (!prevRow) {
        return count
      }
      const treeOpts = computeTreeOpts.value
      const childrenField = treeOpts.children || treeOpts.childrenField
      const rowChildren = prevRow[childrenField]
      if (rowChildren && $xeTable.isTreeExpandByRow(prevRow)) {
        for (let index = 0; index < rowChildren.length; index++) {
          count += countTreeExpand(rowChildren[index], params)
        }
      }
      return count
    }

    const calcTreeLine = (params: any, items: any[], rIndex: number) => {
      let expandSize = 1
      if (rIndex) {
        expandSize = countTreeExpand(items[rIndex - 1], params)
      }
      return tableReactData.rowHeight * expandSize - (rIndex ? 1 : (12 - getOffsetSize()))
    }

    const renderLine = (params: any) => {
      const { row, column } = params
      const { afterFullData } = tableInternalData
      const { treeConfig } = tableProps
      const treeOpts = computeTreeOpts.value
      const { slots, treeNode } = column
      const { fullAllDataRowIdData } = tableInternalData
      const rowid = getRowid($xeTable, row)
      const rest = fullAllDataRowIdData[rowid]
      let rLevel = 0
      let rIndex = 0
      let items: any[] = []
      if (rest) {
        rLevel = rest.level
        rIndex = rest._index
        items = rest.items
      }
      if (slots && slots.line) {
        return $xeTable.callSlot(slots.line, params)
      }
      const isFirstRow = $xeTable.eqRow(afterFullData[0], row)
      if (treeConfig && treeNode && (treeOpts.showLine || treeOpts.line)) {
        return [
          h('div', {
            class: 'vxe-tree--line-wrapper'
          }, [
            h('div', {
              class: 'vxe-tree--line',
              style: {
                height: `${isFirstRow ? 1 : calcTreeLine(params, items, rIndex)}px`,
                left: `${(rLevel * treeOpts.indent) + (rLevel ? 2 - getOffsetSize() : 0) + 16}px`
              }
            })
          ])
        ]
      }
      return []
    }

    /**
     * 渲染列
     */
    const renderColumn = (seq: number | string, rowid: string, fixedType: any, rowLevel: number, row: any, rowIndex: number, $rowIndex: number, _rowIndex: number, column: any, $columnIndex: number, columns: any, items: any[]) => {
      const { fullAllDataRowIdData } = tableInternalData
      const { columnKey, height, showOverflow: allColumnOverflow, cellClassName: allCellClassName, cellStyle, align: allAlign, spanMethod, mouseConfig, editConfig, editRules, tooltipConfig } = tableProps
      const { tableData, overflowX, currentColumn, scrollXLoad, scrollYLoad, mergeList, editStore, isAllOverflow, validErrorMaps } = tableReactData
      const { afterFullData } = tableInternalData
      const cellOpts = computeCellOpts.value
      const validOpts = computeValidOpts.value
      const checkboxOpts = computeCheckboxOpts.value
      const editOpts = computeEditOpts.value
      const tooltipOpts = computeTooltipOpts.value
      const rowOpts = computeRowOpts.value
      const sYOpts = computeSYOpts.value
      const columnOpts = computeColumnOpts.value
      const mouseOpts = computeMouseOpts.value
      const areaOpts = computeAreaOpts.value
      const { selectCellToRow } = areaOpts
      const { type, cellRender, editRender, align, showOverflow, className, treeNode, slots } = column
      const { verticalAlign } = cellOpts
      const { actived } = editStore
      const { rHeight: scrollYRHeight } = sYOpts
      const { height: rowHeight } = rowOpts
      const colid = column.id
      const renderOpts = editRender || cellRender
      const compConf = renderOpts ? renderer.get(renderOpts.name) : null
      const compCellClassName = compConf ? (compConf.tableCellClassName || compConf.cellClassName) : null
      const compCellStyle = compConf ? (compConf.tableCellStyle || compConf.cellStyle) : ''
      const showAllTip = tooltipOpts.showAll
      const columnIndex = $xeTable.getColumnIndex(column)
      const _columnIndex = $xeTable.getVTColumnIndex(column)
      const isEdit = isEnableConf(editRender)
      let fixedHiddenColumn = fixedType ? column.fixed !== fixedType : column.fixed && overflowX
      const cellOverflow = (XEUtils.isUndefined(showOverflow) || XEUtils.isNull(showOverflow)) ? allColumnOverflow : showOverflow
      const showEllipsis = cellOverflow === 'ellipsis'
      const showTitle = cellOverflow === 'title'
      const showTooltip = cellOverflow === true || cellOverflow === 'tooltip'
      const hasEllipsis = showTitle || showTooltip || showEllipsis
      let isDirty
      const tdOns: any = {}
      const rest = fullAllDataRowIdData[rowid]
      const cellAlign = align || (compConf ? compConf.tableCellAlign : '') || allAlign
      const errorValidItem = validErrorMaps[`${rowid}:${colid}`]
      const showValidTip = editRules && validOpts.showMessage && (validOpts.message === 'default' ? (height || tableData.length > 1) : validOpts.message === 'inline')
      const attrs: any = { colid }
      const params: VxeTableDefines.CellRenderBodyParams = {
        $table: $xeTable,
        $grid: $xeTable.xegrid,
        isEdit: false,
        seq,
        rowid,
        row,
        rowIndex,
        $rowIndex,
        _rowIndex,
        column,
        columnIndex,
        $columnIndex,
        _columnIndex,
        fixed: fixedType,
        type: renderType,
        isHidden: fixedHiddenColumn,
        level: rowLevel,
        visibleData: afterFullData,
        data: tableData,
        items
      }
      // hover 进入事件
      if (showTitle || showTooltip || showAllTip || tooltipConfig) {
        tdOns.onMouseenter = (evnt: MouseEvent) => {
          if (isVMScrollProcess()) {
            return
          }
          if (showTitle) {
            updateCellTitle(evnt.currentTarget, column)
          } else if (showTooltip || showAllTip) {
            // 如果配置了显示 tooltip
            $xeTable.triggerBodyTooltipEvent(evnt, params)
          }
          $xeTable.dispatchEvent('cell-mouseenter', Object.assign({ cell: evnt.currentTarget }, params), evnt)
        }
      }
      // hover 退出事件
      if (showTooltip || showAllTip || tooltipConfig) {
        tdOns.onMouseleave = (evnt: MouseEvent) => {
          if (isVMScrollProcess()) {
            return
          }
          if (showTooltip || showAllTip) {
            $xeTable.handleTargetLeaveEvent(evnt)
          }
          $xeTable.dispatchEvent('cell-mouseleave', Object.assign({ cell: evnt.currentTarget }, params), evnt)
        }
      }
      // 按下事件处理
      if (checkboxOpts.range || mouseConfig) {
        tdOns.onMousedown = (evnt: MouseEvent) => {
          $xeTable.triggerCellMousedownEvent(evnt, params)
        }
      }
      // 点击事件处理
      tdOns.onClick = (evnt: MouseEvent) => {
        $xeTable.triggerCellClickEvent(evnt, params)
      }
      // 双击事件处理
      tdOns.onDblclick = (evnt: MouseEvent) => {
        $xeTable.triggerCellDblclickEvent(evnt, params)
      }
      // 合并行或列
      if (mergeList.length) {
        const spanRest = mergeBodyMethod(mergeList, _rowIndex, _columnIndex)
        if (spanRest) {
          const { rowspan, colspan } = spanRest
          if (!rowspan || !colspan) {
            return null
          }
          if (rowspan > 1) {
            attrs.rowspan = rowspan
          }
          if (colspan > 1) {
            attrs.colspan = colspan
          }
        }
      } else if (spanMethod) {
        // 自定义合并行或列的方法
        const { rowspan = 1, colspan = 1 } = spanMethod(params) || {}
        if (!rowspan || !colspan) {
          return null
        }
        if (rowspan > 1) {
          attrs.rowspan = rowspan
        }
        if (colspan > 1) {
          attrs.colspan = colspan
        }
      }
      // 如果被合并不可隐藏
      if (fixedHiddenColumn && mergeList) {
        if (attrs.colspan > 1 || attrs.rowspan > 1) {
          fixedHiddenColumn = false
        }
      }
      // 如果编辑列开启显示状态
      if (!fixedHiddenColumn && editConfig && (editRender || cellRender) && (editOpts.showStatus || editOpts.showUpdateStatus)) {
        isDirty = $xeTable.isUpdateByRow(row, column.field)
      }
      const tdVNs: any[] = []
      if (fixedHiddenColumn && (allColumnOverflow ? isAllOverflow : allColumnOverflow)) {
        tdVNs.push(
          h('div', {
            class: ['vxe-cell', {
              'c--title': showTitle,
              'c--tooltip': showTooltip,
              'c--ellipsis': showEllipsis
            }],
            style: {
              maxHeight: hasEllipsis && (scrollYRHeight || rowHeight) ? `${scrollYRHeight || rowHeight}px` : ''
            }
          })
        )
      } else {
        // 渲染单元格
        tdVNs.push(
          ...renderLine(params),
          h('div', {
            class: ['vxe-cell', {
              'c--title': showTitle,
              'c--tooltip': showTooltip,
              'c--ellipsis': showEllipsis
            }],
            style: {
              maxHeight: hasEllipsis && (scrollYRHeight || rowHeight) ? `${scrollYRHeight || rowHeight}px` : ''
            },
            title: showTitle ? $xeTable.getCellLabel(row, column) : null
          }, column.renderCell(params))
        )
        if (showValidTip && errorValidItem) {
          const errRule = errorValidItem.rule
          const validSlot = slots ? slots.valid : null
          const validParams = { ...params, ...errorValidItem, rule: errorValidItem }
          tdVNs.push(
            h('div', {
              class: ['vxe-cell--valid-error-tip', getPropClass(validOpts.className, validParams)],
              style: errRule && errRule.maxWidth
                ? {
                    width: `${errRule.maxWidth}px`
                  }
                : null
            }, [
              h('div', {
                class: `vxe-cell--valid-error-wrapper vxe-cell--valid-error-theme-${validOpts.theme || 'normal'}`
              }, [
                validSlot
                  ? $xeTable.callSlot(validSlot, validParams)
                  : [
                      h('span', {
                        class: 'vxe-cell--valid-error-msg'
                      }, errorValidItem.content)
                    ]
              ])
            ])
          )
        }
      }
      let cellHeight = ''
      if (hasEllipsis && (scrollYRHeight || rowHeight)) {
        cellHeight = `${scrollYRHeight || rowHeight}px`
      } else if (scrollXLoad || scrollYLoad) {
        if (!hasEllipsis) {
          cellHeight = `${rest.height || 24}px`
        }
      }

      if (mouseConfig && mouseOpts.area && selectCellToRow) {
        if (
          (!$columnIndex && selectCellToRow === true) ||
          (selectCellToRow === column.field)
        ) {
          tdVNs.push(
            h('div', {
              class: 'vxe-cell--area-status'
            })
          )
        }
      }

      return h('td', {
        class: [
          'vxe-body--column',
          colid,
          {
            [`col--${cellAlign}`]: cellAlign,
            [`col--vertical-${verticalAlign}`]: verticalAlign,
            [`col--${type}`]: type,
            'col--last': $columnIndex === columns.length - 1,
            'col--tree-node': treeNode,
            'col--edit': isEdit,
            'col--ellipsis': hasEllipsis,
            'fixed--hidden': fixedHiddenColumn,
            'col--dirty': isDirty,
            'col--active': editConfig && isEdit && (actived.row === row && (actived.column === column || editOpts.mode === 'row')),
            'col--valid-error': !!errorValidItem,
            'col--current': currentColumn === column
          },
          getPropClass(compCellClassName, params),
          getPropClass(className, params),
          getPropClass(allCellClassName, params)
        ],
        key: columnKey || columnOpts.useKey || rowOpts.useKey || columnOpts.drag ? colid : $columnIndex,
        ...attrs,
        style: Object.assign({
          height: cellHeight
        }, XEUtils.isFunction(compCellStyle) ? compCellStyle(params) : compCellStyle, XEUtils.isFunction(cellStyle) ? cellStyle(params) : cellStyle),
        ...tdOns
      }, tdVNs)
    }

    const renderRows = (fixedType: any, tableData: any, tableColumn: any) => {
      const { stripe, rowKey, highlightHoverRow, rowClassName, rowStyle, showOverflow: allColumnOverflow, editConfig, treeConfig } = tableProps
      const { hasFixedColumn, treeExpandedMaps, scrollYLoad, rowExpandedMaps, expandColumn, selectRadioRow, pendingRowMaps, pendingRowList, isDragColMove } = tableReactData
      const { fullAllDataRowIdData } = tableInternalData
      const checkboxOpts = computeCheckboxOpts.value
      const radioOpts = computeRadioOpts.value
      const treeOpts = computeTreeOpts.value
      const editOpts = computeEditOpts.value
      const rowOpts = computeRowOpts.value
      const columnOpts = computeColumnOpts.value
      const { transform } = treeOpts
      const childrenField = treeOpts.children || treeOpts.childrenField
      const rows: any[] = []
      tableData.forEach((row: any, $rowIndex: any) => {
        const trOn: any = {}
        let rowIndex = $rowIndex
        // 确保任何情况下 rowIndex 都精准指向真实 data 索引
        rowIndex = $xeTable.getRowIndex(row)
        // 当前行事件
        if (rowOpts.isHover || highlightHoverRow) {
          trOn.onMouseenter = (evnt: any) => {
            if (isVMScrollProcess()) {
              return
            }
            $xeTable.triggerHoverEvent(evnt, { row, rowIndex })
          }
          trOn.onMouseleave = () => {
            if (isVMScrollProcess()) {
              return
            }
            $xeTable.clearHoverRow()
          }
        }
        const rowid = getRowid($xeTable, row)
        const rest = fullAllDataRowIdData[rowid]
        let rowLevel = 0
        let seq: string | number = -1
        let _rowIndex = 0
        if (rest) {
          rowLevel = rest.level
          seq = rest.seq
          _rowIndex = rest._index
        }
        const params = { $table: $xeTable, seq, rowid, fixed: fixedType, type: renderType, level: rowLevel, row, rowIndex, $rowIndex, _rowIndex }
        // 行是否被展开
        const isExpandRow = expandColumn && !!rowExpandedMaps[rowid]
        // 树节点是否被展开
        let isExpandTree = false
        let rowChildren = []
        // 处理新增状态
        let isNewRow = false
        if (editConfig) {
          isNewRow = $xeTable.isInsertByRow(row)
        }
        if (treeConfig && !scrollYLoad && !transform) {
          rowChildren = row[childrenField]
          isExpandTree = rowChildren && rowChildren.length > 0 && !!treeExpandedMaps[rowid]
        }
        // 拖拽行事件
        if (rowOpts.drag && !rowLevel) {
          trOn.onDragstart = $xeTable.handleRowDragDragstartEvent
          trOn.onDragend = $xeTable.handleRowDragDragendEvent
          trOn.onDragover = $xeTable.handleRowDragDragoverEvent
        }
        const trClass = [
          'vxe-body--row',
          treeConfig ? `row--level-${rowLevel}` : '',
          {
            'row--stripe': stripe && ($xeTable.getVTRowIndex(row) + 1) % 2 === 0,
            'is--new': isNewRow,
            'is--expand-row': isExpandRow,
            'is--expand-tree': isExpandTree,
            'row--new': isNewRow && (editOpts.showStatus || editOpts.showInsertStatus),
            'row--radio': radioOpts.highlight && $xeTable.eqRow(selectRadioRow, row),
            'row--checked': checkboxOpts.highlight && $xeTable.isCheckedByCheckboxRow(row),
            'row--pending': pendingRowList.length && !!pendingRowMaps[rowid]
          },
          getPropClass(rowClassName, params)
        ]
        const tdVNs = tableColumn.map((column: any, $columnIndex: any) => {
          return renderColumn(seq, rowid, fixedType, rowLevel, row, rowIndex, $rowIndex, _rowIndex, column, $columnIndex, tableColumn, tableData)
        })
        rows.push(
          columnOpts.drag
            ? h(TransitionGroup, {
              name: `vxe-header--col-list${isDragColMove ? '' : '-disabled'}`,
              tag: 'tr',
              class: trClass,
              rowid: rowid,
              style: rowStyle ? (XEUtils.isFunction(rowStyle) ? rowStyle(params) : rowStyle) : null,
              key: rowKey || rowOpts.useKey || rowOpts.drag || treeConfig ? rowid : $rowIndex,
              ...trOn
            }, {
              default: () => tdVNs
            })
            : h('tr', {
              class: trClass,
              rowid: rowid,
              style: rowStyle ? (XEUtils.isFunction(rowStyle) ? rowStyle(params) : rowStyle) : null,
              key: rowKey || rowOpts.useKey || rowOpts.drag || treeConfig ? rowid : $rowIndex,
              ...trOn
            }, tdVNs)
        )
        // 如果行被展开了
        if (isExpandRow) {
          const expandOpts = computeExpandOpts.value
          const { height: expandHeight, padding } = expandOpts
          const cellStyle: any = {}
          if (expandHeight) {
            cellStyle.height = `${expandHeight}px`
          }
          if (treeConfig) {
            cellStyle.paddingLeft = `${(rowLevel * treeOpts.indent) + 30}px`
          }
          const { showOverflow } = expandColumn
          const hasEllipsis = (XEUtils.isUndefined(showOverflow) || XEUtils.isNull(showOverflow)) ? allColumnOverflow : showOverflow
          const expandParams = { $table: $xeTable, seq, column: expandColumn, fixed: fixedType, type: renderType, level: rowLevel, row, rowIndex, $rowIndex, _rowIndex }
          rows.push(
            h('tr', {
              class: ['vxe-body--expanded-row', {
                'is--padding': padding
              }],
              key: `expand_${rowid}`,
              style: rowStyle ? (XEUtils.isFunction(rowStyle) ? rowStyle(expandParams) : rowStyle) : null,
              ...trOn
            }, [
              h('td', {
                class: {
                  'vxe-body--expanded-column': 1,
                  'fixed--hidden': fixedType && !hasFixedColumn,
                  'col--ellipsis': hasEllipsis
                },
                colspan: tableColumn.length
              }, [
                h('div', {
                  class: {
                    'vxe-body--expanded-cell': 1,
                    'is--ellipsis': expandHeight
                  },
                  style: cellStyle
                }, [
                  expandColumn.renderData(expandParams)
                ])
              ])
            ])
          )
        }
        // 如果是树形表格
        if (isExpandTree) {
          rows.push(...renderRows(fixedType, rowChildren, tableColumn))
        }
      })
      return rows
    }

    /**
     * 滚动处理
     * 如果存在列固定左侧，同步更新滚动状态
     * 如果存在列固定右侧，同步更新滚动状态
     */
    const scrollEvent = (evnt: Event) => {
      const { fixedType } = props
      const { lastScrollTop, lastScrollLeft, inVirtualScroll, inBodyScroll, bodyScrollType, inFooterScroll } = tableInternalData
      if (inVirtualScroll) {
        return
      }
      if (inFooterScroll) {
        return
      }
      if (inBodyScroll) {
        if (bodyScrollType !== fixedType) {
          return
        }
      }
      const tableHeader = refTableHeader.value
      const tableBody = refTableBody.value
      const tableFooter = refTableFooter.value
      const leftBody = refTableLeftBody.value
      const rightBody = refTableRightBody.value
      const scrollBodyElem = refElem.value
      const headerElem = tableHeader ? tableHeader.$el as HTMLDivElement : null
      const footerElem = tableFooter ? tableFooter.$el as HTMLDivElement : null
      const bodyElem = tableBody.$el as HTMLDivElement
      if (!bodyElem) {
        return
      }
      const leftElem = leftBody ? leftBody.$el as HTMLDivElement : null
      const rightElem = rightBody ? rightBody.$el as HTMLDivElement : null
      const xHandleEl = refScrollXHandleElem.value
      const yHandleEl = refScrollYHandleElem.value
      const scrollTop = scrollBodyElem.scrollTop
      const scrollLeft = bodyElem.scrollLeft
      const isRollX = scrollLeft !== lastScrollLeft
      const isRollY = scrollTop !== lastScrollTop
      tableInternalData.inBodyScroll = true
      tableInternalData.bodyScrollType = fixedType
      if (isRollY) {
        if (leftElem && fixedType === 'left') {
          setScrollTop(bodyElem, scrollTop)
          setScrollTop(rightElem, scrollTop)
        } else if (rightElem && fixedType === 'right') {
          setScrollTop(bodyElem, scrollTop)
          setScrollTop(leftElem, scrollTop)
        } else {
          setScrollTop(leftElem, scrollTop)
          setScrollTop(rightElem, scrollTop)
        }
        setScrollTop(yHandleEl, scrollTop)
        $xeTable.triggerScrollYEvent(evnt)
      }
      if (isRollX) {
        setScrollLeft(xHandleEl, scrollLeft)
        setScrollLeft(headerElem, scrollLeft)
        setScrollLeft(footerElem, scrollLeft)
        $xeTable.triggerScrollXEvent(evnt)
      }
      $xeTable.handleScrollEvent(evnt, isRollY, isRollX, scrollTop, scrollLeft, {
        type: renderType,
        fixed: fixedType
      })
    }

    let wheelTime: any
    let wheelYSize = 0
    let wheelYInterval = 0
    let wheelYTotal = 0
    let isPrevWheelTop = false

    const handleWheel = (evnt: WheelEvent, isTopWheel: boolean, deltaTop: number, isRollX: boolean, isRollY: boolean) => {
      const { elemStore } = tableInternalData
      const { scrollXLoad, scrollYLoad } = tableReactData
      const tableBody = refTableBody.value
      const leftBody = refTableLeftBody.value
      const rightBody = refTableRightBody.value
      const leftElem = leftBody ? leftBody.$el as HTMLDivElement : null
      const rightElem = rightBody ? rightBody.$el as HTMLDivElement : null
      const bodyElem = tableBody.$el as HTMLDivElement
      const bodyYElem = getRefElem(elemStore['main-body-ySpace'])
      const bodyXElem = getRefElem(elemStore['main-body-xSpace'])
      const bodyHeight = scrollYLoad && bodyYElem ? bodyYElem.clientHeight : bodyElem.clientHeight
      const bodyWidth = scrollXLoad && bodyXElem ? bodyXElem.clientWidth : bodyElem.clientWidth
      const remainSize = isPrevWheelTop === isTopWheel ? Math.max(0, wheelYSize - wheelYTotal) : 0
      isPrevWheelTop = isTopWheel
      wheelYSize = Math.abs(isTopWheel ? deltaTop - remainSize : deltaTop + remainSize)
      wheelYInterval = 0
      wheelYTotal = 0
      clearTimeout(wheelTime)
      const handleSmooth = () => {
        if (wheelYTotal < wheelYSize) {
          const { fixedType } = props
          wheelYInterval = Math.max(5, Math.floor(wheelYInterval * 1.5))
          wheelYTotal = wheelYTotal + wheelYInterval
          if (wheelYTotal > wheelYSize) {
            wheelYInterval = wheelYInterval - (wheelYTotal - wheelYSize)
          }
          const { scrollTop, clientHeight, scrollHeight } = bodyElem
          const targerTop = scrollTop + (wheelYInterval * (isTopWheel ? -1 : 1))
          bodyElem.scrollTop = targerTop
          if (leftElem) {
            leftElem.scrollTop = targerTop
          }
          if (rightElem) {
            rightElem.scrollTop = targerTop
          }
          if (isTopWheel ? targerTop < scrollHeight - clientHeight : targerTop >= 0) {
            wheelTime = setTimeout(handleSmooth, 10)
          }
          $xeTable.dispatchEvent('scroll', {
            type: renderType,
            fixed: fixedType,
            scrollTop: bodyElem.scrollTop,
            scrollLeft: bodyElem.scrollLeft,
            scrollHeight: bodyElem.scrollHeight,
            scrollWidth: bodyElem.scrollWidth,
            bodyHeight,
            bodyWidth,
            isX: isRollX,
            isY: isRollY
          }, evnt)
        }
      }
      handleSmooth()
    }

    /**
     * 滚轮处理
     */
    const wheelEvent = (evnt: WheelEvent) => {
      const { deltaY, deltaX } = evnt
      const { highlightHoverRow } = tableProps
      const { scrollYLoad } = tableReactData
      const { lastScrollTop, lastScrollLeft } = tableInternalData
      const rowOpts = computeRowOpts.value
      const tableBody = refTableBody.value
      const scrollBodyElem = refElem.value
      const bodyElem = tableBody.$el as HTMLDivElement

      const deltaTop = deltaY
      const deltaLeft = deltaX
      const isTopWheel = deltaTop < 0
      // 如果滚动位置已经是顶部或底部，则不需要触发
      if (isTopWheel ? scrollBodyElem.scrollTop <= 0 : scrollBodyElem.scrollTop >= scrollBodyElem.scrollHeight - scrollBodyElem.clientHeight) {
        return
      }

      const scrollTop = scrollBodyElem.scrollTop + deltaTop
      const scrollLeft = bodyElem.scrollLeft + deltaLeft
      const isRollX = scrollLeft !== lastScrollLeft
      const isRollY = scrollTop !== lastScrollTop

      // 用于鼠标纵向滚轮处理
      if (isRollY) {
        evnt.preventDefault()
        tableInternalData.lastScrollTop = scrollTop
        tableInternalData.lastScrollLeft = scrollLeft
        tableReactData.lastScrollTime = Date.now()
        if (rowOpts.isHover || highlightHoverRow) {
          $xeTable.clearHoverRow()
        }
        handleWheel(evnt, isTopWheel, deltaTop, isRollX, isRollY)
        if (scrollYLoad) {
          $xeTable.triggerScrollYEvent(evnt)
        }
      }
    }

    onMounted(() => {
      nextTick(() => {
        const { fixedType } = props
        const { elemStore } = tableInternalData
        const prefix = `${fixedType || 'main'}-body-`
        elemStore[`${prefix}wrapper`] = refElem
        elemStore[`${prefix}table`] = refBodyTable
        elemStore[`${prefix}colgroup`] = refBodyColgroup
        elemStore[`${prefix}list`] = refBodyTBody
        elemStore[`${prefix}xSpace`] = refBodyXSpace
        elemStore[`${prefix}ySpace`] = refBodyYSpace
        elemStore[`${prefix}emptyBlock`] = refBodyEmptyBlock
      })
    })

    onBeforeUnmount(() => {
      clearTimeout(wheelTime)
    })

    onUnmounted(() => {
      const { fixedType } = props
      const { elemStore } = tableInternalData
      const prefix = `${fixedType || 'main'}-body-`
      elemStore[`${prefix}wrapper`] = null
      elemStore[`${prefix}table`] = null
      elemStore[`${prefix}colgroup`] = null
      elemStore[`${prefix}list`] = null
      elemStore[`${prefix}xSpace`] = null
      elemStore[`${prefix}ySpace`] = null
      elemStore[`${prefix}emptyBlock`] = null
    })

    const renderVN = () => {
      let { fixedColumn, fixedType, tableColumn } = props
      const { keyboardConfig, showOverflow: allColumnOverflow, spanMethod, mouseConfig } = tableProps
      const { tableData, mergeList, scrollYLoad, isAllOverflow, isDragRowMove } = tableReactData
      const { visibleColumn } = tableInternalData
      const { slots } = tableContext
      const rowOpts = computeRowOpts.value
      const sYOpts = computeSYOpts.value
      const emptyOpts = computeEmptyOpts.value
      const keyboardOpts = computeKeyboardOpts.value
      const mouseOpts = computeMouseOpts.value
      const columnOpts = computeColumnOpts.value
      // const isMergeLeftFixedExceeded = computeIsMergeLeftFixedExceeded.value
      // const isMergeRightFixedExceeded = computeIsMergeRightFixedExceeded.value
      // 如果是使用优化模式
      if (fixedType) {
        // 如果存在展开行使用全量渲染
        if (!tableReactData.expandColumn && (scrollYLoad || (allColumnOverflow ? isAllOverflow : allColumnOverflow))) {
          if (!mergeList.length && !spanMethod && !(keyboardConfig && keyboardOpts.isMerge)) {
            tableColumn = fixedColumn
          } else {
            tableColumn = visibleColumn
            // 检查固定列是否被合并，合并范围是否超出固定列
            // if (mergeList.length && !isMergeLeftFixedExceeded && fixedType === 'left') {
            //   tableColumn = fixedColumn
            // } else if (mergeList.length && !isMergeRightFixedExceeded && fixedType === 'right') {
            //   tableColumn = fixedColumn
            // } else {
            //   tableColumn = visibleColumn
            // }
          }
        } else {
          tableColumn = visibleColumn
        }
      }
      let emptyContent: string | VxeComponentSlotType | VxeComponentSlotType[]
      const emptySlot = slots ? slots.empty : null
      if (emptySlot) {
        emptyContent = $xeTable.callSlot(emptySlot, { $table: $xeTable, $grid: $xeTable.xegrid })
      } else {
        const compConf = emptyOpts.name ? renderer.get(emptyOpts.name) : null
        const rtEmptyView = compConf ? (compConf.renderTableEmpty || compConf.renderTableEmptyView || compConf.renderEmpty) : null
        if (rtEmptyView) {
          emptyContent = getSlotVNs(rtEmptyView(emptyOpts, { $table: $xeTable }))
        } else {
          emptyContent = tableProps.emptyText || getI18n('vxe.table.emptyText')
        }
      }

      const ons: Record<string, any> = {
        onScroll: scrollEvent
      }
      if (sYOpts.mode === 'wheel') {
        ons.onWheel = wheelEvent
      }

      return h('div', {
        ref: refElem,
        class: ['vxe-table--body-wrapper', fixedType ? `fixed-${fixedType}--wrapper` : 'body--wrapper'],
        xid: xID,
        ...ons
      }, [
        fixedType
          ? createCommentVNode()
          : h('div', {
            ref: refBodyXSpace,
            class: 'vxe-body--x-space'
          }),
        h('div', {
          ref: refBodyYSpace,
          class: 'vxe-body--y-space'
        }),
        h('table', {
          ref: refBodyTable,
          class: 'vxe-table--body',
          xid: xID,
          cellspacing: 0,
          cellpadding: 0,
          border: 0
        }, [
          /**
           * 列宽
           */
          h('colgroup', {
            ref: refBodyColgroup
          }, (tableColumn as any[]).map((column, $columnIndex) => {
            return h('col', {
              name: column.id,
              key: $columnIndex
            })
          })),
          /**
           * 内容
           */
          rowOpts.drag || columnOpts.drag
            ? h(TransitionGroup, {
              ref: refBodyTBody,
              name: `vxe-body--row-list${isDragRowMove ? '' : '-disabled'}`,
              tag: 'tbody'
            }, {
              default: () => renderRows(fixedType, tableData, tableColumn)
            })
            : h('tbody', {
              ref: refBodyTBody
            }, renderRows(fixedType, tableData, tableColumn))
        ]),
        h('div', {
          class: 'vxe-table--checkbox-range'
        }),
        mouseConfig && mouseOpts.area
          ? h('div', {
            class: 'vxe-table--cell-area'
          }, [
            h('span', {
              class: 'vxe-table--cell-main-area'
            }, mouseOpts.extension
              ? [
                  h('span', {
                    class: 'vxe-table--cell-main-area-btn',
                    onMousedown (evnt: any) {
                      if ($xeTable.triggerCellAreaExtendMousedownEvent) {
                        $xeTable.triggerCellAreaExtendMousedownEvent(evnt, { $table: $xeTable, fixed: fixedType, type: renderType })
                      }
                    }
                  })
                ]
              : []),
            h('span', {
              class: 'vxe-table--cell-copy-area'
            }),
            h('span', {
              class: 'vxe-table--cell-extend-area'
            }),
            h('span', {
              class: 'vxe-table--cell-multi-area'
            }),
            h('span', {
              class: 'vxe-table--cell-active-area'
            })
          ])
          : renderEmptyElement($xeTable),
        !fixedType
          ? h('div', {
            class: 'vxe-table--empty-block',
            ref: refBodyEmptyBlock
          }, [
            h('div', {
              class: 'vxe-table--empty-content'
            }, emptyContent)
          ])
          : renderEmptyElement($xeTable)
      ])
    }

    return renderVN
  }
})
