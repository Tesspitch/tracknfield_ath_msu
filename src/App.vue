<script setup lang="ts">
import { ref } from 'vue'
import ExcelUploader from './components/ExcelUploader.vue'
import TimingSheet from './components/TimingSheet.vue'
import ResultsViewer from './components/ResultsViewer.vue'
import EventManager from './components/EventManager.vue'
import RoundManager from './components/RoundManager.vue'
import AthleteList from './components/AthleteList.vue'
import { CalendarDays, ListOrdered, Upload, Timer, Trophy, Users } from 'lucide-vue-next'

const currentTab = ref<'import' | 'timing' | 'results' | 'events' | 'rounds' | 'athletes'>('import')
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
    
    <!-- Sidebar -->
    <aside class="w-full md:w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col shadow-sm md:h-screen md:sticky top-0 z-10">
      <div class="p-6 border-b border-gray-100">
        <h1 class="text-2xl font-extrabold text-blue-900 tracking-tight leading-tight">
          Track & Field
          <span class="block text-blue-600 font-bold text-lg mt-1">Race Timing</span>
        </h1>
      </div>
      
      <nav class="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <button 
          @click="currentTab = 'events'"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'events' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <CalendarDays class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'events' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">จัดการรายการแข่ง</span>
        </button>

        <button 
          @click="currentTab = 'rounds'"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'rounds' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <ListOrdered class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'rounds' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">จัดการรอบ (Heat)</span>
        </button>
        
        <button 
          @click="currentTab = 'import'"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'import' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <Upload class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'import' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">นำเข้าข้อมูล (Import)</span>
        </button>
        
        <button 
          @click="currentTab = 'athletes'"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'athletes' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <Users class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'athletes' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">รายชื่อนักกีฬา</span>
        </button>
        
        <button 
          @click="currentTab = 'timing'"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'timing' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <Timer class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'timing' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">บันทึกผล (Live Timing)</span>
        </button>
        
        <button 
          @click="currentTab = 'results'"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'results' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <Trophy class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'results' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">ผลการแข่งขัน (Results)</span>
        </button>
      </nav>
      
      <div class="p-4 border-t border-gray-100 text-xs text-gray-400 text-center font-medium">
        ATHMSU ManageSystem
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 p-4 md:p-8 min-w-0">
      <div class="max-w-6xl mx-auto">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-6 md:p-8 min-h-[calc(100vh-4rem)]">
          <div v-if="currentTab === 'events'">
            <EventManager />
          </div>
          <div v-else-if="currentTab === 'rounds'">
            <RoundManager />
          </div>
          <div v-else-if="currentTab === 'import'">
            <ExcelUploader />
          </div>
          <div v-else-if="currentTab === 'timing'">
            <TimingSheet />
          </div>
          <div v-else-if="currentTab === 'results'">
            <ResultsViewer />
          </div>
          <div v-else-if="currentTab === 'athletes'">
            <AthleteList />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
