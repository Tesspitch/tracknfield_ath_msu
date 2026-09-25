<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRaceStore, type EnhancedRaceResult } from '../stores/raceStore'
import { formatTime } from '../utils/timeFormat'
import CertificatePreview from './CertificatePreview.vue'
import BulkCertificateModal from './BulkCertificateModal.vue'
import { FileBadge, Download, Printer } from 'lucide-vue-next'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import logoUrl from '../assets/project_logo.jpg'

const raceStore = useRaceStore()

const isCertModalOpen = ref(false)
const isBulkModalOpen = ref(false)
const bulkWinners = ref<any[]>([])

const certData = ref({
  athleteNames: [] as string[],
  rank: null as number | null,
  eventName: '',
  timeText: '',
  timeUnit: 'วินาที'
})

onMounted(() => {
  raceStore.fetchEvents()
})

watch(() => raceStore.selectedEventId, (newId) => {
  if (newId === 'ALL') {
    raceStore.fetchAllResultsGlobal()
    raceStore.selectedRoundId = 'ALL'
  } else if (newId) {
    raceStore.fetchRoundsForEvent(newId as number)
    raceStore.selectedRoundId = null
    raceStore.activeResults = []
  } else {
    raceStore.activeResults = []
    raceStore.selectedRoundId = null
  }
})

watch(() => raceStore.selectedRoundId, (newId) => {
  if (newId) {
    if (newId === 'ALL' || newId === 'ALL_FINALS' || newId === 'ALL_HEATS') {
      if (raceStore.selectedEventId === 'ALL') {
        raceStore.fetchAllResultsGlobal(newId as 'ALL' | 'ALL_FINALS' | 'ALL_HEATS')
      } else if (raceStore.selectedEventId) {
        raceStore.fetchAllResultsForEvent(raceStore.selectedEventId as number)
      }
    } else {
      raceStore.fetchResultsForRound(newId as number)
    }
  } else {
    raceStore.activeResults = []
  }
})

const getDefaultUnit = (event: any) => {
  if (!event) return 'วินาที'
  // 800m+ -> นาที
  if (event.distance_meters >= 800) return 'นาที'
  // 4x400m -> is_relay=true and distance=400 -> นาที
  if (event.is_relay && event.distance_meters >= 400) return 'นาที'
  // 100m, 200m, 400m, 4x100m -> วินาที
  return 'วินาที'
}

const getDisplayTime = (row: any) => {
  if (!row.record_time) return '-'
  const event = row.event_rounds?.events || raceStore.events.find(e => e.event_id === raceStore.selectedEventId)
  const unit = row.time_unit || getDefaultUnit(event)
  return `${formatTime(row.record_time)} ${unit}`
}

const openCertificate = (row: EnhancedRaceResult) => {
  const event = raceStore.events.find(e => e.event_id === raceStore.selectedEventId)
  
  let namesToAdd: string[] = []
  if (row.athletes) {
    namesToAdd = [row.athletes.full_name]
  } else if (row.relay_teams) {
    if (row.relay_teams.relay_members && row.relay_teams.relay_members.length > 0) {
      namesToAdd = row.relay_teams.relay_members
        .slice()
        .sort((a: any, b: any) => a.leg_order - b.leg_order)
        .map((m: any) => m.athletes?.full_name || 'ไม่ระบุชื่อ')
    } else {
      namesToAdd = [row.relay_teams.team_name]
    }
  } else {
    namesToAdd = ['ไม่ระบุชื่อ']
  }
  
  certData.value = {
    athleteNames: namesToAdd,
    rank: row.rank,
    eventName: event ? event.event_name : 'ไม่ระบุรายการ',
    timeText: formatTime(row.record_time) || '',
    timeUnit: row.time_unit || getDefaultUnit(event)
  }
  isCertModalOpen.value = true
}

const isFinalRound = computed(() => {
  if (!raceStore.selectedRoundId) return false
  const round = raceStore.rounds.find(r => r.round_id === raceStore.selectedRoundId)
  if (!round) return false
  const name = round.round_name.toLowerCase()
  return name.includes('final') || name.includes('ชิง')
})

const canGetCertificate = (row: any) => {
  return isFinalRound.value && row.status === 'OK' && row.rank && row.rank <= 3
}

const prepareBulkExport = async () => {
  const { data, error } = await supabase
    .from('race_results')
    .select(`
      *,
      athletes(full_name),
      relay_teams(team_name, relay_members(leg_order, athletes(full_name))),
      event_rounds(round_name, events(event_name, distance_meters, is_relay))
    `)
    .eq('status', 'OK')
    .lte('rank', 3)
    .not('rank', 'is', null)

  if (error) {
    alert('ดึงข้อมูลผิดพลาด: ' + error.message)
    return
  }

  const winners: any[] = []
  
  for (const row of data) {
    const round = row.event_rounds as any
    if (!round) continue
    
    const rName = round.round_name.toLowerCase()
    if (rName.includes('final') || rName.includes('ชิง')) {
      const event = round.events
      
      let namesToAdd: string[] = []
      if (row.athletes) {
        namesToAdd = [row.athletes.full_name]
      } else if (row.relay_teams) {
        if (row.relay_teams.relay_members && row.relay_teams.relay_members.length > 0) {
          namesToAdd = row.relay_teams.relay_members
            .slice()
            .sort((a: any, b: any) => a.leg_order - b.leg_order)
            .map((m: any) => m.athletes?.full_name || 'ไม่ระบุชื่อ')
        } else {
          namesToAdd = [row.relay_teams.team_name]
        }
      } else {
        namesToAdd = ['ไม่ระบุชื่อ']
      }
      
      namesToAdd.forEach(n => {
        winners.push({
          name: n,
          rank: row.rank,
          eventName: event.event_name,
          timeText: formatTime(row.record_time) || '-',
          timeUnit: row.time_unit || getDefaultUnit(event)
        })
      })
    }
  }
  
  if (winners.length === 0) {
    alert('ไม่พบข้อมูลผู้ชนะอันดับ 1-3 ในรอบชิงชนะเลิศ (Final) ในระบบเลยครับ')
    return
  }

  // Sort by event name then by rank
  winners.sort((a, b) => {
    if (a.eventName < b.eventName) return -1
    if (a.eventName > b.eventName) return 1
    return a.rank - b.rank
  })

  bulkWinners.value = winners
  isBulkModalOpen.value = true
}

const validResults = computed(() => {
  return raceStore.activeResults.filter(r => r.status === 'OK' || !r.status)
})

const invalidResults = computed(() => {
  return raceStore.activeResults.filter(r => r.status && r.status !== 'OK')
})

const exportResultsToExcel = () => {
  if (raceStore.activeResults.length === 0) {
    alert('ไม่มีข้อมูลผลการแข่งขัน')
    return
  }

  const exportData = validResults.value.map((row) => {
    let name = row.athletes?.full_name || row.relay_teams?.team_name || 'ไม่ระบุ'
    return {
      'อันดับ': row.rank || '-',
      'ชื่อ/ทีม': name,
      'สถิติ (เวลา)': getDisplayTime(row)
    }
  })

  const ws = XLSX.utils.json_to_sheet([])
  XLSX.utils.sheet_add_json(ws, exportData, { origin: 'A5', skipHeader: false })
  
  let titleContext = ''
  if (raceStore.selectedEventId === 'ALL') {
    titleContext = 'รวมทุกรายการ'
  } else {
    const event = raceStore.events.find(e => e.event_id === raceStore.selectedEventId)
    const round = raceStore.rounds.find(r => r.round_id === raceStore.selectedRoundId)
    titleContext = event ? event.event_name : ''
    if (round) {
      titleContext += ` - ${round.round_name}`
    }
  }

  XLSX.utils.sheet_add_aoa(ws, [
    ['การแข่งขัน MSU TRACK RUNNING OPEN 2026'],
    ['วันที่ 27 กันยายน 2569'],
    [`ผลการแข่งขัน: ${titleContext}`],
    []
  ], { origin: 'A1' })
  
  const wscols = [
    { wch: 10 },
    { wch: 40 },
    { wch: 20 },
  ]
  ws['!cols'] = wscols
  
  if (invalidResults.value.length > 0) {
    const invalidDataRows = invalidResults.value.map(row => {
      let name = row.athletes?.full_name || row.relay_teams?.team_name || 'ไม่ระบุ'
      return [row.status, name, '-']
    })
    
    const startRowForInvalid = 5 + exportData.length + 3
    XLSX.utils.sheet_add_aoa(ws, [
      ['นักกีฬาที่ไม่ผ่านการแข่งขัน (DNF/DNS/DQ)'],
      ['สถานะ', 'ชื่อ/ทีม', 'สถิติ (เวลา)'],
      ...invalidDataRows
    ], { origin: `A${startRowForInvalid}` })
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Results')
  
  const safeName = titleContext.replace(/[\/\\?%*:|"<>]/g, '-')
  XLSX.writeFile(wb, `Results_${safeName}.xlsx`)
}

const exportResultsToPDF = () => {
  if (raceStore.activeResults.length === 0) {
    alert('ไม่มีข้อมูลผลการแข่งขัน')
    return
  }

  let titleContext = ''
  if (raceStore.selectedEventId === 'ALL') {
    titleContext = 'รวมทุกรายการ'
  } else {
    const event = raceStore.events.find(e => e.event_id === raceStore.selectedEventId)
    const round = raceStore.rounds.find(r => r.round_id === raceStore.selectedRoundId)
    titleContext = event ? event.event_name : ''
    if (round) {
      titleContext += ` - ${round.round_name}`
    }
  }

  let tableRows = ''
  validResults.value.forEach((row) => {
    let name = row.athletes?.full_name || row.relay_teams?.team_name || 'ไม่ระบุ'
    
    tableRows += `
      <tr>
        <td style="border: 1px solid #333; padding: 10px 8px; text-align: center; font-weight: bold;">
          ${row.rank === 1 ? '1' : row.rank === 2 ? '2' : row.rank === 3 ? '3' : (row.rank || '-')}
        </td>
        <td style="border: 1px solid #333; padding: 10px 8px;">${name}</td>
        <td style="border: 1px solid #333; padding: 10px 8px; text-align: center;">${getDisplayTime(row)}</td>
      </tr>
    `
  })

  let invalidHtml = ''
  if (invalidResults.value.length > 0) {
    let invalidTableRows = ''
    invalidResults.value.forEach((row) => {
      let name = row.athletes?.full_name || row.relay_teams?.team_name || 'ไม่ระบุ'
      invalidTableRows += `
        <tr>
          <td style="border: 1px solid #333; padding: 10px 8px; text-align: center; font-weight: bold; color: #d97706;">${row.status}</td>
          <td style="border: 1px solid #333; padding: 10px 8px;">${name}</td>
          <td style="border: 1px solid #333; padding: 10px 8px; text-align: center;">-</td>
        </tr>
      `
    })

    invalidHtml = `
      <div style="margin-top: 30px;">
        <h4 style="margin-bottom: 10px; font-size: 16px; font-weight: bold;">นักกีฬาที่ไม่ผ่านการแข่งขัน (DNF/DNS/DQ)</h4>
        <table>
          <thead>
            <tr>
              <th style="width: 15%;">สถานะ</th>
              <th style="width: 60%;">ชื่อ/ทีม</th>
              <th style="width: 25%;">สถิติ (เวลา)</th>
            </tr>
          </thead>
          <tbody>
            ${invalidTableRows}
          </tbody>
        </table>
      </div>
    `
  }

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('กรุณาอนุญาตให้ Pop-up ทำงานเพื่อพิมพ์เอกสาร')
    return
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Results_${titleContext}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Sarabun', Tahoma, sans-serif; padding: 20px; color: #000; }
          .header-container { text-align: center; margin-bottom: 15px; }
          .header-container img { height: 90px; margin-bottom: 10px; object-fit: contain; }
          h2 { text-align: center; margin: 5px 0; font-size: 22px; }
          h3 { text-align: center; margin: 5px 0; font-size: 18px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 15px; }
          th { border: 1px solid #333; padding: 12px 8px; background-color: #f2f2f2; font-weight: bold; text-align: center; }
          @media print {
            @page { margin: 1cm; size: A4 portrait; }
            body { padding: 0; }
            th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <img src="${window.location.origin}${logoUrl}" alt="Logo" />
          <h2>การแข่งขัน MSU TRACK RUNNING OPEN 2026</h2>
          <h2>วันที่ 27 กันยายน 2569</h2>
          <h3>ผลการแข่งขัน: ${titleContext}</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 10%;">อันดับ</th>
              <th style="width: 60%;">ชื่อ/ทีม</th>
              <th style="width: 30%;">สถิติ (เวลา)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        ${invalidHtml}
        <script>
          setTimeout(() => {
            window.print();
          }, 800);
        <\/script>
      </body>
    </html>
  `)
  
  printWindow.document.close()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
      <h2 class="text-xl font-bold text-gray-800">ผลการแข่งขัน</h2>
      <button 
        @click="prepareBulkExport"
        class="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition"
      >
        <Download class="w-4 h-4 mr-2" />
        ดาวน์โหลดเกียรติบัตรทั้งหมด (PDF เดียว)
      </button>
    </div>

    <div class="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-2">รายการแข่งขัน</label>
        <select v-model="raceStore.selectedEventId" class="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3">
          <option :value="null">-- เลือกรายการ --</option>
          <option value="ALL">ดูผลการแข่งขันทั้งหมดทุกรายการ</option>
          <option v-for="e in raceStore.events" :key="e.event_id" :value="e.event_id">
            {{ e.event_name }}
          </option>
        </select>
      </div>
      
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-2">รอบการแข่งขัน (เลือกรอบชิงเพื่อออกเกียรติบัตร)</label>
        <select v-model="raceStore.selectedRoundId" class="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3" :disabled="!raceStore.selectedEventId">
          <option :value="null">-- เลือกรอบ --</option>
          <option v-if="raceStore.selectedEventId === 'ALL'" value="ALL">รวมผลทุกรอบ (ทั้งหมด)</option>
          <option v-if="raceStore.selectedEventId === 'ALL'" value="ALL_FINALS">เฉพาะรอบชิงชนะเลิศทั้งหมด</option>
          <option v-if="raceStore.selectedEventId === 'ALL'" value="ALL_HEATS">เฉพาะรอบคัดเลือกทั้งหมด</option>
          <option v-if="raceStore.selectedEventId && raceStore.selectedEventId !== 'ALL'" value="ALL">ดูผลรวมรอบคัดเลือก</option>
          <option v-for="r in raceStore.rounds" :key="r.round_id" :value="r.round_id">
            {{ r.round_name }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="raceStore.selectedRoundId" class="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div class="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h3 class="font-semibold text-gray-800">ผลการแข่งขันอย่างเป็นทางการ</h3>
        
        <div class="flex items-center gap-2">
          <span v-if="!isFinalRound" class="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded hidden sm:inline-block">
            ปุ่มออกเกียรติบัตรจะแสดงเฉพาะรอบ "Final" หรือ "ชิง" เท่านั้น
          </span>
          <button 
            @click="exportResultsToPDF"
            class="px-2 py-1 bg-white text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-md transition flex items-center text-xs font-medium gap-1 shadow-sm"
            title="พิมพ์ผลการแข่งขันเป็น PDF"
          >
            <Printer class="w-3.5 h-3.5" /> PDF
          </button>
          <button 
            @click="exportResultsToExcel"
            class="px-2 py-1 bg-white text-green-600 hover:bg-green-100 border border-green-200 rounded-md transition flex items-center text-xs font-medium gap-1 shadow-sm"
            title="ส่งออกผลการแข่งขันเป็น Excel"
          >
            <Download class="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-gray-600">
          <thead class="bg-gray-100 text-gray-700">
            <tr>
              <th class="px-4 py-3 w-20 text-center">อันดับ</th>
              <th class="px-4 py-3">ชื่อ/ทีม</th>
              <th class="px-4 py-3 w-32">สถิติ (เวลา)</th>
              <th class="px-4 py-3 w-32 text-center">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="row in validResults" :key="row.result_id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-center font-bold text-gray-900">
                <span v-if="row.rank === 1" class="text-yellow-600">🥇 1</span>
                <span v-else-if="row.rank === 2" class="text-gray-400">🥈 2</span>
                <span v-else-if="row.rank === 3" class="text-amber-700">🥉 3</span>
                <span v-else>{{ row.rank || '-' }}</span>
              </td>
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">
                  {{ row.athletes?.full_name || row.relay_teams?.team_name || 'ไม่ระบุ' }}
                </div>
                <div class="text-xs text-gray-500 mt-0.5">
                  {{ (row.athletes?.student_id) || 'ไม่ระบุรหัสนักศึกษา' }}
                </div>
                <div v-if="raceStore.selectedEventId === 'ALL'" class="text-xs text-blue-600 mt-1 font-semibold bg-blue-50 px-2 py-1 rounded inline-block">
                  {{ row.event_rounds?.events?.event_name }} ({{ row.event_rounds?.round_name }})
                </div>
              </td>
              <td class="px-4 py-3 font-mono">{{ getDisplayTime(row) }}</td>
              <td class="px-4 py-3 text-center">
                <button 
                  v-if="canGetCertificate(row)"
                  @click="openCertificate(row)"
                  class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-medium transition"
                >
                  <FileBadge class="w-4 h-4 mr-1" />
                  เกียรติบัตร
                </button>
              </td>
            </tr>
            <tr v-if="validResults.length === 0">
              <td colspan="4" class="px-4 py-8 text-center text-gray-500">
                ไม่มีข้อมูลผลการแข่งขันที่ผ่านการแข่งขันสำเร็จในรอบนี้
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="invalidResults.length > 0" class="overflow-x-auto border-t border-gray-200 mt-6">
        <div class="p-4 bg-orange-50 border-b border-orange-100 flex items-center">
          <h4 class="font-semibold text-orange-800">นักกีฬาที่ไม่ผ่านการแข่งขัน (DNF/DNS/DQ)</h4>
        </div>
        <table class="w-full text-left text-sm text-gray-600">
          <thead class="bg-gray-100 text-gray-700">
            <tr>
              <th class="px-4 py-3 w-24 text-center">สถานะ</th>
              <th class="px-4 py-3">ชื่อ/ทีม</th>
              <th class="px-4 py-3 w-32">สถิติ (เวลา)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="row in invalidResults" :key="row.result_id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-center font-bold text-orange-600">
                {{ row.status }}
              </td>
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">
                  {{ row.athletes?.full_name || row.relay_teams?.team_name || 'ไม่ระบุ' }}
                </div>
                <div class="text-xs text-gray-500 mt-0.5">
                  {{ (row.athletes?.student_id) || 'ไม่ระบุรหัสนักศึกษา' }}
                </div>
                <div v-if="raceStore.selectedEventId === 'ALL'" class="text-xs text-blue-600 mt-1 font-semibold bg-blue-50 px-2 py-1 rounded inline-block">
                  {{ row.event_rounds?.events?.event_name }} ({{ row.event_rounds?.round_name }})
                </div>
              </td>
              <td class="px-4 py-3 font-mono text-gray-400">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <CertificatePreview 
      :is-open="isCertModalOpen"
      :athlete-names="certData.athleteNames"
      :rank="certData.rank"
      :event-name="certData.eventName"
      :time-text="certData.timeText"
      :default-time-unit="certData.timeUnit"
      @close="isCertModalOpen = false"
    />
    
    <BulkCertificateModal
      :is-open="isBulkModalOpen"
      :winners="bulkWinners"
      @close="isBulkModalOpen = false"
    />
  </div>
</template>
