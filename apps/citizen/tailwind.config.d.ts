declare const _default: {
    content: string[];
    theme: {
        extend: {
            colors: {
                paper: {
                    DEFAULT: string;
                    weekly: string;
                    card2: string;
                    chip: string;
                    avatar: string;
                };
                border: {
                    DEFAULT: string;
                    light: string;
                    strong: string;
                };
                ink: {
                    DEFAULT: string;
                    black: string;
                    dark: string;
                };
                muted: {
                    DEFAULT: string;
                    strong: string;
                    soft: string;
                };
                rage: {
                    DEFAULT: string;
                    deep: string;
                    ember: string;
                    glow: string;
                };
                gov: {
                    DEFAULT: string;
                    bg: string;
                    border: string;
                    text: string;
                };
                resolved: {
                    DEFAULT: string;
                    bg: string;
                    border: string;
                };
            };
            fontFamily: {
                display: [string, string];
                serif: [string, string, string];
                mono: [string, string, string];
            };
            borderRadius: {
                card: string;
                panel: string;
            };
            keyframes: {
                swFlick: {
                    '0%,100%': {
                        transform: string;
                        opacity: string;
                    };
                    '35%': {
                        transform: string;
                        opacity: string;
                    };
                    '70%': {
                        transform: string;
                        opacity: string;
                    };
                };
                swHeat: {
                    '0%,100%': {
                        boxShadow: string;
                    };
                    '50%': {
                        boxShadow: string;
                    };
                };
                swGlow: {
                    '0%,100%': {
                        opacity: string;
                    };
                    '50%': {
                        opacity: string;
                    };
                };
                swEmber: {
                    '0%': {
                        transform: string;
                        opacity: string;
                    };
                    '25%': {
                        opacity: string;
                    };
                    '100%': {
                        transform: string;
                        opacity: string;
                    };
                };
                swSmoke: {
                    '0%': {
                        transform: string;
                        opacity: string;
                    };
                    '22%': {
                        opacity: string;
                    };
                    '100%': {
                        transform: string;
                        opacity: string;
                    };
                };
                swCount: {
                    '0%': {
                        transform: string;
                        opacity: string;
                    };
                    '100%': {
                        transform: string;
                        opacity: string;
                    };
                };
            };
            animation: {
                'sw-flick': string;
                'sw-heat': string;
                'sw-glow': string;
                'sw-ember': string;
                'sw-smoke': string;
                'sw-count': string;
            };
        };
    };
    plugins: any[];
};
export default _default;
