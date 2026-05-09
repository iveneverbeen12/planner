/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: ['./*.html', './js/**/*.js'],
    theme: {
        extend: {
            fontFamily: {
                display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif']
            }
        }
    },
    plugins: []
};
