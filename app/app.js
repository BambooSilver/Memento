(function () {
    var STORAGE_KEY = 'mementoSettings';
    var GLOBAL_LIFE_EXPECTANCY = 71.4;
    var YEAR_MS = 31556900000;
    var DEFAULT_TEXT = {
        ageLabel: 'Age',
        countdownPrefix: 'that\'ll leave you with ≈',
        countdownSuffix: 'if you\'re lucky'
    };

    var DEFAULT_TEXT_STYLES = {
        ageLabel: {
            size: 1.2,
            textColor: '#b0b5b9',
            borderColor: '#000000'
        },
        countdownPrefix: {
            size: 1,
            textColor: '#b0b5b9',
            borderColor: '#000000'
        },
        countdownValue: {
            size: 0.75,
            textColor: '#880808',
            borderColor: '#000000'
        },
        countdownSuffix: {
            size: 0.5,
            textColor: '#1e1e1e',
            borderColor: '#000000'
        }
    };

    var state = {
        settings: loadSettings(),
        setupStep: 0,
        setupDraft: {},
        interval: null,
        editingShortcutId: null,
        iconCatalog: [],
        iconPickerTarget: null,
        counterResetTarget: null,
        iconSearch: '',
        iconDraft: null,
        resetArmed: false,
        drag: null
    };

    var app = document.getElementById('app');
    var modalRoot = document.getElementById('modalRoot');
    var settingsButton = document.getElementById('settingsButton');
    var favicon = document.getElementById('page-favicon');
    var customFontStyle = document.createElement('style');
    customFontStyle.id = 'custom-dashboard-font';
    document.head.appendChild(customFontStyle);

    function loadSettings() {
        try {
            var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (saved && saved.dob && saved.lifeExpectancy) {
                return {
                    dob: saved.dob,
                    lifeExpectancy: Number(saved.lifeExpectancy),
                    title: saved.title || 'Memento',
                    icon: saved.icon || '',
                    text: normalizeTextSettings(saved.text),
                    customFont: normalizeCustomFont(saved.customFont),
                    shortcuts: Array.isArray(saved.shortcuts) ? saved.shortcuts.map(normalizeShortcut) : []
                };
            }
        } catch (error) {
            console.warn('Could not load Memento settings.', error);
        }

        return null;
    }

    function normalizeShortcut(shortcut) {
        return {
            id: shortcut.id || createId(),
            name: shortcut.name || '',
            url: shortcut.url || '',
            clicks: Number(shortcut.clicks || 0),
            iconClass: shortcut.iconClass || '',
            customIcon: shortcut.customIcon || '',
            color: shortcut.color || '#353d3f',
            countClicks: shortcut.countClicks !== false
        };
    }

    function normalizeTextSettings(text) {
        text = text || {};
        return {
            ageLabel: text.ageLabel || DEFAULT_TEXT.ageLabel,
            countdownPrefix: text.countdownPrefix || DEFAULT_TEXT.countdownPrefix,
            countdownSuffix: text.countdownSuffix || DEFAULT_TEXT.countdownSuffix,
            styles: normalizeTextStyles(text.styles)
        };
    }

    function normalizeTextStyles(styles) {
        styles = styles || {};
        return {
            ageLabel: normalizeTextStyle(styles.ageLabel, DEFAULT_TEXT_STYLES.ageLabel),
            countdownPrefix: normalizeTextStyle(styles.countdownPrefix, DEFAULT_TEXT_STYLES.countdownPrefix),
            countdownValue: normalizeTextStyle(styles.countdownValue, DEFAULT_TEXT_STYLES.countdownValue),
            countdownSuffix: normalizeTextStyle(styles.countdownSuffix, DEFAULT_TEXT_STYLES.countdownSuffix)
        };
    }

    function normalizeTextStyle(style, defaults) {
        style = style || {};
        return {
            size: clampNumber(style.size, 0.4, 8, defaults.size),
            textColor: normalizeHexColor(style.textColor, defaults.textColor),
            borderColor: normalizeHexColor(style.borderColor, defaults.borderColor)
        };
    }

    function clampNumber(value, min, max, fallback) {
        var number = Number(value);
        if (!isFinite(number)) return fallback;
        return Math.min(max, Math.max(min, number));
    }

    function normalizeHexColor(value, fallback) {
        var color = String(value || '').trim();
        return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
    }

    function renderTextStyle(style, fallback) {
        var normalized = normalizeTextStyle(style, fallback);
        var borderColor = escapeHtml(normalized.borderColor);
        return 'font-size:' + normalized.size + 'rem;color:' + escapeHtml(normalized.textColor) + ';-webkit-text-stroke-color:' + borderColor + ';text-shadow:-0.03em 0 ' + borderColor + ',0.03em 0 ' + borderColor + ',0 -0.03em ' + borderColor + ',0 0.03em ' + borderColor + ';';
    }

    function normalizeCustomFont(font) {
        if (!font || !font.data || !font.name) return null;
        return {
            name: font.name,
            data: font.data
        };
    }

    function saveSettings(settings) {
        state.settings = settings;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        applyPageIdentity();
    }

    function applyPageIdentity() {
        var title = state.settings && state.settings.title ? state.settings.title : 'Memento';
        document.title = title;

        if (favicon && state.settings && state.settings.icon) {
            favicon.href = state.settings.icon;
        }

        applyCustomFont();
    }

    function applyCustomFont() {
        if (!state.settings || !state.settings.customFont) {
            customFontStyle.textContent = '';
            document.documentElement.style.setProperty('--dashboard-font', 'Lato, Avenir, "helvetica neue", helvetica, arial, sans-serif');
            return;
        }

        var fontName = 'MementoUserFont';
        customFontStyle.textContent = '@font-face { font-family: "' + fontName + '"; src: url("' + state.settings.customFont.data + '"); }';
        document.documentElement.style.setProperty('--dashboard-font', '"' + fontName + '", Lato, Avenir, "helvetica neue", helvetica, arial, sans-serif');
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeUrl(url) {
        var trimmed = String(url || '').trim();
        if (!trimmed) return '';
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return 'https://' + trimmed;
    }

    function createId() {
        return String(Date.now()) + String(Math.floor(Math.random() * 10000));
    }

    function readIconFile(file, callback) {
        if (!file) {
            callback('');
            return;
        }

        if (!file.type || file.type.indexOf('image/') !== 0) {
            callback('');
            return;
        }

        var reader = new FileReader();
        reader.onload = function () {
            callback(reader.result);
        };
        reader.readAsDataURL(file);
    }

    function readFontFile(file, callback) {
        if (!file) {
            callback(null);
            return;
        }

        var lowerName = file.name.toLowerCase();
        var validExtension = /\.(woff2?|ttf|otf)$/.test(lowerName);
        if (!validExtension) {
            callback(null);
            return;
        }

        var reader = new FileReader();
        reader.onload = function () {
            callback({
                name: file.name.replace(/\.(woff2?|ttf|otf)$/i, ''),
                data: reader.result
            });
        };
        reader.readAsDataURL(file);
    }

    function stopLoop() {
        if (state.interval) {
            clearInterval(state.interval);
            state.interval = null;
        }
    }

    function startLoop() {
        stopLoop();
        document.body.classList.remove('settings-open');
        settingsButton.hidden = false;
        renderDashboard();
        state.interval = setInterval(updateDashboardTime, 100);
    }

    function setApp(html) {
        app.innerHTML = html;
    }

    function clearModal() {
        state.iconPickerTarget = null;
        state.counterResetTarget = null;
        state.iconSearch = '';
        state.iconDraft = null;
        modalRoot.innerHTML = '';
    }

    function render() {
        applyPageIdentity();

        if (state.settings) {
            settingsButton.hidden = false;
            startLoop();
        } else {
            settingsButton.hidden = true;
            stopLoop();
            renderSetup();
        }
    }

    function renderSetup() {
        var step = state.setupStep;
        var draft = state.setupDraft;
        var html = '';

        if (step === 0) {
            html = [
                '<section class="setup-panel">',
                '<p class="setup-kicker">Set up</p>',
                '<h1 class="setup-title">When were you born?</h1>',
                '<form id="birthdayForm" class="setup-form">',
                '<label class="field-label" for="dobInput">Birthday</label>',
                '<input id="dobInput" name="dob" type="date" value="' + escapeHtml(draft.dob || '') + '" required>',
                '<button class="primary-button" type="submit">Continue</button>',
                '</form>',
                '</section>'
            ].join('');
        }

        if (step === 1) {
            html = [
                '<section class="setup-panel">',
                '<p class="setup-kicker">Set up</p>',
                '<h1 class="setup-title">Life expectancy</h1>',
                '<form id="lifeForm" class="setup-form">',
                '<label class="field-label" for="lifeInput">Years</label>',
                '<input id="lifeInput" name="lifeExpectancy" type="number" min="1" max="130" step="0.1" value="' + escapeHtml(draft.lifeExpectancy || GLOBAL_LIFE_EXPECTANCY) + '" required>',
                '<p class="field-info">Default value is the average global life expectancy, currently 71.4 years.</p>',
                '<div class="form-actions">',
                '<button class="ghost-button" type="button" data-action="back">Back</button>',
                '<button class="primary-button" type="submit">Continue</button>',
                '</div>',
                '</form>',
                '</section>'
            ].join('');
        }

        if (step === 2) {
            html = [
                '<section class="setup-panel">',
                '<p class="setup-kicker">Set up</p>',
                '<h1 class="setup-title">Title and icon</h1>',
                '<form id="identityForm" class="setup-form">',
                '<label class="field-label" for="titleInput">New tab title</label>',
                '<input id="titleInput" name="title" type="text" maxlength="80" value="' + escapeHtml(draft.title || 'Memento') + '" required>',
                '<label class="field-label" for="iconInput">New tab icon</label>',
                '<input id="iconInput" name="icon" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon">',
                '<p class="field-info">For the cleanest display, use PNG, SVG, WebP, JPG, or ICO. Square icons at 16, 32, 48, or 128 px work best.</p>',
                '<div class="form-actions">',
                '<button class="ghost-button" type="button" data-action="back">Back</button>',
                '<button class="primary-button" type="submit">Continue</button>',
                '</div>',
                '</form>',
                '</section>'
            ].join('');
        }

        if (step === 3) {
            html = [
                '<section class="setup-panel setup-panel-wide">',
                '<p class="setup-kicker">Set up</p>',
                '<h1 class="setup-title">Add shortcuts?</h1>',
                '<p class="field-info setup-copy">Shortcuts are optional. If you skip them, this page stays empty apart from the countdown.</p>',
                '<div id="shortcutDrafts" class="shortcut-drafts"></div>',
                '<div class="form-actions">',
                '<button class="ghost-button" type="button" data-action="back">Back</button>',
                '<button class="ghost-button" type="button" data-action="skipShortcuts">No</button>',
                '<button class="primary-button" type="button" data-action="addShortcut">Add shortcut</button>',
                '<button class="primary-button" type="button" data-action="finishSetup">Finish</button>',
                '</div>',
                '</section>'
            ].join('');
        }

        setApp(html);

        if (step === 3) {
            renderShortcutDrafts();
        }
    }

    function renderShortcutDrafts() {
        var container = document.getElementById('shortcutDrafts');
        if (!container) return;

        var shortcuts = state.setupDraft.shortcuts || [];
        if (!shortcuts.length) {
            container.innerHTML = '<p class="empty-note">No shortcuts added.</p>';
            return;
        }

        container.innerHTML = renderCounterBulkControls('setup') + shortcuts.map(function (shortcut) {
            return [
                '<div class="shortcut-row" data-id="' + escapeHtml(shortcut.id) + '">',
                renderShortcutDragHandle(),
                '<input type="text" data-field="name" placeholder="Name" value="' + escapeHtml(shortcut.name) + '">',
                '<input type="url" data-field="url" placeholder="https://example.com" value="' + escapeHtml(shortcut.url) + '">',
                renderShortcutIconButton(shortcut),
                renderShortcutCounterToggle(shortcut),
                '<button class="icon-button" type="button" data-action="removeShortcut" title="Remove shortcut" aria-label="Remove shortcut">',
                '<i class="fa-solid fa-xmark"></i>',
                '</button>',
                '</div>'
            ].join('');
        }).join('');
    }

    function buildSettings(skipShortcuts) {
        var shortcuts = skipShortcuts ? [] : (state.setupDraft.shortcuts || [])
            .map(function (shortcut) {
                    return {
                        id: shortcut.id,
                        name: String(shortcut.name || '').trim(),
                        url: normalizeUrl(shortcut.url),
                        clicks: 0,
                        iconClass: shortcut.iconClass || '',
                        customIcon: shortcut.customIcon || '',
                        color: shortcut.color || '#353d3f',
                        countClicks: shortcut.countClicks !== false
                    };
            })
            .filter(function (shortcut) {
                return shortcut.name && shortcut.url;
            });

        return {
            dob: state.setupDraft.dob,
            lifeExpectancy: Number(state.setupDraft.lifeExpectancy || GLOBAL_LIFE_EXPECTANCY),
            title: state.setupDraft.title || 'Memento',
            icon: state.setupDraft.icon || '',
            text: normalizeTextSettings(state.setupDraft.text),
            customFont: null,
            shortcuts: shortcuts
        };
    }

    function renderDashboard() {
        if (!state.settings) return;

        var shortcutsHtml = renderShortcuts(state.settings.shortcuts || []);
        var text = normalizeTextSettings(state.settings.text);
        var styles = text.styles;

        setApp([
            shortcutsHtml,
            '<section class="countdown-shell">',
            '<h1 class="age-label styled-dashboard-text" style="' + renderTextStyle(styles.ageLabel, DEFAULT_TEXT_STYLES.ageLabel) + '">' + escapeHtml(text.ageLabel) + '</h1>',
            '<h2 class="count"><span id="yearValue"></span><sup>.<span id="millisecondsValue"></span></sup></h2>',
            '<div class="countdownDiv">',
            '<div class="countdownText styled-dashboard-text" style="' + renderTextStyle(styles.countdownPrefix, DEFAULT_TEXT_STYLES.countdownPrefix) + '">' + escapeHtml(text.countdownPrefix) + '</div>',
            '<h2 id="remainingValue" class="countdown styled-dashboard-text" style="' + renderTextStyle(styles.countdownValue, DEFAULT_TEXT_STYLES.countdownValue) + '"></h2>',
            '<div class="orLess styled-dashboard-text" style="' + renderTextStyle(styles.countdownSuffix, DEFAULT_TEXT_STYLES.countdownSuffix) + '">' + escapeHtml(text.countdownSuffix) + '</div>',
            '</div>',
            '</section>'
        ].join(''));

        updateDashboardTime();
    }
    function updateDashboardTime() {
        if (!state.settings) return;

        var dob = parseBirthday(state.settings.dob);
        var now = new Date();
        var years = (now - dob) / YEAR_MS;
        var ageParts = Math.max(0, years).toFixed(9).split('.');
        var remaining = (Number(state.settings.lifeExpectancy) - years).toFixed(9);

        var yearValue = document.getElementById('yearValue');
        var millisecondsValue = document.getElementById('millisecondsValue');
        var remainingValue = document.getElementById('remainingValue');

        if (yearValue) yearValue.textContent = ageParts[0];
        if (millisecondsValue) millisecondsValue.textContent = ageParts[1];
        if (remainingValue) remainingValue.textContent = remaining;
    }

    function parseBirthday(value) {
        var parts = String(value).split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function renderShortcuts(shortcuts) {
        if (!shortcuts.length) return '<div class="shortcut-space" aria-hidden="true"></div>';

        return [
            '<nav class="shortcut-ribbon" aria-label="Shortcuts">',
            shortcuts.map(function (shortcut) {
                var initial = escapeHtml(shortcut.name.charAt(0).toUpperCase());
                var color = escapeHtml(shortcut.color || '#353d3f');
                var icon = shortcut.customIcon
                    ? '<img class="shortcut-custom-icon" src="' + escapeHtml(shortcut.customIcon) + '" alt="">'
                    : shortcut.iconClass
                    ? '<i class="' + escapeHtml(shortcut.iconClass) + ' shortcut-fa" aria-hidden="true"></i>'
                    : '<span class="shortcut-initial">' + initial + '</span>';
                return [
                    '<div class="shortcut-tile" data-id="' + escapeHtml(shortcut.id) + '">',
                    '<a href="' + escapeHtml(shortcut.url) + '" target="_self" title="' + escapeHtml(shortcut.name) + '" data-shortcut-link="true" style="color:' + color + '">',
                    icon,
                    '</a>',
                    shortcut.countClicks !== false ? '<span class="click-counter">' + Number(shortcut.clicks || 0) + '</span>' : '',
                    '</div>'
                ].join('');
            }).join(''),
            '</nav>'
        ].join('');
    }

    function renderSettings() {
        stopLoop();
        document.body.classList.add('settings-open');
        settingsButton.hidden = true;

        var settings = state.settings;
        var shortcuts = settings.shortcuts || [];
        var text = normalizeTextSettings(settings.text);
        var styles = text.styles;

        setApp([
            '<section class="settings-panel">',
            '<div class="settings-header">',
            '<div>',
            '<p class="setup-kicker">Settings</p>',
            '<h1 class="setup-title">Personalization</h1>',
            '</div>',
            '<button class="icon-button" type="button" data-action="closeSettings" title="Close settings" aria-label="Close settings">',
            '<i class="fa-solid fa-xmark"></i>',
            '</button>',
            '</div>',
            '<form id="settingsForm" class="setup-form settings-grid">',
            '<label class="field-label" for="settingsDob">Birthday</label>',
            '<input id="settingsDob" name="dob" type="date" value="' + escapeHtml(settings.dob) + '" required>',
            '<label class="field-label" for="settingsLife">Life expectancy</label>',
            '<input id="settingsLife" name="lifeExpectancy" type="number" min="1" max="130" step="0.1" value="' + escapeHtml(settings.lifeExpectancy) + '" required>',
            '<label class="field-label" for="settingsTitle">New tab title</label>',
            '<input id="settingsTitle" name="title" type="text" maxlength="80" value="' + escapeHtml(settings.title) + '" required>',
            '<label class="field-label" for="settingsIcon">New tab icon</label>',
            '<input id="settingsIcon" name="icon" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon">',
            '<p class="field-info">Leave the icon empty to keep the current one.</p>',
            '<div class="settings-section">',
            '<h2>Main screen text</h2>',
            renderTextSettingControl('settingsAgeLabel', 'ageLabel', 'Age label', text.ageLabel, 80, styles.ageLabel),
            renderTextSettingControl('settingsCountdownPrefix', 'countdownPrefix', 'Countdown lead-in', text.countdownPrefix, 120, styles.countdownPrefix),
            renderTextSettingControl('settingsCountdownValue', 'countdownValue', 'Countdown number', '', 0, styles.countdownValue),
            renderTextSettingControl('settingsCountdownSuffix', 'countdownSuffix', 'Countdown footer', text.countdownSuffix, 120, styles.countdownSuffix),
            '</div>',
            '<div class="settings-section">',
            '<h2>Main screen font</h2>',
            '<input id="settingsFont" name="dashboardFont" type="file" accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf">',
            '<p class="field-info">Settings stay in Lato for readability. Uploaded WOFF, WOFF2, TTF, or OTF fonts apply to the main countdown screen.</p>',
            '</div>',
            '<div class="settings-shortcuts">',
            '<div class="settings-subhead">',
            '<h2>Shortcuts</h2>',
            '<button class="ghost-button" type="button" data-action="addSettingsShortcut">Add</button>',
            '</div>',
            '<div id="settingsShortcuts" class="shortcut-drafts">' + renderSettingsShortcutRows(shortcuts) + '</div>',
            '</div>',
            '<div class="settings-action-bar">',
            '<div class="danger-zone">',
            renderResetTrigger(),
            '</div>',
            '<div class="form-actions sticky-actions">',
            '<button class="primary-button" type="submit">Save</button>',
            '<button class="ghost-button" type="button" data-action="closeSettings">Cancel</button>',
            '</div>',
            '</div>',
            '</form>',
            '</section>'
        ].join(''));
    }

    function renderResetTrigger() {
        return state.resetArmed
            ? '<button class="danger-button active text-danger-button toolbar-danger-button" type="button" data-action="openResetConfirm">Reset settings</button>'
            : '<button class="danger-button" type="button" data-action="revealReset" aria-label="Warning" title="Warning"><i class="fa-solid fa-triangle-exclamation"></i></button>';
    }

    function disarmResetTrigger() {
        state.resetArmed = false;
        var dangerZone = document.querySelector('.danger-zone');
        if (dangerZone) dangerZone.innerHTML = renderResetTrigger();
    }

    function renderTextSettingControl(id, name, label, value, maxLength, style) {
        var normalized = normalizeTextStyle(style, DEFAULT_TEXT_STYLES[name]);
        var textInput = maxLength > 0
            ? [
                '<label class="field-label" for="' + id + '">' + label + '</label>',
                '<input id="' + id + '" name="' + name + '" type="text" maxlength="' + maxLength + '" value="' + escapeHtml(value) + '" required>'
            ].join('')
            : '<span class="field-label text-style-only">' + label + '</span>';

        return [
            '<div class="text-setting-row" data-text-control="' + escapeHtml(name) + '">',
            '<div class="text-setting-input">',
            textInput,
            '</div>',
            '<div class="text-style-controls">',
            '<label class="mini-field-label" for="' + id + 'Size">Size</label>',
            '<input id="' + id + 'Size" name="' + name + 'Size" class="text-size-slider" type="range" min="0.4" max="8" step="0.05" value="' + escapeHtml(normalized.size) + '">',
            '<span class="text-size-value">' + escapeHtml(normalized.size.toFixed(2)) + 'rem</span>',
            '<label class="mini-field-label" for="' + id + 'TextColor">Text</label>',
            '<input id="' + id + 'TextColor" name="' + name + 'TextColor" class="color-circle small-color-circle" type="color" value="' + escapeHtml(normalized.textColor) + '">',
            '<label class="mini-field-label" for="' + id + 'BorderColor">Border</label>',
            '<input id="' + id + 'BorderColor" name="' + name + 'BorderColor" class="color-circle small-color-circle" type="color" value="' + escapeHtml(normalized.borderColor) + '">',
            '</div>',
            '</div>'
        ].join('');
    }

    function renderSettingsShortcutRows(shortcuts) {
        if (!shortcuts.length) return '<p class="empty-note">No shortcuts added.</p>';

        return renderCounterBulkControls('settings') + shortcuts.map(function (shortcut) {
            return [
                '<div class="shortcut-row" data-id="' + escapeHtml(shortcut.id) + '">',
                renderShortcutDragHandle(),
                '<input type="text" data-field="name" placeholder="Name" value="' + escapeHtml(shortcut.name) + '">',
                '<input type="url" data-field="url" placeholder="https://example.com" value="' + escapeHtml(shortcut.url) + '">',
                renderShortcutIconButton(shortcut),
                renderShortcutCounterToggle(shortcut),
                '<button class="icon-button reset-counter-button" type="button" data-action="openCounterReset" title="Reset click counter" aria-label="Reset click counter">',
                '<i class="fa-solid fa-rotate-left"></i>',
                '</button>',
                '<button class="icon-button" type="button" data-action="removeSettingsShortcut" title="Remove shortcut" aria-label="Remove shortcut">',
                '<i class="fa-solid fa-xmark"></i>',
                '</button>',
                '</div>'
            ].join('');
        }).join('');
    }

    function renderCounterBulkControls(source) {
        return [
            '<div class="counter-bulk-controls" data-counter-source="' + source + '">',
            '<span>Count clicks</span>',
            '<button class="ghost-button tiny-button" type="button" data-action="countClicksAll">Tick all</button>',
            '<button class="ghost-button tiny-button" type="button" data-action="countClicksNone">Untick all</button>',
            source === 'settings' ? '<button class="ghost-button tiny-button reset-all-counters-button" type="button" data-action="openAllCountersReset">Reset all</button>' : '',
            '</div>'
        ].join('');
    }

    function renderShortcutDragHandle() {
        return [
            '<button class="drag-handle" type="button" aria-label="Drag shortcut" title="Drag shortcut">',
            '<i class="fa-solid fa-grip-vertical" aria-hidden="true"></i>',
            '</button>'
        ].join('');
    }

    function renderShortcutCounterToggle(shortcut) {
        return [
            '<label class="counter-toggle">',
            '<input type="checkbox" data-field="countClicks"' + (shortcut.countClicks !== false ? ' checked' : '') + '>',
            '<span>Count clicks</span>',
            '</label>'
        ].join('');
    }

    function renderShortcutIconButton(shortcut) {
        var icon = shortcut.customIcon
            ? '<img class="shortcut-custom-icon small" src="' + escapeHtml(shortcut.customIcon) + '" alt="">'
            : shortcut.iconClass
            ? '<i class="' + escapeHtml(shortcut.iconClass) + '" style="color:' + escapeHtml(shortcut.color || '#353d3f') + '" aria-hidden="true"></i>'
            : '<i class="fa-solid fa-plus" aria-hidden="true"></i>';
        var label = shortcut.iconClass || shortcut.customIcon ? 'Change icon' : 'Add icon';

        return [
            '<button class="shortcut-icon-picker-button" type="button" data-action="openIconPicker">',
            '<span class="shortcut-icon-preview">' + icon + '</span>',
            '<span>' + label + '</span>',
            '</button>'
        ].join('');
    }

    function loadIconCatalog(callback) {
        if (state.iconCatalog.length) {
            callback();
            return;
        }

        fetch('assets/metadata/fontawesome-icons.json')
            .then(function (response) {
                if (!response.ok) throw new Error('Font Awesome metadata was not found.');
                return response.json();
            })
            .then(function (icons) {
                var catalog = [];
                Object.keys(icons).forEach(function (name) {
                    var icon = icons[name];
                    var styles = icon.free || icon.styles || [];
                    styles.forEach(function (style) {
                        catalog.push({
                            name: name,
                            label: icon.label || name,
                            style: style,
                            className: styleToPrefix(style) + ' fa-' + name,
                            terms: ((icon.search && icon.search.terms) || []).join(' ')
                        });
                    });
                });
                state.iconCatalog = catalog.sort(function (a, b) {
                    return a.label.localeCompare(b.label);
                });
                callback();
            })
            .catch(function (error) {
                modalRoot.innerHTML = [
                    '<div class="modal-backdrop">',
                    '<section class="glass-modal compact-modal">',
                    '<button class="icon-button modal-close" type="button" data-action="closeIconPicker" aria-label="Close icon picker"><i class="fa-solid fa-xmark"></i></button>',
                    '<p class="setup-kicker">Icons</p>',
                    '<h1 class="setup-title">Could not load icons</h1>',
                    '<p class="field-info">' + escapeHtml(error.message) + '</p>',
                    '</section>',
                    '</div>'
                ].join('');
            });
    }

    function styleToPrefix(style) {
        if (style === 'brands') return 'fa-brands';
        if (style === 'regular') return 'fa-regular';
        return 'fa-solid';
    }

    function getShortcutTarget() {
        if (!state.iconPickerTarget) return null;
        var list = state.iconPickerTarget.source === 'settings'
            ? state.settings.shortcuts
            : state.setupDraft.shortcuts;

        return list.find(function (shortcut) {
            return shortcut.id === state.iconPickerTarget.id;
        });
    }

    function openIconPicker(row) {
        var isSettings = !!row.closest('#settingsShortcuts');
        state.iconPickerTarget = {
            source: isSettings ? 'settings' : 'setup',
            id: row.getAttribute('data-id')
        };

        var shortcut = getShortcutTarget();
        state.iconDraft = {
            iconClass: shortcut.iconClass || '',
            customIcon: shortcut.customIcon || '',
            color: shortcut.color || '#353d3f'
        };

        loadIconCatalog(renderIconPicker);
    }

    function renderIconPicker() {
        if (!state.iconPickerTarget) return;

        var selectedIcon = state.iconDraft && state.iconDraft.iconClass;
        var customIcon = state.iconDraft && state.iconDraft.customIcon;
        var selectedColor = state.iconDraft && state.iconDraft.color ? state.iconDraft.color : '#353d3f';
        var filtered = getFilteredIcons();

        modalRoot.innerHTML = [
            '<div class="modal-backdrop">',
            '<section class="glass-modal" role="dialog" aria-modal="true" aria-labelledby="iconPickerTitle">',
            '<div class="modal-header">',
            '<div>',
            '<p class="setup-kicker">Shortcut icon</p>',
            '<h1 id="iconPickerTitle" class="setup-title">Choose an icon</h1>',
            '</div>',
            '<button class="icon-button modal-close" type="button" data-action="closeIconPicker" aria-label="Close icon picker"><i class="fa-solid fa-xmark"></i></button>',
            '</div>',
            '<input id="iconSearchInput" class="icon-search" type="search" placeholder="Search Font Awesome icons" value="' + escapeHtml(state.iconSearch) + '">',
            '<div class="upload-strip">',
            '<label class="upload-icon-button" for="customShortcutIcon"><i class="fa-solid fa-upload"></i><span>Upload icon</span></label>',
            '<input id="customShortcutIcon" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/gif">',
            '<p class="field-info">Optional upload. PNG, SVG, WebP, JPG, GIF, or ICO works best; square 16, 32, 48, or 128 px icons display cleanest.</p>',
            '</div>',
            '<div class="icon-picker-layout">',
            '<div id="iconGrid" class="icon-grid" aria-label="Font Awesome icons">',
            renderIconChoices(filtered.visible),
            '</div>',
            '<aside class="icon-personalizer">',
            customIcon ? [
                '<div class="live-icon-preview">',
                '<img class="shortcut-custom-icon large" src="' + escapeHtml(customIcon) + '" alt="">',
                '</div>',
                '<p class="field-info">Uploaded icons are shown as-is, so color controls are disabled.</p>'
            ].join('') : selectedIcon ? [
                '<div class="live-icon-preview" style="color:' + escapeHtml(selectedColor) + '">',
                '<i class="' + escapeHtml(selectedIcon) + '" aria-hidden="true"></i>',
                '</div>',
                '<label class="field-label" for="shortcutIconColor">Icon color</label>',
                '<input id="shortcutIconColor" class="color-circle" type="color" value="' + escapeHtml(selectedColor) + '">',
                '<p class="field-info">The circle changes the icon color live.</p>'
            ].join('') : '<p class="field-info">Choose an icon to personalize its color.</p>',
            '</aside>',
            '</div>',
            '<div class="modal-footer">',
            '<p id="iconCountText" class="field-info">' + filtered.visible.length + ' of ' + filtered.total + ' icons shown. Search to narrow the list.</p>',
            '<div class="form-actions">',
            '<button class="ghost-button" type="button" data-action="clearShortcutIcon">Clear icon</button>',
            '<button class="primary-button" type="button" data-action="applyShortcutIcon"' + (selectedIcon || customIcon ? '' : ' disabled') + '>Apply</button>',
            '</div>',
            '</div>',
            '</section>',
            '</div>'
        ].join('');
    }

    function getFilteredIcons() {
        var query = state.iconSearch.toLowerCase().trim();
        var icons = state.iconCatalog.filter(function (icon) {
            if (!query) return true;
            return [icon.name, icon.label, icon.style, icon.terms].join(' ').toLowerCase().indexOf(query) !== -1;
        });

        return {
            total: icons.length,
            visible: icons.slice(0, 360)
        };
    }

    function renderIconChoices(icons) {
        var selectedIcon = state.iconDraft && state.iconDraft.iconClass;
        return icons.map(function (icon) {
            var isSelected = icon.className === selectedIcon ? ' selected' : '';
            return [
                '<button class="icon-choice' + isSelected + '" type="button" data-action="selectIcon" data-icon-class="' + escapeHtml(icon.className) + '" title="' + escapeHtml(icon.label) + '">',
                '<i class="' + escapeHtml(icon.className) + '" aria-hidden="true"></i>',
                '<span>' + escapeHtml(icon.label) + '</span>',
                '</button>'
            ].join('');
        }).join('');
    }

    function updateIconResults() {
        var filtered = getFilteredIcons();
        var iconGrid = document.getElementById('iconGrid');
        var countText = document.getElementById('iconCountText');
        if (iconGrid) iconGrid.innerHTML = renderIconChoices(filtered.visible);
        if (countText) countText.textContent = filtered.visible.length + ' of ' + filtered.total + ' icons shown. Search to narrow the list.';
    }

    function updateShortcutFromInput(input, target) {
        var row = input.closest('.shortcut-row');
        if (!row) return;

        var shortcut = target.find(function (item) {
            return item.id === row.getAttribute('data-id');
        });

        if (!shortcut) return;
        if (input.type === 'checkbox') {
            shortcut[input.getAttribute('data-field')] = input.checked;
            return;
        }

        shortcut[input.getAttribute('data-field')] = input.value;
    }

    function finishShortcutDrag() {
        if (!state.drag) return;

        var drag = state.drag;
        drag.row.classList.remove('dragging-shortcut');
        drag.row.style.width = '';
        drag.row.style.left = '';
        drag.row.style.top = '';
        drag.placeholder.parentNode.insertBefore(drag.row, drag.placeholder);
        drag.placeholder.remove();
        document.body.classList.remove('shortcut-drag-active');

        commitShortcutOrder(drag.source, drag.list);
        state.drag = null;
    }

    function commitShortcutOrder(source, list) {
        var ids = Array.prototype.slice.call(list.querySelectorAll('.shortcut-row')).map(function (row) {
            return row.getAttribute('data-id');
        });
        var shortcuts = source === 'settings' ? state.settings.shortcuts : state.setupDraft.shortcuts;
        var byId = {};

        shortcuts.forEach(function (shortcut) {
            byId[shortcut.id] = shortcut;
        });

        var ordered = ids.map(function (id) {
            return byId[id];
        }).filter(Boolean);

        if (source === 'settings') {
            state.settings.shortcuts = ordered;
            document.getElementById('settingsShortcuts').innerHTML = renderSettingsShortcutRows(state.settings.shortcuts);
        } else {
            state.setupDraft.shortcuts = ordered;
            renderShortcutDrafts();
        }
    }

    function renderResetConfirm() {
        modalRoot.innerHTML = [
            '<div class="modal-backdrop">',
            '<section class="glass-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="resetTitle">',
            '<div class="modal-header">',
            '<div>',
            '<p class="setup-kicker danger-kicker">Warning</p>',
            '<h1 id="resetTitle" class="setup-title">Reset all settings?</h1>',
            '</div>',
            '<button class="icon-button modal-close" type="button" data-action="closeResetConfirm" aria-label="Close reset dialog"><i class="fa-solid fa-xmark"></i></button>',
            '</div>',
            '<p class="field-info">This will remove your birthday, life expectancy, title, icons, fonts, shortcuts, and click counts. The extension will return to the first-run setup page.</p>',
            '<div class="form-actions">',
            '<button class="danger-button active" type="button" data-action="confirmResetSettings">Reset settings</button>',
            '<button class="ghost-button" type="button" data-action="closeResetConfirm">Cancel</button>',
            '</div>',
            '</section>',
            '</div>'
        ].join('');
    }

    function renderCounterResetConfirm(row) {
        var shortcutId = row.getAttribute('data-id');
        var shortcut = state.settings.shortcuts.find(function (item) {
            return item.id === shortcutId;
        });

        if (!shortcut) return;
        state.counterResetTarget = shortcutId;

        modalRoot.innerHTML = [
            '<div class="modal-backdrop">',
            '<section class="glass-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="counterResetTitle">',
            '<div class="modal-header">',
            '<div>',
            '<p class="setup-kicker danger-kicker">Warning</p>',
            '<h1 id="counterResetTitle" class="setup-title">Reset this counter?</h1>',
            '</div>',
            '<button class="icon-button modal-close" type="button" data-action="closeCounterReset" aria-label="Close reset counter dialog"><i class="fa-solid fa-xmark"></i></button>',
            '</div>',
            '<p class="field-info">This will reset the click counter for ' + escapeHtml(shortcut.name || 'this shortcut') + ' to 0. This cannot be reverted.</p>',
            '<div class="form-actions">',
            '<button class="danger-button active text-danger-button" type="button" data-action="confirmCounterReset">Reset counter</button>',
            '<button class="ghost-button" type="button" data-action="closeCounterReset">Cancel</button>',
            '</div>',
            '</section>',
            '</div>'
        ].join('');
    }

    function renderAllCountersResetConfirm() {
        state.counterResetTarget = 'all';

        modalRoot.innerHTML = [
            '<div class="modal-backdrop">',
            '<section class="glass-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="allCountersResetTitle">',
            '<div class="modal-header">',
            '<div>',
            '<p class="setup-kicker danger-kicker">Warning</p>',
            '<h1 id="allCountersResetTitle" class="setup-title">Reset all counters?</h1>',
            '</div>',
            '<button class="icon-button modal-close" type="button" data-action="closeCounterReset" aria-label="Close reset counters dialog"><i class="fa-solid fa-xmark"></i></button>',
            '</div>',
            '<p class="field-info">This will reset every shortcut click counter to 0. This cannot be reverted.</p>',
            '<div class="form-actions">',
            '<button class="danger-button active text-danger-button" type="button" data-action="confirmAllCountersReset">Reset all counters</button>',
            '<button class="ghost-button" type="button" data-action="closeCounterReset">Cancel</button>',
            '</div>',
            '</section>',
            '</div>'
        ].join('');
    }

    function createShortcut() {
        return {
            id: String(Date.now()) + String(Math.floor(Math.random() * 10000)),
            name: '',
            url: '',
            clicks: 0,
            iconClass: '',
            customIcon: '',
            color: '#353d3f',
            countClicks: true
        };
    }

    app.addEventListener('submit', function (event) {
        event.preventDefault();

        if (event.target.id === 'birthdayForm') {
            state.setupDraft.dob = event.target.elements.dob.value;
            state.setupStep = 1;
            renderSetup();
        }

        if (event.target.id === 'lifeForm') {
            state.setupDraft.lifeExpectancy = Number(event.target.elements.lifeExpectancy.value || GLOBAL_LIFE_EXPECTANCY);
            state.setupStep = 2;
            renderSetup();
        }

        if (event.target.id === 'identityForm') {
            state.setupDraft.title = event.target.elements.title.value.trim() || 'Memento';
            readIconFile(event.target.elements.icon.files[0], function (icon) {
                state.setupDraft.icon = icon;
                state.setupStep = 3;
                if (!state.setupDraft.shortcuts) state.setupDraft.shortcuts = [];
                renderSetup();
            });
        }

        if (event.target.id === 'settingsForm') {
            var fields = event.target.elements;
            var nextSettings = {
                dob: fields.dob.value,
                lifeExpectancy: Number(fields.lifeExpectancy.value || GLOBAL_LIFE_EXPECTANCY),
                title: fields.title.value.trim() || 'Memento',
                icon: state.settings.icon,
                text: normalizeTextSettings({
                    ageLabel: fields.ageLabel.value.trim(),
                    countdownPrefix: fields.countdownPrefix.value.trim(),
                    countdownSuffix: fields.countdownSuffix.value.trim(),
                    styles: readTextStyleFields(fields)
                }),
                customFont: state.settings.customFont,
                shortcuts: (state.settings.shortcuts || [])
                    .map(function (shortcut) {
                        return {
                            id: shortcut.id,
                            name: String(shortcut.name || '').trim(),
                            url: normalizeUrl(shortcut.url),
                            clicks: Number(shortcut.clicks || 0),
                            iconClass: shortcut.iconClass || '',
                            customIcon: shortcut.customIcon || '',
                            color: shortcut.color || '#353d3f',
                            countClicks: shortcut.countClicks !== false
                        };
                    })
                    .filter(function (shortcut) {
                        return shortcut.name && shortcut.url;
                    })
            };

            readIconFile(fields.icon.files[0], function (icon) {
                if (icon) nextSettings.icon = icon;
                readFontFile(fields.dashboardFont.files[0], function (font) {
                    if (font) nextSettings.customFont = font;
                    state.resetArmed = false;
                    saveSettings(nextSettings);
                    startLoop();
                });
            });
        }
    });

    app.addEventListener('input', function (event) {
        if (event.target.matches('.text-size-slider')) {
            var valueLabel = event.target.parentElement.querySelector('.text-size-value');
            if (valueLabel) valueLabel.textContent = Number(event.target.value).toFixed(2) + 'rem';
        }

        if (!event.target.matches('[data-field]')) return;

        if (state.settings && event.target.closest('#settingsShortcuts')) {
            updateShortcutFromInput(event.target, state.settings.shortcuts);
            return;
        }

        if (state.setupDraft.shortcuts) {
            updateShortcutFromInput(event.target, state.setupDraft.shortcuts);
        }
    });

    function readTextStyleFields(fields) {
        return {
            ageLabel: readTextStyleField(fields, 'ageLabel', DEFAULT_TEXT_STYLES.ageLabel),
            countdownPrefix: readTextStyleField(fields, 'countdownPrefix', DEFAULT_TEXT_STYLES.countdownPrefix),
            countdownValue: readTextStyleField(fields, 'countdownValue', DEFAULT_TEXT_STYLES.countdownValue),
            countdownSuffix: readTextStyleField(fields, 'countdownSuffix', DEFAULT_TEXT_STYLES.countdownSuffix)
        };
    }

    function readTextStyleField(fields, name, defaults) {
        return normalizeTextStyle({
            size: fields[name + 'Size'] ? fields[name + 'Size'].value : defaults.size,
            textColor: fields[name + 'TextColor'] ? fields[name + 'TextColor'].value : defaults.textColor,
            borderColor: fields[name + 'BorderColor'] ? fields[name + 'BorderColor'].value : defaults.borderColor
        }, defaults);
    }

    app.addEventListener('pointerdown', function (event) {
        var handle = event.target.closest('.drag-handle');
        if (!handle) return;

        var row = handle.closest('.shortcut-row');
        var list = row && row.closest('.shortcut-drafts');
        if (!row || !list) return;

        var source = list.id === 'settingsShortcuts' ? 'settings' : 'setup';
        var rect = row.getBoundingClientRect();
        var placeholder = document.createElement('div');
        placeholder.className = 'shortcut-row-placeholder';
        placeholder.style.height = rect.height + 'px';

        state.drag = {
            row: row,
            list: list,
            source: source,
            placeholder: placeholder,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            startId: row.getAttribute('data-id')
        };

        row.parentNode.insertBefore(placeholder, row.nextSibling);
        row.classList.add('dragging-shortcut');
        row.style.width = rect.width + 'px';
        row.style.left = rect.left + 'px';
        row.style.top = rect.top + 'px';
        document.body.classList.add('shortcut-drag-active');
        handle.setPointerCapture && handle.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    document.addEventListener('pointermove', function (event) {
        if (!state.drag) return;

        var drag = state.drag;
        drag.row.style.left = (event.clientX - drag.offsetX) + 'px';
        drag.row.style.top = (event.clientY - drag.offsetY) + 'px';

        var rows = Array.prototype.slice.call(drag.list.querySelectorAll('.shortcut-row:not(.dragging-shortcut)'));
        var beforeRow = rows.find(function (row) {
            var rect = row.getBoundingClientRect();
            return event.clientY < rect.top + rect.height / 2;
        });

        if (beforeRow) {
            drag.list.insertBefore(drag.placeholder, beforeRow);
        } else {
            drag.list.appendChild(drag.placeholder);
        }

        event.preventDefault();
    });

    document.addEventListener('pointerup', finishShortcutDrag);
    document.addEventListener('pointercancel', finishShortcutDrag);

    modalRoot.addEventListener('input', function (event) {
        if (event.target.id === 'iconSearchInput') {
            state.iconSearch = event.target.value;
            updateIconResults();
        }

        if (event.target.id === 'shortcutIconColor' && state.iconDraft) {
            state.iconDraft.color = event.target.value;
            var livePreview = document.querySelector('.live-icon-preview');
            if (livePreview) livePreview.style.color = event.target.value;
        }

        if (event.target.id === 'customShortcutIcon') {
            readIconFile(event.target.files[0], function (icon) {
                if (!icon || !state.iconDraft) return;
                state.iconDraft.customIcon = icon;
                state.iconDraft.iconClass = '';
                renderIconPicker();
            });
        }
    });

    app.addEventListener('click', function (event) {
        var actionElement = event.target.closest('[data-action]');
        var shortcutLink = event.target.closest('.shortcut-tile a');

        if (shortcutLink && state.settings) {
            event.preventDefault();

            if (event.ctrlKey || event.metaKey) {
                activateShortcut(shortcutLink, 'newtab');
            } else {
                activateShortcut(shortcutLink, 'self');
            }

            return;
        }

        if (!actionElement) return;

        var action = actionElement.getAttribute('data-action');

        if (action === 'back') {
            state.setupStep = Math.max(0, state.setupStep - 1);
            renderSetup();
        }

        if (action === 'addShortcut') {
            if (!state.setupDraft.shortcuts) state.setupDraft.shortcuts = [];
            state.setupDraft.shortcuts.push(createShortcut());
            renderShortcutDrafts();
        }

        if (action === 'openIconPicker') {
            openIconPicker(actionElement.closest('.shortcut-row'));
        }

        if (action === 'removeShortcut') {
            var row = actionElement.closest('.shortcut-row');
            state.setupDraft.shortcuts = state.setupDraft.shortcuts.filter(function (shortcut) {
                return shortcut.id !== row.getAttribute('data-id');
            });
            renderShortcutDrafts();
        }

        if (action === 'skipShortcuts') {
            saveSettings(buildSettings(true));
            render();
        }

        if (action === 'finishSetup') {
            saveSettings(buildSettings(false));
            render();
        }

        if (action === 'closeSettings') {
            state.settings = loadSettings();
            state.resetArmed = false;
            startLoop();
        }

        if (action === 'addSettingsShortcut') {
            state.settings.shortcuts.push(createShortcut());
            document.getElementById('settingsShortcuts').innerHTML = renderSettingsShortcutRows(state.settings.shortcuts);
        }

        if (action === 'removeSettingsShortcut') {
            var settingsRow = actionElement.closest('.shortcut-row');
            state.settings.shortcuts = state.settings.shortcuts.filter(function (shortcut) {
                return shortcut.id !== settingsRow.getAttribute('data-id');
            });
            document.getElementById('settingsShortcuts').innerHTML = renderSettingsShortcutRows(state.settings.shortcuts);
        }

        if (action === 'countClicksAll' || action === 'countClicksNone') {
            var source = actionElement.closest('[data-counter-source]').getAttribute('data-counter-source');
            var targetShortcuts = source === 'settings' ? state.settings.shortcuts : state.setupDraft.shortcuts;
            targetShortcuts.forEach(function (shortcut) {
                shortcut.countClicks = action === 'countClicksAll';
            });
            if (source === 'settings') {
                document.getElementById('settingsShortcuts').innerHTML = renderSettingsShortcutRows(state.settings.shortcuts);
            } else {
                renderShortcutDrafts();
            }
        }

        if (action === 'revealReset') {
            state.resetArmed = true;
            renderSettings();
        }

        if (action === 'openResetConfirm') {
            renderResetConfirm();
        }

        if (action === 'openCounterReset') {
            renderCounterResetConfirm(actionElement.closest('.shortcut-row'));
        }

        if (action === 'openAllCountersReset') {
            renderAllCountersResetConfirm();
        }
    });

    app.addEventListener('auxclick', function (event) {
        var shortcutLink = event.target.closest('.shortcut-tile a');
        if (!shortcutLink || !state.settings || event.button !== 1) return;

        event.preventDefault();
        activateShortcut(shortcutLink, 'newtab');
    });

    function countShortcutClick(shortcutLink) {
        var tile = shortcutLink.closest('.shortcut-tile');
        var shortcut = state.settings.shortcuts.find(function (item) {
            return item.id === tile.getAttribute('data-id');
        });

        if (shortcut && shortcut.countClicks !== false) {
            shortcut.clicks = Number(shortcut.clicks || 0) + 1;
            saveSettings(state.settings);
            var counter = tile.querySelector('.click-counter');
            if (counter) counter.textContent = shortcut.clicks;
        }

        return shortcut;
    }

    function activateShortcut(shortcutLink, target) {
        countShortcutClick(shortcutLink);

        if (target === 'newtab') {
            window.open(shortcutLink.href, '_blank');
            return;
        }

        window.location.href = shortcutLink.href;
    }

    modalRoot.addEventListener('click', function (event) {
        var actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;

        var action = actionElement.getAttribute('data-action');

        if (action === 'closeIconPicker') {
            clearModal();
        }

        if (action === 'closeResetConfirm') {
            modalRoot.innerHTML = '';
            disarmResetTrigger();
        }

        if (action === 'closeCounterReset') {
            state.counterResetTarget = null;
            modalRoot.innerHTML = '';
        }

        if (action === 'confirmResetSettings') {
            localStorage.removeItem(STORAGE_KEY);
            state.settings = null;
            state.setupStep = 0;
            state.setupDraft = {};
            state.resetArmed = false;
            customFontStyle.textContent = '';
            modalRoot.innerHTML = '';
            document.body.classList.remove('settings-open');
            render();
        }

        if (action === 'confirmCounterReset') {
            var resetShortcut = state.settings && state.settings.shortcuts.find(function (shortcut) {
                return shortcut.id === state.counterResetTarget;
            });

            if (resetShortcut) {
                resetShortcut.clicks = 0;
                saveSettings(state.settings);
                document.getElementById('settingsShortcuts').innerHTML = renderSettingsShortcutRows(state.settings.shortcuts);
            }

            state.counterResetTarget = null;
            modalRoot.innerHTML = '';
        }

        if (action === 'confirmAllCountersReset') {
            if (state.settings) {
                state.settings.shortcuts.forEach(function (shortcut) {
                    shortcut.clicks = 0;
                });
                saveSettings(state.settings);
                document.getElementById('settingsShortcuts').innerHTML = renderSettingsShortcutRows(state.settings.shortcuts);
            }

            state.counterResetTarget = null;
            modalRoot.innerHTML = '';
        }

        if (action === 'selectIcon') {
            state.iconDraft.iconClass = actionElement.getAttribute('data-icon-class');
            state.iconDraft.customIcon = '';
            renderIconPicker();
        }

        if (action === 'clearShortcutIcon') {
            state.iconDraft.iconClass = '';
            state.iconDraft.customIcon = '';
            state.iconDraft.color = '#353d3f';
            renderIconPicker();
        }

        if (action === 'applyShortcutIcon') {
            var shortcut = getShortcutTarget();
            if (!shortcut) return;

            shortcut.iconClass = state.iconDraft.iconClass;
            shortcut.customIcon = state.iconDraft.customIcon;
            shortcut.color = state.iconDraft.color || '#353d3f';

            if (state.iconPickerTarget.source === 'settings') {
                document.getElementById('settingsShortcuts').innerHTML = renderSettingsShortcutRows(state.settings.shortcuts);
            } else {
                renderShortcutDrafts();
            }

            clearModal();
        }
    });

    settingsButton.addEventListener('click', renderSettings);

    render();
})();
