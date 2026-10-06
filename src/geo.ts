import { useCallback, useEffect, useState } from 'react'

export type Position = { lat: number; lng: number; accuracy: number }

const GEO_KEY = 'sessionmap:geo'

function loadEnabled() {
  try {
    return localStorage.getItem(GEO_KEY) === 'on'
  } catch {
    return false
  }
}

/**
 * 現在地を追い続ける。位置は端末の中だけで使い、どこにも送らない。
 * 初回は「現在地を使う」を押したときに許可を求め、一度オンにしたら次回からは自動で始める
 */
export function useGeolocation() {
  const [enabled, setEnabled] = useState(loadEnabled)
  const [pos, setPos] = useState<Position | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  useEffect(() => {
    if (!enabled || !supported) return
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(null)
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy })
      },
      (e) =>
        setError(
          e.code === e.PERMISSION_DENIED
            ? '位置情報の利用が許可されていない。ブラウザの設定で許可してほしい'
            : '現在地を取得できなかった。屋内では取りにくいことがある',
        ),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled, supported])

  const toggle = useCallback(
    (on: boolean) => {
      setEnabled(on)
      if (!on) setPos(null)
      try {
        localStorage.setItem(GEO_KEY, on ? 'on' : 'off')
      } catch {
        // 保存できなくても今回の操作は効く
      }
    },
    [setEnabled],
  )

  return { enabled, pos, error: supported ? error : 'この端末では位置情報を使えない', toggle }
}

/** 2 点間の直線距離（km） */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** ラスベガス現地（America/Los_Angeles）の今の日付と、0 時からの分 */
export function nowInVegas(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}
