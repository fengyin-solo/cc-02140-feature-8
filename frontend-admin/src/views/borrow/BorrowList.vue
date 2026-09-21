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

    <!-- 流程阶段说明 -->
    <div class="flow-guide animate-fade-in">
      <div
        v-for="stage in flowStages"
        :key="stage.key"
        class="flow-guide-item"
      >
        <div class="flow-guide-index">{{ stage.index }}</div>
        <div class="flow-guide-content">
          <div class="flow-guide-title">{{ stage.title }}</div>
          <div class="flow-guide-desc">{{ stage.desc }}</div>
          <div class="flow-guide-action">{{ stage.action }}</div>
        </div>
      </div>
    </div>

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
          <template v-else-if="column.key === 'stage'">
            <div class="stage-cell">
              <div class="stage-main">{{ getStageHint(record) }}</div>
              <div class="stage-sub" :class="{ danger: getEffectiveStatus(record) === 'overdue' }">
                {{ getStageSubHint(record) }}
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="getStatusColor(getEffectiveStatus(record))" :class="['status-tag', getEffectiveStatus(record)]">
              {{ getStatusText(getEffectiveStatus(record)) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="4" wrap>
              <a-button
                type="link"
                size="small"
                class="table-action-btn detail-btn"
                @click="showDetail(record)"
              >
                <EyeOutlined /> 详情
              </a-button>
              <a-button
                type="link"
                size="small"
                class="table-action-btn return-btn"
                @click="handleReturn(record)"
              >
                <CheckOutlined /> 归还
              </a-button>

              <a-button
                type="link"
                size="small"
                class="table-action-btn renew-btn"
                @click="handleRenew(record)"
              >
                <ReloadOutlined /> 续借
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 新增借阅弹窗 -->
    <a-modal
      v-model:open="borrowModalVisible"
      title="新增借阅"
      :confirm-loading="submitLoading"
      @ok="handleBorrowSubmit"
      @cancel="handleModalClose"
      width="560px"
    >
      <a-alert
        v-if="borrowFeedback && !borrowFeedback.success"
        type="error"
        show-icon
        class="borrow-result-alert"
        :message="borrowFeedback.message"
      >
        <template #description>
          <div class="result-description">
            <div v-for="reason in borrowFeedback.reasons" :key="reason" class="result-reason">
              <CloseCircleOutlined /> {{ reason }}
            </div>
            <div class="result-preserve">当前选择、原借阅记录和库存均未改动。</div>
          </div>
        </template>
      </a-alert>

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
            placeholder="请选择读者"
            show-search
            :filter-option="filterReader"
          >
            <a-select-option
              v-for="reader in readerStore.readers"
              :key="reader.id"
              :value="reader.id"
              :label="`${reader.name} ${reader.cardNo} ${getReaderOptionMeta(reader)}`"
            >
              {{ reader.name }} ({{ reader.cardNo }}) - {{ getReaderOptionMeta(reader) }}
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
              v-for="book in bookStore.books"
              :key="book.id"
              :value="book.id"
              :label="`${book.title} ${book.isbn} ${getBookOptionMeta(book)}`"
            >
              {{ book.title }} - {{ getBookOptionMeta(book) }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 借阅详情抽屉 -->
    <a-drawer
      v-model:open="detailVisible"
      title="借阅流程详情"
      width="560"
      :destroy-on-close="false"
    >
      <template v-if="currentRecord">
        <a-descriptions :column="1" bordered size="small" class="detail-descriptions">
          <a-descriptions-item label="读者">
            {{ currentRecord.readerName }}（{{ currentRecord.cardNo }}）
          </a-descriptions-item>
          <a-descriptions-item label="图书">
            {{ currentRecord.bookTitle }}（{{ currentRecord.isbn }}）
          </a-descriptions-item>
          <a-descriptions-item label="当前状态">
            <a-tag :color="getStatusColor(getEffectiveStatus(currentRecord))">
              {{ getStatusText(getEffectiveStatus(currentRecord)) }}
            </a-tag>
            <span class="detail-stage-hint">{{ getStageHint(currentRecord) }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="借阅日期">{{ currentRecord.borrowDate }}</a-descriptions-item>
          <a-descriptions-item label="应还日期">
            <span :class="{ 'danger-text': getEffectiveStatus(currentRecord) === 'overdue' }">
              {{ currentRecord.dueDate }}
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="归还日期">
            {{ currentRecord.returnDate || '暂未归还' }}
          </a-descriptions-item>
          <a-descriptions-item label="续借次数">
            {{ currentRecord.renewCount }} / {{ MAX_RENEW_COUNT }}
          </a-descriptions-item>
          <a-descriptions-item label="当前库存">
            <template v-if="detailBook">{{ detailBook.available }} / {{ detailBook.total }}</template>
            <span v-else class="text-secondary">未找到图书库存信息</span>
          </a-descriptions-item>
          <a-descriptions-item label="读者在借">
            <template v-if="detailReader">
              {{ currentReaderActiveCount }} / {{ detailReader.maxBorrow }}
            </template>
            <span v-else class="text-secondary">未找到读者权限信息</span>
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-flow-stages">
          <div
            v-for="stage in detailStages"
            :key="stage.key"
            :class="['detail-stage', stage.state]"
          >
            <div class="detail-stage-index">
              <CheckOutlined v-if="stage.state === 'done'" />
              <span v-else>{{ stage.index }}</span>
            </div>
            <div class="detail-stage-body">
              <div class="detail-stage-title">
                {{ stage.title }}
                <a-tag :color="stageTagColor(stage.state)" size="small">{{ stage.stateText }}</a-tag>
              </div>
              <div class="detail-stage-desc">{{ stage.desc }}</div>
              <div class="detail-stage-action">{{ stage.action }}</div>
            </div>
          </div>
        </div>

        <a-alert
          v-if="detailFeedback"
          :type="detailFeedbackType"
          show-icon
          :message="detailFeedback.message"
          class="detail-feedback"
        >
          <template #description>
            <div class="result-description">
              <div v-if="formatResultSummary(detailFeedback)" class="result-summary">
                {{ formatResultSummary(detailFeedback) }}
              </div>
              <div v-for="reason in detailFeedback.reasons" :key="reason" class="result-reason">
                <CloseCircleOutlined /> {{ reason }}
              </div>
              <div v-for="warning in detailFeedback.warnings" :key="warning" class="result-warning">
                <ExclamationCircleOutlined /> {{ warning }}
              </div>
              <div v-if="!detailFeedback.success" class="result-preserve">
                原记录、到期日、续借次数和库存均已保留。
              </div>
            </div>
          </template>
        </a-alert>
      </template>

      <template #footer>
        <div class="detail-footer">
          <a-button @click="detailVisible = false">返回列表</a-button>
          <a-button
            v-if="currentRecord"
            type="primary"
            :loading="actionLoading"
            @click="handleReturn(currentRecord)"
          >
            <CheckOutlined /> 确认归还
          </a-button>

          <a-button
            v-if="currentRecord"
            :loading="actionLoading"
            @click="handleRenew(currentRecord)"
          >
            <ReloadOutlined /> 确认续借
          </a-button>
        </div>
      </template>
    </a-drawer>
  </div>
</template>

<script setup>
import { h, ref, reactive, computed, nextTick, onMounted } from 'vue'
import { message, notification } from 'ant-design-vue'
import {
  PlusOutlined,
  CheckOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  RiseOutlined,
  ClockCircleOutlined,
  SmileOutlined,
  WarningOutlined,
  AlertOutlined,
  SearchOutlined,
  CalendarOutlined,
  EyeOutlined
} from '@ant-design/icons-vue'
import { useBorrowStore } from '@/stores/borrow'
import { useReaderStore } from '@/stores/reader'
import { useBookStore } from '@/stores/book'
import {
  BORROW_DAYS,
  MAX_RENEW_COUNT,
  RENEW_DAYS,
  canRenew as canRenewRecord,
  getOverdueDays,
  getReaderBlockReasons,
  getRecordStatus,
  getRenewBlockReasons,
  getReturnBlockReason
} from '@/utils/borrowFlow'

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
const borrowFeedback = ref(null)
const detailVisible = ref(false)
const detailId = ref(null)
const detailFeedback = ref(null)
const actionLoading = ref(false)
let searchTimeout = null

const columns = [
  { title: '读者信息', key: 'reader', width: 150 },
  { title: '图书信息', key: 'book', width: 190 },
  { title: '当前阶段', key: 'stage', width: 180 },
  { title: '借阅日期', dataIndex: 'borrowDate', key: 'borrowDate', width: 110 },
  { title: '应还日期', dataIndex: 'dueDate', key: 'dueDate', width: 110 },
  { title: '归还日期', dataIndex: 'returnDate', key: 'returnDate', width: 110 },
  { title: '续借次数', dataIndex: 'renewCount', key: 'renewCount', width: 90 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 230, fixed: 'right' }
]

const borrowForm = reactive({
  readerId: null,
  bookId: null
})

const borrowRules = {
  readerId: [{ required: true, message: '请选择读者' }],
  bookId: [{ required: true, message: '请选择图书' }]
}

const flowStages = [
  {
    key: 'borrowed',
    index: 1,
    title: '借出',
    desc: '校验读者权限与图书库存',
    action: `借出后生成 ${BORROW_DAYS} 天应还日期，库存 -1`
  },
  {
    key: 'renew',
    index: 2,
    title: '续借',
    desc: '仅借阅中的记录可续借',
    action: `每次延长 ${RENEW_DAYS} 天，最多续借 ${MAX_RENEW_COUNT} 次`
  },
  {
    key: 'overdue',
    index: 3,
    title: '逾期',
    desc: '超过应还日期且未归还即逾期',
    action: '逾期记录停止续借，仅允许办理归还'
  },
  {
    key: 'returned',
    index: 4,
    title: '归还',
    desc: '登记实际归还日期并保留原记录',
    action: '归还后库存 +1、读者在借数 -1，状态不再回退'
  }
]

const hasFilters = computed(() => {
  return searchKeyword.value || selectedStatus.value || dateRange.value
})

const effectiveRecords = computed(() =>
  borrowStore.records.map(record => borrowStore.getDisplayRecord(record))
)

const filteredRecords = computed(() => {
  let result = effectiveRecords.value

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
  const today = new Date().toISOString().split('T')[0]
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

const currentRecord = computed(() => {
  if (!detailId.value) return null
  const record = borrowStore.getRecordById(detailId.value)
  return record ? borrowStore.getDisplayRecord(record) : null
})

const detailBook = computed(() => {
  return currentRecord.value ? bookStore.getBookById(currentRecord.value.bookId) : null
})

const detailReader = computed(() => {
  return currentRecord.value ? readerStore.getReaderById(currentRecord.value.readerId) : null
})

const currentReaderActiveCount = computed(() => {
  return currentRecord.value
    ? borrowStore.getActiveCountByReader(currentRecord.value.readerId)
    : 0
})

const detailStages = computed(() => {
  const record = currentRecord.value
  if (!record) return []

  const status = getRecordStatus(record)
  const overdueDays = getOverdueDays(record)
  const wasOverdueWhenReturned = status === 'returned' && record.returnDate && record.dueDate < record.returnDate
  const renewState = record.renewCount > 0
    ? 'done'
    : status === 'borrowed'
      ? 'active'
      : 'disabled'
  const overdueState = status === 'overdue'
    ? 'active'
    : wasOverdueWhenReturned
      ? 'done'
      : status === 'borrowed'
        ? 'wait'
        : 'disabled'

  return [
    {
      ...flowStages[0],
      state: status === 'borrowed' ? 'active' : 'done',
      stateText: status === 'borrowed' ? '当前' : '已完成',
      desc: `借出日期：${record.borrowDate}`,
      action: `应还日期：${record.dueDate}，借出周期 ${BORROW_DAYS} 天`
    },
    {
      ...flowStages[1],
      state: renewState,
      stateText: { done: '已续借', active: '可办理', disabled: '不可办理' }[renewState],
      desc: `已续借 ${record.renewCount}/${MAX_RENEW_COUNT} 次`,
      action: renewState === 'active'
        ? `续借后当前应还日期顺延 ${RENEW_DAYS} 天`
        : renewState === 'done'
          ? '续借结果已计入当前应还日期'
          : status === 'overdue'
            ? '图书已逾期，需先归还'
            : '记录已归还，不能继续续借'
    },
    {
      ...flowStages[2],
      state: overdueState,
      stateText: { done: '曾逾期', active: '逾期中', wait: '未逾期', disabled: '未发生' }[overdueState],
      desc: status === 'overdue'
        ? `已逾期 ${overdueDays} 天`
        : wasOverdueWhenReturned
          ? '归还时已处于逾期状态'
          : '当前未超过应还日期',
      action: overdueState === 'active' ? '此阶段只可办理归还' : '逾期依据应还日期自动计算'
    },
    {
      ...flowStages[3],
      state: status === 'returned' ? 'done' : 'active',
      stateText: status === 'returned' ? '已完成' : '可办理',
      desc: record.returnDate ? `归还日期：${record.returnDate}` : '暂未登记归还',
      action: status === 'returned'
        ? '记录已归档，不能重复归还或回退状态'
        : '确认归还后库存和读者在借数将同步更新'
    }
  ]
})

const detailFeedbackType = computed(() => {
  if (!detailFeedback.value) return 'success'
  if (!detailFeedback.value.success) return 'error'
  return detailFeedback.value.warnings.length > 0 ? 'warning' : 'success'
})

function getEffectiveStatus(record) {
  return getRecordStatus(record)
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

function getStageHint(record) {
  const status = getRecordStatus(record)
  if (status === 'borrowed') return '可归还，也可续借'
  if (status === 'overdue') return '逾期不可续借，仅可归还'
  return '已归还，流程结束'
}

function getStageSubHint(record) {
  const status = getRecordStatus(record)
  if (status === 'overdue') {
    return `已逾期 ${getOverdueDays(record)} 天，续借 ${record.renewCount}/${MAX_RENEW_COUNT}`
  }
  if (status === 'borrowed') {
    return `应还 ${record.dueDate}，续借 ${record.renewCount}/${MAX_RENEW_COUNT}`
  }
  return `${record.returnDate} 已归还，记录继续保留`
}

function getReturnDisabledReason(record) {
  return getReturnBlockReason(record) || '当前状态不可归还'
}

function getRenewDisabledReason(record) {
  return getRenewBlockReasons(record)[0] || '当前状态不可续借'
}

function canRenew(record) {
  return canRenewRecord(record)
}

function stageTagColor(state) {
  return {
    done: 'success',
    active: 'processing',
    wait: 'warning',
    disabled: 'default'
  }[state] || 'default'
}

function getReaderOptionMeta(reader) {
  const activeCount = borrowStore.getActiveCountByReader(reader.id)
  const reasons = getReaderBlockReasons(reader, activeCount)
  return reasons.length > 0
    ? `不可借：${reasons[0]}`
    : `可借，当前在借 ${activeCount}/${reader.maxBorrow}`
}

function getBookOptionMeta(book) {
  return book.available > 0
    ? `库存 ${book.available}/${book.total}`
    : `无库存 0/${book.total}`
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

function resetBorrowForm() {
  borrowForm.readerId = null
  borrowForm.bookId = null
  borrowFeedback.value = null
}

function handleModalClose() {
  nextTick(() => {
    borrowFormRef.value?.resetFields()
    resetBorrowForm()
  })
}

function showBorrowModal() {
  resetBorrowForm()
  borrowModalVisible.value = true
  nextTick(() => {
    borrowFormRef.value?.clearValidate()
  })
}

function showDetail(record) {
  detailId.value = record.id
  detailFeedback.value = null
  detailVisible.value = true
}

function formatResultSummary(result) {
  if (!result) return ''

  if (result.action === 'borrow') {
    const maxBorrow = result.reader?.maxBorrow ?? '-'
    return [
      `应还日期：${result.dueDate}`,
      `库存：${result.stock.before}/${result.stock.total} → ${result.stock.after}/${result.stock.total}`,
      `续借：0/${MAX_RENEW_COUNT}`,
      `读者在借：${result.activeCount}/${maxBorrow}`
    ].join('；')
  }

  if (result.action === 'renew') {
    const stockText = result.stock
      ? `；库存：${result.stock.available}/${result.stock.total}`
      : ''
    return `应还日期：${result.previousDueDate} → ${result.dueDate}；续借：${result.renewCount}/${MAX_RENEW_COUNT}${stockText}`
  }

  if (result.action === 'return') {
    const parts = [`归还日期：${result.returnDate}`]
    if (result.overdueDays > 0) parts.push(`逾期：${result.overdueDays} 天`)
    if (result.stock) {
      parts.push(`库存：${result.stock.before}/${result.stock.total} → ${result.stock.after}/${result.stock.total}`)
    }
    if (result.reader) {
      parts.push(`读者在借：${result.activeCount}/${result.reader.maxBorrow}`)
    }
    return parts.join('；')
  }

  return ''
}

function showResultNotification(result) {
  const type = !result.success
    ? 'error'
    : result.warnings.length > 0
      ? 'warning'
      : 'success'

  notification[type]({
    message: result.message,
    duration: 5,
    description: h('div', { class: 'flow-result-notice' }, [
      result.success
        ? h('div', { class: 'result-summary' }, formatResultSummary(result))
        : null,
      ...result.reasons.map(reason =>
        h('div', { class: 'result-reason' }, `• ${reason}`)
      ),
      ...result.warnings.map(warning =>
        h('div', { class: 'result-warning' }, `• ${warning}`)
      ),
      !result.success
        ? h('div', { class: 'result-preserve' }, '• 原记录、库存和读者权限数据均保持不变')
        : null
    ])
  })
}

async function handleBorrowSubmit() {
  try {
    await borrowFormRef.value.validate()
    submitLoading.value = true
    borrowFeedback.value = null

    await new Promise(resolve => setTimeout(resolve, 300))

    const result = borrowStore.borrowBook(borrowForm.readerId, borrowForm.bookId)
    borrowFeedback.value = result

    if (result.success) {
      showResultNotification(result)
      message.success('借阅记录、库存和读者权限已同步更新')
      borrowModalVisible.value = false
      nextTick(() => {
        borrowFormRef.value?.resetFields()
        resetBorrowForm()
      })
    }
  } catch (error) {
    if (error?.errorFields) return
    console.error('借阅提交失败:', error)
  } finally {
    submitLoading.value = false
  }
}

async function runRecordAction(resultPromise, sourceRecord) {
  actionLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 200))
  const result = await resultPromise

  if (currentRecord.value?.id === sourceRecord.id) {
    detailFeedback.value = result
  }
  showResultNotification(result)
  actionLoading.value = false
  return result
}

function handleReturn(record) {
  return runRecordAction(Promise.resolve(borrowStore.returnBook(record.id)), record)
}

function handleRenew(record) {
  return runRecordAction(Promise.resolve(borrowStore.renewBook(record.id)), record)
}

onMounted(() => {
  borrowStore.refreshStatuses()
})
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

.flow-guide {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.flow-guide-item {
  position: relative;
  display: flex;
  gap: 10px;
  padding: 14px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border-top: 3px solid #1890ff;

  &:not(:last-child)::after {
    content: '→';
    position: absolute;
    right: -13px;
    top: 50%;
    z-index: 2;
    transform: translateY(-50%);
    color: #1890ff;
    font-weight: 700;
  }
}

.flow-guide-index {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e6f7ff;
  color: #1890ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.flow-guide-content {
  min-width: 0;
}

.flow-guide-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 4px;
}

.flow-guide-desc {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.flow-guide-action {
  margin-top: 6px;
  font-size: 12px;
  color: #1890ff;
  line-height: 1.5;
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
  }
}

.stage-cell {
  .stage-main {
    font-size: 13px;
    font-weight: 500;
    color: #1f1f1f;
    line-height: 1.4;
  }

  .stage-sub {
    margin-top: 3px;
    font-size: 12px;
    color: #8c8c8c;
    line-height: 1.4;

    &.danger {
      color: #ff4d4f;
    }
  }
}

.borrow-result-alert,
.detail-feedback {
  margin-bottom: 16px;
}

.result-description {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-summary {
  font-weight: 600;
  color: #1f1f1f;
  line-height: 1.6;
}

.result-reason,
.result-warning,
.result-preserve {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  line-height: 1.6;
}

.result-reason {
  color: #ff4d4f;
}

.result-warning {
  color: #fa8c16;
}

.result-preserve {
  color: #595959;
}

.detail-descriptions {
  margin-bottom: 20px;
}

.detail-stage-hint {
  margin-left: 8px;
  color: #666;
  font-size: 12px;
}

.detail-flow-stages {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.detail-stage {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #f0f0f0;
  background: #fafafa;

  &.done {
    border-color: #b7eb8f;
    background: #f6ffed;

    .detail-stage-index {
      background: #52c41a;
    }
  }

  &.active {
    border-color: #91d5ff;
    background: #e6f7ff;

    .detail-stage-index {
      background: #1890ff;
    }
  }

  &.wait {
    border-color: #ffe58f;
    background: #fffbe6;

    .detail-stage-index {
      background: #faad14;
    }
  }

  &.disabled {
    opacity: 0.65;

    .detail-stage-index {
      background: #bfbfbf;
    }
  }
}

.detail-stage-index {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.detail-stage-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 4px;
}

.detail-stage-desc,
.detail-stage-action {
  font-size: 12px;
  line-height: 1.6;
}

.detail-stage-desc {
  color: #595959;
}

.detail-stage-action {
  color: #1890ff;
}

.detail-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.danger-text {
  color: #ff4d4f;
  font-weight: 600;
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

@media (max-width: 992px) {
  .flow-guide {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .flow-guide-item:not(:last-child)::after {
    display: none;
  }
}

@media (max-width: 576px) {
  .flow-guide {
    grid-template-columns: 1fr;
  }
}
</style>
