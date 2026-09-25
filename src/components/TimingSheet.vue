<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRaceStore, type EnhancedRaceResult } from '../stores/raceStore'
import { parseTime, formatTime } from '../utils/timeFormat'
import AdvanceRoundModal from './AdvanceRoundModal.vue'
import AddParticipantModal from './AddParticipantModal.vue'
import EditParticipantModal from './EditParticipantModal.vue'
import { Trophy, PlusCircle, UserPlus, Trash2, Pencil } from 'lucide-vue-next'
import { supabase } from '../lib/supabaseClient'

const raceStore = useRaceStore()

const isAdvanceModalOpen = ref(false)
const isAddParticipantModalOpen = ref(false)
const isEditModalOpen = ref(false)
const editingResultData = ref<EnhancedRaceResult | null>(null)
const saving = ref(false)

onMounted(() => {
  raceStore.fetchEvents()
})

watch(() => raceStore.selectedEventId, (newId) => {
  if (newId && newId !== 'ALL') {
    raceStore.fetchRoundsForEvent(newId as number)
    raceStore.selectedRoundId = null
    raceStore.activeResults = []
  }
})

watch(() => raceStore.selectedRoundId, (newId) => {
  if (newId === 'ALL' || newId === 'ALL_FINALS' || newId === 'ALL_HEATS') {
    if (raceStore.selectedEventId && raceStore.selectedEventId !== 'ALL') {
      raceStore.fetchAllResultsForEvent(raceStore.selectedEventId as number)
    }
  } else if (newId) {
    raceStore.fetchResultsForRound(newId as number)
    raceStore.subscribeToRound(newId as number)
  } else {
    raceStore.activeResults = []
  }
  
  const event = raceStore.events.find(e => e.event_id === raceStore.selectedEventId)
  bulkTimeUnit.value = getDefaultUnit(event)
})

// Removed old initTimeInputs

// Removed old autoRank

const getDefaultUnit = (event: any) => {
  if (!event) return 'วินาที'
  if (event.distance_meters >= 800) return 'นาที'
  if (event.is_relay && event.distance_meters >= 400) return 'นาที'
  return 'วินาที'
}

const bulkTimeUnit = ref('วินาที')

const applyUnitToAll = () => {
  raceStore.activeResults.forEach(r => {
    r.time_unit = bulkTimeUnit.value
  })
}

const initTimeInputs = () => {
  const event = raceStore.events.find(e => e.event_id === raceStore.selectedEventId)
  const defaultUnit = getDefaultUnit(event)
  
  raceStore.activeResults.forEach(r => {
    if (r.timeInput === undefined) {
      r.timeInput = formatTime(r.record_time)
      r.selectedForAdvance = false
      if (!r.time_unit || r.record_time === null) {
        r.time_unit = defaultUnit
      }
    }
  })
}

const formatTimeInput = (row: any) => {
  if (row.timeInput && row.timeInput.trim() !== '') {
    const parsed = parseTime(row.timeInput)
    if (parsed !== null) {
      row.timeInput = formatTime(parsed)
    }
  }
}

watch(() => raceStore.activeResults, () => {
  initTimeInputs()
}, { deep: true, immediate: true })

const handleStatusChange = (row: any) => {
  if (row.status !== 'OK') {
    row.timeInput = ''
    row.record_time = null
  }
}

const autoRank = () => {
  raceStore.activeResults.forEach(r => {
    r.record_time = parseTime(r.timeInput)
  })

  const okResults = raceStore.activeResults.filter(r => r.status === 'OK' && r.record_time !== null)
  const otherResults = raceStore.activeResults.filter(r => r.status !== 'OK' || r.record_time === null)

  okResults.sort((a, b) => (a.record_time!) - (b.record_time!))

  let currentRank = 1
  okResults.forEach(r => {
    r.rank = currentRank++
  })

  otherResults.forEach(r => {
    r.rank = null
  })

  raceStore.activeResults = [...okResults, ...otherResults]
}

const saveResults = async () => {
  saving.value = true
  try {
    raceStore.activeResults.forEach(r => {
      r.record_time = parseTime(r.timeInput)
      // r.time_unit is already bound via v-model
    })
    await raceStore.saveResults(raceStore.activeResults)
    alert('บันทึกผลสำเร็จ')
  } catch (e: any) {
    alert('เกิดข้อผิดพลาดในการบันทึก: ' + e.message)
    console.error(e)
  } finally {
    saving.value = false
  }
}

const createNewRound = async () => {
  if (!raceStore.selectedEventId) {
    return alert('กรุณาเลือกรายการแข่งขันก่อนสร้างรอบ')
  }
  const roundName = prompt('ตั้งชื่อรอบการแข่งขันใหม่ (เช่น Heat 3, Final):')
  if (!roundName || roundName.trim() === '') return
  
  const { error } = await supabase.from('event_rounds').insert({
    event_id: raceStore.selectedEventId as number,
    round_name: roundName.trim()
  })
  
  if (error) {
    alert('สร้างรอบไม่สำเร็จ: ' + error.message)
  } else {
    raceStore.fetchRoundsForEvent(raceStore.selectedEventId as number)
  }
}

const deleteRound = async () => {
  if (!raceStore.selectedRoundId || raceStore.selectedRoundId === 'ALL') {
    return alert('กรุณาเลือกรอบที่ต้องการลบ')
  }
  
  const round = raceStore.rounds.find(r => r.round_id === raceStore.selectedRoundId)
  if (!round) return
  
  if (!confirm(`ยืนยันการลบ "${round.round_name}" ออกจากระบบ? (รายชื่อนักกีฬาในรอบนี้จะถูกลบด้วย หากไม่ได้แข่งในรอบอื่น)`)) return
  
  try {
    // 1. ดึงข้อมูล race_results ในรอบนี้ทั้งหมด
    const { data: results } = await supabase
      .from('race_results')
      .select('result_id, athlete_id, relay_team_id')
      .eq('round_id', raceStore.selectedRoundId)

    if (results && results.length > 0) {
      // 2. ลบ race_results ออกก่อน (หรือให้ cascade จัดการ แต่ลบตรงนี้ชัวร์สุด)
      await supabase.from('race_results').delete().eq('round_id', raceStore.selectedRoundId)

      // 3. ตามไปลบนักกีฬาและทีมผลัด หากไม่มีข้อมูลในรอบอื่นๆ แล้ว
      for (const res of results) {
        if (res.athlete_id) {
          const { count } = await supabase.from('race_results').select('*', { count: 'exact', head: true }).eq('athlete_id', res.athlete_id)
          if (count === 0) {
            await supabase.from('athletes').delete().eq('athlete_id', res.athlete_id)
          }
        }
        if (res.relay_team_id) {
          const { count } = await supabase.from('race_results').select('*', { count: 'exact', head: true }).eq('relay_team_id', res.relay_team_id)
          if (count === 0) {
            await supabase.from('relay_teams').delete().eq('relay_team_id', res.relay_team_id)
          }
        }
      }
    }

    // 4. ลบรอบการแข่งขัน
    const { error } = await supabase.from('event_rounds').delete().eq('round_id', raceStore.selectedRoundId)
    if (error) throw error

    raceStore.selectedRoundId = null
    raceStore.fetchRoundsForEvent(raceStore.selectedEventId as number)
    alert('ลบรอบการแข่งขันและรายชื่อสำเร็จ')
  } catch (err: any) {
    alert('ลบไม่สำเร็จ: ' + err.message)
    console.error(err)
  }
}

const advancingCandidates = ref<any[]>([])

const openAdvanceModal = () => {
  const selected = raceStore.activeResults.filter(r => r.selectedForAdvance)
  
  if (selected.length === 0) {
    alert('กรุณาติ๊กเลือกนักกีฬาที่จะส่งเข้ารอบ (ช่องซ้ายสุด) ก่อนกดปุ่มนี้ครับ')
    return
  }
    
  advancingCandidates.value = selected.map(r => ({
    id: r.athlete_id || r.relay_team_id,
    name: r.athletes?.full_name || r.relay_teams?.team_name || 'ไม่ทราบชื่อ',
    time: formatTime(r.record_time) || 'ไม่มีสถิติ'
  }))
  
  isAdvanceModalOpen.value = true
}

const handleAdvance = async (data: { roundName: string, athleteIds: number[] }) => {
  try {
    let targetRoundId = null
    const existingRound = raceStore.rounds.find(r => r.round_name === data.roundName)
    
    if (existingRound) {
      targetRoundId = existingRound.round_id
    } else {
      const { data: newR, error: errR } = await supabase.from('event_rounds').insert({
        event_id: raceStore.selectedEventId as number, 
        round_name: data.roundName
      }).select().single()
      
      if (errR) throw errR
      targetRoundId = newR.round_id
      await raceStore.fetchRoundsForEvent(raceStore.selectedEventId as number)
    }

    const inserts = data.athleteIds.map(id => {
      const originalRecord = raceStore.activeResults.find(r => (r.athlete_id === id || r.relay_team_id === id))
      return {
        round_id: targetRoundId,
        athlete_id: originalRecord?.athlete_id || null,
        relay_team_id: originalRecord?.relay_team_id || null,
        lane_number: null,
        status: 'OK'
      }
    })

    const { error } = await supabase.from('race_results').insert(inserts)
    if (error) throw error
    alert(`ส่งตัวแทนเข้ารอบ "${data.roundName}" สำเร็จ!`)
    
    // Automatically switch to the new round to arrange lanes
    raceStore.selectedRoundId = targetRoundId
  } catch (err: any) {
    alert('เกิดข้อผิดพลาดในการส่งเข้ารอบ: ' + err.message)
    console.error(err)
  }
}

const openEditModal = (row: EnhancedRaceResult) => {
  editingResultData.value = row
  isEditModalOpen.value = true
}

const removeResult = async (resultId: number) => {
  if (!confirm('ยืนยันการลบรายการนี้ออกจากรอบการแข่งขัน? (รายชื่อนักกีฬาจะถูกลบออกจากระบบด้วย หากไม่ได้ลงแข่งรายการอื่น)')) return
  
  try {
    const { data: resData } = await supabase.from('race_results').select('athlete_id, relay_team_id').eq('result_id', resultId).maybeSingle()
    
    const { error } = await supabase.from('race_results').delete().eq('result_id', resultId)
    if (error) throw error

    if (resData) {
      if (resData.athlete_id) {
        const { count } = await supabase.from('race_results').select('*', { count: 'exact', head: true }).eq('athlete_id', resData.athlete_id)
        if (count === 0) {
          await supabase.from('athletes').delete().eq('athlete_id', resData.athlete_id)
        }
      }
      if (resData.relay_team_id) {
        const { count } = await supabase.from('race_results').select('*', { count: 'exact', head: true }).eq('relay_team_id', resData.relay_team_id)
        if (count === 0) {
          await supabase.from('relay_teams').delete().eq('relay_team_id', resData.relay_team_id)
        }
      }
    }

    raceStore.fetchResultsForRound(raceStore.selectedRoundId as number)
  } catch (err: any) {
    alert('เกิดข้อผิดพลาด: ' + err.message)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">รายการแข่งขัน</label>
        <select v-model="raceStore.selectedEventId" class="w-full border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500">
          <option :value="null">-- เลือกรายการ --</option>
          <option v-for="e in raceStore.events" :key="e.event_id" :value="e.event_id">
            {{ e.event_name }}
          </option>
        </select>
      </div>
      
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">รอบการแข่งขัน</label>
        <div class="flex space-x-2">
          <select v-model="raceStore.selectedRoundId" class="flex-1 border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" :disabled="!raceStore.selectedEventId">
            <option :value="null">-- เลือกรอบ --</option>
            <option value="ALL" class="font-semibold text-blue-600">-- รวมทุก Heat (เพื่อคัดตัว) --</option>
            <option v-for="r in raceStore.rounds" :key="r.round_id" :value="r.round_id">
              {{ r.round_name }}
            </option>
          </select>
          <button 
            @click="createNewRound"
            class="px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 rounded-md transition flex items-center"
            title="สร้างรอบใหม่"
            :disabled="!raceStore.selectedEventId"
          >
            <PlusCircle class="w-5 h-5" />
          </button>
          <button 
            v-if="raceStore.selectedRoundId && raceStore.selectedRoundId !== 'ALL'"
            @click="deleteRound"
            class="px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 rounded-md transition flex items-center"
            title="ลบรอบนี้ (Heat)"
          >
            <Trash2 class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="raceStore.selectedRoundId" class="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div class="flex justify-between items-center p-4 border-b bg-gray-50 flex-wrap gap-4">
        <h3 class="font-semibold text-gray-800">
          {{ raceStore.selectedRoundId === 'ALL' ? 'จัดอันดับรวมทุก Heat' : 'ตารางบันทึกผล' }}
        </h3>
        
        <div class="flex items-center space-x-4">
          <div v-if="raceStore.selectedRoundId !== 'ALL'" class="flex items-center space-x-2 bg-white px-2 py-1 rounded border border-gray-300 shadow-sm">
            <label class="text-xs font-medium text-gray-500">เปลี่ยนทั้งหมดเป็น:</label>
            <select 
              v-model="bulkTimeUnit" 
              @change="applyUnitToAll"
              class="text-sm border-none bg-transparent focus:ring-0 py-0 pl-1 pr-6 font-medium text-blue-600 cursor-pointer"
            >
              <option value="วินาที">วินาที</option>
              <option value="นาที">นาที</option>
              <option value="ชั่วโมง">ชั่วโมง</option>
            </select>
          </div>

          <div class="space-x-2 flex">
            <button v-if="raceStore.selectedRoundId !== 'ALL'" @click="isAddParticipantModalOpen = true" class="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 rounded text-sm font-medium flex items-center transition">
              <UserPlus class="w-4 h-4 mr-1" />
              เพิ่มนักกีฬา
            </button>
            <button v-if="raceStore.selectedRoundId !== 'ALL'" @click="autoRank" class="px-3 py-1.5 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-200 rounded text-sm font-medium flex items-center transition">
              <Trophy class="w-4 h-4 mr-1" />
              Auto-Rank
            </button>
            <button @click="openAdvanceModal" class="px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-200 rounded text-sm font-medium transition">
              ส่งเข้ารอบ...
            </button>
            <button v-if="raceStore.selectedRoundId !== 'ALL'" @click="saveResults" :disabled="saving" class="px-4 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm font-medium transition">
              {{ saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล' }}
            </button>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-gray-600">
          <thead class="bg-gray-100 text-gray-700">
            <tr>
              <th class="px-4 py-3 w-16 text-center">เข้ารอบ</th>
              <th class="px-4 py-3 w-16 text-center">ลู่</th>
              <th class="px-4 py-3">ชื่อ/ทีม</th>
              <th v-if="raceStore.selectedRoundId === 'ALL'" class="px-4 py-3">จากรอบ</th>
              <th class="px-4 py-3 w-40">เวลา</th>
              <th class="px-4 py-3 w-32">สถานะ</th>
              <th class="px-4 py-3 w-24 text-center">อันดับ</th>
              <th class="px-4 py-3 w-24 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="row in raceStore.activeResults" :key="row.result_id" class="hover:bg-gray-50">
              <td class="px-4 py-2 text-center">
                <input 
                  type="checkbox" 
                  v-model="row.selectedForAdvance"
                  class="w-5 h-5 rounded border-gray-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </td>
              <td class="px-4 py-2 text-center font-medium">{{ row.lane_number || '-' }}</td>
              <td class="px-4 py-2 text-gray-900">
                <div v-if="row.athletes" class="font-medium">
                  {{ row.athletes.full_name }}
                </div>
                <div v-else-if="row.relay_teams">
                  <div class="font-medium text-blue-700">{{ row.relay_teams.team_name }}</div>
                  <div v-if="row.relay_teams.relay_members && row.relay_teams.relay_members.length" class="text-xs text-gray-500 mt-1 pl-2 border-l-2 border-gray-200">
                    <div v-for="(m, idx) in row.relay_teams.relay_members.slice().sort((a: any, b: any) => (a.leg_order || 99) - (b.leg_order || 99))" :key="m.athletes?.student_id || m.athletes?.full_name || idx">
                      <span v-if="m.leg_order">ไม้ {{ m.leg_order }}:</span>
                      <span v-else>สำรอง:</span>
                      {{ m.athletes?.full_name || 'ไม่ระบุ' }}
                    </div>
                  </div>
                </div>
                <div v-else class="text-gray-400 italic">
                  ไม่ระบุ
                </div>
              </td>
              <td v-if="raceStore.selectedRoundId === 'ALL'" class="px-4 py-2 text-gray-500 text-xs">
                {{ (row as any).event_rounds?.round_name || '-' }}
              </td>
              <td class="px-4 py-2">
                <div class="flex items-center space-x-1">
                  <input 
                    type="text" 
                    v-model="row.timeInput"
                    @blur="formatTimeInput(row)"
                    :disabled="row.status !== 'OK' || raceStore.selectedRoundId === 'ALL'"
                    class="w-20 border border-gray-300 px-2 py-1 rounded focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    placeholder="00.00"
                  />
                  <select 
                    v-model="row.time_unit"
                    :disabled="row.status !== 'OK' || raceStore.selectedRoundId === 'ALL'"
                    class="w-16 border-none bg-transparent focus:ring-0 px-1 py-1 text-sm text-gray-600 cursor-pointer disabled:opacity-50"
                  >
                    <option value="วินาที">วิฯ</option>
                    <option value="นาที">นาที</option>
                    <option value="ชั่วโมง">ชม.</option>
                  </select>
                </div>
              </td>
              <td class="px-4 py-2">
                <select 
                  v-model="row.status"
                  @change="handleStatusChange(row)"
                  :disabled="raceStore.selectedRoundId === 'ALL'"
                  class="w-full border border-gray-300 px-2 py-1 rounded focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
                >
                  <option value="OK">OK</option>
                  <option value="DNS">DNS</option>
                  <option value="DNF">DNF</option>
                  <option value="DQ">DQ</option>
                </select>
              </td>
              <td class="px-4 py-2 text-center">
                <input 
                  type="number" 
                  v-model.number="row.rank"
                  :disabled="raceStore.selectedRoundId === 'ALL'"
                  class="w-16 border border-gray-300 px-2 py-1 rounded text-center focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </td>
              <td class="px-4 py-2 text-center space-x-1 whitespace-nowrap">
                <button 
                  v-if="raceStore.selectedRoundId !== 'ALL'"
                  @click="openEditModal(row)"
                  class="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition"
                  title="แก้ไขรายชื่อ/สลับไม้"
                >
                  <Pencil class="w-4 h-4 inline" />
                </button>
                <button 
                  v-if="raceStore.selectedRoundId !== 'ALL'"
                  @click="removeResult(row.result_id)"
                  class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                  title="ลบออก"
                >
                  <Trash2 class="w-4 h-4 inline" />
                </button>
              </td>
            </tr>
            <tr v-if="raceStore.activeResults.length === 0">
              <td :colspan="raceStore.selectedRoundId === 'ALL' ? 8 : 7" class="px-4 py-8 text-center text-gray-500">
                ไม่มีข้อมูลนักกีฬาในรอบนี้
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <AdvanceRoundModal 
      :isOpen="isAdvanceModalOpen" 
      :candidates="advancingCandidates"
      :existingRounds="raceStore.rounds"
      @close="isAdvanceModalOpen = false" 
      @advance="handleAdvance" 
    />
    
    <AddParticipantModal
      :isOpen="isAddParticipantModalOpen"
      :eventId="(raceStore.selectedEventId as number)"
      :roundId="typeof raceStore.selectedRoundId === 'number' ? raceStore.selectedRoundId : null"
      @close="isAddParticipantModalOpen = false"
      @added="typeof raceStore.selectedRoundId === 'number' && raceStore.fetchResultsForRound(raceStore.selectedRoundId)"
    />
    
    <EditParticipantModal
      :isOpen="isEditModalOpen"
      :eventId="(raceStore.selectedEventId as number)"
      :roundId="typeof raceStore.selectedRoundId === 'number' ? raceStore.selectedRoundId : null"
      :existingData="editingResultData"
      @close="isEditModalOpen = false"
      @edited="raceStore.selectedRoundId !== 'ALL' && raceStore.fetchResultsForRound(raceStore.selectedRoundId as number)"
    />
  </div>
</template>
