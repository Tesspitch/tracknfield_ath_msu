import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'

export const useImportStore = defineStore('import', () => {
  const isImporting = ref(false)
  const importError = ref<string | null>(null)
  const importSuccessMsg = ref<string | null>(null)

  const processExcel = async (file: File) => {
    isImporting.value = true
    importError.value = null
    importSuccessMsg.value = null

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })

      const sheetIndividual = workbook.Sheets['บุคคล']
      const sheetRelay = workbook.Sheets['ผลัด']

      const { data: allEventsData, error: eventErr } = await supabase.from('events').select('*')
      if (eventErr) throw eventErr
      const allEvents = allEventsData || []

      let count = 0;
      const importedEventNames = new Set<string>();

      if (sheetIndividual) {
        const jsonIndiv = XLSX.utils.sheet_to_json(sheetIndividual)
        count += await processIndividuals(jsonIndiv, allEvents, importedEventNames)
      }

      if (sheetRelay) {
        const jsonRelay = XLSX.utils.sheet_to_json(sheetRelay)
        count += await processRelays(jsonRelay, allEvents, importedEventNames)
      }

      const eventNamesStr = Array.from(importedEventNames).join(', ')
      importSuccessMsg.value = `นำเข้าข้อมูลสำเร็จแล้ว (${count} รายชื่อ) จากรายการ: ${eventNamesStr}`
    } catch (err: any) {
      console.error(err)
      importError.value = err.message || 'Error processing Excel file'
    } finally {
      isImporting.value = false
    }
  }

  const processIndividuals = async (rows: any[], allEvents: any[], importedEventNames: Set<string>) => {
    let importedCount = 0
    for (const row of rows) {
      const studentId = String(row.student_id || '').trim()
      const fullName = String(row.full_name || '').trim()
      const gender = String(row.gender || '').trim().toUpperCase()
      const facName = String(row.faculty_name || '').trim()
      const studyYear = parseInt(row.study_year) || null
      const eventName = String(row.event_name || '').trim()
      const roundName = String(row.round_name || '').trim()
      const laneNum = parseInt(row.lane_number) || null

      if (!fullName || !eventName) continue

      // 1. Find Event
      const normalizeName = (name: string) => String(name).replace(/\s+/g, '').replace(/^วิ่ง/, '').replace(/^ผลัด/, '').replace(/\*/g, 'x').replace(/ชาย$/, '').replace(/หญิง$/, '').replace(/ผสม$/, '').replace(/เมตร/g, '').toLowerCase()
      const normalizedSearchName = normalizeName(eventName)
      
      let eventData = allEvents.find((e: any) => 
        normalizeName(e.event_name) === normalizedSearchName && 
        (e.gender === gender || e.gender === 'Mixed' || !e.gender)
      );
      
      if (!eventData) {
        throw new Error(`ไม่พบรายการแข่งขันที่ชื่อ: "${eventName}" ชาย/หญิง ไม่ตรงกัน หรือชื่อรายการผิด กรุณาตรวจสอบให้ตรงกับในฐานข้อมูล`)
      }

      // 2. Check for Duplicate in Event
      const query = supabase
        .from('race_results')
        .select('result_id, athletes!inner(student_id, full_name), event_rounds!inner(event_id)')
        .eq('event_rounds.event_id', eventData.event_id)
        .eq('athletes.full_name', fullName)
      
      const { data: existing } = await query.limit(1)
      if (existing && existing.length > 0) {
        continue; // Skip duplicate
      }

      // 3. Upsert Faculty
      let facId = null
      if (facName) {
        const { data: fData } = await supabase.from('faculties').select('fac_id').eq('fac_name', facName).maybeSingle()
        if (fData) { facId = fData.fac_id }
        else {
          const { data: newF } = await supabase.from('faculties').insert({ fac_name: facName }).select('fac_id').single()
          if (newF) facId = newF.fac_id
        }
      }

      // 4. Upsert Athlete
      let athleteId = null
      
      const { data: nameData } = await supabase.from('athletes').select('athlete_id').eq('full_name', fullName).maybeSingle()
      if (nameData) {
        athleteId = nameData.athlete_id
        await supabase.from('athletes').update({ gender, faculty_id: facId, study_year: studyYear }).eq('athlete_id', athleteId)
      } else {
        const { data: newA, error: insErr } = await supabase.from('athletes').insert({
          student_id: studentId || null, full_name: fullName, gender, faculty_id: facId, study_year: studyYear
        }).select('athlete_id').single()
        
        if (insErr && insErr.code === '23505') { // Unique constraint violation (likely student_id)
          const { data: retryA } = await supabase.from('athletes').insert({
            student_id: null, full_name: fullName, gender, faculty_id: facId, study_year: studyYear
          }).select('athlete_id').single()
          if (retryA) athleteId = retryA.athlete_id
        } else if (newA) {
          athleteId = newA.athlete_id
        }
      }

      // 4. Upsert Round
      let roundId = null
      const { data: roundData } = await supabase.from('event_rounds').select('round_id').eq('event_id', eventData.event_id).eq('round_name', roundName).maybeSingle()
      if (roundData) { roundId = roundData.round_id }
      else {
        const { data: newR } = await supabase.from('event_rounds').insert({
          event_id: eventData.event_id, round_name: roundName
        }).select('round_id').single()
        if (newR) roundId = newR.round_id
      }

      // 5. Insert Race Result
      if (athleteId && roundId) {
        // We delete existing row for this lane first to prevent Unique Constraint error if reusing template
        if (laneNum) {
           await supabase.from('race_results').delete().eq('round_id', roundId).eq('lane_number', laneNum)
        }
        await supabase.from('race_results').insert({
          round_id: roundId,
          athlete_id: athleteId,
          lane_number: laneNum,
          status: 'OK'
        })
        importedCount++
        importedEventNames.add(eventData.event_name)
      }
    }
    return importedCount
  }

  const processRelays = async (rows: any[], allEvents: any[], importedEventNames: Set<string>) => {
    let importedCount = 0
    const teamGroups = {} as Record<string, any[]>
    for (const r of rows) {
      const team = String(r.team_name || '').trim()
      if (!team) continue
      if (!teamGroups[team]) teamGroups[team] = []
      teamGroups[team].push(r)
    }

    for (const [teamName, members] of Object.entries(teamGroups)) {
      const first = members[0]
      const facName = String(first.faculty_name || '').trim()
      const eventName = String(first.event_name || '').trim()
      const roundName = String(first.round_name || '').trim()
      const laneNum = parseInt(first.lane_number) || null

      // 1. Find Event
      const normalizeName = (name: string) => String(name).replace(/\s+/g, '').replace(/^วิ่ง/, '').replace(/^ผลัด/, '').replace(/\*/g, 'x').replace(/ชาย$/, '').replace(/หญิง$/, '').replace(/ผสม$/, '').replace(/เมตร/g, '').toLowerCase()
      const normalizedSearchName = normalizeName(eventName)
      
      // Determine predominant team gender (if not mixed)
      const teamGender = members.map(m => String(m.gender || '').trim().toUpperCase()).find(g => g === 'M' || g === 'F') || 'M'
      
      let eventData = allEvents.find((e: any) => 
        normalizeName(e.event_name) === normalizedSearchName &&
        (e.gender === teamGender || e.gender === 'Mixed' || !e.gender) 
      );
      
      if (!eventData) {
        throw new Error(`ไม่พบรายการแข่งขันผลัดที่ชื่อ: "${eventName}" หรือเพศของนักกีฬาในทีมไม่ตรงกับรายการ`)
      }

      // Check Mixed relay rules if the matched event is Mixed or if eventName contains 'ผสม'
      if (eventData.gender === 'Mixed' || eventName.includes('ผสม')) {
        const males = members.filter(m => String(m.gender).trim().toUpperCase() === 'M').length
        const females = members.filter(m => String(m.gender).trim().toUpperCase() === 'F').length
        if (males !== 2 || females !== 2) {
          throw new Error(`ทีม "${teamName}" ในรายการผสม ต้องมีชาย 2 และหญิง 2 คน (พบ ชาย:${males} หญิง:${females})`)
        }
      }

      // 2. Check for Duplicate Team in Event
      const { data: existingTeam } = await supabase
        .from('race_results')
        .select('result_id, relay_teams!inner(team_name), event_rounds!inner(event_id)')
        .eq('relay_teams.team_name', teamName)
        .eq('event_rounds.event_id', eventData.event_id)
        .limit(1)

      if (existingTeam && existingTeam.length > 0) {
        continue; // Skip duplicate team
      }

      // 3. Upsert Faculty
      let facId = null
      if (facName) {
        const { data: fData } = await supabase.from('faculties').select('fac_id').eq('fac_name', facName).maybeSingle()
        if (fData) facId = fData.fac_id
        else {
          const { data: newF } = await supabase.from('faculties').insert({ fac_name: facName }).select('fac_id').single()
          if (newF) facId = newF.fac_id
        }
      }

      // 4. Insert Relay Team
      const { data: teamData } = await supabase.from('relay_teams').insert({
        team_name: teamName, faculty_id: facId
      }).select('relay_team_id').single()

      if (!teamData) continue
      const relayTeamId = teamData.relay_team_id

      // 3. Insert Members
      for (const m of members) {
        const studentId = String(m.student_id || '').trim()
        const fullName = String(m.full_name || '').trim()
        const gender = String(m.gender || '').trim().toUpperCase()
        const legOrder = parseInt(m.leg_order) || null
        const memberFacName = String(m.faculty_name || '').trim()

        if(!fullName) continue;

        let memberFacId = null
        if (memberFacName) {
          const { data: mfData } = await supabase.from('faculties').select('fac_id').eq('fac_name', memberFacName).maybeSingle()
          if (mfData) memberFacId = mfData.fac_id
          else {
            const { data: newMF } = await supabase.from('faculties').insert({ fac_name: memberFacName }).select('fac_id').single()
            if (newMF) memberFacId = newMF.fac_id
          }
        }

        // Upsert Athlete
        let athleteId = null
        const { data: nameData } = await supabase.from('athletes').select('athlete_id').eq('full_name', fullName).maybeSingle()
        if (nameData) {
          athleteId = nameData.athlete_id
          await supabase.from('athletes').update({ gender, faculty_id: memberFacId }).eq('athlete_id', athleteId)
        } else {
          const { data: newA, error: insErr } = await supabase.from('athletes').insert({
            student_id: studentId || null, full_name: fullName, gender, faculty_id: memberFacId
          }).select('athlete_id').single()
          
          if (insErr && insErr.code === '23505') { // Unique constraint violation (likely student_id)
            const { data: retryA } = await supabase.from('athletes').insert({
              student_id: null, full_name: fullName, gender, faculty_id: memberFacId
            }).select('athlete_id').single()
            if (retryA) athleteId = retryA.athlete_id
          } else if (newA) {
            athleteId = newA.athlete_id
          }
        }

        if (athleteId && legOrder) {
          await supabase.from('relay_members').insert({
            relay_team_id: relayTeamId,
            athlete_id: athleteId,
            leg_order: legOrder
          })
        }
      }

      // 5. Upsert Round
      let roundId = null
      const { data: roundData } = await supabase.from('event_rounds').select('round_id').eq('event_id', eventData.event_id).eq('round_name', roundName).maybeSingle()
      if (roundData) roundId = roundData.round_id
      else {
        const { data: newR } = await supabase.from('event_rounds').insert({
          event_id: eventData.event_id, round_name: roundName
        }).select('round_id').single()
        if (newR) roundId = newR.round_id
      }

      // 6. Insert Race Result
      if (laneNum) {
         await supabase.from('race_results').delete().eq('round_id', roundId).eq('lane_number', laneNum)
      }
      await supabase.from('race_results').insert({
        round_id: roundId,
        relay_team_id: relayTeamId,
        lane_number: laneNum,
        status: 'OK'
      })
      importedCount++
      importedEventNames.add(eventData.event_name)
    }
    return importedCount
  }

  return {
    isImporting,
    importError,
    importSuccessMsg,
    processExcel
  }
})
