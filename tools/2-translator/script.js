// Create a namespace for our tools to avoid global scope conflicts
window.SubTools = window.SubTools || {};

// Define the module for the Subtitle Translator tool
window.SubTools.translator = {
    // Module-level properties
    toolContainer: null,
    subtitles: [],
    originalFileName: 'translated.srt',
    currentFileContent: '',
    searchState: { currentIndex: -1, searchTerm: '' },
    elements: {}, // To hold DOM element references

    // The init method is called by the main hub script to start the tool
    init: function(containerId) {
        this.toolContainer = document.getElementById(containerId);
        if (!this.toolContainer) {
            console.error(`Container with id "${containerId}" not found for Translator tool.`);
            return;
        }

        // Scope all element queries to the tool's container
        this.elements = {
            fileInput: this.toolContainer.querySelector('#fileInput'),
            fileNameSpan: this.toolContainer.querySelector('#file-name'),
            translatorCard: this.toolContainer.querySelector('#translator-card'),
            subtitleBody: this.toolContainer.querySelector('#subtitle-body'),
            saveButton: this.toolContainer.querySelector('#saveButton'),
            autoSaveStatus: this.toolContainer.querySelector('#autosave-status'),
            selectAllCheckbox: this.toolContainer.querySelector('#select-all-checkbox'),
            addLineBtn: this.toolContainer.querySelector('#add-line-btn'),
            deleteLinesBtn: this.toolContainer.querySelector('#delete-lines-btn'),
            findInput: this.toolContainer.querySelector('#find-input'),
            replaceInput: this.toolContainer.querySelector('#replace-input'),
            findNextBtn: this.toolContainer.querySelector('#find-next-btn'),
            replaceBtn: this.toolContainer.querySelector('#replace-btn'),
            replaceAllBtn: this.toolContainer.querySelector('#replace-all-btn'),
            findReplaceStatus: this.toolContainer.querySelector('#find-replace-status')
        };
        
        // Bind event listeners
        this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.elements.saveButton.addEventListener('click', this.saveTranslatedFile.bind(this));
        this.elements.findNextBtn.addEventListener('click', this.handleFindNext.bind(this));
        this.elements.replaceBtn.addEventListener('click', this.handleReplace.bind(this));
        this.elements.replaceAllBtn.addEventListener('click', this.handleReplaceAll.bind(this));
        this.elements.selectAllCheckbox.addEventListener('change', this.handleSelectAll.bind(this));
        this.elements.addLineBtn.addEventListener('click', this.handleAddLine.bind(this));
        this.elements.deleteLinesBtn.addEventListener('click', this.handleDeleteLines.bind(this));

        console.log('Translator tool initialized.');
    },

    // The destroy method is called when switching to another tool
    destroy: function() {
        // Reset state for a clean re-initialization
        this.subtitles = [];
        this.originalFileName = 'translated.srt';
        this.currentFileContent = '';
        this.searchState = { currentIndex: -1, searchTerm: '' };
        console.log('Translator tool destroyed.');
    },
    
    // --- Core Functions ---

    handleFileSelect: function(event) {
        const file = event.target.files[0];
        if (!file || !file.name.endsWith('.srt')) {
            alert('Please select a valid .srt file.');
            return;
        }
        this.originalFileName = file.name.replace('.srt', '_translated.srt');
        this.elements.fileNameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentFileContent = e.target.result;
            this.subtitles = this.parseSrt(this.currentFileContent);
            if (this.subtitles.length > 0) {
                this.renderTranslator();
                this.loadAutoSavedTranslations();
                this.elements.translatorCard.classList.remove('hidden');
            } else {
                alert('The subtitle file appears to be empty or invalid.');
            }
        };
        reader.readAsText(file, 'UTF-8');
    },

    parseSrt: function(data) {
        return data.trim().replace(/\r/g, '').split('\n\n').map(block => {
            const lines = block.split('\n');
            if (lines.length >= 2 && lines[1].includes('-->')) {
                const timeParts = lines[1].split(' --> ');
                return {
                    index: parseInt(lines[0], 10),
                    startTime: timeParts[0],
                    endTime: timeParts[1],
                    text: lines.slice(2).join('\n'),
                    selected: false
                };
            }
            return null;
        }).filter(Boolean);
    },

    renderTranslator: function() {
        this.elements.subtitleBody.innerHTML = '';
        this.subtitles.forEach((sub, i) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Select" class="col-select"><input type="checkbox" class="line-checkbox" data-index="${i}" ${sub.selected ? 'checked' : ''}></td>
                <td data-label="#" class="col-index">${sub.index}</td>
                <td data-label="Timestamp" class="col-time">${sub.startTime} --> ${sub.endTime}</td>
                <td data-label="Original Text" class="col-original">${sub.text.replace(/\n/g, '<br>')}</td>
                <td data-label="Translated Text" class="col-translation">
                    <textarea data-id="${i}" class="translation-input" rows="2" spellcheck="false"></textarea>
                    <div class="translation-meta">
                        <button class="copy-original-btn" title="Copy original text">Copy</button>
                        <span class="char-counter">0</span>
                    </div>
                </td>
            `;
            this.elements.subtitleBody.appendChild(row);
        });
        this.attachEventListeners();
        this.updateSelectAllCheckboxState();
    },

    attachEventListeners: function() {
        this.toolContainer.querySelectorAll('.line-checkbox').forEach(cb => cb.addEventListener('change', this.handleLineSelect.bind(this)));
        this.toolContainer.querySelectorAll('.translation-input').forEach(textarea => {
            textarea.addEventListener('input', this.handleTextareaInput.bind(this));
            textarea.addEventListener('keydown', this.handleTextareaKeyDown.bind(this));
        });
        this.toolContainer.querySelectorAll('.copy-original-btn').forEach(button => {
            button.addEventListener('click', this.handleCopyOriginal.bind(this));
        });
    },

    // --- Add/Delete/Selection Logic ---

    handleAddLine: function() {
        const selectedIndex = this.subtitles.findIndex(sub => sub.selected);
        if (selectedIndex === -1) {
            alert("Please select a line. The new line will be inserted before it.");
            return;
        }
        if (selectedIndex === 0) {
            alert("Cannot add a line before the first subtitle.");
            return;
        }
        const prevSub = this.subtitles[selectedIndex - 1];
        const nextSub = this.subtitles[selectedIndex];
        const prevEndTime = this.timeToMilliseconds(prevSub.endTime);
        const nextStartTime = this.timeToMilliseconds(nextSub.startTime);
        const gap = nextStartTime - prevEndTime;
        if (gap < 200) { // Minimum 200ms gap required
            alert(`Not enough time (${gap}ms) between lines ${prevSub.index} and ${nextSub.index} to add a new line.`);
            return;
        }
        const newSubtitle = {
            index: -1, // Will be set by reindexing
            startTime: this.millisecondsToTime(prevEndTime + 1),
            endTime: this.millisecondsToTime(nextStartTime - 1),
            text: "[New Line]",
            selected: false,
        };
        this.subtitles.splice(selectedIndex, 0, newSubtitle);
        this.reindexSubtitles();
        this.renderTranslator();
        this.loadAutoSavedTranslations();
    },

    handleDeleteLines: function() {
        const selectedCount = this.subtitles.filter(sub => sub.selected).length;
        if (selectedCount === 0) {
            alert("Please select one or more lines to delete.");
            return;
        }
        if (confirm(`Are you sure you want to delete ${selectedCount} selected line(s)? This cannot be undone.`)) {
            this.subtitles = this.subtitles.filter(sub => !sub.selected);
            this.reindexSubtitles();
            this.renderTranslator();
            this.loadAutoSavedTranslations();
        }
    },

    reindexSubtitles: function() {
        this.subtitles.forEach((sub, i) => {
            sub.index = i + 1;
        });
    },

    handleLineSelect: function(event) {
        const index = parseInt(event.target.dataset.index, 10);
        this.subtitles[index].selected = event.target.checked;
        this.updateSelectAllCheckboxState();
    },

    handleSelectAll: function(event) {
        const isChecked = event.target.checked;
        this.subtitles.forEach(sub => sub.selected = isChecked);
        this.toolContainer.querySelectorAll('.line-checkbox').forEach(cb => cb.checked = isChecked);
    },

    updateSelectAllCheckboxState: function() {
        const selectedCount = this.subtitles.filter(sub => sub.selected).length;
        if (this.subtitles.length > 0) {
            this.elements.selectAllCheckbox.checked = selectedCount === this.subtitles.length;
            this.elements.selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < this.subtitles.length;
        } else {
            this.elements.selectAllCheckbox.checked = false;
            this.elements.selectAllCheckbox.indeterminate = false;
        }
    },

    // --- Find and Replace Logic ---

    handleFindNext: function() {
        const textareas = Array.from(this.toolContainer.querySelectorAll('.translation-input'));
        const searchTerm = this.elements.findInput.value;
        if (!searchTerm) {
            this.elements.findReplaceStatus.textContent = "Please enter text to find.";
            return;
        }
        if (this.searchState.searchTerm !== searchTerm) {
            this.searchState.currentIndex = -1;
            this.searchState.searchTerm = searchTerm;
            this.clearHighlights();
        }
        let found = false;
        for (let i = 0; i < textareas.length; i++) {
            let currentIndex = (this.searchState.currentIndex + 1 + i) % textareas.length;
            const textarea = textareas[currentIndex];
            if (textarea.value.toLowerCase().includes(searchTerm.toLowerCase())) {
                this.clearHighlights();
                textarea.classList.add('highlighted');
                textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this.elements.findReplaceStatus.textContent = `Found in line #${this.subtitles[currentIndex].index}`;
                this.searchState.currentIndex = currentIndex;
                found = true;
                break;
            }
        }
        if (!found) {
            this.elements.findReplaceStatus.textContent = "End of document reached. No more results.";
            this.searchState.currentIndex = -1;
            this.clearHighlights();
        }
    },

    handleReplace: function() {
        if (this.searchState.currentIndex === -1 || !this.elements.findInput.value) {
            this.elements.findReplaceStatus.textContent = "You must find text before you can replace it.";
            return;
        }
        const textarea = this.toolContainer.querySelector(`.translation-input[data-id="${this.searchState.currentIndex}"]`);
        const regex = new RegExp(this.elements.findInput.value, 'i');
        if (regex.test(textarea.value)) {
            textarea.value = textarea.value.replace(regex, this.elements.replaceInput.value);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            this.elements.findReplaceStatus.textContent = "Replaced one occurrence.";
            this.handleFindNext();
        }
    },

    handleReplaceAll: function() {
        const findTerm = this.elements.findInput.value;
        const replaceTerm = this.elements.replaceInput.value;
        if (!findTerm) {
            this.elements.findReplaceStatus.textContent = "Please enter text to find and replace.";
            return;
        }
        let totalReplacements = 0;
        const regex = new RegExp(findTerm, 'gi');
        this.toolContainer.querySelectorAll('.translation-input').forEach(textarea => {
            const originalValue = textarea.value;
            const newValue = originalValue.replace(regex, replaceTerm);
            if (originalValue !== newValue) {
                totalReplacements += (originalValue.match(regex) || []).length;
                textarea.value = newValue;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        this.elements.findReplaceStatus.textContent = `Replaced ${totalReplacements} occurrence(s).`;
        this.clearHighlights();
        this.searchState.currentIndex = -1;
    },

    clearHighlights: function() {
        this.toolContainer.querySelectorAll('.translation-input.highlighted').forEach(el => el.classList.remove('highlighted'));
    },

    // --- UX Feature Handlers ---

    handleTextareaInput: function(event) {
        const textarea = event.target;
        const charCounter = textarea.nextElementSibling.querySelector('.char-counter');
        const textLength = textarea.value.length;
        const CHAR_LIMIT_PER_LINE = 42;
        charCounter.textContent = textLength;
        charCounter.classList.toggle('limit-exceeded', textarea.value.split('\n').some(line => line.length > CHAR_LIMIT_PER_LINE));
        this.autoSaveTranslation(textarea.getAttribute('data-id'), textarea.value);
    },

    handleCopyOriginal: function(event) {
        const textarea = event.target.closest('.col-translation').querySelector('textarea');
        const originalText = this.subtitles[textarea.getAttribute('data-id')].text;
        textarea.value = originalText;
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },

    handleTextareaKeyDown: function(event) {
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            const nextTextarea = this.toolContainer.querySelector(`.translation-input[data-id="${parseInt(event.target.getAttribute('data-id')) + 1}"]`);
            if (nextTextarea) nextTextarea.focus();
            else this.elements.saveButton.focus();
        }
    },

    // --- Auto-Save & File Download Logic ---

    getAutoSaveKey: function() {
        let hash = 0;
        for (let i = 0; i < this.currentFileContent.length; i++) {
            hash = ((hash << 5) - hash) + this.currentFileContent.charCodeAt(i);
            hash |= 0;
        }
        return `srt-translation-${hash}`;
    },

    autoSaveTranslation: function(index, text) {
        const key = this.getAutoSaveKey();
        try {
            let translations = JSON.parse(localStorage.getItem(key)) || {};
            translations[index] = text;
            localStorage.setItem(key, JSON.stringify(translations));
            this.elements.autoSaveStatus.textContent = 'Saved.';
            setTimeout(() => { if (this.elements.autoSaveStatus) this.elements.autoSaveStatus.textContent = ''; }, 2000);
        } catch (e) {
            console.error("Failed to save to localStorage", e);
            this.elements.autoSaveStatus.textContent = 'Save Error!';
        }
    },

    loadAutoSavedTranslations: function() {
        const key = this.getAutoSaveKey();
        const savedTranslations = JSON.parse(localStorage.getItem(key));
        if (savedTranslations) {
            this.toolContainer.querySelectorAll('.translation-input').forEach(textarea => {
                const index = textarea.getAttribute('data-id');
                if (savedTranslations[index]) {
                    textarea.value = savedTranslations[index];
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
            this.elements.autoSaveStatus.textContent = 'Loaded auto-saved session.';
        }
    },

    saveTranslatedFile: function() {
        const newSrtContent = this.subtitles.map((sub, i) => {
            const textarea = this.toolContainer.querySelector(`.translation-input[data-id="${i}"]`);
            const translatedText = textarea.value.trim() || sub.text;
            return `${sub.index}\n${sub.startTime} --> ${sub.endTime}\n${translatedText}`;
        }).join('\n\n') + '\n\n';

        const blob = new Blob([newSrtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.originalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (confirm("Download started. Would you like to clear the auto-saved data?")) {
            localStorage.removeItem(this.getAutoSaveKey());
            this.elements.autoSaveStatus.textContent = 'Auto-save cleared.';
        }
    },

    // --- Time Conversion Helpers ---
    
    timeToMilliseconds: function(timeStr) {
        const parts = timeStr.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (!parts) return 0;
        return parseInt(parts[1]) * 3600000 + parseInt(parts[2]) * 60000 + parseInt(parts[3]) * 1000 + parseInt(parts[4]);
    },

    millisecondsToTime: function(ms) {
        if (ms < 0) ms = 0;
        const h = Math.floor(ms / 3600000); ms %= 3600000;
        const m = Math.floor(ms / 60000); ms %= 60000;
        const s = Math.floor(ms / 1000);
        const msec = ms % 1000;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(msec).padStart(3, '0')}`;
    }
};
