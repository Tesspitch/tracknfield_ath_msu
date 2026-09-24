<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  isOpen: boolean,
  candidates: any[],
  existingRounds: any[]
}>()

const emit = defineEmits(['close', 'advance'])

const selectedExistingRound = ref('')
const newRoundName = ref('')

const finalRoundName = computed(() => {
  return selectedExistingRound.value ? selectedExistingRound.value : newRoundName.value
})

const handleAdvance = () => {
  const rName = finalRoundName.value.trim()
  if (!rName) return
  
  emit('advance', {
    roundName: rName,
    athleteIds: props.candidates.map(c => c.id)
  })
  closeModal()
}

const closeModal = () => {
  emit('close')
  selectedExistingRound.value = ''
  newRoundName.value = ''
}

// Optional: default to first round or new round on open
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    selectedExistingRound.value = ''
    newRoundName.value = ''
  }
})
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">ยืนยันการส่งตัวแทนเข้ารอบถัดไป</h3>
      </div>
      
      <div class="p-6 space-y-4">
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">เลือกรอบการแข่งขันปลายทาง</label>
          
          <select 
            v-model="selectedExistingRound"
            class="w-full border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">-- สร้างชื่อรอบใหม่ --</option>
            <option v-for="r in existingRounds" :key="r.round_id" :value="r.round_name">
              {{ r.round_name }}
            </option>
          </select>

          <input 
            v-if="selectedExistingRound === ''"
            v-model="newRoundName"
            type="text" 
            class="w-full border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 mt-2"
            placeholder="พิมพ์ชื่อรอบใหม่ (เช่น Final)..."
          />
        </div>
        
        <div class="pt-2">
          <h4 class="text-sm font-medium text-gray-700 mb-2">รายชื่อผู้ผ่านเข้ารอบที่เลือกไว้ ({{ candidates.length }} คน)</h4>
          <div class="max-h-60 overflow-y-auto border rounded p-3 space-y-2 bg-gray-50">
            <div v-for="c in candidates" :key="c.id" class="flex items-center text-sm text-gray-800 font-medium">
              ✅ {{ c.name }} <span class="text-gray-500 ml-2">(สถิติ: {{ c.time }})</span>
            </div>
            <div v-if="candidates.length === 0" class="text-sm text-gray-500 py-2">
              ไม่มีข้อมูล
            </div>
          </div>
        </div>
      </div>
      
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
        <button 
          @click="closeModal"
          class="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition"
        >
          ยกเลิก
        </button>
        <button 
          @click="handleAdvance"
          :disabled="!finalRoundName || candidates.length === 0"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
        >
          ยืนยันส่งเข้ารอบ
        </button>
      </div>
    </div>
  </div>
</template>
