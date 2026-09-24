<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const props = defineProps<{
  isOpen: boolean
  athleteNames: string[]
  rank: number | null
  eventName: string
  timeText: string
  defaultTimeUnit: string
}>()

const emit = defineEmits(['close'])

const certificateRef = ref<HTMLElement | null>(null)
const hiddenCertRef = ref<HTMLElement | null>(null)
const isGenerating = ref(false)
const selectedTimeUnit = ref('วินาที')
const currentPreviewIndex = ref(0)
const currentPreviewName = computed(() => {
  if (!props.athleteNames || props.athleteNames.length === 0) return ''
  return props.athleteNames[currentPreviewIndex.value] || props.athleteNames[0]
})

const nextPreview = () => {
  if (props.athleteNames && currentPreviewIndex.value < props.athleteNames.length - 1) {
    currentPreviewIndex.value++
  }
}

const prevPreview = () => {
  if (currentPreviewIndex.value > 0) {
    currentPreviewIndex.value--
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    selectedTimeUnit.value = props.defaultTimeUnit || 'วินาที'
    currentPreviewIndex.value = 0
  }
})

const downloadPDF = async () => {
  if (!hiddenCertRef.value || !props.athleteNames || props.athleteNames.length === 0) return
  
  isGenerating.value = true
  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })
    
    for (let i = 0; i < props.athleteNames.length; i++) {
      currentPreviewIndex.value = i
      await nextTick()
      await new Promise(r => setTimeout(r, 150))
      
      const canvas = await html2canvas(hiddenCertRef.value, {
        scale: 2,
        useCORS: true,
        logging: false
      })
      
      const imgData = canvas.toDataURL('image/jpeg', 0.8) // match bulk format
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210)
    }
    
    let filename = `Certificate_${props.athleteNames[0]}.pdf`
    if (props.athleteNames.length > 1) {
      filename = `Certificates_${props.eventName}_Rank${props.rank}.pdf`
    }
    pdf.save(filename)
  } catch (error) {
    console.error('PDF Generation error:', error)
    alert('เกิดข้อผิดพลาดในการสร้าง PDF')
  } finally {
    isGenerating.value = false
    currentPreviewIndex.value = 0
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-screen">
      <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-lg font-semibold text-gray-900">
          ตัวอย่างเกียรติบัตร
          <span v-if="athleteNames && athleteNames.length > 1" class="text-sm font-normal text-blue-600 ml-2">
            (ระบบจะสร้าง PDF รวม {{ athleteNames.length }} แผ่น สำหรับนักกีฬาแต่ละคน)
          </span>
        </h3>
        <button @click="emit('close')" class="text-gray-500 hover:text-gray-700 font-bold text-xl">&times;</button>
      </div>
      
      <div class="p-6 overflow-auto bg-gray-100 flex justify-center items-center">
        <!-- Certificate Container: A4 aspect ratio 297:210 -->
        <div 
          id="cert-print-area"
          ref="certificateRef"
          class="relative bg-white shadow-md overflow-hidden" 
          style="width: 1122px; height: 793px; transform: scale(0.80); transform-origin: center center;"
         
        >
          <!-- Background Image -->
          <img src="/certificate-bg.jpg" alt="Certificate Background" class="absolute inset-0 w-full h-full object-cover" crossorigin="anonymous" />
          
          <!-- Overlay Text -->
          <!-- Name -->
          <div class="absolute w-full text-center" style="top: 37%;">
            <h1 class="text-7xl font-bold cert-text-name tracking-wider">{{ currentPreviewName }}</h1>
          </div>
          
          <!-- Rank, Event, Time -->
          <div class="absolute w-full text-center flex flex-col items-center" style="top: 52%;">
            <p class="text-2xl font-medium cert-text-detail tracking-wide whitespace-nowrap">
              ชนะเลิศอันดับที่ {{ rank }} ประเภท {{ eventName }} สถิติ {{ timeText }} {{ selectedTimeUnit }}
            </p>
          </div>
        </div>
      </div>
      
      <div class="px-6 py-2 bg-white flex justify-center space-x-4 items-center border-b border-gray-200" v-if="athleteNames && athleteNames.length > 1">
        <button 
          @click="prevPreview" 
          :disabled="currentPreviewIndex === 0 || isGenerating"
          class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
        >
          &laquo; ก่อนหน้า
        </button>
        <span class="text-sm text-gray-600 font-medium">คนที่ {{ currentPreviewIndex + 1 }} / {{ athleteNames.length }}</span>
        <button 
          @click="nextPreview" 
          :disabled="currentPreviewIndex === athleteNames.length - 1 || isGenerating"
          class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
        >
          ถัดไป &raquo;
        </button>
      </div>

      <div class="px-6 py-4 bg-gray-50 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
        <div class="flex items-center space-x-2">
          <label class="text-sm font-medium text-gray-700">หน่วยเวลา:</label>
          <select 
            v-model="selectedTimeUnit"
            class="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="วินาที">วินาที</option>
            <option value="นาที">นาที</option>
            <option value="ชั่วโมง">ชั่วโมง</option>
          </select>
        </div>

        <div class="flex space-x-3">
          <button 
            @click="emit('close')"
            class="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition"
          >
            ปิด
          </button>
          <button 
            @click="downloadPDF"
            :disabled="isGenerating"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50 transition"
          >
            <span>{{ isGenerating ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF' }}</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Hidden Off-screen Container for html2canvas (Exact same layout as Bulk Export) -->
    <div style="position: absolute; left: -9999px; top: -9999px; z-index: -10; opacity: 0; pointer-events: none;">
      <div 
        ref="hiddenCertRef"
        class="relative bg-white" 
        style="width: 1122px; height: 793px;"
      >
        <img src="/certificate-bg.jpg" alt="Certificate Background" class="absolute inset-0 w-full h-full object-cover" crossorigin="anonymous" />
        
        <div class="absolute w-full text-center" style="top: 37%;">
          <h1 class="text-7xl font-bold cert-text-name tracking-wider">{{ currentPreviewName }}</h1>
        </div>
        
        <div class="absolute w-full text-center flex flex-col items-center" style="top: 50%;">
          <p class="text-2xl font-medium cert-text-detail tracking-wide whitespace-nowrap">
            ชนะอันดับที่ {{ rank }} ประเภท {{ eventName }} ทำสถิติเวลาได้ {{ timeText }} {{ selectedTimeUnit }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Charmonman:wght@400;700&family=Sarabun:wght@300;400;500&display=swap');

.cert-text-name {
  font-family: 'Charmonman', cursive;
  color: #C59B27; 
  /* ขอบบางๆ เพื่อไม่ให้อ้วน */
  -webkit-text-stroke: 0.4px #FFFFFF;
  text-shadow: 
    1px 2px 0px rgba(138, 90, 25, 0.8),
    0px 4px 8px rgba(0, 0, 0, 0.3);
}

.cert-text-detail {
  font-family: 'Sarabun', sans-serif;
  color: #3e2e25; 
  /* เอาขอบออก เพื่อให้ดูสะอาดตาและหรูหรา */
  text-shadow: 0px 0px 6px rgba(255, 255, 255, 0.9);
}
</style>
