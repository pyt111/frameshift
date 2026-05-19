'use client'

import { useState, useEffect } from 'react'

/** 打字机效果 Hook */
export function useTypewriter(text: string, speed: number = 50) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1))
        i++
      } else {
        setDone(true)
        clearInterval(timer)
      }
    }, speed)
    return () => clearInterval(timer)
  }, [text, speed])

  return { displayed, done }
}

/** 加载步骤 Hook */
export function useLoadingStep(stepCount: number) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timers = Array.from({ length: stepCount }, (_, i) =>
      setTimeout(() => setStep(i), (i + 1) * 2200)
    )
    return () => {
      timers.forEach(clearTimeout)
      setStep(0)
    }
  }, [stepCount])

  return step
}
