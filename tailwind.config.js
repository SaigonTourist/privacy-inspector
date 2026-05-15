/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./popup.tsx", "./src/**/*.{tsx,ts}"],
  theme: {
    extend: {
      colors: {
        risk: {
          low:      "#10B981",
          medium:   "#F59E0B",
          high:     "#F97316",
          critical: "#EF4444"
        }
      }
    }
  },
  plugins: []
}
