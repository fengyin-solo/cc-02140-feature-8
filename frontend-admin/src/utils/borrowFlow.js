export const BORROW_DAYS = 30
export const RENEW_DAYS = 15
export const MAX_RENEW_COUNT = 2

export const STATUS_TEXT = {
  borrowed: '借阅中',
  overdue: '已逾期',
  returned: '已归还'
}

export const ACTION_TEXT = {
  borrow: '借出',
  renew: '续借',
  return: '归还'
}

export function formatDate(date) {
  return date.toISOString().split('T')[0]
}

export function getToday() {
  return formatDate(new Date())
}

export function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return formatDate(result)
}

export function getBorrowDueDate(borrowDate = getToday()) {
  return addDays(borrowDate, BORROW_DAYS)
}

export function getRenewedDueDate(dueDate) {
  return addDays(dueDate, RENEW_DAYS)
}

export function diffDays(fromDate, toDate = getToday()) {
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${toDate}T00:00:00`)
  return Math.round((to - from) / 86400000)
}

export function isReturned(record) {
  return Boolean(record?.returnDate) || record?.status === 'returned'
}

export function isRecordOverdue(record, today = getToday()) {
  return !isReturned(record) && Boolean(record?.dueDate) && record.dueDate < today
}

export function getRecordStatus(record, today = getToday()) {
  if (isReturned(record)) return 'returned'
  return isRecordOverdue(record, today) ? 'overdue' : 'borrowed'
}

export function getOverdueDays(record, today = getToday()) {
  if (!isRecordOverdue(record, today)) return 0
  return diffDays(record.dueDate, today)
}

export function getReaderBlockReasons(reader, activeBorrowCount = 0, today = getToday()) {
  if (!reader) {
    return ['读者信息不存在，请重新选择读者']
  }

  const reasons = []
  if (reader.status !== 'active') {
    reasons.push(`读者账号不可借：当前状态为“${reader.status === 'expired' ? '已过期' : reader.status}”`)
  }
  if (reader.expireDate && reader.expireDate < today) {
    reasons.push(`读者权限已过期：有效期至 ${reader.expireDate}`)
  }
  if (Number(reader.maxBorrow) >= 0 && activeBorrowCount >= Number(reader.maxBorrow)) {
    reasons.push(`借阅册数已达上限：当前 ${activeBorrowCount}/${reader.maxBorrow} 册`)
  }
  return reasons
}

export function getBookBlockReasons(book) {
  if (!book) {
    return ['图书信息不存在，请重新选择图书']
  }
  if (book.available <= 0) {
    return [`图书无库存：《${book.title}》当前可借库存为 0/${book.total}`]
  }
  return []
}

export function getReturnBlockReason(record) {
  if (!record) return '借阅记录不存在，无法归还'
  if (isReturned(record)) return `该记录已于 ${record.returnDate} 归还，不能重复归还`
  return null
}

export function getRenewBlockReasons(record, today = getToday()) {
  if (!record) return ['借阅记录不存在，无法续借']

  const reasons = []
  if (isReturned(record)) {
    reasons.push(`记录已于 ${record.returnDate} 归还，不能续借`)
  }
  if (isRecordOverdue(record, today)) {
    reasons.push(`图书已逾期 ${getOverdueDays(record, today)} 天，请先归还，不能续借`)
  }
  if (Number(record.renewCount || 0) >= MAX_RENEW_COUNT) {
    reasons.push(`续借次数已达上限：${record.renewCount}/${MAX_RENEW_COUNT}`)
  }
  return reasons
}

export function canRenew(record, today = getToday()) {
  return getRenewBlockReasons(record, today).length === 0
}

export function buildFailureResult(action, reasons, extra = {}) {
  return {
    success: false,
    action,
    message: `${ACTION_TEXT[action] || '操作'}失败`,
    reasons,
    warnings: [],
    ...extra
  }
}
