<script setup lang="ts">
import { ref } from 'vue'
import { UploadCloud } from 'lucide-vue-next'
import { useImportStore } from '../stores/importStore'
import * as XLSX from 'xlsx'

const importStore = useImportStore()
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

const emit = defineEmits<{ (e: 'import-success'): void }>()

const triggerUpload = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    await importStore.processExcel(target.files[0])
    target.value = ''
    if (!importStore.importError) {
      emit('import-success')
    }
  }
}

const handleDrop = async (event: DragEvent) => {
  dragOver.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    await importStore.processExcel(event.dataTransfer.files[0])
    if (!importStore.importError) {
      emit('import-success')
    }
  }
}

const downloadTemplate = () => {
  const individualData = [
    ['student_id', 'full_name', 'gender', 'faculty_name', 'study_year', 'event_name', 'round_name', 'lane_number'],
    ['64010101', 'นายสมชาย ใจดี', 'M', 'วิศวกรรมศาสตร์', 3, '100 เมตร ชาย', 'Heat 1', 4]
  ]
  
  const relayData = [
    ['team_name', 'faculty_name', 'event_name', 'round_name', 'lane_number', 'student_id', 'full_name', 'gender', 'leg_order'],
    ['วิศวะ A', 'วิศวกรรมศาสตร์', 'วิ่งผลัด 4x100 เมตร ชาย', 'Final', 3, '64010101', 'นายสมชาย ใจดี', 'M', 1],
    ['วิศวะ A', 'วิศวกรรมศาสตร์', 'วิ่งผลัด 4x100 เมตร ชาย', 'Final', 3, '64010102', 'นายสมศักดิ์ รักเรียน', 'M', 2],
    ['วิศวะ A', 'วิศวกรรมศาสตร์', 'วิ่งผลัด 4x100 เมตร ชาย', 'Final', 3, '64010103', 'นายสมพร อ่อนโยน', 'M', 3],
    ['วิศวะ A', 'วิศวกรรมศาสตร์', 'วิ่งผลัด 4x100 เมตร ชาย', 'Final', 3, '64010104', 'นายสมบูรณ์ เพิ่มพูน', 'M', 4],
    ['ทีมรวม B', 'วิทยาศาสตร์', 'วิ่งผลัด 4x100 เมตร ชาย', 'Final', 4, '65010201', 'นายก้องเกียรติ ยิ่งใหญ่', 'M', 1],
    ['ทีมรวม B', 'แพทยศาสตร์', 'วิ่งผลัด 4x100 เมตร ชาย', 'Final', 4, '65010301', 'นายใจดี รักษา', 'M', 2],
    ['ทีมรวม B', 'บริหารธุรกิจ', 'วิ่งผลัด 4x100 เมตร ชาย', 'Final', 4, '65010401', 'นายรวยเงิน ทองม้วน', 'M', 3],
    ['ทีมรวม B', 'มนุษยศาสตร์', 'วิ่งผลัด 4x100 เมตร ชาย', 'Final', 4, '65010501', 'นายศิลป์ ภาษา', 'M', 4]
  ]

  const wsIndiv = XLSX.utils.aoa_to_sheet(individualData)
  const wsRelay = XLSX.utils.aoa_to_sheet(relayData)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsIndiv, 'บุคคล')
  XLSX.utils.book_append_sheet(wb, wsRelay, 'ผลัด')

  XLSX.writeFile(wb, 'TrackTiming_Template.xlsx')
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-gray-800">นำเข้ารายชื่อจาก Excel</h2>
      <button @click="downloadTemplate" class="text-blue-600 hover:underline text-sm font-medium">
        ดาวน์โหลด Template
      </button>
    </div>

    <div
      class="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center transition-colors"
      :class="dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="handleDrop"
    >
      <UploadCloud class="w-16 h-16 text-gray-400 mb-4" />
      <p class="text-gray-700 text-lg mb-2">ลากไฟล์ Excel มาวางที่นี่</p>
      <p class="text-gray-500 text-sm mb-4">หรือคลิกเพื่อเลือกไฟล์</p>
      
      <div class="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-md w-full max-w-sm mb-6 text-center border border-yellow-200">
        💡 <b>คำแนะนำ:</b> ไฟล์ Template มี 2 ชีต (บุคคล และ ผลัด) <br/> 
        สามารถใส่รายชื่อนักกีฬาแต่ละผลัดในชีต "ผลัด" ได้เลย โดยใส่ชื่อคณะที่ต่างกันได้
      </div>
      
      <button 
        @click="triggerUpload"
        class="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition"
        :disabled="importStore.isImporting"
      >
        {{ importStore.isImporting ? 'กำลังประมวลผล...' : 'เลือกไฟล์ Excel' }}
      </button>
      <input 
        type="file" 
        ref="fileInput" 
        class="hidden" 
        accept=".xlsx, .xls"
        @change="handleFileSelect"
      />
      <div v-if="importStore.isImporting" class="w-full max-w-md mt-6">
        <div class="flex justify-between text-sm text-gray-600 mb-1">
          <span>กำลังนำเข้าข้อมูล...</span>
          <span>{{ Math.min(100, Math.floor((importStore.importProgress / (importStore.importTotal || 1)) * 100)) }}% ({{ importStore.importProgress }}/{{ importStore.importTotal }})</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5">
          <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" :style="`width: ${Math.min(100, Math.floor((importStore.importProgress / (importStore.importTotal || 1)) * 100))}%`"></div>
        </div>
      </div>
    </div>

    <div v-if="importStore.importError" class="bg-red-50 text-red-600 p-4 rounded border border-red-200">
      {{ importStore.importError }}
    </div>
    
    <div v-if="importStore.importSuccessMsg" class="bg-green-50 text-green-700 p-4 rounded border border-green-200">
      {{ importStore.importSuccessMsg }}
    </div>
  </div>
</template>
