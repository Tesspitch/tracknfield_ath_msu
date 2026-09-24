<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { GripVertical } from 'lucide-vue-next'
import { supabase } from '../lib/supabaseClient'
import { useRaceStore } from '../stores/raceStore'

const props = defineProps<{
  isOpen: boolean
  eventId: number | null
  roundId: number | null
}>()

const emit = defineEmits(['close', 'added'])
const raceStore = useRaceStore()

const isSubmitting = ref(false)

const form = ref({
  name: '',
  student_id: '',
  gender: 'M',
  faculty: '',
  lane_number: '',
  relayMembers: [
    { id: 1, student_id: '', name: '', faculty: '', gender: 'M', leg_order: 1 },
    { id: 2, student_id: '', name: '', faculty: '', gender: 'M', leg_order: 2 },
    { id: 3, student_id: '', name: '', faculty: '', gender: 'M', leg_order: 3 },
    { id: 4, student_id: '', name: '', faculty: '', gender: 'M', leg_order: 4 }
  ]
})

const isRelay = computed(() => {
  if (!props.eventId) return false
  const evt = raceStore.events.find(e => e.event_id === props.eventId)
  return evt?.is_relay || false
})

// Reset form when opened
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = {
      name: '',
      student_id: '',
      gender: 'M',
      faculty: '',
      lane_number: '',
      relayMembers: [
        { id: 1, student_id: '', name: '', faculty: '', gender: 'M', leg_order: 1 },
        { id: 2, student_id: '', name: '', faculty: '', gender: 'M', leg_order: 2 },
        { id: 3, student_id: '', name: '', faculty: '', gender: 'M', leg_order: 3 },
        { id: 4, student_id: '', name: '', faculty: '', gender: 'M', leg_order: 4 }
      ]
    }
  }
})

const draggedItemIndex = ref<number | null>(null)

const onDragStart = (idx: number, event: DragEvent) => {
  draggedItemIndex.value = idx
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.dropEffect = 'move'
  }
}

const onDrop = (dropIdx: number) => {
  if (draggedItemIndex.value === null || draggedItemIndex.value === dropIdx) return
  
  const startIdx = draggedItemIndex.value
  
  // Swap the objects in the array
  const temp = form.value.relayMembers[startIdx]
  form.value.relayMembers[startIdx] = form.value.relayMembers[dropIdx]
  form.value.relayMembers[dropIdx] = temp
  
  // Update leg_order based on new index
  form.value.relayMembers.forEach((m, i) => {
    m.leg_order = i + 1
  })
  
  draggedItemIndex.value = null
}

const handleSubmit = async () => {
  if (!props.roundId) return
  isSubmitting.value = true
  
  try {
    let facId = null
    const facName = form.value.faculty.trim()
    
    // 1. Upsert Faculty
    if (facName) {
      const { data: fData } = await supabase.from('faculties').select('fac_id').eq('fac_name', facName).maybeSingle()
      if (fData) {
        facId = fData.fac_id
      } else {
        const { data: newF, error: fErr } = await supabase.from('faculties').insert({ fac_name: facName }).select('fac_id').single()
        if (fErr) throw fErr
        facId = newF.fac_id
      }
    }

    let athleteId = null
    let relayTeamId = null

    if (isRelay.value) {
      // 2. Relay Team Mode
      const { data: newT, error: tErr } = await supabase.from('relay_teams').insert({
        team_name: form.value.name.trim(),
        faculty_id: facId
      }).select('relay_team_id').single()
      
      if (tErr) throw tErr
      relayTeamId = newT.relay_team_id

      for (const m of form.value.relayMembers) {
        if (!m.name.trim()) continue;
        
        let memberFacId = facId;
        if (m.faculty.trim()) {
           const { data: mfData } = await supabase.from('faculties').select('fac_id').eq('fac_name', m.faculty.trim()).maybeSingle()
           if (mfData) memberFacId = mfData.fac_id
           else {
             const { data: newMF } = await supabase.from('faculties').insert({ fac_name: m.faculty.trim() }).select('fac_id').single()
             if (newMF) memberFacId = newMF.fac_id
           }
        }
        
        let mAthleteId = null;
        if (m.student_id.trim()) {
          const { data: aData } = await supabase.from('athletes').select('athlete_id').eq('student_id', m.student_id.trim()).maybeSingle()
          if (aData) {
            mAthleteId = aData.athlete_id
            await supabase.from('athletes').update({ full_name: m.name.trim(), gender: m.gender, faculty_id: memberFacId }).eq('athlete_id', mAthleteId)
          }
        }
        
        if (!mAthleteId) {
           const { data: newA } = await supabase.from('athletes').insert({
             student_id: m.student_id.trim() || null,
             full_name: m.name.trim(),
             gender: m.gender,
             faculty_id: memberFacId
           }).select('athlete_id').single()
           if (newA) mAthleteId = newA.athlete_id
        }
        
        if (mAthleteId) {
          await supabase.from('relay_members').insert({
            relay_team_id: relayTeamId,
            athlete_id: mAthleteId,
            leg_order: m.leg_order
          })
        }
      }
    } else {
      // 2. Individual Athlete Mode
      const studentId = form.value.student_id.trim()
      let existingAthlete = null
      
      if (studentId) {
        const { data: aData } = await supabase.from('athletes').select('athlete_id').eq('student_id', studentId).maybeSingle()
        existingAthlete = aData
      }
      
      if (existingAthlete) {
        athleteId = existingAthlete.athlete_id
        await supabase.from('athletes').update({ 
          full_name: form.value.name.trim(), 
          gender: form.value.gender, 
          faculty_id: facId 
        }).eq('athlete_id', athleteId)
      } else {
        const { data: newA, error: aErr } = await supabase.from('athletes').insert({
          student_id: studentId || null,
          full_name: form.value.name.trim(),
          gender: form.value.gender,
          faculty_id: facId
        }).select('athlete_id').single()
        
        if (aErr) throw aErr
        athleteId = newA.athlete_id
      }
    }

    // 3. Insert into race_results
    const laneNum = parseInt(form.value.lane_number) || null
    if (laneNum) {
      // Clear existing person in this lane to avoid Unique Constraint error
      await supabase.from('race_results').delete().eq('round_id', props.roundId).eq('lane_number', laneNum)
    }
    
    const { error: rErr } = await supabase.from('race_results').insert({
      round_id: props.roundId,
      athlete_id: athleteId,
      relay_team_id: relayTeamId,
      lane_number: laneNum,
      status: 'OK'
    })
    
    if (rErr) throw rErr
    
    alert('เพิ่มรายชื่อสำเร็จ!')
    emit('added')
    emit('close')
  } catch (error: any) {
    alert('เกิดข้อผิดพลาด: ' + error.message)
    console.error(error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <h3 class="text-lg font-semibold text-gray-900">
          {{ isRelay ? 'เพิ่มทีมแข่งขัน (ผลัด)' : 'เพิ่มนักกีฬาเข้าสู่รอบนี้' }}
        </h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4 overflow-y-auto flex-1">
        <div v-if="!isRelay">
          <label class="block text-sm font-medium text-gray-700 mb-1">รหัสนักศึกษา / เลขประจำตัว (ถ้ามี)</label>
          <input 
            v-model="form.student_id"
            type="text" 
            class="w-full border border-gray-300 px-3 py-2 rounded-md focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {{ isRelay ? 'ชื่อทีม' : 'ชื่อ-นามสกุลนักกีฬา' }} <span class="text-red-500">*</span>
          </label>
          <input 
            v-model="form.name"
            type="text" 
            required
            class="w-full border border-gray-300 px-3 py-2 rounded-md focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div v-if="!isRelay">
          <label class="block text-sm font-medium text-gray-700 mb-1">เพศ</label>
          <select 
            v-model="form.gender" 
            class="w-full border border-gray-300 px-3 py-2 rounded-md focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="M">ชาย (M)</option>
            <option value="F">หญิง (F)</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">สังกัด / คณะ / โรงเรียน (ถ้ามี)</label>
          <input 
            v-model="form.faculty"
            type="text" 
            class="w-full border border-gray-300 px-3 py-2 rounded-md focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ลู่วิ่ง (Lane) (เว้นว่างได้)</label>
          <input 
            v-model="form.lane_number"
            type="number" 
            min="1"
            max="12"
            class="w-full border border-gray-300 px-3 py-2 rounded-md focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <!-- Relay Members form -->
        <div v-if="isRelay" class="border-t border-gray-200 pt-4 mt-4 space-y-3">
          <h4 class="font-medium text-gray-700 mb-2">รายชื่อนักกีฬาในทีม (ลากเพื่อสลับไม้ได้)</h4>
          <div 
            v-for="(member, idx) in form.relayMembers" 
            :key="member.id" 
            class="bg-gray-50 p-3 rounded border border-gray-200 relative cursor-move hover:border-blue-400 hover:shadow-sm transition"
            draggable="true"
            @dragstart="onDragStart(idx, $event)"
            @dragover.prevent
            @dragenter.prevent
            @drop="onDrop(idx)"
          >
            <div class="text-sm font-semibold text-gray-600 mb-2 flex items-center">
              <GripVertical class="w-4 h-4 mr-1 text-gray-400" />
              ไม้ {{ member.leg_order }}
            </div>
            <div class="grid grid-cols-2 gap-2 mb-2">
              <input v-model="member.student_id" type="text" placeholder="รหัสนักศึกษา" class="border border-gray-300 px-2 py-1 rounded text-sm w-full" />
              <input v-model="member.name" type="text" placeholder="ชื่อ-นามสกุล" class="border border-gray-300 px-2 py-1 rounded text-sm w-full" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input v-model="member.faculty" type="text" placeholder="คณะ (เว้นว่างเพื่อใช้คณะทีม)" class="border border-gray-300 px-2 py-1 rounded text-sm w-full" />
              <select v-model="member.gender" class="border border-gray-300 px-2 py-1 rounded text-sm w-full text-gray-600">
                <option value="M">ชาย (M)</option>
                <option value="F">หญิง (F)</option>
              </select>
            </div>
          </div>
        </div>
        
        <div class="pt-4 flex justify-end space-x-3">
          <button 
            type="button"
            @click="emit('close')"
            class="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition"
          >
            ยกเลิก
          </button>
          <button 
            type="submit"
            :disabled="isSubmitting"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {{ isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรายชื่อ' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
