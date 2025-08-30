// Create a namespace for our tools to avoid global scope conflicts
window.SubTools = window.SubTools || {};

// Define the module for the Timeline Coordinator tool
window.SubTools.coordinator = {
    // Store module-level variables
    toolContainer: null,
    subtitles: [],
    originalFileName: 'edited.srt',
    totalDurationMs: 0,
    elements: {}, // An object to hold DOM element references
    keyboardHandler: null, // To hold the reference to the bound keyboard handler

    // The init method is called by the main hub script to start the tool
    init: function(containerId) {
        this.toolContainer = document.getElementById(containerId);
        if (!this.toolContainer) {
            console.error(`Container with id "${containerId}" not found for Coordinator tool.`);
            return;
        }

        // Scope all element queries to the tool's container
        // This prevents conflicts with identical IDs in other tools
        this.elements = {
            fileInput: this.toolContainer.querySelector('#fileInput'),
            fileNameSpan: this.toolContainer.querySelector('#file-name'),
            saveButton: this.toolContainer.querySelector('#saveButton'),
            subtitleContainer: this.toolContainer.querySelector('#subtitle-container'),
            selectAllCheckbox: this.toolContainer.querySelector('#selectAllCheckbox'),
            shiftInputs: {
                h: this.toolContainer.querySelector('#shiftHours'),
                m: this.toolContainer.querySelector('#shiftMinutes'),
                s: this.toolContainer.querySelector('#shiftSeconds'),
                ms: this.toolContainer.querySelector('#shiftMilliseconds')
            },
            shiftForwardButton: this.toolContainer.querySelector('#shiftForwardButton'),
            shiftBackwardButton: this.toolContainer.querySelector('#shiftBackwardButton'),
            editorCard: this.toolContainer.querySelector('#editor-card'),
            saveCard: this.toolContainer.querySelector('#save-card')
        };
        
        // Bind event listeners
        this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.elements.saveButton.addEventListener('click', this.saveSrtFile.bind(this));
        this.elements.shiftForwardButton.addEventListener('click', () => this.applyShift(1));
        this.elements.shiftBackwardButton.addEventListener('click', () => this.applyShift(-1));
        this.elements.selectAllCheckbox.addEventListener('change', this.handleSelectAll.bind(this));
        
        // Manage keyboard shortcuts so they are only active when this tool is visible
        this.keyboardHandler = this.handleKeyboardShortcuts.bind(this);
        document.addEventListener('keydown', this.keyboardHandler);
        
        console.log('Coordinator tool initialized.');
    },

    // The destroy method is called when switching to another tool
    destroy: function() {
        // Remove global event listeners to prevent running in the background
        document.removeEventListener('keydown', this.keyboardHandler);
        // Reset state for a clean re-initialization
        this.subtitles = [];
        this.originalFileName = 'edited.srt';
        console.log('Coordinator tool destroyed.');
    },
    
    // --- Main Application Functions ---

    handleFileSelect: function(event) {
        const file = event.target.files[0];
        if (!file || !file.name.endsWith('.srt')) {
            alert('Please select a valid .srt file.');
            return;
        }
        this.originalFileName = file.name.replace('.srt', '_edited.srt');
        this.elements.fileNameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.subtitles = this.parseSrt(e.target.result);
            if (this.subtitles.length > 0) {
                this.totalDurationMs = this.timeToMilliseconds(this.subtitles[this.subtitles.length - 1].endTime);
                this.elements.editorCard.classList.remove('hidden');
                this.elements.saveCard.classList.remove('hidden');
                this.renderSubtitles();
            } else {
                alert('Could not parse the SRT file. It might be empty or invalid.');
            }
        };
        reader.readAsText(file, 'UTF-8');
    },

    renderSubtitles: function() {
        this.elements.subtitleContainer.innerHTML = '';
        this.subtitles.forEach((sub, i) => {
            const item = document.createElement('div');
            item.className = 'subtitle-item';
            if (sub.selected) item.classList.add('selected');

            const durationSec = (this.timeToMilliseconds(sub.endTime) - this.timeToMilliseconds(sub.startTime)) / 1000;
            const cps = durationSec > 0 ? (sub.text.length / durationSec) : 0;
            const CPS_THRESHOLD = 20;
            let cpsWarningHTML = '';
            if (cps > CPS_THRESHOLD) {
                item.classList.add('has-warning');
                cpsWarningHTML = `<div class="cps-warning" title="High Characters Per Second">!
                    <span class="tooltip">CPS: ${cps.toFixed(1)}. Reading may be too fast.</span></div>`;
            }

            const startPercent = (this.timeToMilliseconds(sub.startTime) / this.totalDurationMs) * 100;
            const widthPercent = (durationSec * 1000 / this.totalDurationMs) * 100;

            item.innerHTML = `
                <input type="checkbox" data-index="${i}" ${sub.selected ? 'checked' : ''}>
                <div class="subtitle-content">
                    <div class="subtitle-header">
                        <div class="subtitle-time">${sub.startTime} --> ${sub.endTime}</div>
                        ${cpsWarningHTML}
                    </div>
                    <div class="subtitle-text">${sub.text.replace(/\n/g, '<br>')}</div>
                    <div class="timeline-bar-container">
                        <div class="timeline-bar" style="margin-left: ${startPercent}%; width: ${widthPercent}%;"></div>
                    </div>
                </div>`;
            
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                this.subtitles[i].selected = e.target.checked;
                item.classList.toggle('selected', e.target.checked);
                this.updateSelectAllCheckboxState();
            });

            item.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
            this.elements.subtitleContainer.appendChild(item);
        });
        this.updateSelectAllCheckboxState();
    },
    
    applyShift: function(direction, nudgeMs = 0) {
        let totalShift;
        if (nudgeMs > 0) {
            totalShift = nudgeMs * direction;
        } else {
            const h = parseInt(this.elements.shiftInputs.h.value) || 0;
            const m = parseInt(this.elements.shiftInputs.m.value) || 0;
            const s = parseInt(this.elements.shiftInputs.s.value) || 0;
            const ms = parseInt(this.elements.shiftInputs.ms.value) || 0;
            totalShift = (h * 3600000 + m * 60000 + s * 1000 + ms) * direction;
        }

        if (totalShift === 0 && nudgeMs === 0) {
            alert("Please enter a time value to shift.");
            return;
        }

        const targetSubtitles = this.subtitles.filter(sub => sub.selected);
        if (targetSubtitles.length === 0) {
            if (nudgeMs > 0) return;
            if (confirm("No subtitles are selected. Apply shift to ALL subtitles?")) {
                this.subtitles.forEach(sub => this.shiftTime(sub, totalShift));
            }
        } else {
            targetSubtitles.forEach(sub => this.shiftTime(sub, totalShift));
        }
        this.renderSubtitles();
    },
    
    shiftTime: function(sub, shiftMs) {
        sub.startTime = this.millisecondsToTime(this.timeToMilliseconds(sub.startTime) + shiftMs);
        sub.endTime = this.millisecondsToTime(this.timeToMilliseconds(sub.endTime) + shiftMs);
    },
    
    saveSrtFile: function() {
        const srtContent = this.subtitles.map(sub => {
            return `${sub.index}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}`;
        }).join('\n\n') + '\n\n';
        
        const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.originalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    handleKeyboardShortcuts: function(e) {
        // Check if the event is happening inside an input field
        if (e.target.tagName === 'INPUT' && e.target.type === 'number') return;
        
        if (e.ctrlKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            this.elements.selectAllCheckbox.checked = !this.elements.selectAllCheckbox.checked;
            this.handleSelectAll();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            this.elements.saveButton.click();
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.applyShift(1, 100);
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.applyShift(-1, 100);
        }
    },
    
    // --- Helper Functions ---
    
    handleSelectAll: function() {
        this.subtitles.forEach(sub => sub.selected = this.elements.selectAllCheckbox.checked);
        this.renderSubtitles();
    },
    
    updateSelectAllCheckboxState: function() {
        const totalCount = this.subtitles.length;
        const selectedCount = this.subtitles.filter(sub => sub.selected).length;
        if (totalCount > 0 && selectedCount === totalCount) {
            this.elements.selectAllCheckbox.checked = true;
            this.elements.selectAllCheckbox.indeterminate = false;
        } else if (selectedCount > 0) {
            this.elements.selectAllCheckbox.checked = false;
            this.elements.selectAllCheckbox.indeterminate = true;
        } else {
            this.elements.selectAllCheckbox.checked = false;
            this.elements.selectAllCheckbox.indeterminate = false;
        }
    },

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
    },

    parseSrt: function(data) {
        return data.trim().replace(/\r/g, '').split('\n\n').map(block => {
            const lines = block.split('\n');
            if (lines.length >= 3) {
                const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
                if (timeMatch) {
                    return {
                        index: parseInt(lines[0], 10),
                        startTime: timeMatch[1],
                        endTime: timeMatch[2],
                        text: lines.slice(2).join('\n'),
                        selected: false
                    };
                }
            }
            return null;
        }).filter(Boolean); // Filter out any null (invalid) blocks
    }
};
