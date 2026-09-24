<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const props = defineProps<{
  isOpen: boolean
  winners: Array<{
    name: string
    rank: number
    eventName: string
    timeText: string
    timeUnit: string
  }>
}>()

const emit = defineEmits(['close'])

const certRef = ref<HTMLElement | null>(null)
const isGenerating = ref(false)
const currentIndex = ref(0)
const total = ref(0)

const currentWinner = ref({
  name: '',
  rank: 1,
  eventName: '',
  timeText: '',
  timeUnit: 'วินาที'
})

const startBulkExport = async () => {
  if (!certRef.value || props.winners.length === 0) return
  
  isGenerating.value = true
  total.value = props.winners.length
  
  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    for (let i = 0; i < props.winners.length; i++) {
      currentIndex.value = i + 1
      currentWinner.value = props.winners[i]
      
      // Wait for Vue to update the DOM
      await nextTick()
      // Wait a tiny bit more for fonts/image to render safely
      await new Promise(r => setTimeout(r, 150))
      
      const canvas = await html2canvas(certRef.value, {
        scale: 2,
        useCORS: true,
        logging: false
      })
      
      const imgData = canvas.toDataURL('image/jpeg', 0.8) // Use JPEG for smaller bulk size
      
      if (i > 0) {
        pdf.addPage()
      }
      
      pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210)
    }
    
    pdf.save('All_Certificates.pdf')
    emit('close')
  } catch (error) {
    console.error('Bulk PDF Generation error:', error)
    alert('เกิดข้อผิดพลาดในการสร้าง PDF')
  } finally {
    isGenerating.value = false
    currentIndex.value = 0
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    currentIndex.value = 0
    total.value = props.winners.length
  }
})
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">สร้างเกียรติบัตรทั้งหมด (Bulk Export)</h3>
      </div>
      
      <div class="p-6 text-center space-y-4">
        <p class="text-gray-700">
          พบข้อมูลผู้ชนะทั้งหมด <strong>{{ total }}</strong> รายการ
        </p>
        
        <div v-if="isGenerating" class="space-y-2">
          <p class="text-sm font-medium text-blue-600">
            กำลังสร้าง PDF... ({{ currentIndex }} / {{ total }})
          </p>
          <div class="w-full bg-gray-200 rounded-full h-2.5">
            <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" :style="{ width: `${(currentIndex / total) * 100}%` }"></div>
          </div>
          <p class="text-xs text-red-500 mt-2">* กรุณาอย่าปิดหน้าต่างนี้จนกว่าจะเสร็จสิ้น (อาจใช้เวลาหลายนาที)</p>
        </div>
      </div>
      
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
        <button 
          @click="emit('close')"
          :disabled="isGenerating"
          class="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          ยกเลิก
        </button>
        <button 
          @click="startBulkExport"
          :disabled="isGenerating"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          เริ่มดาวน์โหลด PDF
        </button>
      </div>
    </div>

    <!-- Hidden Off-screen Container for html2canvas -->
    <div style="position: absolute; left: -9999px; top: -9999px; z-index: -10; opacity: 0; pointer-events: none;">
      <div 
        ref="certRef"
        class="relative bg-white" 
        style="width: 1122px; height: 793px;"
      >
        <img src="/certificate-bg.jpg" alt="Certificate Background" class="absolute inset-0 w-full h-full object-cover" crossorigin="anonymous" />
        
        <div class="absolute w-full text-center" style="top: 37%;">
          <h1 class="text-7xl font-bold cert-text-name tracking-wider">{{ currentWinner.name }}</h1>
        </div>
        
        <div class="absolute w-full text-center flex flex-col items-center" style="top: 52%;">
          <p class="text-2xl font-medium cert-text-detail tracking-wide whitespace-nowrap">
            ชนะเลิศอันดับที่ {{ currentWinner.rank }} ประเภท {{ currentWinner.eventName }} สถิติ {{ currentWinner.timeText }} {{ currentWinner.timeUnit }}
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
  -webkit-text-stroke: 0.5px #FFFFFF;
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
