(() => {
    const form = document.getElementById('terminal');
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');
    const cursor = document.getElementById('terminal-cursor');

    if (!form || !input || !output) return;

    const state = window.THREEVENTZ || {};
    const currentYear = Number(state.year) || new Date().getFullYear();
    const root = document.documentElement;

    const themes = ['default', 'c64', 'amiga', 'atari', 'edgerunner', 'hackers'];
    const colors = {
        cyan: '#00f5ff',
        green: '#39ff14',
        pink: '#ff3df2',
        amber: '#ffbf00',
        orange: '#ff7a00',
        red: '#ff3344',
        blue: '#3b82ff',
        purple: '#a855f7',
        white: '#ffffff'
    };

    const commands = [
        'help',
        'next',
        'prev',
        'year',
        'today',
        'events',
        'admin',
        'color',
        'theme',
        'dark',
        'light',
        'clear',
        'whoami',
        'sudo'
    ];

    let commandIndex = -1;

    const say = (text) => {
        output.textContent = '→ ' + text;
    };

    const goYear = (year) => {
        const y = Math.max(2000, Math.min(2100, Number(year)));
        window.location.href = '?year=' + y;
    };

    const inputSizer = document.createElement('span');
    inputSizer.setAttribute('aria-hidden', 'true');
    Object.assign(inputSizer.style, {
        position: 'absolute',
        visibility: 'hidden',
        pointerEvents: 'none',
        whiteSpace: 'pre',
        left: '-99999px',
        top: '0'
    });
    document.body.appendChild(inputSizer);

    const resizeInput = () => {
        const styles = getComputedStyle(input);

        inputSizer.style.fontFamily = styles.fontFamily;
        inputSizer.style.fontSize = styles.fontSize;
        inputSizer.style.fontWeight = styles.fontWeight;
        inputSizer.style.fontStyle = styles.fontStyle;
        inputSizer.style.letterSpacing = styles.letterSpacing;
        inputSizer.style.textTransform = styles.textTransform;

        inputSizer.textContent = input.value;

        const width = input.value
            ? Math.ceil(inputSizer.getBoundingClientRect().width) + 1
            : 0;

        input.style.width = Math.min(width, window.innerWidth * 0.38) + 'px';
    };

    const applySavedAppearance = () => {
        const savedTheme = localStorage.getItem('3ventz-theme') || 'default';
        const savedMode = localStorage.getItem('3ventz-mode') || 'dark';
        const savedColor = localStorage.getItem('3ventz-color');

        root.dataset.theme = themes.includes(savedTheme) ? savedTheme : 'default';
        root.dataset.mode = savedMode === 'light' ? 'light' : 'dark';

        if (savedColor && /^#[0-9a-f]{6}$/i.test(savedColor)) {
            root.style.setProperty('--cyan', savedColor);
        }
    };

    const setTheme = (name) => {
        const theme = (name || '').toLowerCase();

        if (!themes.includes(theme)) {
            say('themes: ' + themes.join(' · '));
            return;
        }

        root.dataset.theme = theme;
        root.style.removeProperty('--cyan');
        localStorage.setItem('3ventz-theme', theme);
        localStorage.removeItem('3ventz-color');
        say('theme = ' + theme);
    };

    const setMode = (mode) => {
        root.dataset.mode = mode;
        localStorage.setItem('3ventz-mode', mode);
        say('mode = ' + mode);
    };

    const setColor = (value) => {
        if (!value) {
            say('colors: ' + Object.keys(colors).join(' · ') + ' · #RRGGBB · reset');
            return;
        }

        const requested = value.toLowerCase();

        if (requested === 'reset') {
            root.style.removeProperty('--cyan');
            localStorage.removeItem('3ventz-color');
            say('color reset');
            return;
        }

        const resolved = colors[requested] || requested;

        if (!/^#[0-9a-f]{6}$/i.test(resolved)) {
            say('usage: color cyan | color #00ff88 | color reset');
            return;
        }

        root.style.setProperty('--cyan', resolved);
        localStorage.setItem('3ventz-color', resolved);
        say('color = ' + resolved);
    };

    const complete = () => {
        const raw = input.value;
        const trimmed = raw.trimStart();
        const parts = trimmed.split(/\s+/);
        const cmd = (parts[0] || '').toLowerCase();
        const hasSpace = /\s/.test(trimmed);

        let pool = commands;
        let prefix = cmd;
        let lead = '';

        if (hasSpace && cmd === 'theme') {
            pool = themes;
            prefix = (parts[1] || '').toLowerCase();
            lead = 'theme ';
        } else if (hasSpace && cmd === 'color') {
            pool = [...Object.keys(colors), 'reset'];
            prefix = (parts[1] || '').toLowerCase();
            lead = 'color ';
        }

        const matches = pool.filter((item) => item.startsWith(prefix));

        if (matches.length === 1) {
            input.value = lead + matches[0];
            resizeInput();
            output.textContent = '';
            return;
        }

        if (matches.length > 1) {
            say(matches.join(' · '));
            return;
        }

        if (prefix === '') {
            say(pool.join(' · '));
        } else {
            say('no match');
        }
    };

    input.addEventListener('input', () => {
        resizeInput();
        commandIndex = -1;
        if (input.value.length > 0) output.textContent = '';
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
            complete();
        }
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const raw = input.value.trim();
        const parts = raw.split(/\s+/);
        const cmd = (parts[0] || '').toLowerCase();
        const arg = parts.slice(1).join(' ');

        switch (cmd) {
            case '':
                say('type help');
                break;
            case 'help':
            case '?':
                say('help · next · prev · year · today · events · admin · color · theme · dark · light');
                break;
            case 'next':
                goYear(currentYear + 1);
                break;
            case 'prev':
            case 'previous':
                goYear(currentYear - 1);
                break;
            case 'year':
                if (/^\d{4}$/.test(arg)) goYear(arg);
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
            case 'color':
                setColor(arg);
                break;
            case 'theme':
                setTheme(arg);
                break;
            case 'dark':
                setMode('dark');
                break;
            case 'light':
                setMode('light');
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

    applySavedAppearance();
    resizeInput();

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(resizeInput);
    }

    requestAnimationFrame(() => {
        input.focus({ preventScroll: true });
    });
})();
