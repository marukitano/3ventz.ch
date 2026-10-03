(() => {
    const form = document.getElementById('terminal');
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');
    const cursor = document.getElementById('terminal-cursor');

    if (!form || !input || !output) return;

    const state = window.THREEVENTZ || {};
    const currentYear = Number(state.year) || new Date().getFullYear();

    const say = (text) => {
        output.textContent = '// ' + text;
    };

    const goYear = (year) => {
        const y = Math.max(2000, Math.min(2100, Number(year)));
        window.location.href = '?year=' + y;
    };

    input.addEventListener('input', () => {
        if (cursor) cursor.style.display = input.value ? 'none' : 'inline';
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const raw = input.value.trim();
        const parts = raw.split(/\s+/);
        const cmd = (parts[0] || '').toLowerCase();
        const arg = parts[1];

        switch (cmd) {
            case '':
                say('type help');
                break;
            case 'help':
            case '?':
                say('help · next · prev · year 2027 · today · events · admin · clear');
                break;
            case 'next':
                goYear(currentYear + 1);
                break;
            case 'prev':
            case 'previous':
                goYear(currentYear - 1);
                break;
            case 'year':
                if (/^\d{4}$/.test(arg || '')) goYear(arg);
                else say('usage: year 2027');
                break;
            case 'today':
                goYear(new Date().getFullYear());
                break;
            case 'events':
                say(String(state.eventCount || 0) + ' events loaded for ' + currentYear);
                break;
            case 'admin':
                window.location.href = '/admin/';
                break;
            case 'clear':
                output.textContent = '';
                break;
            case 'whoami':
                say('guest@3ventz');
                break;
            case 'sudo':
                say('nice try.');
                break;
            default:
                say('command not found: ' + cmd + ' · try help');
        }

        input.value = '';
        if (cursor) cursor.style.display = 'inline';
        input.focus();
    });

    document.querySelector('.brand')?.addEventListener('click', () => input.focus());
})();
