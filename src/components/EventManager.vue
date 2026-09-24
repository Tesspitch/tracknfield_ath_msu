<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { useRaceStore } from '../stores/raceStore'
import { PlusCircle, Trash2, Pencil } from 'lucide-vue-next'

const raceStore = useRaceStore()

const newEvent = ref({
  event_name: '',
  distance_meters: 100,
  gender: 'M' as 'M' | 'F' | 'Mixed',
  is_relay: false
})

const isSubmitting = ref(false)

const loadEvents = async () => {
  await raceStore.fetchEvents()
}

onMounted(() => {
  loadEvents()
})

const addEvent = async () => {
  if (!newEvent.value.event_name) return alert('กรุณากรอกชื่อรายการ')
  isSubmitting.value = true
  
  const { error } = await supabase.from('events').insert({
    event_name: newEvent.value.event_name.trim(),
    distance_meters: newEvent.value.distance_meters,
    gender: newEvent.value.gender,
    is_relay: newEvent.value.is_relay
  })
  
  isSubmitting.value = false
  
  if (error) {
    alert('เกิดข้อผิดพลาด: ' + error.message)
  } else {
    newEvent.value.event_name = ''
    newEvent.value.distance_meters = 100
    alert('เพิ่มรายการสำเร็จ')
    loadEvents()
  }
}

const deleteEvent = async (id: number) => {
  if (!confirm('ยืนยันการลบรายการนี้? (คำเตือน: ข้อมูลรอบและผลการแข่งของรายการนี้จะถูกลบไปด้วยทั้งหมด)')) return
  
  const { error } = await supabase.from('events').delete().eq('event_id', id)
  
  if (error) {
    alert('ลบไม่สำเร็จ: ' + error.message)
  } else {
    loadEvents()
  }
}

const editingId = ref<number | null>(null)
const editName = ref('')

const startEdit = (e: any) => {
  editingId.value = e.event_id
  editName.value = e.event_name
}

const cancelEdit = () => {
  editingId.value = null
  editName.value = ''
}

const saveEdit = async (e: any) => {
  if (!editName.value.trim()) return alert('กรุณากรอกชื่อรายการ')
  
  const { error } = await supabase.from('events').update({
    event_name: editName.value.trim()
  }).eq('event_id', e.event_id)
  
  if (error) {
    alert('บันทึกไม่สำเร็จ: ' + error.message)
  } else {
    editingId.value = null
    loadEvents()
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Form Add Event -->
    <div class="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <PlusCircle class="w-5 h-5 mr-2 text-blue-600" />
        เพิ่มรายการแข่งขันใหม่
      </h2>
      
      <form @submit.prevent="addEvent" class="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">ชื่อรายการ (พิมพ์ให้ตรงกับใน Excel)</label>
          <input 
            v-model="newEvent.event_name"
            type="text" 
            required
            class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="เช่น 100 เมตร ชาย"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ระยะทาง (เมตร)</label>
          <input 
            v-model.number="newEvent.distance_meters"
            type="number" 
            required
            class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">เพศ</label>
          <select 
            v-model="newEvent.gender" 
            class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="M">ชาย (M)</option>
            <option value="F">หญิง (F)</option>
            <option value="Mixed">ผสม (Mixed)</option>
          </select>
        </div>
        
        <div class="flex items-center pb-2">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input 
              type="checkbox" 
              v-model="newEvent.is_relay"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
            />
            <span class="text-sm font-medium text-gray-700">วิ่งผลัด (ทีม)</span>
          </label>
        </div>
        
        <div class="md:col-span-5 flex justify-end mt-2">
          <button 
            type="submit" 
            :disabled="isSubmitting"
            class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {{ isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรายการ' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Event List -->
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div class="p-4 border-b bg-gray-50">
        <h3 class="font-semibold text-gray-800">รายการแข่งขันทั้งหมดในระบบ</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-gray-600">
          <thead class="bg-gray-100 text-gray-700">
            <tr>
              <th class="px-4 py-3">ID</th>
              <th class="px-4 py-3">ชื่อรายการแข่งขัน</th>
              <th class="px-4 py-3 text-center">ระยะทาง (ม.)</th>
              <th class="px-4 py-3 text-center">เพศ</th>
              <th class="px-4 py-3 text-center">ประเภท</th>
              <th class="px-4 py-3 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="e in raceStore.events" :key="e.event_id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-gray-500">{{ e.event_id }}</td>
              <td class="px-4 py-3 font-medium text-gray-900">
                <div v-if="editingId === e.event_id" class="flex items-center space-x-2">
                  <input v-model="editName" type="text" class="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:ring-blue-500 focus:border-blue-500" @keyup.enter="saveEdit(e)" @keyup.escape="cancelEdit" />
                  <button @click="saveEdit(e)" class="text-green-600 hover:text-green-800 text-xs px-2 py-1 bg-green-50 rounded hover:bg-green-100 transition whitespace-nowrap">บันทึก</button>
                  <button @click="cancelEdit" class="text-gray-500 hover:text-gray-700 text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition whitespace-nowrap">ยกเลิก</button>
                </div>
                <div v-else class="flex justify-between items-center group">
                  <span>{{ e.event_name }}</span>
                  <button @click="startEdit(e)" class="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition" title="แก้ไขชื่อ">
                    <Pencil class="w-4 h-4" />
                  </button>
                </div>
              </td>
              <td class="px-4 py-3 text-center">{{ e.distance_meters }}</td>
              <td class="px-4 py-3 text-center">
                <span class="px-2 py-1 rounded text-xs font-medium" 
                  :class="{
                    'bg-blue-100 text-blue-800': e.gender === 'M',
                    'bg-pink-100 text-pink-800': e.gender === 'F',
                    'bg-purple-100 text-purple-800': e.gender === 'Mixed'
                  }">
                  {{ e.gender }}
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <span class="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  {{ e.is_relay ? 'วิ่งผลัด' : 'บุคคล' }}
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <button 
                  @click="deleteEvent(e.event_id)"
                  class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition title"
                  title="ลบรายการ"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </td>
            </tr>
            <tr v-if="raceStore.events.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                ไม่มีรายการแข่งขันในระบบ
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
