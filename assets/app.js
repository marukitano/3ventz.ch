(() => {
    const form = document.getElementById('terminal');
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');
    const cursor = document.getElementById('terminal-cursor');
    const hint = document.getElementById('terminal-hint');
    const themeIndicator = document.getElementById('theme-indicator');
    const nerdIndicator = document.getElementById('nerd-indicator');
    const navStack = document.querySelector('.nav-stack');
    const friendsToggle = document.getElementById('friends-toggle');
    const friendsPanel = document.getElementById('friends-panel');
    const friendsWall = document.getElementById('friends-wall');

    if (!form || !input || !output) return;

    const state = window.THREEVENTZ || {};
    const root = document.documentElement;
    // Keep JS interaction mode aligned with the CSS breakpoint.
    // Touchscreen laptops such as the ThinkPad E16 can report a coarse primary
    // pointer even at desktop widths. Treating those as mobile made `man` render
    // the touch/manual layout inside the desktop-positioned terminal output,
    // which caused overlapping content and blocked interaction.
    const touchUi =
        window.matchMedia('(max-width: 719px)').matches
        && (navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches);

    const themes = ['hackers', 'sega', 'c64', 'amiga', 'atari'];
    const hackUnlockKey = '3ventz-hack-unlocked';

    const isHackUnlocked = () => localStorage.getItem(hackUnlockKey) === '1';

    const getCommands = () => [
        'whoami',
        'sudo',
        'theme',
        'friends',
        'man',
        'hack the planet',
        ...(isHackUnlocked() ? ['attack'] : [])
    ];

    let commands = getCommands();
    const commandsWithArguments = new Set(['theme']);

    const manualPages = {
        whoami: 'show your page-view number for the current calendar year',
        sudo: 'access to the Gibson backbone',
        theme: 'theme NAME — change the website theme. With [TAB] you get the options',
        friends: 'open or close the Friends wall',
        man: 'list available commands or show help with man COMMAND',
        'hack the planet': 'prove your nerd credentials to get full access',
        'attack': 'unleash the rabbit virus to the Gibson'
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
            question: 'Tux is a?',
            answers: ['penguin', 'elephant', 'gnu', 'devil'],
            correct: 0
        },
        {
            question: 'Vim: save + quit?',
            answers: [':q!', ':wq', ':w', ':e'],
            correct: 1
        },
        {
            question: "What's your home address?",
            answers: ['192.168.0.1', '10.0.0.1', '127.0.0.1', '8.8.8.8'],
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
        output.classList.remove('is-quiz', 'is-manual-page');
        output.textContent = text;
        resetOutputScroll();
        updateHint();
        requestAnimationFrame(positionOutput);
    };

    const sayManual = (command, description) => {
        if (!touchUi) {
            sayTicker(command + ' // ' + description);
            return;
        }

        suggestions = [];
        suggestionIndex = -1;
        suggestionLead = '';
        suggestionMode = 'default';
        suggestionPrompt = '';
        stopTicker();
        output.classList.remove('is-quiz');
        output.classList.add('is-manual-page');
        output.replaceChildren();

        const heading = document.createElement('div');
        heading.className = 'terminal-manual-command';
        heading.textContent = command;

        const body = document.createElement('div');
        body.className = 'terminal-manual-description';
        body.textContent = description;

        output.append(heading, body);
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
        output.classList.remove('is-quiz', 'is-manual-page');
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
        output.classList.remove('is-quiz', 'is-manual-page');
        output.textContent = '';
        resetOutputScroll();
        updateHint();
    };

    let touchStartX = 0;
    let touchStartY = 0;
    let touchPointerId = null;
    let suppressSuggestionTap = false;

    const buildSuggestionList = (items, selectedIndex = 0) => {
        const list = document.createElement('span');
        list.className = 'terminal-suggestion-list';

        items.forEach((item, index) => {
            const span = document.createElement('span');
            span.className = 'terminal-suggestion' + (index === selectedIndex ? ' selected' : '');
            span.textContent = item;
            span.addEventListener('click', (event) => {
                event.preventDefault();

                const selectedIndex = suggestions.indexOf(item);
                if (selectedIndex < 0) return;

                if (suggestionMode === 'quiz' && touchUi) {
                    if (selectedIndex !== suggestionIndex) {
                        suggestionIndex = selectedIndex;
                        renderSuggestions();
                        return;
                    }

                    acceptSuggestion();
                    return;
                }

                suggestionIndex = selectedIndex;

                if (suggestionMode === 'theme' && touchUi) {
                    input.value = '';
                    resizeInput();
                    setTheme(item);
                    updateHint();
                    return;
                }

                acceptSuggestion();
            });
            list.appendChild(span);

            if (
                index < items.length - 1
                && !(touchUi && (suggestionMode === 'quiz' || suggestionMode === 'manual'))
            ) {
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

        output.classList.remove('is-manual-page');
        output.replaceChildren();

        if (suggestionPrompt) {
            const prompt = document.createElement('span');
            prompt.className = 'terminal-suggestion-prompt';
            prompt.textContent = suggestionPrompt + ' ';
            output.appendChild(prompt);
        }

        const fixedTouchQuiz = touchUi && suggestionMode === 'quiz';
        const rotated = fixedTouchQuiz ? suggestions : getRotatedSuggestions();
        const visibleSuggestions = suggestionMode === 'theme'
            ? (touchUi ? rotated : rotated.slice(0, 4))
            : rotated;

        const list = buildSuggestionList(
            visibleSuggestions,
            fixedTouchQuiz ? suggestionIndex : 0
        );

        if (suggestionMode === 'manual') {
            list.classList.add('manual-list');
        }

        if (suggestionMode === 'quiz') {
            list.classList.add('quiz-list');
            output.classList.add('is-quiz');
        } else {
            output.classList.remove('is-quiz');
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

        if (touchUi) {
            output.style.left = '';
            output.style.top = '';
            output.style.width = '';
            return;
        }

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
        inputSizer.textContent = input.value || ' ';

        if (touchUi) {
            input.style.width = '';
            requestAnimationFrame(positionOutput);
            return;
        }

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

    const buildFriendsWallpaper = () => {
        if (!friendsWall) return;

        let wallpaper = friendsWall.querySelector('.friends-wallpaper');
        if (!wallpaper) {
            wallpaper = document.createElement('div');
            wallpaper.className = 'friends-wallpaper';
            wallpaper.setAttribute('aria-hidden', 'true');
            friendsWall.prepend(wallpaper);
        }

        const wallRect = friendsWall.getBoundingClientRect();
        const wallWidth = Math.max(1, wallRect.width);
        const wallHeight = Math.max(1, wallRect.height);

        // Oversize one single text plane so rotating it can never expose an
        // empty corner. The content itself is generated from repeated FRIENDS
        // words instead of a tiled background image.
        const diagonal = Math.hypot(wallWidth, wallHeight);
        const planeWidth = Math.ceil(diagonal * 1.55);
        const planeHeight = Math.ceil(diagonal * 1.55);

        wallpaper.style.width = planeWidth + 'px';
        wallpaper.style.height = planeHeight + 'px';

        const styles = getComputedStyle(wallpaper);
        const fontSize = Math.max(12, parseFloat(styles.fontSize) || 38);
        const lineHeight = Math.max(fontSize, parseFloat(styles.lineHeight) || fontSize * 1.28);
        const rowCount = Math.ceil(planeHeight / lineHeight) + 8;

        // Monospace approximation: one FRIENDS + space is ~8 characters.
        // Add plenty of extra words on both sides so staggered rows stay full.
        const charsPerRow = Math.ceil(planeWidth / (fontSize * .62));
        const wordsPerRow = Math.ceil(charsPerRow / 8) + 14;
        const rowText = 'FRIENDS '.repeat(wordsPerRow);

        const fragment = document.createDocumentFragment();
        for (let row = 0; row < rowCount; row += 1) {
            const line = document.createElement('div');
            line.className = 'friends-wallpaper-row';
            line.textContent = rowText;

            // Shift every following line by about five monospace characters.
            // Wrap the offset so it stays a continuous wallpaper.
            const offsetCh = (row * 5) % 20;
            line.style.transform = 'translateX(-' + offsetCh + 'ch)';
            fragment.appendChild(line);
        }

        wallpaper.replaceChildren(fragment);
    };

    const randomizeFriends = () => {
        if (!friendsWall) return;

        const items = [...friendsWall.querySelectorAll('.friend-item')];
        if (!items.length) return;

        const wallRect = friendsWall.getBoundingClientRect();
        const wallWidth = Math.max(1, wallRect.width);
        const wallHeight = Math.max(1, wallRect.height);

        // Never drop a Friend. Start with the loose "sticker wall" look and
        // progressively tighten scale/gaps/tilt until every entry fits.
        const densitySteps = [
            { scale: 1.00, padding: 28, gap: 16, tilt: 40 },
            { scale: 0.92, padding: 22, gap: 12, tilt: 32 },
            { scale: 0.84, padding: 18, gap: 9,  tilt: 25 },
            { scale: 0.76, padding: 14, gap: 7,  tilt: 18 },
            { scale: 0.68, padding: 10, gap: 5,  tilt: 12 },
            { scale: 0.60, padding: 8,  gap: 3,  tilt: 7  },
            { scale: 0.52, padding: 6,  gap: 2,  tilt: 3  }
        ];

        const relativeBox = (rect) => ({
            x: rect.left - wallRect.left,
            y: rect.top - wallRect.top,
            w: rect.width,
            h: rect.height,
        });

        const clearPlacement = () => {
            items.forEach((item) => {
                item.style.left = '0px';
                item.style.top = '0px';
                item.style.transform = 'none';
                item.style.visibility = '';
            });
        };

        const tryDensity = ({ scale, padding, gap, tilt }) => {
            const placed = [];

            const isInsideWall = (box) =>
                box.x >= padding &&
                box.y >= padding &&
                box.x + box.w <= wallWidth - padding &&
                box.y + box.h <= wallHeight - padding;

            const overlapsPlaced = (box) => placed.some((p) =>
                !(box.x + box.w + gap <= p.x ||
                  p.x + p.w + gap <= box.x ||
                  box.y + box.h + gap <= p.y ||
                  p.y + p.h + gap <= box.y)
            );

            const tryPosition = (item, x, y, angle) => {
                item.style.left = x.toFixed(1) + 'px';
                item.style.top = y.toFixed(1) + 'px';
                item.style.transform =
                    'rotate(' + angle.toFixed(1) + 'deg) scale(' + scale.toFixed(3) + ')';

                const box = relativeBox(item.getBoundingClientRect());
                if (!isInsideWall(box) || overlapsPlaced(box)) return null;
                return box;
            };

            for (const item of items) {
                item.style.left = '0px';
                item.style.top = '0px';
                item.style.transform = 'none';
                item.style.visibility = '';

                if (!item.dataset.friendTilt) {
                    const direction = Math.random() < 0.5 ? -1 : 1;
                    const magnitude = 4 + Math.random() * 36;
                    item.dataset.friendTilt = (direction * magnitude).toFixed(1);
                }

                const storedAngle = parseFloat(item.dataset.friendTilt || '0');
                const angle = Math.max(-tilt, Math.min(tilt, storedAngle));

                // Measure unscaled size first; the actual collision box is read
                // after transform, so rotated/scaled logos are validated exactly.
                const baseRect = item.getBoundingClientRect();
                const itemW = Math.min(baseRect.width * scale || 120 * scale, wallWidth * .82);
                const itemH = Math.min(baseRect.height * scale || 60 * scale, wallHeight * .36);
                const maxLeft = Math.max(padding, wallWidth - itemW - padding);
                const maxTop = Math.max(padding, wallHeight - itemH - padding);

                let accepted = null;

                for (let attempt = 0; attempt < 220 && !accepted; attempt += 1) {
                    const x = padding + Math.random() * Math.max(0, maxLeft - padding);
                    const y = padding + Math.random() * Math.max(0, maxTop - padding);
                    accepted = tryPosition(item, x, y, angle);
                }

                if (!accepted) {
                    const step = Math.max(5, Math.round(12 * scale));
                    for (let y = padding; y <= maxTop && !accepted; y += step) {
                        for (let x = padding; x <= maxLeft && !accepted; x += step) {
                            accepted = tryPosition(item, x, y, angle);
                        }
                    }
                }

                if (!accepted) return false;
                placed.push(accepted);
            }

            return true;
        };

        clearPlacement();

        for (const density of densitySteps) {
            clearPlacement();
            if (tryDensity(density)) return;
        }

        // Guaranteed final fallback for very crowded boards: arrange every Friend
        // in an adaptive grid. This sacrifices some randomness, never visibility.
        clearPlacement();

        const count = items.length;
        const aspect = wallWidth / wallHeight;
        const columns = Math.max(1, Math.ceil(Math.sqrt(count * aspect)));
        const rows = Math.max(1, Math.ceil(count / columns));
        const cellWidth = wallWidth / columns;
        const cellHeight = wallHeight / rows;

        items.forEach((item, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);

            item.style.left = '0px';
            item.style.top = '0px';
            item.style.transform = 'none';
            item.style.visibility = '';

            const baseRect = item.getBoundingClientRect();
            const fitX = Math.max(.28, (cellWidth * .78) / Math.max(1, baseRect.width));
            const fitY = Math.max(.28, (cellHeight * .72) / Math.max(1, baseRect.height));
            const scale = Math.min(1, fitX, fitY);
            const angleLimit = count <= 12 ? 7 : 3;
            const storedAngle = parseFloat(item.dataset.friendTilt || '0');
            const angle = Math.max(-angleLimit, Math.min(angleLimit, storedAngle));

            const x = col * cellWidth + cellWidth / 2;
            const y = row * cellHeight + cellHeight / 2;

            item.style.left = x.toFixed(1) + 'px';
            item.style.top = y.toFixed(1) + 'px';
            item.style.transformOrigin = 'center center';
            item.style.transform =
                'translate(-50%, -50%) rotate(' + angle.toFixed(1) +
                'deg) scale(' + scale.toFixed(3) + ')';
        });
    };

    const setFriendsOpen = (open) => {
        document.documentElement.classList.toggle('friends-open', open);

        if (friendsToggle) {
            friendsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            friendsToggle.textContent = open ? '< FRIENDS' : 'FRIENDS >';
        }

        if (friendsPanel) {
            friendsPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
        }

        if (open) {
            window.requestAnimationFrame(() => {
                buildFriendsWallpaper();
                randomizeFriends();
                window.requestAnimationFrame(randomizeFriends);
            });
        }
    };

    const FRIENDS_HISTORY_KEY = 'tech3ventzFriends';

    const toggleFriends = () => {
        const isOpen = document.documentElement.classList.contains('friends-open');

        if (isOpen) {
            // Closing via the button should consume the history entry we added
            // when opening, so browser Back keeps its natural meaning.
            if (history.state?.[FRIENDS_HISTORY_KEY]) {
                history.back();
            } else {
                setFriendsOpen(false);
            }
            return;
        }

        history.pushState(
            { ...(history.state || {}), [FRIENDS_HISTORY_KEY]: true },
            '',
            window.location.href
        );
        setFriendsOpen(true);
    };

    friendsToggle?.addEventListener('click', (event) => {
        event.preventDefault();
        toggleFriends();
    });

    window.addEventListener('popstate', () => {
        if (document.documentElement.classList.contains('friends-open')) {
            setFriendsOpen(false);
        }
    });

    window.addEventListener('resize', () => {
        if (document.documentElement.classList.contains('friends-open')) {
            window.requestAnimationFrame(() => {
                buildFriendsWallpaper();
                randomizeFriends();
            });
        }
    });

    const setTheme = (name) => {
        const theme = (name || '').toLowerCase();

        if (!themes.includes(theme)) {
            say('themes: ' + themes.join(' · '));
            return;
        }

        root.dataset.theme = theme;
        localStorage.setItem('3ventz-theme', theme);
        updateThemeIndicator(theme);
        if (document.documentElement.classList.contains('friends-open')) {
            window.requestAnimationFrame(buildFriendsWallpaper);
        }
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
        suggestionPrompt = question.question;
        renderSuggestions();
    };

    const handleQuizAnswer = (selected) => {
        const question = quizQuestions[quizIndex];
        if (!question) return;

        if (selected !== question.answers[question.correct]) {
            quizIndex = -1;
            say('ACCESS SENIED // wrong answer // nice try :D');
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
        say('ACCESS // PLANET HACKED // attack UNLOCKED');
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
        }, 5200);
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
            sayManual(name, manualPages[name]);
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

        // Mobile has no Tab key: tapping just behind "theme" performs both
        // desktop Tab steps and opens the theme picker immediately.
        if (touchUi && trimmed.trimEnd().toLowerCase() === 'theme') {
            input.value = 'theme ';
            suggestions = [...themes];
            suggestionIndex = 0;
            suggestionLead = 'theme ';
            suggestionMode = 'theme';
            resizeInput();
            renderSuggestions();
            return;
        }

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

    let inputTouchStartX = 0;
    let inputTouchStartY = 0;

    input.addEventListener('pointerdown', (event) => {
        if (!touchUi || event.pointerType === 'mouse') return;
        inputTouchStartX = event.clientX;
        inputTouchStartY = event.clientY;
    });

    input.addEventListener('pointerup', (event) => {
        if (!touchUi || event.pointerType === 'mouse' || !input.value) return;

        const dx = event.clientX - inputTouchStartX;
        const dy = event.clientY - inputTouchStartY;
        if (Math.hypot(dx, dy) > 12) return;

        const rect = input.getBoundingClientRect();
        const previousSizerText = inputSizer.textContent;
        inputSizer.textContent = input.value.trimEnd() || ' ';
        const visibleTextWidth = Math.ceil(inputSizer.getBoundingClientRect().width);
        inputSizer.textContent = previousSizerText;

        const tapX = event.clientX - rect.left + input.scrollLeft;

        // Only the visible glyphs count. A tap behind unfinished text completes it.
        // If the command is already complete, the next tap acts like Enter.
        if (tapX <= visibleTextWidth + 2) return;

        const completedCommand = input.value.trim().toLowerCase();

        if (commands.includes(completedCommand)) {
            runTouchEnter();
            return;
        }

        complete();

        window.requestAnimationFrame(() => {
            const end = input.value.length;
            input.setSelectionRange(end, end);

            if (!suggestions.length) {
                input.focus({ preventScroll: true });
            }
        });
    });

    let touchEnterLocked = false;

    const runTouchEnter = () => {
        if (touchEnterLocked) return;
        touchEnterLocked = true;

        window.setTimeout(() => {
            touchEnterLocked = false;
        }, 80);

        if (suggestions.length) {
            acceptSuggestion();
        } else {
            form.requestSubmit();
        }
    };

    input.addEventListener('beforeinput', (event) => {
        if (!touchUi) return;
        if (event.inputType !== 'insertLineBreak' && event.inputType !== 'insertParagraph') return;

        event.preventDefault();
        runTouchEnter();
    });

    input.addEventListener('keydown', (event) => {
        if (touchUi && (event.key === 'Enter' || event.keyCode === 13)) {
            event.preventDefault();
            runTouchEnter();
            return;
        }

        if (event.isComposing) return;

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
        if (!touchUi) window.requestAnimationFrame(focusTerminalInput);
    });

    // Fallback for browsers that leave focus on a clicked button/link:
    // printable keys and Enter are redirected to the CLI immediately.
    document.addEventListener('keydown', (event) => {
        if (touchUi) return;
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

    window.addEventListener('pageshow', () => {
        if (!touchUi) focusTerminalInput();
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
            case 'friends':
                if (arg) {
                    say('usage: friends');
                } else {
                    toggleFriends();
                    say(document.documentElement.classList.contains('friends-open') ? 'FRIENDS // OPEN' : 'FRIENDS // CLOSED');
                }
                break;
            case 'theme':
                if (touchUi && !arg) {
                    suggestions = [...themes];
                    suggestionIndex = 0;
                    suggestionLead = 'theme ';
                    suggestionMode = 'theme';
                    renderSuggestions();
                } else {
                    setTheme(arg);
                }
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

        if (touchUi && suggestions.length) {
            input.blur();
        } else {
            input.focus();
        }
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
            markCurrentDay();
            if (!touchUi) focusTerminalInput();
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
        const location = marker.dataset.eventLocation || '';
        const description = marker.dataset.eventDescription || '';
        const hasUrl = Boolean(marker.dataset.eventUrl);
        const eventColor = getComputedStyle(marker).getPropertyValue('--event-color').trim();

        eventTooltip.style.setProperty('--event-tooltip-color', eventColor || 'var(--cyan)');
        eventTooltip.replaceChildren();

        const heading = document.createElement('div');
        heading.className = 'event-tooltip-title';
        heading.textContent = title;
        eventTooltip.appendChild(heading);

        const meta = document.createElement('div');
        meta.className = 'event-tooltip-meta';
        meta.textContent = [date, category, location].filter(Boolean).join(' // ');
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
            action.textContent = touchUi ? 'tap again // open website' : 'click // open website';
            eventTooltip.appendChild(action);
        }

        eventTooltip.hidden = false;
        requestAnimationFrame(() => positionEventTooltip(marker));
    };

    let activeTouchEventMarker = null;

    const hideEventTooltip = () => {
        eventTooltip.hidden = true;
        if (touchUi) activeTouchEventMarker = null;
    };

    document.querySelectorAll('.event-span').forEach((marker) => {
        if (!touchUi) {
            marker.addEventListener('mouseenter', () => showEventTooltip(marker));
            marker.addEventListener('mouseleave', hideEventTooltip);
        }

        marker.addEventListener('focus', () => showEventTooltip(marker));
        marker.addEventListener('blur', hideEventTooltip);

        marker.addEventListener('click', (event) => {
            const officialUrl = marker.dataset.eventUrl || '';

            if (!touchUi) {
                if (officialUrl) {
                    event.preventDefault();
                    window.open(officialUrl, '_blank', 'noopener');
                }
                return;
            }

            const isSecondTap = activeTouchEventMarker === marker && !eventTooltip.hidden;

            if (!isSecondTap) {
                event.preventDefault();
                activeTouchEventMarker = marker;
                showEventTooltip(marker);
                return;
            }

            if (officialUrl) {
                event.preventDefault();
                window.open(officialUrl, '_blank', 'noopener');
            }
        });
    });

    document.addEventListener('pointerdown', (event) => {
        if (!touchUi || !activeTouchEventMarker) return;
        if (event.target.closest('.event-span')) return;
        hideEventTooltip();
    });

    document.querySelector('.brand-terminal')?.addEventListener('click', (event) => {
        if (event.target === input || event.target.closest('.terminal-output')) return;

        focusTerminalInput();

        if (touchUi) {
            const end = input.value.length;
            window.requestAnimationFrame(() => input.setSelectionRange(end, end));
        }
    });

    const markCurrentDay = () => {
        const now = new Date();
        const calendarYear = Number(window.THREEVENTZ?.year || 0);

        document.querySelectorAll('.day.is-today').forEach((day) => {
            day.classList.remove('is-today', 'is-today-on-event');
            day.querySelector('.number[aria-current="date"]')?.removeAttribute('aria-current');
        });
        document.querySelectorAll('.event-span.is-today-event').forEach((marker) => {
            marker.classList.remove('is-today-event');
        });

        if (calendarYear !== now.getFullYear()) return;

        const months = document.querySelectorAll('.month');
        const month = months[now.getMonth()];
        if (!month) return;

        const number = month.querySelector(`.number[data-day="${now.getDate()}"]`);
        const day = number?.closest('.day');
        if (!day || !number) return;

        const today = now.getDate();
        const weekRow = day.closest('.week-row');
        const matchingEvents = weekRow
            ? [...weekRow.querySelectorAll('.event-span')].filter((marker) => {
                const start = Number(marker.dataset.segmentStartDay || 0);
                const end = Number(marker.dataset.segmentEndDay || 0);
                return start <= today && today <= end;
            })
            : [];

        matchingEvents.forEach((marker) => marker.classList.add('is-today-event'));
        const hasVisibleEvent = matchingEvents.some((marker) => !marker.classList.contains('category-filtered-out'));

        day.classList.add('is-today');
        day.classList.toggle('is-today-on-event', hasVisibleEvent);
        number.setAttribute('aria-current', 'date');
        day.setAttribute('title', 'Heute');
    };

    window.setInterval(markCurrentDay, 60000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) markCurrentDay();
    });

    restoreCategoryFilters();
    applyCategoryFilters();
    markCurrentDay();
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

        if (!touchUi) {
            input.focus({ preventScroll: true });
        }
    });
})();
