(() => {
    const form = document.getElementById('terminal');
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');
    const cursor = document.getElementById('terminal-cursor');
    const hint = document.getElementById('terminal-hint');
    const themeIndicator = document.getElementById('theme-indicator');
    const navStack = document.querySelector('.nav-stack');

    if (!form || !input || !output) return;

    const state = window.THREEVENTZ || {};
    const currentYear = Number(state.year) || new Date().getFullYear();
    const root = document.documentElement;

    const themes = ['default', 'c64', 'amiga', 'atari', 'edgerunner', 'hackers'];
    const commands = [
        'next',
        'prev',
        'year',
        'today',
        'events',
        'admin',
        'man',
        'theme',
        'clear',
        'whoami',
        'sudo'
    ];

    const commandsWithArguments = new Set(['theme', 'year']);

    const manualPages = {
        next: 'next — show the next calendar year',
        prev: 'prev — show the previous calendar year',
        year: 'year YYYY — jump to a specific year, e.g. year 2027',
        today: 'today — return to the current year',
        events: 'events — show how many events are loaded for this year',
        admin: 'admin — open the private event administration',
        theme: 'theme NAME — switch the terminal theme; press Tab after theme for choices',
        clear: 'clear — clear the CLI output',
        whoami: 'whoami — identify the current 3ventz visitor',
        sudo: 'sudo — nice try.'
    };

    let commandIndex = -1;
    let suggestions = [];
    let suggestionIndex = -1;
    let suggestionLead = '';
    let suggestionMode = 'default';

    const updateHint = () => {
        if (!hint) return;
        const shouldShow = input.value.length === 0 && suggestions.length === 0 && output.textContent === '';
        hint.hidden = !shouldShow;
    };

    const say = (text) => {
        suggestions = [];
        suggestionIndex = -1;
        suggestionLead = '';
        suggestionMode = 'default';
        output.textContent = text;
        updateHint();
        requestAnimationFrame(positionOutput);
    };

    const clearSuggestions = () => {
        suggestions = [];
        suggestionIndex = -1;
        suggestionLead = '';
        suggestionMode = 'default';
        output.textContent = '';
        updateHint();
    };

    const buildSuggestionList = (items, selectedIndex = 0) => {
        const list = document.createElement('span');
        list.className = 'terminal-suggestion-list';

        items.forEach((item, index) => {
            const span = document.createElement('span');
            span.className = 'terminal-suggestion' + (index === selectedIndex ? ' selected' : '');
            span.textContent = item;
            list.appendChild(span);

            if (index < items.length - 1) {
                list.appendChild(document.createTextNode(' · '));
            }
        });

        return list;
    };

    const getRotatedSuggestions = () => [
        ...suggestions.slice(suggestionIndex),
        ...suggestions.slice(0, suggestionIndex)
    ];

    const renderSuggestions = (direction = 0) => {
        if (!suggestions.length) {
            output.textContent = '';
            return;
        }

        output.replaceChildren();

        const rotated = getRotatedSuggestions();
        const visibleSuggestions = suggestionMode === 'theme'
            ? rotated.slice(0, 4)
            : rotated;

        const list = buildSuggestionList(visibleSuggestions, 0);

        if (suggestionMode === 'manual') {
            list.classList.add('manual-list');
        }

        if (direction < 0) list.classList.add('snap-prev');
        if (direction > 0) list.classList.add('snap-next');

        output.appendChild(list);
        updateHint();
        requestAnimationFrame(positionOutput);
    };

    const acceptSuggestion = () => {
        if (!suggestions.length || suggestionIndex < 0) return false;

        const selected = suggestions[suggestionIndex];

        if (suggestionMode === 'manual') {
            clearSuggestions();
            input.value = '';
            resizeInput();
            showManual(selected);
            return true;
        }

        input.value = suggestionLead + selected;
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

    const positionOutput = () => {
        const formRect = form.getBoundingClientRect();
        const cursorRect = cursor.getBoundingClientRect();
        const left = Math.max(0, cursorRect.right - formRect.left + 8);

        let rightLimit = formRect.width;

        if (navStack) {
            const navRect = navStack.getBoundingClientRect();
            rightLimit = navRect.left - formRect.left - 32;
        }

        const available = Math.max(0, rightLimit - left);

        output.style.left = left + 'px';
        output.style.width = available + 'px';

        const outputHeight = output.getBoundingClientRect().height;
        const top = Math.max(
            0,
            cursorRect.bottom - formRect.top - outputHeight - 2
        );

        output.style.top = top + 'px';
    };

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
        requestAnimationFrame(positionOutput);
    };

    const updateThemeIndicator = (theme) => {
        if (themeIndicator) {
            themeIndicator.textContent = 'echo $theme=' + theme;
        }
    };

    const applySavedAppearance = () => {
        const savedTheme = localStorage.getItem('3ventz-theme') || 'default';
        const theme = themes.includes(savedTheme) ? savedTheme : 'default';
        root.dataset.theme = theme;
        updateThemeIndicator(theme);
    };

    const setTheme = (name) => {
        const theme = (name || '').toLowerCase();

        if (!themes.includes(theme)) {
            say('themes: ' + themes.join(' · '));
            return;
        }

        root.dataset.theme = theme;
        localStorage.setItem('3ventz-theme', theme);
        updateThemeIndicator(theme);
        clearSuggestions();
    };

    const showManual = (command) => {
        const name = (command || '').trim().toLowerCase();

        if (!name) {
            openManual();
            return;
        }

        if (manualPages[name]) {
            say(manualPages[name]);
            return;
        }

        say('no manual entry for ' + name);
    };

    const openManual = () => {
        suggestions = commands.filter((item) => item !== 'man');
        suggestionIndex = 0;
        suggestionLead = '';
        suggestionMode = 'manual';
        renderSuggestions();
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
                suggestionMode = 'theme';
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
                suggestionMode = 'theme';
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
        updateHint();
        if (cursor) cursor.style.display = 'inline';
    });

    input.addEventListener('keydown', (event) => {
        if (suggestions.length) {
            if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                event.preventDefault();
                suggestionIndex = suggestionIndex > 0
                    ? suggestionIndex - 1
                    : suggestions.length - 1;
                renderSuggestions(-1);
                return;
            }

            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
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
                clearSuggestions();
                break;
            case 'man':
                if (arg) showManual(arg);
                else openManual();
                break;
            case '?':
                openManual();
                break;
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
        updateHint();
        if (cursor) cursor.style.display = 'inline';
        input.focus();
    });

    document.querySelector('.brand-terminal')?.addEventListener('click', () => input.focus());

    applySavedAppearance();
    resizeInput();
    updateHint();

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            resizeInput();
            positionOutput();
        });
    }

    window.addEventListener('resize', positionOutput);

    requestAnimationFrame(() => {
        positionOutput();
        input.focus({ preventScroll: true });
    });
})();
