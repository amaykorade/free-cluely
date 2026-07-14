import React, { useState, useEffect, useRef } from "react"
import { IoLogOutOutline } from "react-icons/io5"

interface QueueCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void
  screenshots: Array<{ path: string; preview: string }>
  onChatToggle: () => void
  onSettingsToggle: () => void
  onAudioResult: (text: string) => void
  triggerRef: React.MutableRefObject<(() => void) | null>
  onListeningChange: (listening: boolean) => void
}

const QueueCommands: React.FC<QueueCommandsProps> = ({
  onTooltipVisibilityChange,
  screenshots,
  onChatToggle,
  onSettingsToggle,
  onAudioResult,
  triggerRef,
  onListeningChange
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [isListening, setIsListening] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef<string>('')

  useEffect(() => {
    let tooltipHeight = 0
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10
    }
    onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
  }, [isTooltipVisible])

  const handleMouseEnter = () => setIsTooltipVisible(true)
  const handleMouseLeave = () => setIsTooltipVisible(false)

  const handleToggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      transcriptRef.current = ''
      setLiveTranscript('')
      setIsListening(false)
      onListeningChange(false)
      triggerRef.current = null
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        onAudioResult('Speech recognition not supported in this browser.')
        return
      }
      const rec = new SpeechRecognition()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'
      transcriptRef.current = ''

      rec.onresult = (event: any) => {
        let full = ''
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript + ' '
        }
        transcriptRef.current = full.trim()
        setLiveTranscript(full.trim())
      }

      rec.onerror = (e: any) => {
        console.error('Speech error:', e.error)
        setLiveTranscript(`Error: ${e.error}`)
      }

      rec.onend = () => {
        // auto-restart so it keeps listening
        if (recognitionRef.current) rec.start()
      }

      rec.start()
      recognitionRef.current = rec
      setIsListening(true)
      onListeningChange(true)

      triggerRef.current = async () => {
        const text = transcriptRef.current.trim()
        if (!text) {
          onAudioResult('No speech detected yet. Keep talking then press Cmd+Enter.')
          return
        }
        setAudioLoading(true)
        transcriptRef.current = ''
        setLiveTranscript('')
        try {
          const response = await window.electronAPI.invoke(
            'gemini-chat',
            `You are a real-time AI assistant helping someone in a meeting or interview. They just heard: "${text}"\n\nIdentify the question or topic and give a concise, direct answer they can use.\n\nFormat:\n**Question/Topic:** <what was asked or discussed>\n**Answer:** <what they should say>`
          )
          onAudioResult(response)
        } catch (_) {
          onAudioResult('Could not get answer. Please try again.')
        } finally {
          setAudioLoading(false)
        }
      }
    }
  }

  return (
    <div className="w-fit">
      <div className="text-xs text-white/90 liquid-glass-bar py-1 px-4 flex items-center justify-center gap-4 draggable-area">
        {/* Show/Hide */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] leading-none">Show/Hide</span>
          <div className="flex gap-1">
            <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">⌘</button>
            <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">B</button>
          </div>
        </div>

        {/* Solve Command (screenshot mode) */}
        {screenshots.length > 0 && !isListening && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] leading-none">Solve</span>
            <div className="flex gap-1">
              <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">⌘</button>
              <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">↵</button>
            </div>
          </div>
        )}

        {/* Get Answer hint when listening */}
        {isListening && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] leading-none text-green-300">Get Answer</span>
            <div className="flex gap-1">
              <button className="bg-green-500/20 rounded-md px-1.5 py-1 text-[11px] leading-none text-green-300">⌘</button>
              <button className="bg-green-500/20 rounded-md px-1.5 py-1 text-[11px] leading-none text-green-300">↵</button>
            </div>
          </div>
        )}

        {/* Listen Button */}
        <div className="flex items-center gap-2">
          <button
            className={`transition-colors rounded-md px-2 py-1 text-[11px] leading-none flex items-center gap-1 ${isListening ? 'bg-red-500/70 hover:bg-red-500/90 text-white' : 'bg-white/10 hover:bg-white/20 text-white/70'}`}
            onClick={handleToggleListen}
            type="button"
          >
            {isListening ? (
              audioLoading
                ? <span className="animate-pulse">⏳ Analyzing...</span>
                : <span className="animate-pulse">● Listening</span>
            ) : (
              <span>🎤 Listen</span>
            )}
          </button>
        </div>

        {/* Chat Button */}
        <div className="flex items-center gap-2">
          <button
            className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-white/70 flex items-center gap-1"
            onClick={onChatToggle}
            type="button"
          >
            💬 Chat
          </button>
        </div>

        {/* Settings Button */}
        <div className="flex items-center gap-2">
          <button
            className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-white/70 flex items-center gap-1"
            onClick={onSettingsToggle}
            type="button"
          >
            ⚙️ Models
          </button>
        </div>

        {/* Question mark with tooltip */}
        <div className="relative inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors flex items-center justify-center cursor-help z-10">
            <span className="text-xs text-white/70">?</span>
          </div>
          {isTooltipVisible && (
            <div ref={tooltipRef} className="absolute top-full right-0 mt-2 w-80">
              <div className="p-3 text-xs bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white/90 shadow-lg">
                <div className="space-y-4">
                  <h3 className="font-medium truncate">Keyboard Shortcuts</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate">Toggle Window</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">⌘</span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">B</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate">Take Screenshot</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">⌘</span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">H</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate">Get Answer (voice mode)</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">⌘</span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">↵</span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/70">While listening, press to get AI answer for what was just said.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="mx-2 h-4 w-px bg-white/20" />

        {/* Quit */}
        <button
          className="text-red-500/70 hover:text-red-500/90 transition-colors hover:cursor-pointer"
          title="Quit"
          onClick={() => window.electronAPI.quitApp()}
        >
          <IoLogOutOutline className="w-4 h-4" />
        </button>
      </div>
      {/* Live transcript */}
      {isListening && (
        <div className="mt-1 px-3 py-2 bg-black/40 backdrop-blur-sm rounded-lg text-[11px] text-white/70 max-w-sm">
          {liveTranscript
            ? <span><span className="text-green-400">●</span> {liveTranscript}</span>
            : <span className="animate-pulse text-white/40">Listening... speak now</span>
          }
        </div>
      )}
    </div>
  )
}

export default QueueCommands
