<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient'
import logoSrc from '../assets/project_logo.jpg'

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

const handleLogin = async () => {
  try {
    loading.value = true
    errorMsg.value = ''
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      }
      throw error
    }
  } catch (error: any) {
    errorMsg.value = error.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 px-4 font-sans relative overflow-hidden">
    <!-- Abstract Background shapes to make it look sporty -->
    <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600 opacity-10 blur-3xl pointer-events-none"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-red-500 opacity-10 blur-3xl pointer-events-none"></div>

    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden relative z-10 border border-gray-100">
      <!-- Header -->
      <div class="bg-[#0f4b9e] px-8 py-10 text-center flex flex-col items-center justify-center relative overflow-hidden">
        <!-- Swoosh decorative element -->
        <div class="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none" style="background: linear-gradient(135deg, transparent 40%, rgba(255,215,0,0.8) 40%, rgba(220,38,38,0.8) 60%, transparent 60%);"></div>

        <img :src="logoSrc" alt="MSU Track Running" class="w-32 h-32 object-cover rounded-full border-4 border-white shadow-lg relative z-10" />
        <h2 class="mt-5 text-2xl font-bold text-white tracking-wide relative z-10">ระบบจัดการแข่งขัน</h2>
        <p class="text-blue-200 mt-1 font-medium relative z-10">MSU Track Running Open</p>
      </div>
      
      <!-- Form -->
      <div class="p-8">
        <form @submit.prevent="handleLogin" class="space-y-5">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">อีเมล (Email)</label>
            <input 
              v-model="email" 
              type="email" 
              required 
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0f4b9e] focus:border-[#0f4b9e] transition-all bg-gray-50 outline-none"
              placeholder="admin@example.com"
            />
          </div>
          
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">รหัสผ่าน (Password)</label>
            <input 
              v-model="password" 
              type="password" 
              required 
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0f4b9e] focus:border-[#0f4b9e] transition-all bg-gray-50 outline-none"
              placeholder="••••••••"
            />
          </div>

          <div v-if="errorMsg" class="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center font-medium border border-red-100">
            {{ errorMsg }}
          </div>

          <button 
            type="submit" 
            :disabled="loading"
            class="w-full bg-[#0f4b9e] text-white py-3.5 rounded-xl font-bold text-lg hover:bg-[#0a3574] hover:shadow-lg transition-all disabled:opacity-70 flex justify-center items-center mt-4"
          >
            <span v-if="loading" class="flex items-center gap-2">
              <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              กำลังตรวจสอบ...
            </span>
            <span v-else>เข้าสู่ระบบ</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
