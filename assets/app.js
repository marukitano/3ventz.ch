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

    const themes = ['sega', 'c64', 'amiga', 'atari', 'edgerunner', 'hackers'];
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
        theme: 'theme NAME — Aendert das Design der Website, navigiere mit TAB und Pfeiltasten durch die designs',
        clear: 'clear — clear the CLI output',
        whoami: 'whoami — show your page-view number for the current calendar year',
        sudo: 'sudo — nice try.'
    };

    let commandIndex = -1;
    let suggestions = [];
    let suggestionIndex = -1;
    let suggestionLead = '';
    let suggestionMode = 'default';
    let outputScrollX = 0;
    let outputScrollDirection = 0;
    let outputScrollFrame = null;
    let outputScrollLastTime = null;

    const updateHint = () => {
        if (!hint) return;
        const shouldShow = input.value.length === 0 && suggestions.length === 0 && output.textContent === '';
        hint.hidden = !shouldShow;
    };

    const stopOutputScroll = () => {
        outputScrollDirection = 0;
        outputScrollLastTime = null;

        if (outputScrollFrame !== null) {
            cancelAnimationFrame(outputScrollFrame);
            outputScrollFrame = null;
        }
    };

    const resetOutputScroll = () => {
        stopOutputScroll();
        outputScrollX = 0;
        output.scrollLeft = 0;
    };

    const canScrollOutput = () =>
        output.scrollWidth > output.clientWidth + 2;

    const animateOutputScroll = (time) => {
        if (!outputScrollDirection || !canScrollOutput()) {
            stopOutputScroll();
            return;
        }

        if (outputScrollLastTime === null) {
            outputScrollLastTime = time;
        }

        const delta = Math.min(40, time - outputScrollLastTime);
        outputScrollLastTime = time;

        const speed = 170; // pixels per second
        const maxScroll = Math.max(0, output.scrollWidth - output.clientWidth);

        outputScrollX += outputScrollDirection * speed * (delta / 1000);
        outputScrollX = Math.max(0, Math.min(maxScroll, outputScrollX));
        output.scrollLeft = outputScrollX;

        if (
            (outputScrollDirection < 0 && outputScrollX <= 0) ||
            (outputScrollDirection > 0 && outputScrollX >= maxScroll)
        ) {
            stopOutputScroll();
            return;
        }

        outputScrollFrame = requestAnimationFrame(animateOutputScroll);
    };

    const startOutputScroll = (direction) => {
        if (!canScrollOutput()) return false;

        outputScrollDirection = direction;

        if (outputScrollFrame === null) {
            outputScrollLastTime = null;
            outputScrollFrame = requestAnimationFrame(animateOutputScroll);
        }

        return true;
    };

    const say = (text) => {
        suggestions = [];
        suggestionIndex = -1;
        suggestionLead = '';
        suggestionMode = 'default';
        output.textContent = text;
        resetOutputScroll();
        updateHint();
        requestAnimationFrame(positionOutput);
    };

    const clearSuggestions = () => {
        suggestions = [];
        suggestionIndex = -1;
        suggestionLead = '';
        suggestionMode = 'default';
        output.textContent = '';
        resetOutputScroll();
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
        const savedTheme = localStorage.getItem('3ventz-theme') || 'sega';
        const migratedTheme = savedTheme === 'default' ? 'sega' : savedTheme;
        const theme = themes.includes(migratedTheme) ? migratedTheme : 'sega';
        root.dataset.theme = theme;
        localStorage.setItem('3ventz-theme', theme);
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

        if (!suggestions.length && canScrollOutput()) {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                startOutputScroll(-1);
                return;
            }

            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                startOutputScroll(1);
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

    input.addEventListener('keyup', (event) => {
        if (
            event.key === 'ArrowLeft' ||
            event.key === 'ArrowRight' ||
            event.key === 'ArrowUp' ||
            event.key === 'ArrowDown'
        ) {
            stopOutputScroll();
        }
    });

    input.addEventListener('blur', stopOutputScroll);

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
                if (Number(state.pageViewNumber) > 0) {
                    say('visitor #' + state.pageViewNumber + ' // ' + state.visitYear);
                } else {
                    say('visitor #demo // ' + (state.visitYear || new Date().getFullYear()));
                }
                break;
            case 'sudo':
                say('nice try.');
                break;
            default:
                say('command not found: ' + cmd + ' · try man');
        }

        input.value = '';
        commandIndex = -1;
        resizeInput();
        updateHint();
        if (cursor) cursor.style.display = 'inline';
        input.focus();
    });

    const categoryFilterButtons = [...document.querySelectorAll('[data-category-filter]')];
    const eventMarkers = [...document.querySelectorAll('.event-span')];

    const refreshVisibleDateRanges = () => {
        document.querySelectorAll('.week-row').forEach((row) => {
            const numbers = [...row.querySelectorAll('.number[data-day]')];

            numbers.forEach((number) => {
                number.textContent = number.dataset.day || '';
            });

            const visibleMarkers = [...row.querySelectorAll('.event-span:not(.category-filtered-out)')];

            visibleMarkers.forEach((marker) => {
                const startDay = Number(marker.dataset.segmentStartDay || 0);
                const endDay = Number(marker.dataset.segmentEndDay || 0);
                if (!startDay || !endDay || endDay <= startDay) return;

                const startNumber = numbers.find((number) => Number(number.dataset.day) === startDay);
                if (startNumber) startNumber.textContent = startDay + '–' + endDay;

                numbers.forEach((number) => {
                    const day = Number(number.dataset.day || 0);
                    if (day > startDay && day <= endDay) number.textContent = '';
                });
            });
        });
    };

    const categoryStorageKey = '3ventz-categories';

    const saveCategoryFilters = () => {
        const enabled = categoryFilterButtons
            .filter((button) => button.classList.contains('is-active'))
            .map((button) => button.dataset.categoryFilter || '')
            .filter(Boolean);

        localStorage.setItem(categoryStorageKey, JSON.stringify(enabled));
    };

    const restoreCategoryFilters = () => {
        const saved = localStorage.getItem(categoryStorageKey);
        if (!saved) return;

        try {
            const enabled = new Set(JSON.parse(saved));

            categoryFilterButtons.forEach((button) => {
                const category = button.dataset.categoryFilter || '';
                const active = enabled.has(category);
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        } catch {
            localStorage.removeItem(categoryStorageKey);
        }
    };

    const applyCategoryFilters = () => {
        const enabled = new Set(
            categoryFilterButtons
                .filter((button) => button.classList.contains('is-active'))
                .map((button) => button.dataset.categoryFilter || '')
        );

        eventMarkers.forEach((marker) => {
            const category = marker.dataset.eventCategory || '';
            marker.classList.toggle('category-filtered-out', !enabled.has(category));
        });

        refreshVisibleDateRanges();
    };

    categoryFilterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const active = button.classList.toggle('is-active');
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
            saveCategoryFilters();
            applyCategoryFilters();
        });
    });

    const eventTooltip = document.createElement('div');
    eventTooltip.className = 'event-tooltip';
    eventTooltip.hidden = true;
    document.body.appendChild(eventTooltip);

    const positionEventTooltip = (marker) => {
        const markerRect = marker.getBoundingClientRect();
        const tooltipRect = eventTooltip.getBoundingClientRect();
        const gap = 10;
        const edge = 10;

        let left = markerRect.left + markerRect.width / 2 - tooltipRect.width / 2;
        left = Math.max(edge, Math.min(left, window.innerWidth - tooltipRect.width - edge));

        let top = markerRect.top - tooltipRect.height - gap;
        if (top < edge) {
            top = markerRect.bottom + gap;
        }

        eventTooltip.style.left = Math.round(left) + 'px';
        eventTooltip.style.top = Math.round(top) + 'px';
    };

    const showEventTooltip = (marker) => {
        const title = marker.dataset.eventTitle || '';
        const date = marker.dataset.eventDate || '';
        const category = marker.dataset.eventCategory || '';
        const description = marker.dataset.eventDescription || '';
        const hasUrl = Boolean(marker.dataset.eventUrl);

        eventTooltip.replaceChildren();

        const heading = document.createElement('div');
        heading.className = 'event-tooltip-title';
        heading.textContent = title;
        eventTooltip.appendChild(heading);

        const meta = document.createElement('div');
        meta.className = 'event-tooltip-meta';
        meta.textContent = [date, category].filter(Boolean).join(' // ');
        if (meta.textContent) eventTooltip.appendChild(meta);

        if (description) {
            const body = document.createElement('div');
            body.className = 'event-tooltip-description';
            body.textContent = description;
            eventTooltip.appendChild(body);
        }

        if (hasUrl) {
            const action = document.createElement('div');
            action.className = 'event-tooltip-action';
            action.textContent = 'click // open website';
            eventTooltip.appendChild(action);
        }

        eventTooltip.hidden = false;
        requestAnimationFrame(() => positionEventTooltip(marker));
    };

    const hideEventTooltip = () => {
        eventTooltip.hidden = true;
    };

    document.querySelectorAll('.event-span').forEach((marker) => {
        marker.addEventListener('mouseenter', () => showEventTooltip(marker));
        marker.addEventListener('mouseleave', hideEventTooltip);
        marker.addEventListener('focus', () => showEventTooltip(marker));
        marker.addEventListener('blur', hideEventTooltip);
    });

    document.querySelector('.brand-terminal')?.addEventListener('click', () => input.focus());

    restoreCategoryFilters();
    applyCategoryFilters();
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
