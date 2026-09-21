import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { borrowRecords as initialRecords } from '@/data/mockData'
import { useBookStore } from '@/stores/book'
import { useReaderStore } from '@/stores/reader'

const STORAGE_KEY = 'library_borrow_records'
export const BORROW_DAYS = 30
export const RENEW_DAYS = 15
export const MAX_RENEW_COUNT = 2

function pad(value) {
  return String(value).padStart(2, '0')
}

export function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDate(value) {
  if (!value) return null
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  return new Date(`${value}T00:00:00`)
}

export function getToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function diffDays(fromDate, toDate) {
  const from = parseDate(fromDate)
  const to = parseDate(toDate)
  return Math.round((to - from) / (24 * 60 * 60 * 1000))
}

export function calculateDueDate(baseDate = getToday(), days = BORROW_DAYS) {
  return formatDate(addDays(parseDate(baseDate) || getToday(), days))
}

function cloneRecord(record) {
  return record ? JSON.parse(JSON.stringify(record)) : null
}

function buildInventory(book) {
  return book
    ? { bookId: book.id, bookTitle: book.title, available: book.available, total: book.total }
    : null
}

function buildReaderResult(reader, borrowCount = reader?.borrowCount) {
  return reader
    ? { readerId: reader.id, readerName: reader.name, borrowCount, maxBorrow: reader.maxBorrow }
    : null
}

function failure(action, errors, record = null, extra = {}) {
  return {
    success: false,
    action,
    code: errors[0]?.code || `${action}_failed`,
    message: errors[0]?.message || '操作失败',
    errors,
    record: cloneRecord(record),
    ...extra
  }
}

function getRenewHistory(record) {
  if (Array.isArray(record.renewHistory)) {
    return record.renewHistory.map(item => ({ ...item }))
  }

  if (record.renewCount > 0) {
    return Array.from({ length: record.renewCount }, (_, index) => ({
      renewDate: null,
      fromDueDate: null,
      toDueDate: index === record.renewCount - 1 ? record.dueDate : null,
      index: index + 1
    }))
  }

  return []
}

export function getBorrowStatus(record, today = getToday()) {
  if (!record) return null
  if (record.returnDate || record.status === 'returned') return 'returned'
  return diffDays(today, record.dueDate) < 0 ? 'overdue' : 'borrowed'
}

export function decorateRecord(record, today = getToday()) {
  if (!record) return null

  const status = getBorrowStatus(record, today)
  const returnDate = record.returnDate || (status === 'returned' ? '此前' : null)
  const renewCount = Number(record.renewCount || 0)
  const renewRemaining = Math.max(0, MAX_RENEW_COUNT - renewCount)
  const dueDate = record.dueDate
  const nextDueDate = status === 'borrowed' && renewRemaining > 0
    ? calculateDueDate(dueDate, RENEW_DAYS)
    : null
  const overdueDays = status === 'overdue'
    ? Math.abs(diffDays(today, dueDate))
    : 0
  const returnedLate = status === 'returned' && record.returnDate
    ? diffDays(dueDate, returnDate) > 0
    : false
  const lateDays = returnedLate ? diffDays(dueDate, returnDate) : 0
  const daysToDue = status === 'borrowed' || status === 'overdue'
    ? diffDays(today, dueDate)
    : null
  const canReturn = status === 'borrowed' || status === 'overdue'
  const canRenew = status === 'borrowed' && renewRemaining > 0

  let stage = status
  let stageTitle = ''
  let stageDescription = ''
  let actionHint = ''

  if (status === 'returned') {
    stage = 'returned'
    stageTitle = '已归还'
    stageDescription = `图书已于 ${returnDate} 归还${returnedLate ? `，超过应还日期 ${lateDays} 天` : '，已按时归还'}；借阅记录已归档，不能重复归还或续借。`
    actionHint = '本记录已完成，原始借阅信息和续借信息继续保留。'
  } else if (status === 'overdue') {
    stage = 'overdue'
    stageTitle = '已逾期'
    stageDescription = `已超过应还日期 ${overdueDays} 天，请先办理归还；逾期记录不能续借。`
    actionHint = '当前可执行操作：归还。'
  } else if (renewCount > 0) {
    stage = 'renewed'
    stageTitle = renewRemaining > 0 ? '已续借/借阅中' : '续借已达上限'
    stageDescription = `已续借 ${renewCount} 次，新的应还日期为 ${dueDate}。`
    actionHint = renewRemaining > 0
      ? `当前可归还，仍可续借 ${renewRemaining} 次。`
      : `续借次数已达上限（${MAX_RENEW_COUNT} 次），当前仅可按时归还。`
  } else {
    stage = 'borrowed'
    stageTitle = '借阅中'
    stageDescription = `图书已借出，应还日期为 ${dueDate}，借出期限为 ${BORROW_DAYS} 天。`
    actionHint = `当前可归还或续借，最多可续借 ${MAX_RENEW_COUNT} 次，每次延长 ${RENEW_DAYS} 天。`
  }

  return {
    ...record,
    status,
    stage,
    stageTitle,
    stageDescription,
    actionHint,
    returnDate,
    effectiveReturnDate: returnDate,
    overdueDays,
    returnedLate,
    lateDays,
    daysToDue,
    renewLimit: MAX_RENEW_COUNT,
    renewRemaining,
    nextDueDate,
    canReturn,
    canRenew,
    renewHistory: getRenewHistory(record)
  }
}

export const useBorrowStore = defineStore('borrow', () => {
  const loadRecords = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Failed to parse stored records:', e)
      }
    }
    return [...initialRecords]
  }

  const records = ref(loadRecords())
  const loading = ref(false)

  watch(records, (newRecords) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords))
  }, { deep: true })

  const decoratedRecords = computed(() =>
    records.value.map(record => decorateRecord(record))
  )

  const totalBorrowed = computed(() =>
    decoratedRecords.value.filter(r => r.status === 'borrowed').length
  )

  const totalOverdue = computed(() =>
    decoratedRecords.value.filter(r => r.status === 'overdue').length
  )

  const todayBorrows = computed(() => {
    const today = formatDate(getToday())
    return records.value.filter(r => r.borrowDate === today).length
  })

  function getRecordById(id) {
    return records.value.find(record => record.id === id)
  }

  function getDecoratedRecordById(id) {
    return decorateRecord(getRecordById(id))
  }

  function getRecordsByReader(readerId) {
    return records.value.filter(record => record.readerId === readerId)
  }

  function createRecord(record) {
    const newId = records.value.length > 0
      ? Math.max(...records.value.map(r => r.id)) + 1
      : 1
    const today = formatDate(getToday())
    const newRecord = {
      ...record,
      id: newId,
      borrowDate: today,
      dueDate: calculateDueDate(today),
      returnDate: null,
      status: 'borrowed',
      renewCount: 0,
      renewHistory: []
    }
    records.value.push(newRecord)
    return newRecord
  }

  // 保留原有新增记录入口；涉及库存和读者权限的页面操作请使用 borrowBook。
  function addRecord(record) {
    return createRecord(record).id
  }

  function getReaderActiveBorrowCount(readerId) {
    return records.value.filter(record =>
      record.readerId === readerId &&
      !record.returnDate &&
      record.status !== 'returned'
    ).length
  }

  function borrowBook({ readerId, bookId } = {}) {
    const bookStore = useBookStore()
    const readerStore = useReaderStore()
    const errors = []
    const reader = readerStore.getReaderById(readerId)
    const book = bookStore.getBookById(bookId)

    const activeBorrowCount = reader ? getReaderActiveBorrowCount(reader.id) : 0

    if (!reader) {
      errors.push({ code: 'reader_not_found', message: '读者不存在，不能办理借出。' })
    } else {
      if (reader.status !== 'active') {
        errors.push({
          code: 'reader_inactive',
          message: `读者“${reader.name}”当前不可借：账号状态为${reader.status === 'expired' ? '已过期' : '停用'}。`
        })
      }
      if (activeBorrowCount >= reader.maxBorrow) {
        errors.push({
          code: 'reader_limit_reached',
          message: `读者“${reader.name}”已借 ${activeBorrowCount} 本，上限 ${reader.maxBorrow} 本，请先归还后再借。`
        })
      }
    }

    if (!book) {
      errors.push({ code: 'book_not_found', message: '图书不存在，不能办理借出。' })
    } else if (book.available <= 0) {
      errors.push({
        code: 'book_out_of_stock',
        message: `图书“${book.title}”无可借库存（0/${book.total}）。`
      })
    }

    if (errors.length > 0) {
      return failure('borrow', errors, null, {
        inventory: buildInventory(book),
        reader: reader ? { readerId: reader.id, borrowCount: activeBorrowCount, maxBorrow: reader.maxBorrow } : null
      })
    }

    const newRecord = createRecord({
      readerId: reader.id,
      readerName: reader.name,
      cardNo: reader.cardNo,
      bookId: book.id,
      bookTitle: book.title,
      isbn: book.isbn
    })

    const available = Math.max(0, book.available - 1)
    const borrowCount = Math.min(reader.maxBorrow, getReaderActiveBorrowCount(reader.id))
    bookStore.updateBook(book.id, { available })
    readerStore.updateReader(reader.id, { borrowCount })

    return {
      success: true,
      action: 'borrow',
      code: 'borrow_success',
      message: '借出成功',
      errors: [],
      record: cloneRecord(newRecord),
      dueDate: newRecord.dueDate,
      renewCount: 0,
      renewRemaining: MAX_RENEW_COUNT,
      inventory: buildInventory({ ...book, available }),
      reader: buildReaderResult(reader, borrowCount)
    }
  }

  function returnBook(id) {
    const bookStore = useBookStore()
    const readerStore = useReaderStore()
    const index = records.value.findIndex(record => record.id === id)

    if (index === -1) {
      return failure('return', [{ code: 'record_not_found', message: '借阅记录不存在，未执行归还。' }])
    }

    const record = records.value[index]
    const book = bookStore.getBookById(record.bookId)
    const reader = readerStore.getReaderById(record.readerId)

    if (record.returnDate || record.status === 'returned') {
      return failure(
        'return',
        [{
          code: 'already_returned',
          message: `该记录已于 ${record.returnDate || '此前'} 归还，不能重复归还；原记录、库存和读者借阅数均保持不变。`
        }],
        record,
        {
          dueDate: record.dueDate,
          renewCount: record.renewCount,
          inventory: buildInventory(book),
          reader: buildReaderResult(reader)
        }
      )
    }

    if (!book) {
      return failure(
        'return',
        [{ code: 'book_not_found', message: '关联图书已不存在，为避免库存错误已保留原借阅记录。' }],
        record,
        { dueDate: record.dueDate, renewCount: record.renewCount, inventory: null, reader: buildReaderResult(reader) }
      )
    }
    if (!reader) {
      return failure(
        'return',
        [{ code: 'reader_not_found', message: '关联读者已不存在，为避免借阅权限错误已保留原借阅记录。' }],
        record,
        { dueDate: record.dueDate, renewCount: record.renewCount, inventory: buildInventory(book), reader: null }
      )
    }

    const returnDate = formatDate(getToday())
    const updatedRecord = {
      ...record,
      returnDate,
      status: 'returned'
    }
    records.value[index] = updatedRecord

    const available = Math.min(book.total, book.available + 1)
    const borrowCount = Math.max(0, getReaderActiveBorrowCount(reader.id))
    bookStore.updateBook(book.id, { available })
    readerStore.updateReader(reader.id, { borrowCount })
    const decorated = decorateRecord(updatedRecord)

    return {
      success: true,
      action: 'return',
      code: 'return_success',
      message: '归还成功',
      errors: [],
      record: cloneRecord(updatedRecord),
      returnDate,
      dueDate: updatedRecord.dueDate,
      renewCount: updatedRecord.renewCount,
      inventory: buildInventory({ ...book, available }),
      reader: buildReaderResult(reader, borrowCount),
      stage: decorated.stage,
      stageTitle: decorated.stageTitle
    }
  }

  function renewBook(id) {
    const bookStore = useBookStore()
    const readerStore = useReaderStore()
    const index = records.value.findIndex(record => record.id === id)

    if (index === -1) {
      return failure('renew', [{ code: 'record_not_found', message: '借阅记录不存在，未执行续借。' }])
    }

    const record = records.value[index]
    const book = bookStore.getBookById(record.bookId)
    const reader = readerStore.getReaderById(record.readerId)
    const status = getBorrowStatus(record)
    const errors = []

    if (status === 'returned') {
      errors.push({
        code: 'already_returned',
        message: `该记录已于 ${record.returnDate || '此前'} 归还，不能续借；原记录保持不变。`
      })
    } else {
      if (!book) {
        errors.push({ code: 'book_not_found', message: '关联图书已不存在，续借结果无法同步库存，已保留原借阅记录。' })
      }
      if (!reader) {
        errors.push({ code: 'reader_not_found', message: '关联读者已不存在，续借结果无法同步借阅权限，已保留原借阅记录。' })
      }
      if (status === 'overdue') {
        errors.push({
          code: 'overdue_not_renewable',
          message: `记录已逾期 ${Math.abs(diffDays(getToday(), record.dueDate))} 天，请先归还，不能续借。`
        })
      }
      if (record.renewCount >= MAX_RENEW_COUNT) {
        errors.push({
          code: 'renew_limit_reached',
          message: `续借次数已达上限（${record.renewCount}/${MAX_RENEW_COUNT}），应还日期仍为 ${record.dueDate}。`
        })
      }
    }

    if (errors.length > 0) {
      return failure('renew', errors, record, {
        dueDate: record.dueDate,
        renewCount: record.renewCount,
        renewRemaining: Math.max(0, MAX_RENEW_COUNT - record.renewCount),
        inventory: buildInventory(book),
        reader: buildReaderResult(reader)
      })
    }

    const fromDueDate = record.dueDate
    const toDueDate = calculateDueDate(fromDueDate, RENEW_DAYS)
    const renewDate = formatDate(getToday())
    const updatedRecord = {
      ...record,
      dueDate: toDueDate,
      renewCount: record.renewCount + 1,
      renewHistory: [
        ...getRenewHistory(record),
        { renewDate, fromDueDate, toDueDate, index: record.renewCount + 1 }
      ],
      status: 'borrowed'
    }
    records.value[index] = updatedRecord
    const decorated = decorateRecord(updatedRecord)

    return {
      success: true,
      action: 'renew',
      code: 'renew_success',
      message: '续借成功',
      errors: [],
      record: cloneRecord(updatedRecord),
      dueDate: toDueDate,
      previousDueDate: fromDueDate,
      renewCount: updatedRecord.renewCount,
      renewRemaining: decorated.renewRemaining,
      nextDueDate: decorated.nextDueDate,
      inventory: buildInventory(book),
      reader: buildReaderResult(reader),
      stage: decorated.stage,
      stageTitle: decorated.stageTitle
    }
  }

  function searchRecords(keyword) {
    if (!keyword) return decoratedRecords.value
    const lowerKeyword = keyword.toLowerCase()
    return decoratedRecords.value.filter(record =>
      record.readerName.toLowerCase().includes(lowerKeyword) ||
      record.bookTitle.toLowerCase().includes(lowerKeyword) ||
      record.cardNo.toLowerCase().includes(lowerKeyword)
    )
  }

  return {
    records,
    decoratedRecords,
    loading,
    totalBorrowed,
    totalOverdue,
    todayBorrows,
    getRecordById,
    getDecoratedRecordById,
    getRecordsByReader,
    addRecord,
    borrowBook,
    returnBook,
    renewBook,
    searchRecords
  }
})

export { BORROW_DAYS as BORROW_PERIOD_DAYS, RENEW_DAYS as RENEW_PERIOD_DAYS }
