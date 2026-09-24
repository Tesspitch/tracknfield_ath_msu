<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from './lib/supabaseClient'
import Login from './components/Login.vue'
import ExcelUploader from './components/ExcelUploader.vue'
import TimingSheet from './components/TimingSheet.vue'
import ResultsViewer from './components/ResultsViewer.vue'
import EventManager from './components/EventManager.vue'
import RoundManager from './components/RoundManager.vue'
import AthleteList from './components/AthleteList.vue'
import { CalendarDays, ListOrdered, Upload, Timer, Trophy, Users, LogOut, Menu, X } from 'lucide-vue-next'

const isSidebarOpen = ref(false)

const session = ref<any>(null)
const isLoadingAuth = ref(true)

onMounted(() => {
  supabase.auth.getSession().then(({ data }) => {
    session.value = data.session
    isLoadingAuth.value = false
  })

  supabase.auth.onAuthStateChange((_, _session) => {
    session.value = _session
  })
})

const handleLogout = async () => {
  await supabase.auth.signOut()
}

const currentTab = ref<'import' | 'timing' | 'results' | 'events' | 'rounds' | 'athletes'>('import')
</script>

<template>
  <div v-if="isLoadingAuth" class="min-h-screen flex flex-col items-center justify-center bg-gray-50 space-y-4">
    <div class="w-12 h-12 border-4 border-[#0f4b9e] border-t-transparent rounded-full animate-spin"></div>
    <p class="text-gray-500 font-medium">กำลังโหลด...</p>
  </div>
  
  <Login v-else-if="!session" />

  <div v-else class="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
    
    <!-- Mobile Header -->
    <div class="md:hidden bg-[#0f4b9e] text-white flex items-center p-4 shadow-md sticky top-0 z-20 gap-3">
      <button @click="isSidebarOpen = true" class="p-2 -ml-2 text-white hover:bg-[#0a3574] rounded-lg transition-colors">
        <Menu class="w-6 h-6" />
      </button>
      <div class="font-extrabold text-lg tracking-tight">MSU Track Running</div>
    </div>

    <!-- Backdrop -->
    <div 
      v-if="isSidebarOpen" 
      @click="isSidebarOpen = false"
      class="fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity backdrop-blur-sm"
    ></div>

    <!-- Sidebar -->
    <aside 
      :class="[
        'fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col shadow-2xl md:shadow-sm md:h-screen md:sticky top-0 transform transition-transform duration-300 ease-in-out md:translate-x-0',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      ]"
    >
      <div class="p-5 border-b border-gray-100 flex justify-between items-center bg-[#0f4b9e] md:bg-white text-white md:text-gray-900">
        <h1 class="text-xl md:text-2xl font-extrabold tracking-tight leading-tight">
          Track & Field
          <span class="block text-blue-200 md:text-blue-600 font-bold text-base md:text-lg mt-0.5">Race Timing</span>
        </h1>
        <button @click="isSidebarOpen = false" class="md:hidden p-2 text-white hover:bg-[#0a3574] rounded-lg transition">
          <X class="w-6 h-6" />
        </button>
      </div>
      
      <nav class="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <button 
          @click="currentTab = 'events'; isSidebarOpen = false"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'events' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <CalendarDays class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'events' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">จัดการรายการแข่ง</span>
        </button>

        <button 
          @click="currentTab = 'rounds'; isSidebarOpen = false"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'rounds' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <ListOrdered class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'rounds' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">จัดการรอบ (Heat)</span>
        </button>
        
        <button 
          @click="currentTab = 'import'; isSidebarOpen = false"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'import' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <Upload class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'import' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">นำเข้าข้อมูล (Import)</span>
        </button>
        
        <button 
          @click="currentTab = 'athletes'; isSidebarOpen = false"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'athletes' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <Users class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'athletes' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">รายชื่อนักกีฬา</span>
        </button>
        
        <button 
          @click="currentTab = 'timing'; isSidebarOpen = false"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'timing' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <Timer class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'timing' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">บันทึกผล (Live Timing)</span>
        </button>
        
        <button 
          @click="currentTab = 'results'; isSidebarOpen = false"
          :class="['w-full flex items-center justify-start text-left px-4 py-3 rounded-lg font-medium transition-all duration-200', currentTab === 'results' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900']"
        >
          <Trophy class="w-5 h-5 mr-3 flex-shrink-0" :class="currentTab === 'results' ? 'text-blue-600' : 'text-gray-400'" />
          <span class="flex-1">ผลการแข่งขัน (Results)</span>
        </button>
      </nav>
      
      <div class="p-4 border-t border-gray-100 space-y-3">
        <button 
          @click="handleLogout"
          class="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 bg-white hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-all"
        >
          <LogOut class="w-4 h-4 mr-2" />
          ออกจากระบบ
        </button>
        <div class="text-xs text-gray-400 text-center font-medium">
          ATHMSU ManageSystem
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 p-4 md:p-8 min-w-0">
      <div class="max-w-6xl mx-auto">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-6 md:p-8 min-h-[calc(100vh-4rem)]">
          <KeepAlive>
            <EventManager v-if="currentTab === 'events'" />
            <RoundManager v-else-if="currentTab === 'rounds'" />
            <ExcelUploader v-else-if="currentTab === 'import'" />
            <TimingSheet v-else-if="currentTab === 'timing'" />
            <ResultsViewer v-else-if="currentTab === 'results'" />
            <AthleteList v-else-if="currentTab === 'athletes'" />
          </KeepAlive>
        </div>
      </div>
    </main>
  </div>
</template>
