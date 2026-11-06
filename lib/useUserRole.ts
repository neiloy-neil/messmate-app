'use client'

import { useState, useEffect } from 'react'
import { supabase, Member } from './supabase'

export interface UserRole {
  loading: boolean
  isManager: boolean
  isGuest: boolean
  user: any
  myMembers: Member[]
  guestMembers: Member[]
}

export function useUserRole() {
  const [role, setRole] = useState<UserRole>({
    loading: true,
    isManager: false,
    isGuest: false,
    user: null,
    myMembers: [],
    guestMembers: []
  })

  useEffect(() => {
    let isMounted = true

    async function checkRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (isMounted) setRole(r => ({ ...r, loading: false, user: null }))
          return
        }

        const { data: members } = await supabase.from('members').select('*')
        const memList: Member[] = members || []

        const isManager = memList.length === 0 || 
          memList[0]?.user_id === user.id || 
          memList.some(m => m.auth_id === user.id && (m as any).is_admin)

        const myMembers = memList.filter(m => 
          m.auth_id === user.id || 
          (user.email && m.email && m.email.toLowerCase() === user.email.toLowerCase())
        )

        const guestMembers = memList.filter(m => m.is_meal_only)

        const isGuest = !isManager && (
          myMembers.some(m => m.is_meal_only) ||
          Boolean(user.email && user.email.toLowerCase().includes('guest'))
        )

        if (isMounted) {
          setRole({
            loading: false,
            isManager,
            isGuest,
            user,
            myMembers,
            guestMembers
          })
        }
      } catch (err) {
        if (isMounted) setRole(r => ({ ...r, loading: false }))
      }
    }

    checkRole()
    return () => { isMounted = false }
  }, [])

  return role
}
