export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      faculties: {
        Row: {
          fac_id: number
          fac_name: string
        }
        Insert: {
          fac_id?: never
          fac_name: string
        }
        Update: {
          fac_id?: never
          fac_name?: string
        }
      }
      athletes: {
        Row: {
          athlete_id: number
          student_id: string | null
          full_name: string
          gender: 'M' | 'F' | null
          email: string | null
          faculty_id: number | null
          study_year: number | null
        }
        Insert: {
          athlete_id?: never
          student_id?: string | null
          full_name: string
          gender?: 'M' | 'F' | null
          email?: string | null
          faculty_id?: number | null
          study_year?: number | null
        }
        Update: {
          athlete_id?: never
          student_id?: string | null
          full_name?: string
          gender?: 'M' | 'F' | null
          email?: string | null
          faculty_id?: number | null
          study_year?: number | null
        }
      }
      events: {
        Row: {
          event_id: number
          event_name: string
          distance_meters: number
          gender: 'M' | 'F' | 'Mixed' | null
          is_relay: boolean | null
        }
        Insert: {
          event_id?: never
          event_name: string
          distance_meters: number
          gender?: 'M' | 'F' | 'Mixed' | null
          is_relay?: boolean | null
        }
        Update: {
          event_id?: never
          event_name?: string
          distance_meters?: number
          gender?: 'M' | 'F' | 'Mixed' | null
          is_relay?: boolean | null
        }
      }
      event_rounds: {
        Row: {
          round_id: number
          event_id: number | null
          round_name: string
        }
        Insert: {
          round_id?: never
          event_id?: number | null
          round_name: string
        }
        Update: {
          round_id?: never
          event_id?: number | null
          round_name?: string
        }
      }
      relay_teams: {
        Row: {
          relay_team_id: number
          team_name: string
          faculty_id: number | null
        }
        Insert: {
          relay_team_id?: never
          team_name: string
          faculty_id?: number | null
        }
        Update: {
          relay_team_id?: never
          team_name?: string
          faculty_id?: number | null
        }
      }
      relay_members: {
        Row: {
          relay_team_id: number
          athlete_id: number
          leg_order: number | null
        }
        Insert: {
          relay_team_id: number
          athlete_id: number
          leg_order?: number | null
        }
        Update: {
          relay_team_id?: number
          athlete_id?: number
          leg_order?: number | null
        }
      }
      race_results: {
        Row: {
          result_id: number
          round_id: number | null
          lane_number: number | null
          athlete_id: number | null
          relay_team_id: number | null
          record_time: number | null
          rank: number | null
          status: 'OK' | 'DNS' | 'DNF' | 'DQ' | null
          wind_reading: number | null
        }
        Insert: {
          result_id?: never
          round_id?: number | null
          lane_number?: number | null
          athlete_id?: number | null
          relay_team_id?: number | null
          record_time?: number | null
          rank?: number | null
          status?: 'OK' | 'DNS' | 'DNF' | 'DQ' | null
          wind_reading?: number | null
        }
        Update: {
          result_id?: never
          round_id?: number | null
          lane_number?: number | null
          athlete_id?: number | null
          relay_team_id?: number | null
          record_time?: number | null
          rank?: number | null
          status?: 'OK' | 'DNS' | 'DNF' | 'DQ' | null
          wind_reading?: number | null
        }
      }
    }
  }
}
