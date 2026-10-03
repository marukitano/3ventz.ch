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
    const commands = [
        'help',
        'next',
        'prev',
        'year',
        'today',
        'events',
        'admin',
        'theme',
        'clear',
        'whoami',
        'sudo'
    ];

    const commandsWithArguments = new Set(['theme', 'year']);

    let commandIndex = -1;
    let suggestions = [];
    let suggestionIndex = -1;
    let suggestionLead = '';

    const say = (text) => {
        suggestions = [];
        suggestionIndex = -1;
        suggestionLead = '';
        output.textContent = '→ ' + text;
    };

    const clearSuggestions = () => {
        suggestions = [];
        suggestionIndex = -1;
        suggestionLead = '';
        output.textContent = '';
    };

    const renderSuggestions = (direction = 0) => {
        if (!suggestions.length) {
            output.textContent = '';
            return;
        }

        output.replaceChildren();
        output.appendChild(document.createTextNode('→ '));

        const list = document.createElement('span');
        list.className = 'terminal-suggestion-list';

        if (direction < 0) list.classList.add('rotate-up');
        if (direction > 0) list.classList.add('rotate-down');

        const rotated = [
            ...suggestions.slice(suggestionIndex),
            ...suggestions.slice(0, suggestionIndex)
        ];

        rotated.forEach((item, index) => {
            const span = document.createElement('span');
            span.className = 'terminal-suggestion' + (index === 0 ? ' selected' : '');
            span.textContent = item;
            list.appendChild(span);

            if (index < rotated.length - 1) {
                list.appendChild(document.createTextNode(' · '));
            }
        });

        output.appendChild(list);
    };

    const acceptSuggestion = () => {
        if (!suggestions.length || suggestionIndex < 0) return false;

        input.value = suggestionLead + suggestions[suggestionIndex];
        resizeInput();
        clearSuggestions();
        return true;
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
        root.dataset.theme = themes.includes(savedTheme) ? savedTheme : 'default';
    };

    const setTheme = (name) => {
        const theme = (name || '').toLowerCase();

        if (!themes.includes(theme)) {
            say('themes: ' + themes.join(' · '));
            return;
        }

        root.dataset.theme = theme;
        localStorage.setItem('3ventz-theme', theme);
        say('theme = ' + theme);
    };

    const complete = () => {
        const raw = input.value;
        const trimmed = raw.trimStart();
        const parts = trimmed.split(/\s+/);
        const cmd = (parts[0] || '').toLowerCase();
        const hasSpace = /\s/.test(trimmed);

        // Argument completion for commands that already have their trailing space.
        if (hasSpace && cmd === 'theme') {
            const prefix = (parts[1] || '').toLowerCase();

            if (prefix === '') {
                suggestions = [...themes];
                suggestionIndex = 0;
                suggestionLead = 'theme ';
                renderSuggestions();
                return;
            }

            const matches = themes.filter((item) => item.startsWith(prefix));

            if (matches.length === 1) {
                input.value = 'theme ' + matches[0];
                resizeInput();
                clearSuggestions();
                return;
            }

            if (matches.length > 1) {
                suggestions = matches;
                suggestionIndex = 0;
                suggestionLead = 'theme ';
                renderSuggestions();
                return;
            }

            say('no match');
            return;
        }

        // Complete command names. Commands with arguments get a trailing space
        // immediately, so a second Tab can open argument suggestions.
        const matches = commands.filter((item) => item.startsWith(cmd));

        if (matches.length === 1) {
            const match = matches[0];
            input.value = match + (commandsWithArguments.has(match) ? ' ' : '');
            resizeInput();
            clearSuggestions();
            return;
        }

        if (matches.length > 1) {
            suggestions = matches;
            suggestionIndex = 0;
            suggestionLead = '';
            renderSuggestions();
            return;
        }

        if (cmd === '') {
            suggestions = commands;
            suggestionIndex = 0;
            suggestionLead = '';
            renderSuggestions();
        } else {
            say('no match');
        }
    };

    input.addEventListener('input', () => {
        resizeInput();
        commandIndex = -1;
        clearSuggestions();
        if (cursor) cursor.style.display = 'inline';
    });

    input.addEventListener('keydown', (event) => {
        if (suggestions.length) {
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                suggestionIndex = suggestionIndex > 0
                    ? suggestionIndex - 1
                    : suggestions.length - 1;
                renderSuggestions(-1);
                return;
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                suggestionIndex = suggestionIndex < suggestions.length - 1
                    ? suggestionIndex + 1
                    : 0;
                renderSuggestions(1);
                return;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                acceptSuggestion();
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                clearSuggestions();
                return;
            }
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            commandIndex = commandIndex < commands.length - 1 ? commandIndex + 1 : 0;
            input.value = commands[commandIndex];
            resizeInput();
            clearSuggestions();
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            commandIndex = commandIndex > 0 ? commandIndex - 1 : commands.length - 1;
            input.value = commands[commandIndex];
            resizeInput();
            clearSuggestions();
            return;
        }

        if (event.key === 'Tab') {
            event.preventDefault();
            complete();
            return;
        }
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        clearSuggestions();

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
                say('help · next · prev · year · today · events · admin · theme · clear');
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
            case 'theme':
                setTheme(arg);
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
