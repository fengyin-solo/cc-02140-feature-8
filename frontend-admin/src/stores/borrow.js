import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { borrowRecords as initialRecords } from '@/data/mockData'
import { useBookStore } from '@/stores/book'
import { useReaderStore } from '@/stores/reader'
import {
  ACTION_TEXT,
  BORROW_DAYS,
  MAX_RENEW_COUNT,
  RENEW_DAYS,
  buildFailureResult,
  getBookBlockReasons,
  getBorrowDueDate,
  getOverdueDays,
  getReaderBlockReasons,
  getRecordStatus,
  getRenewBlockReasons,
  getRenewedDueDate,
  getReturnBlockReason,
  getToday
} from '@/utils/borrowFlow'

const STORAGE_KEY = 'library_borrow_records'

export const useBorrowStore = defineStore('borrow', () => {
  function normalizeRecord(record) {
    return {
      ...record,
      renewCount: Number(record.renewCount || 0),
      status: getRecordStatus(record)
    }
  }

  const loadRecords = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        return JSON.parse(stored).map(normalizeRecord)
      } catch (e) {
        console.error('Failed to parse stored records:', e)
      }
    }
    return initialRecords.map(normalizeRecord)
  }

  const records = ref(loadRecords())
  const loading = ref(false)

  watch(records, (newRecords) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords))
  }, { deep: true })

  const totalBorrowed = computed(() =>
    records.value.filter(r => getRecordStatus(r) === 'borrowed').length
  )

  const totalOverdue = computed(() =>
    records.value.filter(r => getRecordStatus(r) === 'overdue').length
  )

  const todayBorrows = computed(() => {
    const today = getToday()
    return records.value.filter(r => r.borrowDate === today).length
  })

  function refreshStatuses() {
    records.value.forEach(record => {
      record.status = getRecordStatus(record)
    })
  }

  function getRecordById(id) {
    return records.value.find(record => record.id === Number(id))
  }

  function getDisplayRecord(record) {
    if (!record) return record
    return {
      ...record,
      status: getRecordStatus(record)
    }
  }

  function getRecordsByReader(readerId) {
    return records.value.filter(record => record.readerId === readerId)
  }

  function getActiveCountByReader(readerId) {
    return records.value.filter(record =>
      record.readerId === readerId && getRecordStatus(record) !== 'returned'
    ).length
  }

  function getNextId() {
    return records.value.length > 0
      ? Math.max(...records.value.map(r => r.id)) + 1
      : 1
  }

  function makeRecordData(record) {
    const today = getToday()
    return {
      ...record,
      id: getNextId(),
      borrowDate: today,
      dueDate: getBorrowDueDate(today),
      returnDate: null,
      status: 'borrowed',
      renewCount: 0
    }
  }

  // 保留原有新增记录方法，页面操作统一使用带校验和库存联动的 borrowBook。
  function addRecord(record) {
    const newRecord = makeRecordData(record)
    records.value.push(newRecord)
    return newRecord.id
  }

  function borrowBook(readerId, bookId) {
    refreshStatuses()

    const bookStore = useBookStore()
    const readerStore = useReaderStore()
    const reader = readerStore.getReaderById(readerId)
    const book = bookStore.getBookById(bookId)
    const activeCount = getActiveCountByReader(readerId)
    const reasons = [
      ...getReaderBlockReasons(reader, activeCount),
      ...getBookBlockReasons(book)
    ]

    if (reasons.length > 0) {
      return buildFailureResult('borrow', reasons, {
        reader: reader || null,
        book: book || null,
        activeCount,
        stock: book ? { available: book.available, total: book.total } : null
      })
    }

    const stockBefore = { available: book.available, total: book.total }
    const stockResult = bookStore.reserveBook(book.id)
    if (!stockResult.success || stockResult.available === stockBefore.available) {
      return buildFailureResult('borrow', ['图书无库存，库存扣减未完成'], {
        reader,
        book,
        activeCount,
        stock: stockBefore
      })
    }

    const newRecord = makeRecordData({
      readerId: reader.id,
      readerName: reader.name,
      cardNo: reader.cardNo,
      bookId: book.id,
      bookTitle: book.title,
      isbn: book.isbn
    })
    records.value.push(newRecord)
    readerStore.updateReader(reader.id, { borrowCount: activeCount + 1 })

    const updatedReader = readerStore.getReaderById(reader.id)
    return {
      success: true,
      action: 'borrow',
      message: '借出成功',
      reasons: [],
      warnings: [],
      record: getDisplayRecord(newRecord),
      reader: updatedReader,
      book: stockResult.book,
      stock: {
        before: stockBefore.available,
        after: stockResult.available,
        total: book.total
      },
      dueDate: newRecord.dueDate,
      renewCount: 0,
      activeCount: activeCount + 1,
      borrowDays: BORROW_DAYS
    }
  }

  function returnBook(id) {
    refreshStatuses()

    const bookStore = useBookStore()
    const readerStore = useReaderStore()
    const index = records.value.findIndex(record => record.id === Number(id))
    if (index === -1) {
      return buildFailureResult('return', ['借阅记录不存在，无法归还'])
    }

    const original = normalizeRecord(records.value[index])
    const blockReason = getReturnBlockReason(original)
    if (blockReason) {
      return buildFailureResult('return', [blockReason], {
        record: original,
        preserved: true
      })
    }

    const bookBefore = bookStore.getBookById(original.bookId)
    const stockBefore = bookBefore
      ? { available: bookBefore.available, total: bookBefore.total }
      : null
    const today = getToday()
    const beforeStatus = getRecordStatus(original, today)
    const overdueDays = getOverdueDays(original, today)

    records.value[index].returnDate = today
    records.value[index].status = 'returned'

    const stockResult = bookBefore ? bookStore.restoreBook(bookBefore.id) : null
    const activeCount = getActiveCountByReader(original.readerId)
    const reader = readerStore.getReaderById(original.readerId)
    if (reader) {
      readerStore.updateReader(reader.id, { borrowCount: activeCount })
    }

    const warnings = []
    if (!bookBefore) warnings.push('未找到对应图书，归还记录已保存，但库存未能联动增加')
    if (!reader) warnings.push('未找到对应读者，归还记录已保存，但读者在借数未能联动更新')
    if (stockResult?.capped) warnings.push('归还后库存已达到馆藏总数，库存按上限保留')

    return {
      success: true,
      action: 'return',
      message: overdueDays > 0 ? '逾期归还成功' : '归还成功',
      reasons: [],
      warnings,
      record: getDisplayRecord(records.value[index]),
      beforeStatus,
      overdueDays,
      reader: readerStore.getReaderById(original.readerId),
      book: stockResult?.book || bookBefore || null,
      stock: stockBefore && stockResult
        ? { before: stockBefore.available, after: stockResult.available, total: stockBefore.total }
        : null,
      returnDate: today,
      activeCount
    }
  }

  function renewBook(id) {
    refreshStatuses()

    const bookStore = useBookStore()
    const index = records.value.findIndex(record => record.id === Number(id))
    if (index === -1) {
      return buildFailureResult('renew', ['借阅记录不存在，无法续借'])
    }

    const original = normalizeRecord(records.value[index])
    const reasons = getRenewBlockReasons(original)
    if (reasons.length > 0) {
      return buildFailureResult('renew', reasons, {
        record: original,
        preserved: true
      })
    }

    const currentDueDate = original.dueDate
    const nextDueDate = getRenewedDueDate(currentDueDate)
    records.value[index].dueDate = nextDueDate
    records.value[index].renewCount = original.renewCount + 1
    records.value[index].status = getRecordStatus(records.value[index])

    const book = bookStore.getBookById(original.bookId)
    return {
      success: true,
      action: 'renew',
      message: '续借成功',
      reasons: [],
      warnings: [],
      record: getDisplayRecord(records.value[index]),
      book,
      stock: book ? { available: book.available, total: book.total } : null,
      dueDate: nextDueDate,
      previousDueDate: currentDueDate,
      renewCount: records.value[index].renewCount,
      renewDays: RENEW_DAYS,
      maxRenewCount: MAX_RENEW_COUNT
    }
  }

  function searchRecords(keyword) {
    if (!keyword) return records.value
    const lowerKeyword = keyword.toLowerCase()
    return records.value.filter(record =>
      record.readerName.toLowerCase().includes(lowerKeyword) ||
      record.bookTitle.toLowerCase().includes(lowerKeyword) ||
      record.cardNo.toLowerCase().includes(lowerKeyword)
    )
  }

  return {
    records,
    loading,
    totalBorrowed,
    totalOverdue,
    todayBorrows,
    refreshStatuses,
    getRecordById,
    getDisplayRecord,
    getRecordsByReader,
    getActiveCountByReader,
    addRecord,
    borrowBook,
    returnBook,
    renewBook,
    searchRecords
  }
})

export {
  ACTION_TEXT,
  BORROW_DAYS,
  MAX_RENEW_COUNT,
  RENEW_DAYS
}
