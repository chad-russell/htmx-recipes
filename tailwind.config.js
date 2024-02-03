/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.ts'
    ],
    theme: {
        extend: {},
    },
    plugins: [require("@tailwindcss/forms")],
}

