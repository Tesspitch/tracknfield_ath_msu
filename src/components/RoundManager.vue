<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp, Users } from 'lucide-vue-next'

const events = ref<any[]>([])
const selectedEventId = ref<number | string | null>(null)
const rounds = ref<any[]>([])
const loading = ref(false)

const newRoundName = ref('')
const editingRoundId = ref<number | null>(null)
const editRoundName = ref('')

const groupedRounds = computed(() => {
  const groups: { eventName: string, rounds: any[] }[] = []
  let currentEventId: number | null = null
  let currentGroup: { eventName: string, rounds: any[] } | null = null
  
  for (const r of rounds.value) {
    if (r.event_id !== currentEventId) {
      currentEventId = r.event_id
      currentGroup = {
        eventName: r.events?.event_name || 'รายการแข่งขัน',
        rounds: []
      }
      groups.push(currentGroup)
    }
    if (currentGroup) {
      currentGroup.rounds.push(r)
    }
  }
  
  return groups
})

const expandedRounds = ref<Set<number>>(new Set())
const roundParticipants = ref<Record<number, any[]>>({})
const loadingParticipants = ref<Record<number, boolean>>({})

const toggleParticipants = async (roundId: number) => {
  if (expandedRounds.value.has(roundId)) {
    expandedRounds.value.delete(roundId)
    return
  }
  
  expandedRounds.value.add(roundId)
  loadingParticipants.value[roundId] = true
  
  const { data, error } = await supabase.from('race_results')
    .select(`
      lane_number,
      athletes ( full_name, faculties ( fac_name ) ),
      relay_teams ( team_name, faculties ( fac_name ) )
    `)
    .eq('round_id', roundId)
    .order('lane_number', { ascending: true })
    
  if (error) {
    alert('Failed to load participants: ' + error.message)
    loadingParticipants.value[roundId] = false
    expandedRounds.value.delete(roundId)
    return
  }
  
  roundParticipants.value[roundId] = data || []
  loadingParticipants.value[roundId] = false
}

const deleteAllRounds = async () => {
  if (rounds.value.length === 0) return
  
  const msg = selectedEventId.value === 'ALL' 
    ? '🚨 คำเตือนขั้นรุนแรง: คุณกำลังจะลบรอบการแข่งขัน "ทั้งหมดของทุกรายการ"\nข้อมูลการแข่ง เวลา และผลลัพธ์ทั้งหมดจะหายไปอย่างถาวร!\n\nคุณแน่ใจหรือไม่ที่จะลบทั้งหมด?'
    : '⚠️ ยืนยันการลบ "ทุกรอบการแข่งขัน" ในรายการนี้หรือไม่?\nข้อมูลการแข่งและเวลาในรายการนี้จะหายไปทั้งหมด!'
    
  if (!confirm(msg)) return
  if (selectedEventId.value === 'ALL' && !confirm('ถามอีกครั้ง! แน่ใจจริงๆ ใช่ไหมว่าจะล้างรอบการแข่งขันทั้งระบบ?')) return
  
  let query = supabase.from('event_rounds').delete()
  
  if (selectedEventId.value !== 'ALL') {
    query = query.eq('event_id', selectedEventId.value)
  } else {
    query = query.neq('round_id', 0) // Trick to delete all records
  }
  
  const { error } = await query
  
  if (error) {
    alert('Failed to delete rounds: ' + error.message)
    return
  }
  
  fetchRounds()
}

const fetchEvents = async () => {
  const { data } = await supabase.from('events').select('*').order('event_id')
  events.value = data || []
}

const fetchRounds = async () => {
  if (!selectedEventId.value) {
    rounds.value = []
    return
  }
  loading.value = true
  
  if (selectedEventId.value === 'ALL') {
    const { data } = await supabase.from('event_rounds')
      .select('*, events(event_name)')
      .order('event_id')
      .order('round_id')
    rounds.value = data || []
  } else {
    const { data } = await supabase.from('event_rounds')
      .select('*, events(event_name)')
      .eq('event_id', selectedEventId.value)
      .order('round_id')
    rounds.value = data || []
  }
  
  loading.value = false
}

onMounted(() => {
  fetchEvents()
})

const addRound = async () => {
  if (!selectedEventId.value || !newRoundName.value.trim()) return
  
  const { error } = await supabase.from('event_rounds').insert({
    event_id: selectedEventId.value,
    round_name: newRoundName.value.trim()
  })
  
  if (error) {
    alert('Failed to add round: ' + error.message)
    return
  }
  
  newRoundName.value = ''
  fetchRounds()
}

const startEdit = (round: any) => {
  editingRoundId.value = round.round_id
  editRoundName.value = round.round_name
}

const cancelEdit = () => {
  editingRoundId.value = null
  editRoundName.value = ''
}

const saveEdit = async (roundId: number) => {
  if (!editRoundName.value.trim()) return
  
  const { error } = await supabase.from('event_rounds').update({
    round_name: editRoundName.value.trim()
  }).eq('round_id', roundId)
  
  if (error) {
    alert('Failed to update round: ' + error.message)
    return
  }
  
  editingRoundId.value = null
  fetchRounds()
}

const deleteRound = async (roundId: number, roundName: string) => {
  if (!confirm(`ยืนยันการลบรอบ "${roundName}"?\n(คำเตือน: ข้อมูลการแข่งและเวลาในรอบนี้จะถูกลบทั้งหมด!)`)) return
  
  const { error } = await supabase.from('event_rounds').delete().eq('round_id', roundId)
  
  if (error) {
    alert('Failed to delete round: ' + error.message)
    return
  }
  
  fetchRounds()
}
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold text-gray-800">จัดการรอบการแข่งขัน (Heat/Round)</h2>
        <p class="text-sm text-gray-500 mt-1">เลือกรายการแข่งเพื่อจัดการรอบ หรือ Heat ทั้งหมด</p>
      </div>
    </div>

    <!-- Event Selector -->
    <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
      <label class="block text-sm font-medium text-gray-700 mb-2">เลือกรายการแข่งขัน</label>
      <select 
        v-model="selectedEventId" 
        @change="fetchRounds"
        class="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3"
      >
        <option :value="null">-- กรุณาเลือกรายการแข่งขัน --</option>
        <option value="ALL" class="font-bold text-blue-600">-- ดึงทุกรายการ (ดูทั้งหมด) --</option>
        <option v-for="e in events" :key="e.event_id" :value="e.event_id">
          {{ e.event_name }}
        </option>
      </select>
    </div>

    <div v-if="selectedEventId" class="bg-white shadow rounded-xl border border-gray-200 overflow-hidden">
      
      <!-- Add Round Form -->
      <div v-if="selectedEventId !== 'ALL'" class="p-4 bg-gray-50 border-b border-gray-200 flex gap-2 items-center">
        <input 
          v-model="newRoundName"
          @keyup.enter="addRound"
          type="text" 
          placeholder="ชื่อรอบใหม่ เช่น Heat 4 หรือ รอบชิงชนะเลิศ"
          class="flex-1 border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
        />
        <button 
          @click="addRound"
          :disabled="!newRoundName.trim()"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center font-medium transition"
        >
          <Plus class="w-4 h-4 mr-2" />
          เพิ่มรอบ
        </button>
      </div>

      <!-- Rounds List -->
      <div v-if="loading" class="p-8 text-center text-gray-500">
        กำลังโหลดข้อมูล...
      </div>
      
      <div v-else-if="rounds.length === 0" class="p-8 text-center text-gray-400">
        ยังไม่มีรอบการแข่งขันในรายการนี้
      </div>

      <div v-else>
        <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <span class="text-sm font-medium text-gray-600">พบทั้งหมด: {{ rounds.length }} รอบ</span>
          <button 
            @click="deleteAllRounds"
            class="text-sm px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 rounded-md transition flex items-center font-medium shadow-sm"
          >
            <Trash2 class="w-4 h-4 mr-1" />
            ลบทั้งหมด
          </button>
        </div>

        <div class="divide-y divide-gray-200">
          <div v-for="group in groupedRounds" :key="group.eventName">
            
            <div v-if="selectedEventId === 'ALL'" class="px-4 py-2 bg-indigo-50/50 border-b border-gray-100 text-sm font-bold text-indigo-900 flex items-center">
              <div class="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></div>
              {{ group.eventName }}
            </div>

            <ul class="divide-y divide-gray-100">
              <li v-for="round in group.rounds" :key="round.round_id" class="flex flex-col transition hover:bg-gray-50/50">
              <div class="p-4 flex items-center justify-between">
                
              <div v-if="editingRoundId === round.round_id" class="flex-1 flex items-center gap-2 mr-4">
                <input 
                  v-model="editRoundName"
                  @keyup.enter="saveEdit(round.round_id)"
                  type="text" 
                  class="flex-1 border-gray-300 rounded-md shadow-sm py-1.5 px-3 focus:ring-blue-500 focus:border-blue-500"
                />
                <button @click="saveEdit(round.round_id)" class="p-1.5 text-green-600 hover:bg-green-100 rounded-md transition" title="บันทึก">
                  <Check class="w-5 h-5" />
                </button>
                <button @click="cancelEdit" class="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md transition" title="ยกเลิก">
                  <X class="w-5 h-5" />
                </button>
              </div>
              
              <div v-else class="flex-1 font-medium text-gray-800">
                {{ round.round_name }}
              </div>

              <div v-if="editingRoundId !== round.round_id" class="flex items-center gap-2">
                <button 
                  @click="startEdit(round)"
                  class="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                  title="แก้ไขชื่อรอบ"
                >
                  <Edit2 class="w-4 h-4" />
                </button>
                <button 
                  @click="deleteRound(round.round_id, round.round_name)"
                  class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition"
                  title="ลบรอบการแข่งขัน"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
                <div class="w-px h-6 bg-gray-300 mx-1"></div>
                <button 
                  @click="toggleParticipants(round.round_id)"
                  class="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition flex items-center gap-1 text-sm font-medium"
                  title="ดูรายชื่อ"
                >
                  <Users class="w-4 h-4" />
                  <span class="hidden sm:inline">ดูรายชื่อ</span>
                  <ChevronDown v-if="!expandedRounds.has(round.round_id)" class="w-4 h-4" />
                  <ChevronUp v-else class="w-4 h-4" />
                </button>
              </div>
              </div>
              
              <!-- Participants Sub-list -->
              <div v-if="expandedRounds.has(round.round_id)" class="bg-blue-50/30 p-4 border-t border-gray-100">
                <div v-if="loadingParticipants[round.round_id]" class="text-sm text-gray-500 text-center py-4">กำลังโหลดรายชื่อ...</div>
                <div v-else-if="!roundParticipants[round.round_id] || roundParticipants[round.round_id].length === 0" class="text-sm text-gray-500 text-center py-4">ยังไม่มีนักกีฬาในรอบนี้</div>
                <div v-else class="overflow-x-auto">
                  <table class="min-w-full text-sm text-left">
                    <thead class="text-xs text-gray-500 uppercase bg-gray-100/60 rounded-t-lg">
                      <tr>
                        <th class="px-4 py-2.5 font-medium rounded-tl-lg">ลู่/ลำดับ</th>
                        <th class="px-4 py-2.5 font-medium">ชื่อ-นามสกุล / ชื่อทีม</th>
                        <th class="px-4 py-2.5 font-medium rounded-tr-lg">สังกัด</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      <tr v-for="(p, index) in roundParticipants[round.round_id]" :key="index" class="hover:bg-white/60 transition-colors">
                        <td class="px-4 py-2 text-gray-500">{{ p.lane_number || '-' }}</td>
                        <td class="px-4 py-2 font-medium text-gray-800">{{ p.athletes?.full_name || p.relay_teams?.team_name }}</td>
                        <td class="px-4 py-2 text-gray-600">{{ p.athletes?.faculties?.fac_name || p.relay_teams?.faculties?.fac_name || '-' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
