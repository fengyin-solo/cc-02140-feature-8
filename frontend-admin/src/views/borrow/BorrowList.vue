<template>
  <div class="borrow-list">
    <h2 class="page-title">借阅管理</h2>

    <!-- 统计卡片 - 丰富内容 -->
    <a-row :gutter="[16, 16]" class="stat-row">
      <a-col :xs="12" :sm="12" :md="6">
        <div class="stat-card-rich total">
          <div class="stat-card-header">
            <div class="stat-card-icon">
              <DatabaseOutlined />
            </div>
            <div class="stat-card-trend up">
              <RiseOutlined />
              <span>{{ todayBorrowCount }}</span>
            </div>
          </div>
          <div class="stat-card-body">
            <div class="stat-card-value">{{ filteredRecords.length }}</div>
            <div class="stat-card-label">总记录</div>
          </div>
          <div class="stat-card-footer">
            <span>今日新增 {{ todayBorrowCount }} 条</span>
          </div>
        </div>
      </a-col>
      <a-col :xs="12" :sm="12" :md="6">
        <div class="stat-card-rich borrowed">
          <div class="stat-card-header">
            <div class="stat-card-icon">
              <BookOutlined />
            </div>
            <div class="stat-card-badge">
              <ClockCircleOutlined />
            </div>
          </div>
          <div class="stat-card-body">
            <div class="stat-card-value">{{ filteredTotalBorrowed }}</div>
            <div class="stat-card-label">借阅中</div>
          </div>
          <div class="stat-card-footer">
            <a-progress
              :percent="borrowedPercent"
              :show-info="false"
              stroke-color="#1890ff"
              size="small"
            />
            <span>占比 {{ borrowedPercent }}%</span>
          </div>
        </div>
      </a-col>
      <a-col :xs="12" :sm="12" :md="6">
        <div class="stat-card-rich returned">
          <div class="stat-card-header">
            <div class="stat-card-icon">
              <CheckCircleOutlined />
            </div>
            <div class="stat-card-badge success">
              <SmileOutlined />
            </div>
          </div>
          <div class="stat-card-body">
            <div class="stat-card-value">{{ returnedCount }}</div>
            <div class="stat-card-label">已归还</div>
          </div>
          <div class="stat-card-footer">
            <a-progress
              :percent="returnedPercent"
              :show-info="false"
              stroke-color="#52c41a"
              size="small"
            />
            <span>归还率 {{ returnedPercent }}%</span>
          </div>
        </div>
      </a-col>
      <a-col :xs="12" :sm="12" :md="6">
        <div class="stat-card-rich overdue">
          <div class="stat-card-header">
            <div class="stat-card-icon">
              <ExclamationCircleOutlined />
            </div>
            <div class="stat-card-badge warning" v-if="filteredTotalOverdue > 0">
              <WarningOutlined />
            </div>
          </div>
          <div class="stat-card-body">
            <div class="stat-card-value">{{ filteredTotalOverdue }}</div>
            <div class="stat-card-label">已逾期</div>
          </div>
          <div class="stat-card-footer">
            <span v-if="filteredTotalOverdue > 0" class="warning-text">
              <AlertOutlined /> 请及时处理
            </span>
            <span v-else class="success-text">
              <CheckOutlined /> 暂无逾期
            </span>
          </div>
        </div>
      </a-col>
    </a-row>

    <!-- 搜索区域 -->
    <div class="search-area animate-slide-down">
      <a-row :gutter="16" align="middle">
        <a-col :xs="24" :sm="12" :md="8" :lg="6">
          <div class="search-input-wrapper">
            <a-input
              v-model:value="searchKeyword"
              placeholder="搜索读者、图书、卡号"
              allow-clear
              @input="onSearchInput"
              class="search-input"
            >
              <template #suffix>
                <SearchOutlined 
                  :class="['search-icon', { 'searching': isSearching }]" 
                />
              </template>
            </a-input>
          </div>
        </a-col>
        <a-col :xs="24" :sm="12" :md="8" :lg="6">
          <a-select
            v-model:value="selectedStatus"
            placeholder="选择状态"
            allow-clear
            style="width: 100%"
            @change="handleStatusChange"
          >
            <a-select-option value="borrowed">借阅中</a-select-option>
            <a-select-option value="returned">已归还</a-select-option>
            <a-select-option value="overdue">已逾期</a-select-option>
          </a-select>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="12" style="text-align: right;">
          <a-button type="primary" @click="showBorrowModal" class="add-btn">
            <PlusOutlined /> 新增借阅
          </a-button>
        </a-col>
      </a-row>
      <a-row :gutter="16" align="middle" style="margin-top: 16px;">
        <a-col :xs="24" :sm="12" :md="8" :lg="6">
          <a-range-picker
            v-model:value="dateRange"
            :placeholder="['开始日期', '结束日期']"
            allow-clear
            style="width: 100%"
            @change="handleDateRangeChange"
          >
            <template #suffixIcon>
              <CalendarOutlined />
            </template>
          </a-range-picker>
        </a-col>
        <a-col :xs="24" :sm="12" :md="16" :lg="18">
          <span class="filter-hint">
            <CalendarOutlined /> 按借阅日期筛选
          </span>
        </a-col>
      </a-row>
      
      <!-- 搜索结果提示 -->
      <transition name="fade-slide">
        <div v-if="hasFilters" class="search-result-tip">
          <span class="result-count">
            找到 <strong>{{ filteredRecords.length }}</strong> 条结果
          </span>
          <a-button type="link" size="small" @click="clearFilters" class="clear-btn">
            清除筛选
          </a-button>
        </div>
      </transition>
    </div>

    <!-- 借阅表格 -->
    <div :class="['table-container', 'animate-fade-in', { 'table-loading': tableAnimating }]">
      <!-- 加载动画遮罩 -->
      <transition name="fade">
        <div v-if="tableAnimating" class="table-loading-overlay">
          <div class="loading-spinner">
            <div class="spinner-ring"></div>
            <span>搜索中...</span>
          </div>
        </div>
      </transition>
      
      <a-table
        :columns="columns"
        :data-source="filteredRecords"
        :loading="loading"
        row-key="id"
        :pagination="{ pageSize: 10, showTotal: total => `共 ${total} 条` }"
        :row-class-name="getRowClassName"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'reader'">
            <div class="reader-cell" :style="{ animationDelay: `${index * 0.05}s` }">
              <div class="text-primary">{{ record.readerName }}</div>
              <div class="text-secondary">{{ record.cardNo }}</div>
            </div>
          </template>
          <template v-else-if="column.key === 'book'">
            <div class="book-cell">
              <div class="text-primary">{{ record.bookTitle }}</div>
              <div class="text-secondary">{{ record.isbn }}</div>
            </div>
          </template>
          <template v-else-if="column.key === 'status'">
            <div class="status-cell">
              <a-tag :color="getStatusColor(record.status)" :class="['status-tag', record.stage]">
                {{ getStatusText(record.status) }}
              </a-tag>
              <span class="stage-note">{{ record.stageTitle }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="4" wrap>
              <a-button
                type="link"
                size="small"
                class="table-action-btn detail-btn"
                @click="showDetail(record.id)"
              >
                <EyeOutlined /> 详情
              </a-button>
              <a-tooltip :title="record.canReturn ? '办理归还' : record.actionHint">
                <a-button
                  v-if="record.canReturn"
                  type="link"
                  size="small"
                  class="table-action-btn return-btn"
                  @click="handleReturn(record)"
                >
                  <CheckOutlined /> 归还
                </a-button>
              </a-tooltip>
              <a-tooltip :title="record.canRenew ? `续借后到期日：${record.nextDueDate}` : record.actionHint">
                <span>
                  <a-button
                    type="link"
                    size="small"
                    class="table-action-btn renew-btn"
                    :disabled="!record.canRenew"
                    @click="handleRenew(record)"
                  >
                    <ReloadOutlined /> 续借
                  </a-button>
                </span>
              </a-tooltip>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 借阅详情抽屉 -->
    <a-drawer
      v-model:open="detailVisible"
      title="借阅流程详情"
      width="620"
      :destroy-on-close="false"
      @close="detailVisible = false"
    >
      <template v-if="currentRecord">
        <a-alert
          :message="currentRecord.stageTitle"
          :description="currentRecord.stageDescription"
          :type="getAlertType(currentRecord.status)"
          show-icon
          class="stage-alert"
        />

        <div class="detail-summary">
          <div class="summary-item">
            <span class="summary-label">当前库存</span>
            <strong>{{ currentBook ? `${currentBook.available}/${currentBook.total}` : '--' }}</strong>
          </div>
          <div class="summary-item">
            <span class="summary-label">应还日期</span>
            <strong>{{ currentRecord.dueDate }}</strong>
          </div>
          <div class="summary-item">
            <span class="summary-label">续借次数</span>
            <strong>{{ currentRecord.renewCount }}/{{ currentRecord.renewLimit }}</strong>
          </div>
        </div>

        <a-descriptions :column="1" bordered size="small" class="detail-descriptions">
          <a-descriptions-item label="读者">
            {{ currentRecord.readerName }}（{{ currentRecord.cardNo }}）
          </a-descriptions-item>
          <a-descriptions-item label="图书">
            {{ currentRecord.bookTitle }}（{{ currentRecord.isbn }}）
          </a-descriptions-item>
          <a-descriptions-item label="借出日期">{{ currentRecord.borrowDate }}</a-descriptions-item>
          <a-descriptions-item label="归还日期">{{ currentRecord.effectiveReturnDate || '尚未归还' }}</a-descriptions-item>
          <a-descriptions-item label="阶段可操作说明">{{ currentRecord.actionHint }}</a-descriptions-item>
        </a-descriptions>

        <a-timeline class="stage-timeline">
          <a-timeline-item color="blue">
            <div class="timeline-title">借出（{{ currentRecord.borrowDate }}）</div>
            <div class="timeline-desc">库存借出 1 本，初始借期 {{ borrowPeriodDays }} 天。</div>
          </a-timeline-item>
          <a-timeline-item
            v-for="(item, index) in currentRecord.renewHistory"
            :key="`renew-${index}`"
            color="green"
          >
            <div class="timeline-title">
              续借 {{ item.index }}/{{ currentRecord.renewLimit }}
              <span v-if="item.renewDate">（{{ item.renewDate }}）</span>
            </div>
            <div class="timeline-desc">
              到期日 <s v-if="item.fromDueDate">{{ item.fromDueDate }}</s>
              <span v-if="item.fromDueDate"> → </span>
              {{ item.toDueDate }}，延长 {{ renewPeriodDays }} 天
              <span v-if="!item.renewDate">（历史记录）</span>
            </div>
          </a-timeline-item>
          <a-timeline-item :color="getDueTimelineColor(currentRecord)">
            <div class="timeline-title">到期 / 逾期</div>
            <div class="timeline-desc">{{ getDueDescription(currentRecord) }}</div>
          </a-timeline-item>
          <a-timeline-item :color="currentRecord.status === 'returned' ? 'green' : 'gray'">
            <div class="timeline-title">归还</div>
            <div class="timeline-desc">
              {{ currentRecord.effectiveReturnDate ? `已于 ${currentRecord.effectiveReturnDate} 完成归还。` : '等待办理归还，归还后记录保留且状态不会回退。' }}
            </div>
          </a-timeline-item>
        </a-timeline>

      </template>
      <template #extra v-if="currentRecord">
        <a-space>
          <a-button
            type="primary"
            :disabled="!currentRecord.canReturn"
            @click="handleReturn(currentRecord)"
          >
            <CheckOutlined /> 立即归还
          </a-button>
          <a-button
            :disabled="!currentRecord.canRenew"
            @click="handleRenew(currentRecord)"
          >
            <ReloadOutlined /> 办理续借
          </a-button>
        </a-space>
      </template>
    </a-drawer>

    <!-- 新增借阅弹窗 -->
    <a-modal
      v-model:open="borrowModalVisible"
      title="新增借阅"
      :confirm-loading="submitLoading"
      @ok="handleBorrowSubmit"
      @cancel="handleModalClose"
      width="500px"
    >
      <a-form
        ref="borrowFormRef"
        :model="borrowForm"
        :rules="borrowRules"
        :label-col="{ span: 5 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item label="读者" name="readerId">
          <a-select
            v-model:value="borrowForm.readerId"
            placeholder="请选择读者（含不可借读者，用于显示具体原因）"
            show-search
            :filter-option="filterReader"
          >
            <a-select-option
              v-for="reader in selectableReaders"
              :key="reader.id"
              :value="reader.id"
              :label="reader.name"
            >
              {{ reader.name }} ({{ reader.cardNo }}｜{{ getReaderOptionText(reader) }})
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="图书" name="bookId">
          <a-select
            v-model:value="borrowForm.bookId"
            placeholder="请选择图书"
            show-search
            :filter-option="filterBook"
          >
            <a-select-option
              v-for="book in selectableBooks"
              :key="book.id"
              :value="book.id"
              :label="book.title"
            >
              {{ book.title }} (库存: {{ book.available }}/{{ book.total }})
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-alert
          v-if="borrowValidationMessages.length"
          type="error"
          show-icon
          class="borrow-alert"
          message="当前选择不可借出"
        >
          <template #description>
            <div v-for="(item, index) in borrowValidationMessages" :key="`${item.code}-${index}`" class="result-line">
              {{ index + 1}}. {{ item.message }}
            </div>
          </template>
        </a-alert>
        <a-alert
          v-else
          type="info"
          show-icon
          class="borrow-alert"
          :message="borrowPreviewText"
        />
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, h } from 'vue'
import { notification } from 'ant-design-vue'
import {
  PlusOutlined,
  CheckOutlined,
  ReloadOutlined,
  EyeOutlined,
  DatabaseOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RiseOutlined,
  ClockCircleOutlined,
  SmileOutlined,
  WarningOutlined,
  AlertOutlined,
  SearchOutlined,
  CalendarOutlined
} from '@ant-design/icons-vue'
import {
  useBorrowStore,
  BORROW_PERIOD_DAYS,
  RENEW_PERIOD_DAYS,
  MAX_RENEW_COUNT,
  calculateDueDate,
  formatDate,
  getToday
} from '@/stores/borrow'
import { useReaderStore } from '@/stores/reader'
import { useBookStore } from '@/stores/book'

const borrowStore = useBorrowStore()
const readerStore = useReaderStore()
const bookStore = useBookStore()

const loading = ref(false)
const searchKeyword = ref('')
const selectedStatus = ref(null)
const dateRange = ref(null)
const borrowModalVisible = ref(false)
const submitLoading = ref(false)
const borrowFormRef = ref(null)
const isSearching = ref(false)
const tableAnimating = ref(false)
const detailVisible = ref(false)
const currentDetailId = ref(null)
const borrowPeriodDays = BORROW_PERIOD_DAYS
const renewPeriodDays = RENEW_PERIOD_DAYS
let searchTimeout = null

const columns = [
  { title: '读者信息', key: 'reader', width: 160 },
  { title: '图书信息', key: 'book', width: 200 },
  { title: '借阅日期', dataIndex: 'borrowDate', key: 'borrowDate', width: 110 },
  { title: '应还日期', dataIndex: 'dueDate', key: 'dueDate', width: 110 },
  { title: '归还日期', dataIndex: 'returnDate', key: 'returnDate', width: 110 },
  { title: '续借次数', dataIndex: 'renewCount', key: 'renewCount', width: 90 },
  { title: '状态', key: 'status', width: 120 },
  { title: '操作', key: 'action', width: 220, fixed: 'right' }
]

const borrowForm = reactive({
  readerId: null,
  bookId: null
})

const borrowRules = {
  readerId: [{ required: true, message: '请选择读者' }],
  bookId: [{ required: true, message: '请选择图书' }]
}

const hasFilters = computed(() => {
  return searchKeyword.value || selectedStatus.value || dateRange.value
})

const filteredRecords = computed(() => {
  let result = borrowStore.decoratedRecords

  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(record =>
      record.readerName.toLowerCase().includes(keyword) ||
      record.bookTitle.toLowerCase().includes(keyword) ||
      record.cardNo.toLowerCase().includes(keyword)
    )
  }

  if (selectedStatus.value) {
    result = result.filter(record => record.status === selectedStatus.value)
  }

  if (dateRange.value && dateRange.value.length === 2) {
    const startDate = dateRange.value[0].format('YYYY-MM-DD')
    const endDate = dateRange.value[1].format('YYYY-MM-DD')
    result = result.filter(record => {
      return record.borrowDate >= startDate && record.borrowDate <= endDate
    })
  }

  return result
})

const filteredTotalBorrowed = computed(() => {
  return filteredRecords.value.filter(r => r.status === 'borrowed').length
})

const filteredTotalOverdue = computed(() => {
  return filteredRecords.value.filter(r => r.status === 'overdue').length
})

const returnedCount = computed(() => {
  return filteredRecords.value.filter(r => r.status === 'returned').length
})

const todayBorrowCount = computed(() => {
  const today = formatDate(getToday())
  return filteredRecords.value.filter(r => r.borrowDate === today).length
})

const borrowedPercent = computed(() => {
  const total = filteredRecords.value.length
  if (total === 0) return 0
  return Math.round((filteredTotalBorrowed.value / total) * 100)
})

const returnedPercent = computed(() => {
  const total = filteredRecords.value.length
  if (total === 0) return 0
  return Math.round((returnedCount.value / total) * 100)
})

const selectableReaders = computed(() => readerStore.readers)

const selectableBooks = computed(() => bookStore.books)

const selectedReader = computed(() => {
  return readerStore.getReaderById(borrowForm.readerId)
})

const selectedBook = computed(() => {
  return bookStore.getBookById(borrowForm.bookId)
})

const selectedBorrowCount = computed(() => {
  if (!selectedReader.value) return 0
  return borrowStore.decoratedRecords.filter(record =>
    record.readerId === selectedReader.value.id &&
    (record.status === 'borrowed' || record.status === 'overdue')
  ).length
})

const borrowValidationMessages = computed(() => {
  const messages = []
  const reader = selectedReader.value
  const book = selectedBook.value

  if (reader && reader.status !== 'active') {
    messages.push({
      code: 'reader_inactive',
      message: `读者当前不可借：账号${reader.status === 'expired' ? '已过期' : '已停用'}。`
    })
  }
  if (selectedBorrowCount.value >= reader.maxBorrow) {
    messages.push({
      code: 'reader_limit_reached',
      message: `借阅数已达上限：${selectedBorrowCount.value}/${reader.maxBorrow} 本。`
    })
  }
  if (book && book.available <= 0) {
    messages.push({
      code: 'book_out_of_stock',
      message: `图书无库存：${book.title} 当前 0/${book.total} 本。`
    })
  }

  return messages
})

const borrowPreviewText = computed(() => {
  const readerText = selectedReader.value
    ? `已借 ${selectedBorrowCount.value}/${selectedReader.value.maxBorrow} 本`
    : '请选择读者'
  const bookText = selectedBook.value
    ? `库存 ${selectedBook.value.available}/${selectedBook.value.total} 本`
    : '请选择图书'
  return `${readerText}；${bookText}；借期 ${borrowPeriodDays} 天，到期日 ${calculateDueDate()}，最多续借 ${MAX_RENEW_COUNT} 次。`
})

const currentRecord = computed(() => {
  return currentDetailId.value === null
    ? null
    : borrowStore.getDecoratedRecordById(currentDetailId.value)
})

const currentBook = computed(() => {
  return currentRecord.value ? bookStore.getBookById(currentRecord.value.bookId) : null
})

function getActiveBorrowCount(readerId) {
  return borrowStore.decoratedRecords.filter(record =>
    record.readerId === readerId &&
    (record.status === 'borrowed' || record.status === 'overdue')
  ).length
}

function getReaderOptionText(reader) {
  const count = getActiveBorrowCount(reader.id)
  if (reader.status !== 'active') return '不可借：已过期'
  if (count >= reader.maxBorrow) return '不可借：已达上限'
  return `${count}/${reader.maxBorrow} 本`
}

function getStatusColor(status) {
  const colors = {
    borrowed: 'processing',
    returned: 'success',
    overdue: 'error'
  }
  return colors[status] || 'default'
}

function getStatusText(status) {
  const texts = {
    borrowed: '借阅中',
    returned: '已归还',
    overdue: '已逾期'
  }
  return texts[status] || status
}

function getAlertType(status) {
  const types = {
    borrowed: 'info',
    returned: 'success',
    overdue: 'error'
  }
  return types[status] || 'info'
}

function getDueTimelineColor(record) {
  if (record.status === 'returned') {
    return record.returnedLate ? 'red' : 'green'
  }
  return record.status === 'overdue' ? 'red' : 'blue'
}

function getDueDescription(record) {
  if (record.status === 'returned') {
    return record.returnedLate
      ? `原应还日期 ${record.dueDate}，逾期 ${record.lateDays} 天后归还。`
      : `应还日期 ${record.dueDate}，记录已按时结束。`
  }
  if (record.status === 'overdue') {
    return `应还日期 ${record.dueDate}，当前已逾期 ${record.overdueDays} 天。`
  }
  return `应还日期 ${record.dueDate}，距离到期还有 ${record.daysToDue} 天。`
}

function filterReader(input, option) {
  return option.label.toLowerCase().includes(input.toLowerCase())
}

function filterBook(input, option) {
  return option.label.toLowerCase().includes(input.toLowerCase())
}

function handleStatusChange() {
  triggerSearchAnimation()
}

function handleDateRangeChange() {
  triggerSearchAnimation()
}

// 搜索输入时的动画效果
function onSearchInput() {
  isSearching.value = true
  
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  searchTimeout = setTimeout(() => {
    isSearching.value = false
    triggerSearchAnimation()
  }, 300)
}

// 触发表格搜索动画和loading
function triggerSearchAnimation() {
  loading.value = true
  tableAnimating.value = true
  setTimeout(() => {
    tableAnimating.value = false
    loading.value = false
  }, 600)
}

// 清除筛选
function clearFilters() {
  searchKeyword.value = ''
  selectedStatus.value = null
  dateRange.value = null
  triggerSearchAnimation()
}

// 获取行样式类名
function getRowClassName(record, index) {
  return `table-row-animate row-${index}`
}

function handleModalClose() {
  nextTick(() => {
    borrowFormRef.value?.resetFields()
  })
}

function showBorrowModal() {
  borrowForm.readerId = null
  borrowForm.bookId = null
  borrowModalVisible.value = true
  nextTick(() => {
    borrowFormRef.value?.clearValidate()
  })
}

function showDetail(id) {
  currentDetailId.value = id
  detailVisible.value = true
}

function renderResultDescription(result) {
  const lines = result.errors?.length
    ? result.errors.map((item, index) => `${index + 1}. ${item.message}`)
    : []

  if (result.success) {
    lines.push(`到期日：${result.dueDate}`)
    lines.push(`续借次数：${result.renewCount}/${MAX_RENEW_COUNT}`)
    if (result.inventory) {
      lines.push(`库存：${result.inventory.available}/${result.inventory.total}`)
    }
    if (result.reader) {
      lines.push(`读者借阅数：${result.reader.borrowCount}/${result.reader.maxBorrow}`)
    }
  } else {
    lines.push('原借阅记录、库存和读者借阅数均未改动。')
  }

  return h(
    'div',
    { class: 'action-result-description' },
    lines.map(line => h('div', { class: 'result-line' }, line))
  )
}

function showActionResult(result) {
  notification.open({
    message: result.message,
    description: renderResultDescription(result),
    type: result.success ? 'success' : 'error',
    placement: 'topRight',
    duration: result.success ? 3 : 6
  })
}

async function handleBorrowSubmit() {
  try {
    await borrowFormRef.value.validate()
    submitLoading.value = true
    await new Promise(resolve => setTimeout(resolve, 500))

    const result = borrowStore.borrowBook({
      readerId: borrowForm.readerId,
      bookId: borrowForm.bookId
    })

    showActionResult(result)
    if (result.success) {
      borrowModalVisible.value = false
    }
  } catch (error) {
    console.error('表单验证失败:', error)
  } finally {
    submitLoading.value = false
  }
}

function handleReturn(record) {
  const result = borrowStore.returnBook(record.id)
  showActionResult(result)
}

function handleRenew(record) {
  const result = borrowStore.renewBook(record.id)
  showActionResult(result)
}
</script>

<style lang="less" scoped>
.borrow-list {
  .page-title {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 24px;
  }
}

.stat-row {
  margin-bottom: 16px;
}

.stat-card-rich {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  border-left: 4px solid transparent;
  height: 100%;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    background: #f0f7ff;
  }

  &.total {
    border-left-color: #667eea;
    .stat-card-icon { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .stat-card-value { color: #667eea; }
  }

  &.borrowed {
    border-left-color: #1890ff;
    .stat-card-icon { background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%); }
    .stat-card-value { color: #1890ff; }
  }

  &.returned {
    border-left-color: #52c41a;
    .stat-card-icon { background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%); }
    .stat-card-value { color: #52c41a; }
  }

  &.overdue {
    border-left-color: #ff4d4f;
    .stat-card-icon { background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%); }
    .stat-card-value { color: #ff4d4f; }
  }

  .stat-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .stat-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: #fff;
    }

    .stat-card-trend {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 12px;

      &.up {
        background: #f6ffed;
        color: #52c41a;
      }
    }

    .stat-card-badge {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      background: #e6f7ff;
      color: #1890ff;

      &.success {
        background: #f6ffed;
        color: #52c41a;
      }

      &.warning {
        background: #fff2e8;
        color: #fa541c;
        animation: pulse 1.5s infinite;
      }
    }
  }

  .stat-card-body {
    margin-bottom: 12px;

    .stat-card-value {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
    }

    .stat-card-label {
      font-size: 14px;
      color: #999;
      margin-top: 4px;
    }
  }

  .stat-card-footer {
    font-size: 12px;
    color: #999;
    padding-top: 12px;
    border-top: 1px dashed #f0f0f0;

    :deep(.ant-progress) {
      margin-bottom: 4px;
    }

    .warning-text {
      color: #fa541c;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .success-text {
      color: #52c41a;
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// ========================================
// 动画定义
// ========================================
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes rowFadeIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

// ========================================
// 动画类
// ========================================
.animate-fade-in {
  animation: fadeIn 0.5s ease-out both;
}

.animate-slide-down {
  animation: slideDown 0.5s ease-out both;
}

// ========================================
// 过渡动画
// ========================================
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.search-area {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 20px;
  margin-bottom: 16px;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }
  
  .search-input-wrapper {
    position: relative;
    
    .search-input {
      transition: all 0.3s ease;
      
      &:focus-within {
        box-shadow: 0 0 0 2px rgba(250, 173, 20, 0.2);
      }
    }
    
    .search-icon {
      color: rgba(0, 0, 0, 0.45);
      cursor: pointer;
      transition: all 0.3s ease;
      
      &:hover {
        color: #faad14;
        transform: scale(1.1);
      }
      
      &.searching {
        animation: pulse 0.5s ease-in-out infinite;
        color: #faad14;
      }
    }
  }
  
  .add-btn {
    transition: all 0.3s ease;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(24, 144, 255, 0.4);
    }
  }
  
  .filter-hint {
    font-size: 13px;
    color: #999;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .search-result-tip {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px dashed #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    .result-count {
      color: #666;
      font-size: 13px;
      
      strong {
        color: #faad14;
        font-size: 16px;
        margin: 0 4px;
      }
    }
    
    .clear-btn {
      font-size: 13px;
      
      &:hover {
        color: #ff4d4f;
      }
    }
  }
}

.table-container {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 20px;
  position: relative;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }
  
  &.table-loading {
    .ant-table {
      filter: blur(2px);
      pointer-events: none;
    }
  }
  
  .table-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 12px;
    
    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      
      .spinner-ring {
        width: 40px;
        height: 40px;
        border: 3px solid #f0f0f0;
        border-top-color: #faad14;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      span {
        color: #faad14;
        font-size: 14px;
      }
    }
  }

  // 表格行样式
  :deep(.ant-table-tbody) {
    .ant-table-row {
      &:hover td {
        background: #fafafa !important;
      }
    }
  }

  .table-action-btn {
    padding: 2px 4px;
    height: auto;
    border-radius: 4px;
    transition: all 0.2s ease;

    &.return-btn:hover,
    &.renew-btn:hover,
    &.detail-btn:hover {
      color: #1890ff;
      background: #e6f7ff;
    }

    &:disabled {
      color: #bfbfbf;
      background: transparent;
    }
  }
  
  .completed-text {
    color: #52c41a;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.status-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;

  .stage-note {
    font-size: 12px;
    color: #666;
    line-height: 1.2;
  }
}

.borrow-alert {
  margin-left: 20.8333%;
}

.stage-alert {
  margin-bottom: 16px;
}

.detail-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;

  .summary-item {
    background: #f8fafc;
    border: 1px solid #edf2f7;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .summary-label {
      font-size: 12px;
      color: #8c8c8c;
    }

    strong {
      color: #1f2937;
      font-size: 16px;
    }
  }
}

.detail-descriptions {
  margin-bottom: 20px;
}

.stage-timeline {
  margin-top: 8px;
  padding-left: 4px;

  .timeline-title {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 4px;
  }

  .timeline-desc {
    font-size: 13px;
    color: #666;
    line-height: 1.6;
  }
}

:global(.action-result-description) {
  .result-line {
    line-height: 1.7;
  }
}

.reader-cell,
.book-cell {
  // 保持默认样式
}

.text-primary {
  font-weight: 500;
  color: #1a1a1a;
}

.text-secondary {
  font-size: 12px;
  color: #999;
}

.status-tag {
  // 保持默认样式
}
</style>
