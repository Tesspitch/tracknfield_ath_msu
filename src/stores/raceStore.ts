import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient'
import type { Database } from '../types/database'

type Event = Database['public']['Tables']['events']['Row']
type EventRound = Database['public']['Tables']['event_rounds']['Row']
type RaceResult = Database['public']['Tables']['race_results']['Row']

// Extended type to include joined data for UI
export interface EnhancedRaceResult extends RaceResult {
  athletes?: { full_name: string, student_id: string | null } | null
  relay_teams?: { 
    team_name: string,
    relay_members?: {
      leg_order: number,
      athletes: { full_name: string, student_id: string | null } | null
    }[]
  } | null
  // UI Specific temporary state
  timeInput?: string
  time_unit?: string
  selectedForAdvance?: boolean
}

export const useRaceStore = defineStore('race', () => {
  const events = ref<Event[]>([])
  const rounds = ref<EventRound[]>([])
  const activeResults = ref<EnhancedRaceResult[]>([])

  const selectedEventId = ref<number | 'ALL' | null>(null)
  const selectedRoundId = ref<number | 'ALL' | null>(null)

  const fetchEvents = async () => {
    const { data, error } = await supabase.from('events').select('*').order('event_id')
    if (!error && data) {
      events.value = data
    }
  }

  const fetchRoundsForEvent = async (eventId: number) => {
    const { data, error } = await supabase
      .from('event_rounds')
      .select('*')
      .eq('event_id', eventId)
      .order('round_name')
    if (!error && data) {
      rounds.value = data
    }
  }

  const fetchResultsForRound = async (roundId: number) => {
    const { data, error } = await supabase
      .from('race_results')
      .select(`
        *,
        athletes(full_name, student_id),
        relay_teams(
          team_name,
          relay_members(
            leg_order,
            athletes(full_name, student_id)
          )
        )
      `)
      .eq('round_id', roundId)
      .order('lane_number', { ascending: true })

    if (!error && data) {
      activeResults.value = data as EnhancedRaceResult[]
    }
  }

  const fetchAllResultsForEvent = async (_eventId: number) => {
    if (rounds.value.length === 0) return
    
    // แยกแยะรอบชิง กับ รอบคัดเลือก
    const finalRounds = rounds.value.filter(r => 
      r.round_name.toLowerCase().includes('final') || 
      r.round_name.includes('ชิง')
    )
    const finalRoundIds = finalRounds.map(r => r.round_id)
    
    const heatRounds = rounds.value.filter(r => 
      !r.round_name.toLowerCase().includes('final') && 
      !r.round_name.includes('ชิง')
    )
    const heatRoundIds = heatRounds.map(r => r.round_id)
    
    if (heatRoundIds.length === 0) {
      activeResults.value = []
      return
    }

    // ดึงข้อมูลรอบคัดเลือกทั้งหมด
    const { data: heatData, error } = await supabase
      .from('race_results')
      .select(`
        *,
        athletes(full_name, student_id),
        relay_teams(
          team_name,
          relay_members(
            leg_order,
            athletes(full_name, student_id)
          )
        ),
        event_rounds(round_name)
      `)
      .in('round_id', heatRoundIds)

    if (!error && heatData) {
      // ตรวจสอบว่ามีใครเข้ารอบชิงไปแล้วบ้าง เพื่อกรองออก
      const advancedIds = new Set<string>()
      if (finalRoundIds.length > 0) {
        const { data: finalData } = await supabase
          .from('race_results')
          .select('athlete_id, relay_team_id')
          .in('round_id', finalRoundIds)
          
        if (finalData) {
          finalData.forEach(row => {
            if (row.athlete_id) advancedIds.add(`a_${row.athlete_id}`)
            if (row.relay_team_id) advancedIds.add(`r_${row.relay_team_id}`)
          })
        }
      }

      // กรองคนที่เข้ารอบไปแล้วออก
      const filteredData = heatData.filter(row => {
        if (row.athlete_id && advancedIds.has(`a_${row.athlete_id}`)) return false
        if (row.relay_team_id && advancedIds.has(`r_${row.relay_team_id}`)) return false
        return true
      })

      // Sort by best time (ascending), put non-OK and nulls at the bottom
      const sorted = (filteredData as any[]).sort((a, b) => {
        if (a.status !== 'OK' && b.status === 'OK') return 1
        if (a.status === 'OK' && b.status !== 'OK') return -1
        if (a.record_time === null) return 1
        if (b.record_time === null) return -1
        return (a.record_time || 999999) - (b.record_time || 999999)
      })
      activeResults.value = sorted
    }
  }

  const fetchAllResultsGlobal = async () => {
    const { data, error } = await supabase
      .from('race_results')
      .select(`
        *,
        athletes(full_name, student_id),
        relay_teams(
          team_name,
          relay_members(
            leg_order,
            athletes(full_name, student_id)
          )
        ),
        event_rounds(round_name, events(event_name))
      `)
      .order('rank', { ascending: true }) // You can sort by rank or record_time

    if (!error && data) {
      // Sort by event name, then by round, then by rank/time
      const sorted = (data as any[]).sort((a, b) => {
        const eventA = a.event_rounds?.events?.event_name || ''
        const eventB = b.event_rounds?.events?.event_name || ''
        if (eventA !== eventB) return eventA.localeCompare(eventB)
        
        const rankA = a.rank || 999
        const rankB = b.rank || 999
        return rankA - rankB
      })
      activeResults.value = sorted
    }
  }

  // Subscribe to real-time updates for the current round
  let realtimeChannel: any = null
  const subscribeToRound = (roundId: number) => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
    }

    realtimeChannel = supabase.channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'race_results', filter: `round_id=eq.${roundId}` },
        (_payload) => {
          fetchResultsForRound(roundId)
        }
      )
      .subscribe()
  }

  const saveResults = async (resultsToSave: EnhancedRaceResult[]) => {
    // Identity columns generated always cannot be upserted normally.
    // Use an update loop instead.
    const promises = resultsToSave.map(r => {
      return supabase
        .from('race_results')
        .update({
          record_time: r.record_time,
          rank: r.rank,
          status: r.status,
          time_unit: r.time_unit
        })
        .eq('result_id', r.result_id)
    })

    const responses = await Promise.all(promises)
    const hasError = responses.find(res => res.error)
    if (hasError) {
      console.error('Failed to save some results:', hasError.error)
      throw hasError.error
    }
  }

  return {
    events,
    rounds,
    activeResults,
    selectedEventId,
    selectedRoundId,
    fetchEvents,
    fetchRoundsForEvent,
    fetchResultsForRound,
    fetchAllResultsForEvent,
    fetchAllResultsGlobal,
    subscribeToRound,
    saveResults
  }
})
