<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { Search, Trash2, Download } from 'lucide-vue-next'
import * as XLSX from 'xlsx'

const athletes = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const facultyFilter = ref('ALL')
const eventFilter = ref('ALL')
const faculties = ref<any[]>([])
const events = ref<string[]>([])

const fetchAthletes = async () => {
  loading.value = true
  try {
    // ดึงข้อมูลคณะ
    const { data: facs } = await supabase.from('faculties').select('*').order('fac_name')
    faculties.value = facs || []

    // ดึงข้อมูลนักกีฬาและรายการที่ลงแข่ง
    // ใช้ left join กับ race_results และ event_rounds -> events
    const { data, error } = await supabase
      .from('athletes')
      .select(`
        *,
        faculties ( fac_name ),
        race_results (
          event_rounds (
            events ( event_name )
          )
        ),
        relay_members (
          relay_teams (
            race_results (
              event_rounds (
                events ( event_name )
              )
            )
          )
        )
      `)
      .order('full_name')

    if (error) throw error

    // ประมวลผลรายการแข่งให้แสดงง่ายๆ
    const allEvents = new Set<string>()
    const processed = (data || []).map(a => {
      const indivEvents = (a.race_results || [])
        .map((r: any) => r.event_rounds?.events?.event_name)
        .filter(Boolean)
      
      const relayEvents = (a.relay_members || [])
        .flatMap((m: any) => (m.relay_teams?.race_results || []).map((r: any) => r.event_rounds?.events?.event_name))
        .filter(Boolean)

      // กรองซ้ำ
      const allUniqueEvents = [...new Set([...indivEvents, ...relayEvents])]
      allUniqueEvents.forEach((e: string) => allEvents.add(e))

      return {
        ...a,
        eventList: allUniqueEvents
      }
    })

    events.value = Array.from(allEvents).sort()
    athletes.value = processed
  } catch (e: any) {
    console.error(e)
    alert('โหลดข้อมูลล้มเหลว: ' + e.message)
  } finally {
    loading.value = false
  }
}

const deleteAthlete = async (athleteId: number, name: string) => {
  if (!confirm(`ยืนยันการลบนักกีฬา "${name}" หรือไม่?\nข้อมูลการแข่งขันและผลลัพธ์ของนักกีฬาคนนี้จะถูกลบไปด้วย!`)) return
  
  try {
    // ลบข้อมูลที่ผูกอยู่ก่อน (เพื่อป้องกัน foreign key constraint หากไม่มี cascade)
    await supabase.from('race_results').delete().eq('athlete_id', athleteId)
    await supabase.from('relay_members').delete().eq('athlete_id', athleteId)
    
    // ลบนักกีฬา
    const { error } = await supabase.from('athletes').delete().eq('athlete_id', athleteId)
    if (error) throw error
    
    fetchAthletes()
  } catch (err: any) {
    alert('ลบไม่สำเร็จ: ' + err.message)
  }
}

const deleteAllAthletes = async () => {
  if (!confirm('🚨 คำเตือน: คุณกำลังจะลบ "รายชื่อนักกีฬาทั้งหมด" ออกจากระบบ!\nข้อมูลการแข่งขันทังหมดของพวกเขาก็จะหายไปด้วย\n\nคุณแน่ใจหรือไม่?')) return
  if (!confirm('ยืนยันอีกครั้ง! ข้อมูลจะถูกลบถาวร ไม่สามารถกู้คืนได้ ใช่หรือไม่?')) return
  
  try {
    loading.value = true
    await supabase.from('race_results').delete().neq('result_id', 0)
    await supabase.from('relay_members').delete().neq('member_id', 0)
    // ทีมผลัดก็จะไม่มีสมาชิกแล้ว ก็ลบทีมผลัดไปด้วย
    await supabase.from('relay_teams').delete().neq('relay_team_id', 0)
    
    const { error } = await supabase.from('athletes').delete().neq('athlete_id', 0)
    if (error) throw error
    
    fetchAthletes()
  } catch (err: any) {
    alert('ลบไม่สำเร็จ: ' + err.message)
    loading.value = false
  }
}

onMounted(() => {
  fetchAthletes()
})

const filteredAthletes = computed(() => {
  let result = athletes.value

  if (facultyFilter.value !== 'ALL') {
    result = result.filter(a => a.faculty_id === parseInt(facultyFilter.value))
  }

  if (eventFilter.value !== 'ALL') {
    result = result.filter(a => a.eventList.includes(eventFilter.value))
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(a => 
      (a.full_name && a.full_name.toLowerCase().includes(q)) || 
      (a.student_id && a.student_id.toLowerCase().includes(q)) ||
      (a.eventList.some((e: string) => e.toLowerCase().includes(q)))
    )
  }

  return result
})

const exportToExcel = () => {
  const data = filteredAthletes.value.map((a, index) => ({
    'ลำดับ': index + 1,
    'รหัสนิสิต': a.student_id || '-',
    'ชื่อ-นามสกุล': a.full_name,
    'เพศ': a.gender,
    'คณะ/สังกัด': a.faculties?.fac_name || '-',
    'รายการที่ลงแข่ง': a.eventList.join(', '),
    'ลายมือชื่อ': '' // เว้นว่างสำหรับเซ็นชื่อ
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  
  // ปรับความกว้างคอลัมน์
  const wscols = [
    { wch: 8 },  // ลำดับ
    { wch: 15 }, // รหัส
    { wch: 30 }, // ชื่อ
    { wch: 8 },  // เพศ
    { wch: 25 }, // คณะ
    { wch: 40 }, // รายการ
    { wch: 20 }, // ลายมือชื่อ
  ]
  ws['!cols'] = wscols

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อนักกีฬา')
  
  const fileName = `รายชื่อนักกีฬา_${facultyFilter.value === 'ALL' ? 'ทั้งหมด' : faculties.value.find(f => f.fac_id === parseInt(facultyFilter.value))?.fac_name || 'คณะ'}_${eventFilter.value === 'ALL' ? 'ทุกรายการ' : eventFilter.value}.xlsx`
  XLSX.writeFile(wb, fileName)
}

</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <h2 class="text-xl font-bold text-gray-800">รายชื่อนักกีฬาทั้งหมด ({{ filteredAthletes.length }} คน)</h2>
        <button 
          v-if="filteredAthletes.length > 0"
          @click="exportToExcel"
          class="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-md text-sm font-medium transition flex items-center"
          title="ส่งออกใบเซ็นชื่อเป็น Excel"
        >
          <Download class="w-4 h-4 mr-1" />
          ส่งออก Excel
        </button>
        <button 
          v-if="athletes.length > 0"
          @click="deleteAllAthletes"
          class="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-md text-sm font-medium transition flex items-center"
        >
          <Trash2 class="w-4 h-4 mr-1" />
          ลบนักกีฬาทั้งหมด
        </button>
      </div>
      
      <div class="flex flex-col sm:flex-row gap-2">
        <select 
          v-model="eventFilter" 
          class="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 pl-3 pr-10"
        >
          <option value="ALL">ทุกรายการ (ระยะ)</option>
          <option v-for="e in events" :key="e" :value="e">
            {{ e }}
          </option>
        </select>

        <select 
          v-model="facultyFilter" 
          class="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 pl-3 pr-10"
        >
          <option value="ALL">ทุกคณะ/สังกัด</option>
          <option v-for="f in faculties" :key="f.fac_id" :value="f.fac_id">
            {{ f.fac_name }}
          </option>
        </select>
        
        <div class="relative">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="ค้นหาชื่อ, รหัส, รายการ..." 
            class="w-full sm:w-64 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 pl-10 pr-3"
          />
          <Search class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">
      กำลังโหลดข้อมูล...
    </div>

    <div v-else class="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm text-left">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 font-medium text-gray-500">รหัสนิสิต</th>
              <th scope="col" class="px-6 py-3 font-medium text-gray-500">ชื่อ-นามสกุล</th>
              <th scope="col" class="px-6 py-3 font-medium text-gray-500">เพศ</th>
              <th scope="col" class="px-6 py-3 font-medium text-gray-500">คณะ/สังกัด</th>
              <th scope="col" class="px-6 py-3 font-medium text-gray-500">รายการที่ลงแข่ง</th>
              <th scope="col" class="px-6 py-3 font-medium text-gray-500 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr v-for="athlete in filteredAthletes" :key="athlete.athlete_id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-gray-500">{{ athlete.student_id || '-' }}</td>
              <td class="px-6 py-4 font-medium text-gray-900">{{ athlete.full_name }}</td>
              <td class="px-6 py-4 text-gray-500">{{ athlete.gender }}</td>
              <td class="px-6 py-4 text-gray-500">{{ athlete.faculties?.fac_name || '-' }}</td>
              <td class="px-6 py-4">
                <div v-if="athlete.eventList.length > 0" class="flex flex-wrap gap-1">
                  <span 
                    v-for="ev in athlete.eventList" 
                    :key="ev" 
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {{ ev }}
                  </span>
                </div>
                <div v-else class="text-gray-400 italic text-xs">ไม่มีข้อมูล (รอจัดรอบ)</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button 
                  @click="deleteAthlete(athlete.athlete_id, athlete.full_name)"
                  class="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-md transition"
                  title="ลบนักกีฬา"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </td>
            </tr>
            <tr v-if="filteredAthletes.length === 0">
              <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                ไม่พบข้อมูลนักกีฬา
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
