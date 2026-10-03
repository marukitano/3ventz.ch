(() => {
    const form = document.getElementById('terminal');
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');
    const cursor = document.getElementById('terminal-cursor');

    if (!form || !input || !output) return;

    const state = window.THREEVENTZ || {};
    const currentYear = Number(state.year) || new Date().getFullYear();

    const say = (text) => {
        output.textContent = '→ ' + text;
    };

    const goYear = (year) => {
        const y = Math.max(2000, Math.min(2100, Number(year)));
        window.location.href = '?year=' + y;
    };

    const commands = [
        'help',
        'next',
        'prev',
        'year',
        'today',
        'events',
        'admin',
        'clear',
        'whoami',
        'sudo'
    ];

    let commandIndex = -1;

    const resizeInput = () => {
        const chars = Math.max(0, input.value.length);
        input.style.width = chars ? Math.min(chars, 18) + 'ch' : '0';
    };

    input.addEventListener('input', () => {
        resizeInput();
        commandIndex = -1;
        if (input.value.length > 0) {
            output.textContent = '';
        }
        if (cursor) cursor.style.display = 'inline';
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            commandIndex = commandIndex < commands.length - 1 ? commandIndex + 1 : 0;
            input.value = commands[commandIndex];
            resizeInput();
            output.textContent = '';
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            commandIndex = commandIndex > 0 ? commandIndex - 1 : commands.length - 1;
            input.value = commands[commandIndex];
            resizeInput();
            output.textContent = '';
            return;
        }

        if (event.key === 'Tab') {
            event.preventDefault();

            const value = input.value.trim().toLowerCase();
            const matches = commands.filter((command) => command.startsWith(value));

            if (matches.length === 1) {
                input.value = matches[0];
                resizeInput();
                output.textContent = '';
                return;
            }

            if (matches.length > 1) {
                output.textContent = '→ ' + matches.join(' · ');
                return;
            }

            if (value === '') {
                output.textContent = '→ ' + commands.join(' · ');
            } else {
                output.textContent = '→ no match';
            }
        }
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
        commandIndex = -1;
        resizeInput();
        if (cursor) cursor.style.display = 'inline';
        input.focus();
    });

    document.querySelector('.brand-terminal')?.addEventListener('click', () => input.focus());
    resizeInput();

    // Start like a real terminal: keyboard focus is on the prompt immediately.
    requestAnimationFrame(() => {
        input.focus({ preventScroll: true });
    });
})();
