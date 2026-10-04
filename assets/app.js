(() => {
    const form = document.getElementById('terminal');
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');
    const cursor = document.getElementById('terminal-cursor');
    const hint = document.getElementById('terminal-hint');
    const themeIndicator = document.getElementById('theme-indicator');
    const nerdIndicator = document.getElementById('nerd-indicator');
    const navStack = document.querySelector('.nav-stack');

    if (!form || !input || !output) return;

    const state = window.THREEVENTZ || {};
    const root = document.documentElement;

    const themes = ['hackers', 'sega', 'c64', 'amiga', 'atari'];
    const hackUnlockKey = '3ventz-hack-unlocked';

    const isHackUnlocked = () => localStorage.getItem(hackUnlockKey) === '1';

    const getCommands = () => [
        'whoami',
        'sudo',
        'theme',
        'man',
        'hack the planet',
        ...(isHackUnlocked() ? ['attack'] : [])
    ];

    let commands = getCommands();
    const commandsWithArguments = new Set(['theme']);

    const manualPages = {
        whoami: 'whoami — show your page-view number for the current calendar year',
        sudo: 'sudo — open the private event administration',
        theme: 'theme NAME — Aendert das Design der Website, navigiere mit TAB und Pfeiltasten durch die designs',
        man: 'man — list available commands or show help with man COMMAND',
        'hack the planet': 'hack the planet — prove your nerd credentials',
        'attack': 'attack — unleash the rabbit virus'
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
            question: 'Was ist unser Lieblingstier?',
            answers: ['der Pinguin', 'der Tux', 'die Katze', 'das Capybara'],
            correct: 0
        },
        {
            question: 'Vim: save + quit?',
            answers: [':q!', ':wq', ':w', ':e'],
            correct: 1
        },
        {
            question: 'Antwort auf alles?',
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
        stopTicker();
        output.textContent = text;
        resetOutputScroll();
        updateHint();
        requestAnimationFrame(positionOutput);
    };

    let tickerAnimation = null;

    const stopTicker = () => {
        if (tickerAnimation) {
            tickerAnimation.cancel();
            tickerAnimation = null;
        }

        output.classList.remove('is-ticker');
        output.style.height = '';
        output.style.minHeight = '';
    };

    const sayTicker = (text) => {
        suggestions = [];
        suggestionIndex = -1;
        suggestionLead = '';
        suggestionMode = 'default';
        suggestionPrompt = '';
        stopOutputScroll();
        stopTicker();
        outputScrollX = 0;
        output.scrollLeft = 0;
        output.replaceChildren();

        const ticker = document.createElement('span');
        ticker.textContent = text;
        ticker.style.display = 'inline-block';
        ticker.style.position = 'relative';
        ticker.style.whiteSpace = 'nowrap';

        output.classList.add('is-ticker');
        output.style.height = '1em';
        output.style.minHeight = '1em';
        output.appendChild(ticker);

        updateHint();
        requestAnimationFrame(() => {
            positionOutput();

            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

            const distance = output.clientWidth + ticker.getBoundingClientRect().width;
            tickerAnimation = ticker.animate(
                [
                    { transform: 'translateX(' + output.clientWidth + 'px)' },
                    { transform: 'translateX(-' + ticker.getBoundingClientRect().width + 'px)' }
                ],
                {
                    duration: Math.max(4200, distance * 9),
                    iterations: Infinity,
                    easing: 'linear'
                }
            );
        });
    };

    const clearSuggestions = () => {
        suggestions = [];
        suggestionIndex = -1;
        suggestionLead = '';
        suggestionMode = 'default';
        suggestionPrompt = '';
        stopTicker();
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
            span.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                const selectedIndex = suggestions.indexOf(item);
                if (selectedIndex < 0) return;
                suggestionIndex = selectedIndex;
                acceptSuggestion();
            });
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

    const updateNerdIndicator = () => {
        if (!nerdIndicator) return;
        nerdIndicator.hidden = !isHackUnlocked();
        nerdIndicator.textContent = 'echo $nerd=true';
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
        suggestionPrompt = question.question + ' //';
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
        updateNerdIndicator();
        quizIndex = -1;
        say('ACCESS GRANTED // PLANET HACKED // attack unlocked');
    };

    let rabbitAttackTimer = null;
    let rabbitAttackFinishTimer = null;

    const stopRabbitAttack = () => {
        if (rabbitAttackTimer !== null) {
            window.clearInterval(rabbitAttackTimer);
            rabbitAttackTimer = null;
        }

        if (rabbitAttackFinishTimer !== null) {
            window.clearTimeout(rabbitAttackFinishTimer);
            rabbitAttackFinishTimer = null;
        }

        document.getElementById('rabbit-attack-layer')?.remove();
        document.documentElement.classList.remove('rabbit-attack-active');
    };

    const makeRabbitIcon = (row, col, cellWidth, cellHeight, totalCols) => {
        const rabbit = document.createElement('span');
        const runnerIsRed = row % 2 === 0;
        const movesLeft = row % 2 === 1;

        // Every second row is offset by half a cell, matching the staggered film layout.
        const stagger = row % 2 === 1 ? .5 : 0;
        const left = (col + .5 + stagger) * cellWidth;

        // Deliberately allow the staggered reverse row to begin on the right edge.
        // The attack field clips the half-visible sprite, just like a framebuffer edge.
        const top = (row + .5) * cellHeight;

        // Roughly twice the previous visual size while keeping integer-pixel scaling.
        const size = Math.max(
            100,
            Math.min(
                200,
                Math.floor(Math.min(cellWidth * 1.45, cellHeight * .88) / 25) * 25
            )
        );

        rabbit.className = 'rabbit-virus-icon rabbit-runner '
            + (runnerIsRed ? 'rabbit-red' : 'rabbit-black')
            + (movesLeft ? ' rabbit-facing-left' : '');

        rabbit.style.left = left + 'px';
        rabbit.style.top = top + 'px';
        rabbit.style.width = size + 'px';
        rabbit.style.height = size + 'px';

        // Film behaviour: red runner leaves black rabbits; black runner leaves red rabbits.
        rabbit.dataset.trailClass = runnerIsRed ? 'rabbit-black' : 'rabbit-red';
        rabbit.setAttribute('aria-hidden', 'true');
        return rabbit;
    };

    const freezeRabbitTrail = (rabbit) => {
        if (!rabbit) return;
        rabbit.classList.remove('rabbit-runner', 'rabbit-red', 'rabbit-black');
        rabbit.classList.add(rabbit.dataset.trailClass || 'rabbit-black');
    };

    const showRabbitAlert = (layer) => {
        const alert = document.createElement('div');
        alert.className = 'rabbit-system-alert';
        alert.innerHTML = '<strong>RABBIT VIRUS DETECTED</strong><span>RABBIT IN THE ADMINISTRATION SYSTEM</span><b>FLU SHOT</b>';
        layer.appendChild(alert);

        rabbitAttackFinishTimer = window.setTimeout(() => {
            layer.classList.add('is-clearing');

            rabbitAttackFinishTimer = window.setTimeout(() => {
                stopRabbitAttack();

                const year = Number(state.year) || new Date().getFullYear();
                const activeCategories = categoryFilterButtons
                    .filter((button) => button.classList.contains('is-active'))
                    .map((button) => button.dataset.categoryFilter || '')
                    .filter(Boolean);

                const params = new URLSearchParams();
                params.set('year', String(year));
                params.set('filtered', '1');
                params.set('categories', activeCategories.join(','));

                const successMessage =
                    "ATTACK SUCCESSFUL // WE'RE IN THE GIBSON // GARBAGE FILE ACQUIRED // EXPORTING... // ACID BURN IS IMPRESSED";
                const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

                if (reducedMotion) {
                    say(successMessage);
                } else {
                    sayTicker(successMessage);
                }

                // Real iCalendar export of exactly the categories currently visible.
                // The download starts after one pass; the ticker itself keeps looping
                // until the user types something or presses Enter.
                window.setTimeout(() => {
                    window.location.href = '/export.php?' + params.toString();
                }, reducedMotion ? 1800 : 8200);
            }, 80);
        }, 2300);
    };

    const startRabbitAttack = () => {
        if (!isHackUnlocked()) {
            say('permission denied // run: hack the planet');
            return;
        }

        stopRabbitAttack();
        clearSuggestions();
        say('RABBIT VIRUS DEPLOYED');

        const layer = document.createElement('div');
        layer.id = 'rabbit-attack-layer';
        layer.className = 'rabbit-attack-layer';
        layer.setAttribute('aria-hidden', 'true');

        const glitchField = document.createElement('div');
        glitchField.className = 'rabbit-glitch-field';

        /*
         * Messy 90s framebuffer damage: every attack gets a fresh scatter of
         * rastered fragments. The blocks themselves stay binary — solid pixels
         * and real holes — so there is no alpha-blended "modern" transparency.
         */
        const mobileGlitch = window.innerWidth < 720;
        const glitchCount = mobileGlitch ? 34 : 52;

        for (let i = 0; i < glitchCount; i += 1) {
            const block = document.createElement('span');
            const shape = Math.floor(Math.random() * 5);
            const tall = shape === 2 || (shape === 4 && Math.random() < .5);

            const width = tall
                ? 4 + Math.random() * 10
                : 8 + Math.random() * 24;
            const height = tall
                ? 14 + Math.random() * 34
                : 4 + Math.random() * 13;

            // Allow a little overflow so fragments can enter from every edge.
            const left = -4 + Math.random() * 100;
            const top = -3 + Math.random() * 99;

            block.className = 'rabbit-glitch-block glitch-' + shape;
            block.style.left = left.toFixed(2) + '%';
            block.style.top = top.toFixed(2) + '%';
            block.style.width = width.toFixed(2) + 'vw';
            block.style.height = height.toFixed(2) + 'vh';
            block.style.setProperty('--glitch-shift-x', (Math.floor(Math.random() * 3) - 1) + 'px');
            block.style.setProperty('--glitch-shift-y', (Math.floor(Math.random() * 3) - 1) + 'px');

            glitchField.appendChild(block);
        }

        const field = document.createElement('div');
        field.className = 'rabbit-attack-field';
        layer.appendChild(glitchField);
        layer.appendChild(field);
        document.body.appendChild(layer);
        document.documentElement.classList.add('rabbit-attack-active');

        /*
         * Film-style fill: one complete row at a time.
         * Red rows enter left -> right, black rows right -> left.
         * Cell sizes stay deliberately coarse so the effect remains cheap on phones.
         */
        const mobile = window.innerWidth < 720;
        const targetCellWidth = mobile ? 138 : 174;
        const targetCellHeight = mobile ? 165 : 205;
        const cols = Math.max(mobile ? 4 : 6, Math.ceil(window.innerWidth / targetCellWidth));
        const rows = Math.max(4, Math.ceil(window.innerHeight / targetCellHeight));
        const cellWidth = window.innerWidth / cols;
        const cellHeight = window.innerHeight / rows;
        const total = cols * rows;
        const fillDuration = 14750;
        const interval = Math.max(24, Math.floor(fillDuration / total));

        let created = 0;
        let activeRabbit = null;

        rabbitAttackTimer = window.setInterval(() => {
            if (created >= total) {
                freezeRabbitTrail(activeRabbit);
                activeRabbit = null;

                window.clearInterval(rabbitAttackTimer);
                rabbitAttackTimer = null;

                rabbitAttackFinishTimer = window.setTimeout(() => {
                    showRabbitAlert(layer);
                }, 180);
                return;
            }

            freezeRabbitTrail(activeRabbit);

            const row = Math.floor(created / cols);
            const positionInRow = created % cols;
            const col = row % 2 === 0
                ? positionInRow
                : cols - 1 - positionInRow;

            activeRabbit = makeRabbitIcon(row, col, cellWidth, cellHeight, cols);
            field.appendChild(activeRabbit);
            created += 1;
        }, interval);
    };


    const showManual = (command) => {
        const name = (command || '').trim().toLowerCase();

        if (!name) {
            openManual();
            return;
        }

        if (name === 'attack' && !isHackUnlocked()) {
            say('no manual entry for attack');
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

    const focusTerminalInput = () => {
        if (document.activeElement === input) return;

        try {
            input.focus({ preventScroll: true });
        } catch {
            input.focus();
        }
    };

    // This site has one text-entry surface: the CLI. Clicks may activate filters,
    // links, event markers, etc., but keyboard focus always returns to the prompt.
    document.addEventListener('click', () => {
        window.requestAnimationFrame(focusTerminalInput);
    });

    // Fallback for browsers that leave focus on a clicked button/link:
    // printable keys and Enter are redirected to the CLI immediately.
    document.addEventListener('keydown', (event) => {
        if (event.target === input || event.defaultPrevented) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        if (event.key === 'Enter') {
            event.preventDefault();
            focusTerminalInput();
            form.requestSubmit();
            return;
        }

        if (event.key.length !== 1) return;

        event.preventDefault();
        focusTerminalInput();

        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.setRangeText(event.key, start, end, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, true);

    window.addEventListener('pageshow', focusTerminalInput);

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
            case 'attack':
                if (!isHackUnlocked()) {
                    say('permission denied // run: hack the planet');
                } else if (arg) {
                    say('usage: attack');
                } else {
                    startRabbitAttack();
                }
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
            focusTerminalInput();
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
    updateNerdIndicator();
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
