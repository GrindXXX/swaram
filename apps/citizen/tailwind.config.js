// Tokens extracted from "Newspaper app design scope/Swaram Social - Civic Record.dc.html".
// This is the design-system file that deck never shipped as its own artifact —
// every screen there re-declared these values inline. Keep this file, not the
// deck, as the source of truth going forward.
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                paper: {
                    DEFAULT: '#F5EDDC', // card / screen background
                    weekly: '#F2E7CE', // Weekly Record has a slightly deeper tint
                    card2: '#EDE2C8', // stat tiles, secondary cards
                    chip: '#E9DEC4', // pills / chips
                    avatar: '#E6DAC0',
                },
                border: {
                    DEFAULT: '#D8CCB0',
                    light: '#DFD3B6',
                    strong: '#CFC2A4',
                },
                ink: {
                    DEFAULT: '#29251F', // primary text
                    black: '#171512', // near-black, burned-ticket bg family
                    dark: '#2B2620', // burned ticket screen bg
                },
                muted: {
                    DEFAULT: '#6d6353', // secondary text / timestamps
                    strong: '#4a4237', // body copy on tinted cards
                    soft: '#8a7f6b',
                },
                rage: {
                    DEFAULT: '#9E351B', // primary accent (the "Rage Meter" red)
                    deep: '#7c2915',
                    ember: '#C4703A',
                    glow: '#E0A45C',
                },
                gov: {
                    DEFAULT: '#304C50', // government-department accent (teal)
                    bg: 'rgba(48,76,80,.09)',
                    border: 'rgba(48,76,80,.32)',
                    text: '#2b3a3c',
                },
                resolved: {
                    DEFAULT: '#52613A', // verified-fixed green
                    bg: 'rgba(82,97,58,.1)',
                    border: 'rgba(82,97,58,.3)',
                },
            },
            fontFamily: {
                display: ['"Special Elite"', 'cursive'], // headlines
                serif: ['"Libre Baskerville"', 'Georgia', 'serif'], // body copy
                mono: ['"Courier Prime"', 'ui-monospace', 'monospace'], // labels, numbers, chrome
            },
            borderRadius: {
                card: '10px',
                panel: '20px',
            },
            keyframes: {
                swFlick: {
                    '0%,100%': { transform: 'translateY(0) scaleY(1) rotate(-3deg)', opacity: '.92' },
                    '35%': { transform: 'translateY(-1px) scaleY(1.22) rotate(3deg)', opacity: '1' },
                    '70%': { transform: 'translateY(0) scaleY(.92) rotate(-1deg)', opacity: '.85' },
                },
                swHeat: {
                    '0%,100%': { boxShadow: '0 0 6px rgba(158,53,27,.35)' },
                    '50%': { boxShadow: '0 0 14px rgba(196,112,58,.65)' },
                },
                swGlow: {
                    '0%,100%': { opacity: '.35' },
                    '50%': { opacity: '.75' },
                },
                swEmber: {
                    '0%': { transform: 'translateY(2px) scale(.7)', opacity: '0' },
                    '25%': { opacity: '.85' },
                    '100%': { transform: 'translateY(-20px) scale(.3)', opacity: '0' },
                },
                swSmoke: {
                    '0%': { transform: 'translate(0,0) scale(.5)', opacity: '0' },
                    '22%': { opacity: '.45' },
                    '100%': { transform: 'translate(-26px,-86px) scale(1.7)', opacity: '0' },
                },
                swCount: {
                    '0%': { transform: 'translateY(4px)', opacity: '.4' },
                    '100%': { transform: 'none', opacity: '1' },
                },
            },
            animation: {
                'sw-flick': 'swFlick 1.5s ease-in-out infinite',
                'sw-heat': 'swHeat 2s ease-in-out infinite',
                'sw-glow': 'swGlow 2.4s ease-in-out infinite',
                'sw-ember': 'swEmber 2.2s linear infinite',
                'sw-smoke': 'swSmoke 4.5s linear infinite',
                'sw-count': 'swCount .6s ease-out',
            },
        },
    },
    plugins: [],
};
