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
    const root = document.documentElement;

    const themes = ['hackers', 'sega', 'c64', 'amiga', 'atari'];
    const hackUnlockKey = '3ventz-hack-unlocked';
    const matrixConfigKey = '3ventz-matrix-config';

    const isHackUnlocked = () => localStorage.getItem(hackUnlockKey) === '1';

    const getCommands = () => [
        'whoami',
        'sudo',
        'theme',
        'man',
        'hack the planet',
        ...(isHackUnlocked() ? ['matrix'] : [])
    ];

    let commands = getCommands();
    const commandsWithArguments = new Set(['theme']);

    const manualPages = {
        whoami: 'whoami — show your page-view number for the current calendar year',
        sudo: 'sudo — open the private event administration',
        theme: 'theme NAME — Aendert das Design der Website, navigiere mit TAB und Pfeiltasten durch die designs',
        man: 'man — list available commands or show help with man COMMAND',
        'hack the planet': 'hack the planet — prove your nerd credentials',
        matrix: 'matrix — configure the unlocked moving background (hackers theme only)'
    };

    const quizQuestions = [
        {
            question: 'SSH port?',
            answers: ['21', '22', '23', '443'],
            correct: 1
        },
        {
            question: '0x2A decimal?',
            answers: ['32', '42', '64', '255'],
            correct: 1
        },
        {
            question: 'RFC 1149 transports IP over...?',
            answers: ['ham radio', 'carrier pigeons', 'fax', 'sneakernet'],
            correct: 1
        },
        {
            question: 'Vim: save + quit?',
            answers: [':q!', ':wq', ':w', ':e'],
            correct: 1
        },
        {
            question: 'The Answer to Life, the Universe and Everything?',
            answers: ['23', '404', '42', '1337'],
            correct: 2
        }
    ];

    let commandIndex = -1;
    let suggestions = [];
    let suggestionIndex = -1;
    let suggestionLead = '';
    let suggestionMode = 'default';
    let suggestionPrompt = '';
    let quizIndex = -1;
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
        suggestionPrompt = '';
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
        suggestionPrompt = '';
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

        if (suggestionPrompt) {
            const prompt = document.createElement('span');
            prompt.className = 'terminal-suggestion-prompt';
            prompt.textContent = suggestionPrompt + ' ';
            output.appendChild(prompt);
        }

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

        if (suggestionMode === 'quiz') {
            handleQuizAnswer(selected);
            return true;
        }

        if (suggestionMode === 'matrix-menu') {
            handleMatrixMenuSelection(selected);
            return true;
        }

        if (suggestionMode === 'matrix-speed') {
            updateMatrixConfig({ speed: selected });
            openMatrixConfig();
            return true;
        }

        if (suggestionMode === 'matrix-density') {
            updateMatrixConfig({ density: selected });
            openMatrixConfig();
            return true;
        }

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
        const themeKey = '3ventz-theme';
        const migrationKey = '3ventz-theme-default-hackers-v1';
        let savedTheme = localStorage.getItem(themeKey);

        // SEGA used to be the site default. Migrate that old default once,
        // then respect whatever theme the visitor explicitly chooses later.
        if (!localStorage.getItem(migrationKey)) {
            if (!savedTheme || savedTheme === 'default' || savedTheme === 'sega') {
                savedTheme = 'hackers';
                localStorage.setItem(themeKey, savedTheme);
            }
            localStorage.setItem(migrationKey, '1');
        }

        const theme = themes.includes(savedTheme || '') ? savedTheme : 'hackers';
        root.dataset.theme = theme;
        localStorage.setItem(themeKey, theme);
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

    const refreshCommands = () => {
        commands = getCommands();
        commandIndex = -1;
    };

    const startHackQuiz = () => {
        quizIndex = 0;
        showHackQuestion();
    };

    const showHackQuestion = () => {
        const question = quizQuestions[quizIndex];
        if (!question) return;

        suggestions = [...question.answers];
        suggestionIndex = 0;
        suggestionLead = '';
        suggestionMode = 'quiz';
        suggestionPrompt = 'Q' + (quizIndex + 1) + '/' + quizQuestions.length + ' ' + question.question + ' //';
        renderSuggestions();
    };

    const handleQuizAnswer = (selected) => {
        const question = quizQuestions[quizIndex];
        if (!question) return;

        if (selected !== question.answers[question.correct]) {
            quizIndex = -1;
            say('ACCESS DENIED // wrong answer // try: hack the planet');
            return;
        }

        quizIndex += 1;

        if (quizIndex < quizQuestions.length) {
            showHackQuestion();
            return;
        }

        localStorage.setItem(hackUnlockKey, '1');
        refreshCommands();
        quizIndex = -1;
        renderMatrixBackground();
        say('ACCESS GRANTED // PLANET HACKED // matrix unlocked');
    };

    const defaultMatrixConfig = {
        chars: '01<>#',
        speed: 'normal',
        density: 'normal',
        enabled: true
    };

    const getMatrixConfig = () => {
        try {
            return {
                ...defaultMatrixConfig,
                ...JSON.parse(localStorage.getItem(matrixConfigKey) || '{}')
            };
        } catch {
            return { ...defaultMatrixConfig };
        }
    };

    const saveMatrixConfig = (config) => {
        localStorage.setItem(matrixConfigKey, JSON.stringify(config));
    };

    const updateMatrixConfig = (changes) => {
        const config = { ...getMatrixConfig(), ...changes };
        saveMatrixConfig(config);
        renderMatrixBackground();
        return config;
    };

    const renderMatrixBackground = () => {
        let layer = document.getElementById('hack-rain');

        if (!isHackUnlocked()) {
            if (layer) layer.remove();
            return;
        }

        const config = getMatrixConfig();

        if (!layer) {
            layer = document.createElement('div');
            layer.id = 'hack-rain';
            layer.className = 'hack-rain';
            layer.setAttribute('aria-hidden', 'true');
            document.body.prepend(layer);
        }

        layer.classList.toggle('is-enabled', Boolean(config.enabled));

        const mobile = window.innerWidth < 720;
        const counts = mobile
            ? { low: 4, normal: 6, high: 8 }
            : { low: 7, normal: 11, high: 16 };
        const count = counts[config.density] || counts.normal;
        const symbols = Array.from(String(config.chars || defaultMatrixConfig.chars)).slice(0, 16);
        const safeSymbols = symbols.length ? symbols : Array.from(defaultMatrixConfig.chars);
        const signature = [
            safeSymbols.join(''),
            config.speed,
            config.density,
            config.enabled ? '1' : '0',
            mobile ? 'm' : 'd'
        ].join('|');

        if (layer.dataset.signature === signature) return;
        layer.dataset.signature = signature;
        layer.replaceChildren();

        const baseDuration = {
            slow: 28,
            normal: 20,
            fast: 13
        }[config.speed] || 20;

        for (let column = 0; column < count; column += 1) {
            const rain = document.createElement('span');
            rain.className = 'hack-rain-column';

            const rows = [];
            for (let row = 0; row < 72; row += 1) {
                rows.push(safeSymbols[(row * 5 + column * 3) % safeSymbols.length]);
            }

            rain.textContent = rows.join('\n');
            rain.style.left = ((column + .5) * 100 / count) + '%';
            rain.style.setProperty('--rain-duration', (baseDuration + (column % 4) * 1.7) + 's');
            rain.style.setProperty('--rain-delay', '-' + ((column * 2.3) % baseDuration) + 's');
            layer.appendChild(rain);
        }
    };

    const openMatrixConfig = () => {
        if (!isHackUnlocked()) {
            say('permission denied // run: hack the planet');
            return;
        }

        if (root.dataset.theme !== 'hackers') {
            say('matrix: hackers theme only');
            return;
        }

        const config = getMatrixConfig();
        suggestions = ['chars', 'speed', 'density', config.enabled ? 'turn off' : 'turn on', 'done'];
        suggestionIndex = 0;
        suggestionLead = '';
        suggestionMode = 'matrix-menu';
        suggestionPrompt = 'matrix [' + (config.enabled ? 'on' : 'off') + '] '
            + config.chars + ' / ' + config.speed + ' / ' + config.density + ' //';
        renderSuggestions();
    };

    const handleMatrixMenuSelection = (selected) => {
        if (selected === 'chars') {
            clearSuggestions();
            input.value = 'matrix chars ';
            resizeInput();
            input.focus();
            return;
        }

        if (selected === 'speed') {
            suggestions = ['slow', 'normal', 'fast'];
            suggestionIndex = 0;
            suggestionLead = '';
            suggestionMode = 'matrix-speed';
            suggestionPrompt = 'speed //';
            renderSuggestions();
            return;
        }

        if (selected === 'density') {
            suggestions = ['low', 'normal', 'high'];
            suggestionIndex = 0;
            suggestionLead = '';
            suggestionMode = 'matrix-density';
            suggestionPrompt = 'density //';
            renderSuggestions();
            return;
        }

        if (selected === 'turn off' || selected === 'turn on') {
            updateMatrixConfig({ enabled: selected === 'turn on' });
            openMatrixConfig();
            return;
        }

        say('matrix config saved');
    };

    const handleMatrixCommand = (arg) => {
        if (!isHackUnlocked()) {
            say('permission denied // run: hack the planet');
            return;
        }

        if (root.dataset.theme !== 'hackers') {
            say('matrix: hackers theme only');
            return;
        }

        const value = (arg || '').trim();

        if (!value) {
            openMatrixConfig();
            return;
        }

        if (value === 'on' || value === 'off') {
            updateMatrixConfig({ enabled: value === 'on' });
            say('matrix ' + value);
            return;
        }

        if (value.startsWith('chars ')) {
            const chars = Array.from(value.slice(6).trim()).slice(0, 16).join('');
            if (!chars) {
                say('usage: matrix chars 01<>#');
                return;
            }
            updateMatrixConfig({ chars });
            say('matrix chars=' + chars);
            return;
        }

        if (value.startsWith('speed ')) {
            const speed = value.slice(6).trim().toLowerCase();
            if (!['slow', 'normal', 'fast'].includes(speed)) {
                say('speed: slow · normal · fast');
                return;
            }
            updateMatrixConfig({ speed });
            say('matrix speed=' + speed);
            return;
        }

        if (value.startsWith('density ')) {
            const density = value.slice(8).trim().toLowerCase();
            if (!['low', 'normal', 'high'].includes(density)) {
                say('density: low · normal · high');
                return;
            }
            updateMatrixConfig({ density });
            say('matrix density=' + density);
            return;
        }

        say('matrix: chars · speed · density · on · off');
    };

    const showManual = (command) => {
        const name = (command || '').trim().toLowerCase();

        if (!name) {
            openManual();
            return;
        }

        if (name === 'matrix' && !isHackUnlocked()) {
            say('no manual entry for matrix');
            return;
        }

        if (manualPages[name]) {
            say(manualPages[name]);
            return;
        }

        say('no manual entry for ' + name);
    };

    const openManual = () => {
        suggestions = [...commands];
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
            case 'theme':
                setTheme(arg);
                break;
            case 'hack':
                if (arg.toLowerCase() === 'the planet') startHackQuiz();
                else say('usage: hack the planet');
                break;
            case 'matrix':
                handleMatrixCommand(arg);
                break;
            case 'whoami':
                if (Number(state.pageViewNumber) > 0) {
                    say('visitor #' + state.pageViewNumber + ' // ' + state.visitYear);
                } else {
                    say('visitor #demo // ' + (state.visitYear || new Date().getFullYear()));
                }
                break;
            case 'sudo':
                window.location.href = '/admin/';
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
    refreshCommands();
    renderMatrixBackground();
    resizeInput();
    updateHint();

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            resizeInput();
            positionOutput();
        });
    }

    window.addEventListener('resize', () => {
        positionOutput();
        renderMatrixBackground();
    });

    requestAnimationFrame(() => {
        positionOutput();
        input.focus({ preventScroll: true });
    });
})();
