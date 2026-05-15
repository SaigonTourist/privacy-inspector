interface Props {
  loading?: boolean
  onClick?: () => void
}

export function AnalyzeButton({ loading = false, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="pixel-btn w-full py-2.5 px-4 font-mono font-bold text-xs uppercase tracking-widest"
      style={{
        background: loading ? "#4C1D95" : "#7C3AED",
        color: "#F0EBF8",
      }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          [ ANALYZING<span className="anim-blink">█</span> ]
        </span>
      ) : (
        "[ DEEP ANALYSIS ]"
      )}
    </button>
  )
}
