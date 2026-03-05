import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { API_BASE } from '../lib/api'

export interface ProfileData {
    name: string
    email: string
    phone: string
    zipCode: string
    address: string
    detailAddress: string
    companyName: string
    businessNumber: string
}

interface ProfileStore {
    profile: ProfileData | null
    isLoading: boolean
    error: string | null
    fetchProfile: () => Promise<void>
    updateProfile: (data: Partial<ProfileData>) => Promise<boolean>
    clearProfile: () => void
}

const defaultProfile: ProfileData = {
    name: '',
    email: '',
    phone: '',
    zipCode: '',
    address: '',
    detailAddress: '',
    companyName: '',
    businessNumber: '',
}

export const useProfileStore = create<ProfileStore>()(
    persist(
        (set, get) => ({
            profile: null,
            isLoading: false,
            error: null,

            fetchProfile: async () => {
                set({ isLoading: true, error: null })
                try {
                    const headers = { 'x-user-id': 'temp-user' }
                    const res = await fetch(`${API_BASE}/api/user/profile`, { headers })

                    if (res.ok) {
                        const data = await res.json()
                        const profile: ProfileData = {
                            name: data.name || '',
                            email: data.email || '',
                            phone: data.phone || '',
                            zipCode: data.zipCode || '',
                            address: data.address || '',
                            detailAddress: data.detailAddress || '',
                            companyName: data.companyName || '',
                            businessNumber: data.businessNumber || '',
                        }
                        set({ profile, isLoading: false })
                    } else {
                        set({ error: '프로필 로드 실패', isLoading: false })
                    }
                } catch (error) {
                    console.error('프로필 로드 실패:', error)
                    set({ error: '네트워크 오류', isLoading: false })
                }
            },

            updateProfile: async (data: Partial<ProfileData>) => {
                const currentProfile = get().profile || defaultProfile
                const updatedProfile = { ...currentProfile, ...data }

                set({ isLoading: true, error: null })
                try {
                    const headers = {
                        'x-user-id': 'temp-user',
                        'Content-Type': 'application/json',
                    }
                    const res = await fetch(`${API_BASE}/api/user/profile`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify(updatedProfile),
                    })

                    if (res.ok) {
                        set({ profile: updatedProfile, isLoading: false })
                        return true
                    } else {
                        set({ error: '저장 실패', isLoading: false })
                        return false
                    }
                } catch (error) {
                    console.error('프로필 저장 실패:', error)
                    set({ error: '네트워크 오류', isLoading: false })
                    return false
                }
            },

            clearProfile: () => {
                set({ profile: null, error: null })
            },
        }),
        {
            name: 'profile-storage',
            partialize: (state) => ({ profile: state.profile }),
        }
    )
)
