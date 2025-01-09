import { watch, reactive } from 'vue'
import XEUtils from 'xe-utils'
import { ColumnInfo } from './columnInfo'
import { isPx, isScale } from '../../ui/src/dom'

import type { VxeTableConstructor, VxeTablePrivateMethods, VxeTableDefines } from '../../../types'

const getAllConvertColumns = (columns: any, parentColumn?: any) => {
  const result: any[] = []
  columns.forEach((column: any) => {
    column.parentId = parentColumn ? parentColumn.id : null
    if (column.visible) {
      if (column.children && column.children.length && column.children.some((column: any) => column.visible)) {
        result.push(column)
        result.push(...getAllConvertColumns(column.children, column))
      } else {
        result.push(column)
      }
    }
  })
  return result
}

export const convertHeaderColumnToRows = (originColumns: any): any[][] => {
  let maxLevel = 1
  const traverse = (column: any, parent?: any) => {
    if (parent) {
      column.level = parent.level + 1
      if (maxLevel < column.level) {
        maxLevel = column.level
      }
    }
    if (column.children && column.children.length && column.children.some((column: any) => column.visible)) {
      let colSpan = 0
      column.children.forEach((subColumn: any) => {
        if (subColumn.visible) {
          traverse(subColumn, column)
          colSpan += subColumn.colSpan
        }
      })
      column.colSpan = colSpan
    } else {
      column.colSpan = 1
    }
  }

  originColumns.forEach((column: any) => {
    column.level = 1
    traverse(column)
  })

  const rows: any[] = []
  for (let i = 0; i < maxLevel; i++) {
    rows.push([])
  }

  const allColumns = getAllConvertColumns(originColumns)

  allColumns.forEach((column) => {
    if (column.children && column.children.length && column.children.some((column: any) => column.visible)) {
      column.rowSpan = 1
    } else {
      column.rowSpan = maxLevel - column.level + 1
    }
    rows[column.level - 1].push(column)
  })

  return rows
}

export function restoreScrollLocation ($xeTable: VxeTableConstructor, scrollLeft: number, scrollTop: number) {
  const internalData = $xeTable.internalData

  return $xeTable.clearScroll().then(() => {
    if (scrollLeft || scrollTop) {
      // 重置最后滚动状态
      internalData.lastScrollLeft = 0
      internalData.lastScrollTop = 0

      internalData.inVirtualScroll = false
      internalData.inBodyScroll = false
      internalData.inFooterScroll = false
      internalData.bodyScrollType = ''
      // 还原滚动状态
      return $xeTable.scrollTo(scrollLeft, scrollTop)
    }
  })
}

/**
 * 生成行的唯一主键
 */
export function getRowUniqueId () {
  return XEUtils.uniqueId('row_')
}

// 行主键 key
export function getRowkey ($xeTable: VxeTableConstructor) {
  const { props } = $xeTable
  const { computeRowOpts } = $xeTable.getComputeMaps()
  const { rowId } = props
  const rowOpts = computeRowOpts.value
  return rowId || rowOpts.keyField || '_X_ROW_KEY'
}

// 行主键 value
export function getRowid ($xeTable: VxeTableConstructor, row: any) {
  const rowid = XEUtils.get(row, getRowkey($xeTable))
  return XEUtils.eqNull(rowid) ? '' : encodeURIComponent(rowid)
}

export interface XEColumnInstance {
  columnConfig: ColumnInfo;
}

export const handleFieldOrColumn = ($xeTable: VxeTableConstructor, fieldOrColumn: string | VxeTableDefines.ColumnInfo | null) => {
  if (fieldOrColumn) {
    return XEUtils.isString(fieldOrColumn) ? $xeTable.getColumnByField(fieldOrColumn) : fieldOrColumn
  }
  return null
}

function getPaddingLeftRightSize (elem: HTMLElement | null) {
  if (elem) {
    const computedStyle = getComputedStyle(elem)
    const paddingLeft = XEUtils.toNumber(computedStyle.paddingLeft)
    const paddingRight = XEUtils.toNumber(computedStyle.paddingRight)
    return paddingLeft + paddingRight
  }
  return 0
}

function getElementMarginWidth (elem: HTMLElement | null) {
  if (elem) {
    const computedStyle = getComputedStyle(elem)
    const marginLeft = XEUtils.toNumber(computedStyle.marginLeft)
    const marginRight = XEUtils.toNumber(computedStyle.marginRight)
    return elem.offsetWidth + marginLeft + marginRight
  }
  return 0
}

function queryCellElement (cell: HTMLTableCellElement, selector: string) {
  return cell.querySelector('.vxe-cell' + selector) as HTMLElement | null
}

export function toFilters (filters: any) {
  if (filters && XEUtils.isArray(filters)) {
    return filters.map(({ label, value, data, resetValue, checked }) => {
      return { label, value, data, resetValue, checked: !!checked, _checked: !!checked }
    })
  }
  return filters
}

export function toTreePathSeq (path: any[]) {
  return path.map((num, i) => i % 2 === 0 ? (Number(num) + 1) : '.').join('')
}

export function getCellValue (row: any, column: VxeTableDefines.ColumnInfo) {
  return XEUtils.get(row, column.field)
}

export function setCellValue (row: any, column: VxeTableDefines.ColumnInfo, value: any) {
  return XEUtils.set(row, column.field, value)
}

export function getRefElem (refEl: any) {
  if (refEl) {
    const rest = refEl.value
    if (rest) {
      return (rest.$el || rest) as HTMLElement
    }
  }
  return null
}

/**
 * 列宽拖动最大宽度
 * @param params
 * @returns
 */
export function getColReMaxWidth (params: {
  $table: VxeTableConstructor & VxeTablePrivateMethods;
  column: VxeTableDefines.ColumnInfo;
  columnIndex: number;
  $columnIndex: number;
  $rowIndex: number;
  cell: HTMLTableCellElement;
}) {
  const { $table } = params
  const { computeResizableOpts } = $table.getComputeMaps()
  const resizableOpts = computeResizableOpts.value
  const { maxWidth: reMaxWidth } = resizableOpts
  // 如果自定义调整宽度逻辑
  if (reMaxWidth) {
    const customMaxWidth = XEUtils.isFunction(reMaxWidth) ? reMaxWidth(params) : reMaxWidth
    if (customMaxWidth !== 'auto') {
      return Math.max(1, XEUtils.toNumber(customMaxWidth))
    }
  }
  return -1
}

/**
 * 列宽拖动最小宽度
 * @param params
 * @returns
 */
export function getColReMinWidth (params: {
  $table: VxeTableConstructor & VxeTablePrivateMethods;
  column: VxeTableDefines.ColumnInfo;
  columnIndex: number;
  $columnIndex: number;
  $rowIndex: number;
  cell: HTMLTableCellElement;
}) {
  const { $table, column, cell } = params
  const { props: tableProps } = $table
  const { computeResizableOpts } = $table.getComputeMaps()
  const resizableOpts = computeResizableOpts.value
  const { minWidth: reMinWidth } = resizableOpts
  // 如果自定义调整宽度逻辑
  if (reMinWidth) {
    const customMinWidth = XEUtils.isFunction(reMinWidth) ? reMinWidth(params) : reMinWidth
    if (customMinWidth !== 'auto') {
      return Math.max(1, XEUtils.toNumber(customMinWidth))
    }
  }
  const { showHeaderOverflow: allColumnHeaderOverflow } = tableProps
  const { showHeaderOverflow, minWidth: colMinWidth } = column
  const headOverflow = XEUtils.isUndefined(showHeaderOverflow) || XEUtils.isNull(showHeaderOverflow) ? allColumnHeaderOverflow : showHeaderOverflow
  const showEllipsis = headOverflow === 'ellipsis'
  const showTitle = headOverflow === 'title'
  const showTooltip = headOverflow === true || headOverflow === 'tooltip'
  const hasEllipsis = showTitle || showTooltip || showEllipsis
  const minTitleWidth = XEUtils.floor((XEUtils.toNumber(getComputedStyle(cell).fontSize) || 14) * 1.6)
  const paddingLeftRight = getPaddingLeftRightSize(cell) + getPaddingLeftRightSize(queryCellElement(cell, ''))
  let mWidth = minTitleWidth + paddingLeftRight
  // 默认最小宽处理
  if (hasEllipsis) {
    const dragIconWidth = getPaddingLeftRightSize(queryCellElement(cell, '>.vxe-cell--drag-handle'))
    const checkboxIconWidth = getPaddingLeftRightSize(queryCellElement(cell, '>.vxe-cell--checkbox'))
    const requiredIconWidth = getElementMarginWidth(queryCellElement(cell, '>.vxe-cell--required-icon'))
    const editIconWidth = getElementMarginWidth(queryCellElement(cell, '>.vxe-cell--edit-icon'))
    const prefixIconWidth = getElementMarginWidth(queryCellElement(cell, '>.vxe-cell-title-prefix-icon'))
    const suffixIconWidth = getElementMarginWidth(queryCellElement(cell, '>.vxe-cell-title-suffix-icon'))
    const sortIconWidth = getElementMarginWidth(queryCellElement(cell, '>.vxe-cell--sort'))
    const filterIconWidth = getElementMarginWidth(queryCellElement(cell, '>.vxe-cell--filter'))
    mWidth += dragIconWidth + checkboxIconWidth + requiredIconWidth + editIconWidth + prefixIconWidth + suffixIconWidth + filterIconWidth + sortIconWidth
  }
  // 如果设置最小宽
  if (colMinWidth) {
    const { refTableBody } = $table.getRefMaps()
    const tableBody = refTableBody.value
    const bodyElem = tableBody ? tableBody.$el as HTMLDivElement : null
    if (bodyElem) {
      if (isScale(colMinWidth)) {
        const bodyWidth = bodyElem.clientWidth - 1
        const meanWidth = bodyWidth / 100
        return Math.max(mWidth, Math.floor(XEUtils.toInteger(colMinWidth) * meanWidth))
      } else if (isPx(colMinWidth)) {
        return Math.max(mWidth, XEUtils.toInteger(colMinWidth))
      }
    }
  }
  return mWidth
}

export function isColumnInfo (column: any): column is ColumnInfo {
  return column && (column.constructor === ColumnInfo || column instanceof ColumnInfo)
}

export function createColumn ($xeTable: VxeTableConstructor & VxeTablePrivateMethods, options: VxeTableDefines.ColumnOptions | VxeTableDefines.ColumnInfo, renderOptions: any): any {
  return isColumnInfo(options) ? options : reactive(new ColumnInfo($xeTable, options, renderOptions))
}

export function watchColumn ($xeTable: VxeTableConstructor & VxeTablePrivateMethods, props: any, column: ColumnInfo) {
  Object.keys(props).forEach(name => {
    watch(() => props[name], (value: any) => {
      column.update(name, value)
      if ($xeTable) {
        if (name === 'filters') {
          $xeTable.setFilter(column as any, value)
          $xeTable.handleUpdateDataQueue()
        } else if (['visible', 'fixed', 'width', 'minWidth', 'maxWidth'].includes(name)) {
          $xeTable.handleRefreshColumnQueue()
        }
      }
    })
  })
}

export function assembleColumn ($xeTable: VxeTableConstructor & VxeTablePrivateMethods, elem: HTMLElement, column: ColumnInfo, colgroup: XEColumnInstance | null) {
  const { reactData } = $xeTable
  const { staticColumns } = reactData
  const parentElem = elem.parentNode
  const parentColumn = colgroup ? colgroup.columnConfig : null
  const parentCols = parentColumn ? parentColumn.children : staticColumns
  if (parentElem && parentCols) {
    parentCols.splice(XEUtils.arrayIndexOf(parentElem.children, elem), 0, column)
    reactData.staticColumns = staticColumns.slice(0)
  }
}

export function destroyColumn ($xeTable: VxeTableConstructor & VxeTablePrivateMethods, column: ColumnInfo) {
  const { reactData } = $xeTable
  const { staticColumns } = reactData
  const matchObj = XEUtils.findTree(staticColumns, item => item.id === column.id, { children: 'children' })
  if (matchObj) {
    matchObj.items.splice(matchObj.index, 1)
  }
  reactData.staticColumns = staticColumns.slice(0)
}

export function getRootColumn ($xeTable: VxeTableConstructor & VxeTablePrivateMethods, column: ColumnInfo) {
  const { internalData } = $xeTable
  const { fullColumnIdData } = internalData
  if (!column) {
    return null
  }
  let parentColId = column.parentId
  while (fullColumnIdData[parentColId]) {
    const column = fullColumnIdData[parentColId].column
    parentColId = column.parentId
    if (!parentColId) {
      return column
    }
  }
  return column
}

export function mergeBodyMethod (mergeList: VxeTableDefines.MergeItem[], _rowIndex: number, _columnIndex: number) {
  for (let mIndex = 0; mIndex < mergeList.length; mIndex++) {
    const { row: mergeRowIndex, col: mergeColIndex, rowspan: mergeRowspan, colspan: mergeColspan } = mergeList[mIndex]
    if (mergeColIndex > -1 && mergeRowIndex > -1 && mergeRowspan && mergeColspan) {
      if (mergeRowIndex === _rowIndex && mergeColIndex === _columnIndex) {
        return { rowspan: mergeRowspan, colspan: mergeColspan }
      }
      if (_rowIndex >= mergeRowIndex && _rowIndex < mergeRowIndex + mergeRowspan && _columnIndex >= mergeColIndex && _columnIndex < mergeColIndex + mergeColspan) {
        return { rowspan: 0, colspan: 0 }
      }
    }
  }
}

export function clearTableDefaultStatus ($xeTable: VxeTableConstructor & VxeTablePrivateMethods) {
  const { props, internalData } = $xeTable
  internalData.initStatus = false
  $xeTable.clearSort()
  $xeTable.clearCurrentRow()
  $xeTable.clearCurrentColumn()
  $xeTable.clearRadioRow()
  $xeTable.clearRadioReserve()
  $xeTable.clearCheckboxRow()
  $xeTable.clearCheckboxReserve()
  $xeTable.clearRowExpand()
  $xeTable.clearTreeExpand()
  $xeTable.clearTreeExpandReserve()
  $xeTable.clearPendingRow()
  if ($xeTable.clearFilter) {
    $xeTable.clearFilter()
  }
  if ($xeTable.clearSelected && (props.keyboardConfig || props.mouseConfig)) {
    $xeTable.clearSelected()
  }
  if ($xeTable.clearCellAreas && props.mouseConfig) {
    $xeTable.clearCellAreas()
    $xeTable.clearCopyCellArea()
  }
  return $xeTable.clearScroll()
}

export function clearTableAllStatus ($xeTable: VxeTableConstructor & VxeTablePrivateMethods) {
  if ($xeTable.clearFilter) {
    $xeTable.clearFilter()
  }
  return clearTableDefaultStatus($xeTable)
}

export function rowToVisible ($xeTable: VxeTableConstructor & VxeTablePrivateMethods, row: any) {
  const { reactData, internalData } = $xeTable
  const tableProps = $xeTable.props
  const { showOverflow } = tableProps
  const { refTableBody } = $xeTable.getRefMaps()
  const { columnStore, scrollYLoad } = reactData
  const { afterFullData, scrollYStore, fullAllDataRowIdData } = internalData
  const { rowHeight } = scrollYStore
  const tableBody = refTableBody.value
  const { leftList, rightList } = columnStore
  const bodyElem = tableBody ? tableBody.$el as HTMLDivElement : null
  const rowid = getRowid($xeTable, row)
  let offsetFixedLeft = 0
  leftList.forEach(item => {
    offsetFixedLeft += item.renderWidth
  })
  let offsetFixedRight = 0
  rightList.forEach(item => {
    offsetFixedRight += item.renderWidth
  })
  if (bodyElem) {
    const bodyHeight = bodyElem.clientHeight
    const bodyScrollTop = bodyElem.scrollTop
    const trElem: HTMLTableRowElement | null = bodyElem.querySelector(`[rowid="${rowid}"]`)
    if (trElem) {
      const trOffsetParent = trElem.offsetParent as HTMLElement
      const trOffsetTop = trElem.offsetTop + (trOffsetParent ? trOffsetParent.offsetTop : 0)
      const trHeight = trElem.clientHeight
      // 检测行是否在可视区中
      if (trOffsetTop < bodyScrollTop || trOffsetTop > bodyScrollTop + bodyHeight) {
        return $xeTable.scrollTo(null, trOffsetTop)
      } else if (trOffsetTop + trHeight >= bodyHeight + bodyScrollTop) {
        return $xeTable.scrollTo(null, bodyScrollTop + trHeight)
      }
    } else {
      // 如果是虚拟渲染滚动
      if (scrollYLoad) {
        if (showOverflow) {
          return $xeTable.scrollTo(null, ($xeTable.findRowIndexOf(afterFullData, row) - 1) * rowHeight)
        }
        let scrollTop = 0
        const rowRest = fullAllDataRowIdData[rowid]
        const rHeight = rowRest ? (rowRest.height || rowHeight) : rowHeight
        for (let i = 0; i < afterFullData.length; i++) {
          const currRow = afterFullData[i]
          const currRowid = getRowid($xeTable, currRow)
          if (currRow === row || currRowid === rowid) {
            break
          }
          const rowRest = fullAllDataRowIdData[currRowid]
          scrollTop += rowRest ? (rowRest.height || rowHeight) : rowHeight
        }
        if (scrollTop < bodyScrollTop) {
          return $xeTable.scrollTo(null, scrollTop - offsetFixedLeft - 1)
        }
        return $xeTable.scrollTo(null, (scrollTop + rHeight) - (bodyHeight - offsetFixedRight - 1))
      }
    }
  }
  return Promise.resolve()
}

export function colToVisible ($xeTable: VxeTableConstructor & VxeTablePrivateMethods, column: VxeTableDefines.ColumnInfo, row?: any) {
  const { reactData, internalData } = $xeTable
  const { refTableBody } = $xeTable.getRefMaps()
  const { columnStore, scrollXLoad } = reactData
  const { visibleColumn } = internalData
  const { leftList, rightList } = columnStore
  const tableBody = refTableBody.value
  const bodyElem = tableBody ? tableBody.$el as HTMLDivElement : null
  if (column.fixed) {
    return Promise.resolve()
  }
  let offsetFixedLeft = 0
  leftList.forEach(item => {
    offsetFixedLeft += item.renderWidth
  })
  let offsetFixedRight = 0
  rightList.forEach(item => {
    offsetFixedRight += item.renderWidth
  })
  if (bodyElem) {
    const bodyWidth = bodyElem.clientWidth
    const bodyScrollLeft = bodyElem.scrollLeft
    let tdElem: HTMLTableCellElement | null = null
    if (row) {
      const rowid = getRowid($xeTable, row)
      tdElem = bodyElem.querySelector(`[rowid="${rowid}"] .${column.id}`)
    }
    if (!tdElem) {
      tdElem = bodyElem.querySelector(`.${column.id}`)
    }
    if (tdElem) {
      const tdOffsetParent = tdElem.offsetParent as HTMLElement
      const tdOffsetLeft = tdElem.offsetLeft + (tdOffsetParent ? tdOffsetParent.offsetLeft : 0)
      const cellWidth = tdElem.clientWidth
      // 检测是否在可视区中
      if (tdOffsetLeft < (bodyScrollLeft + offsetFixedLeft)) {
        return $xeTable.scrollTo(tdOffsetLeft - offsetFixedLeft - 1)
      } else if ((tdOffsetLeft + cellWidth - bodyScrollLeft) > (bodyWidth - offsetFixedRight)) {
        return $xeTable.scrollTo((tdOffsetLeft + cellWidth) - (bodyWidth - offsetFixedRight - 1))
      }
    } else {
      // 检测是否在虚拟渲染可视区中
      if (scrollXLoad) {
        let scrollLeft = 0
        const cellWidth = column.renderWidth
        for (let i = 0; i < visibleColumn.length; i++) {
          const currCol = visibleColumn[i]
          if (currCol === column || currCol.id === column.id) {
            break
          }
          scrollLeft += currCol.renderWidth
        }
        if (scrollLeft < bodyScrollLeft) {
          return $xeTable.scrollTo(scrollLeft - offsetFixedLeft - 1)
        }
        return $xeTable.scrollTo((scrollLeft + cellWidth) - (bodyWidth - offsetFixedRight - 1))
      }
    }
  }
  return Promise.resolve()
}
