document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const fileInput = document.getElementById('fileInput');
    const fileNameSpan = document.getElementById('file-name');
    const saveButton = document.getElementById('saveButton');
    const subtitleContainer = document.getElementById('subtitle-container');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const shiftInputs = {
        h: document.getElementById('shiftHours'),
        m: document.getElementById('shiftMinutes'),
        s: document.getElementById('shiftSeconds'),
        ms: document.getElementById('shiftMilliseconds')
    };
    const shiftForwardButton = document.getElementById('shiftForwardButton');
    const shiftBackwardButton = document.getElementById('shiftBackwardButton');
    const uploadCard = document.getElementById('upload-card');
    const editorCard = document.getElementById('editor-card');
    const saveCard = document.getElementById('save-card');
    const shortcutsFooter = document.getElementById('shortcuts-footer');

    let subtitles = [];
    let originalFileName = 'edited.srt';
    let totalDurationMs = 0;
    const CPS_THRESHOLD = 20; // Characters Per Second warning limit

    // Event Listeners
    fileInput.addEventListener('change', handleFileSelect);
    saveButton.addEventListener('click', saveSrtFile);
    shiftForwardButton.addEventListener('click', () => applyShift(1)); // 1 for forward
    shiftBackwardButton.addEventListener('click', () => applyShift(-1)); // -1 for backward
    selectAllCheckbox.addEventListener('change', handleSelectAll);
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // --- Main Functions ---

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file || !file.name.endsWith('.srt')) {
            alert('Please select a valid .srt file.');
            return;
        }
        originalFileName = file.name.replace('.srt', '_edited.srt');
        fileNameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            subtitles = parseSrt(e.target.result);
            if (subtitles.length > 0) {
                totalDurationMs = timeToMilliseconds(subtitles[subtitles.length - 1].endTime);
                editorCard.classList.remove('hidden');
                saveCard.classList.remove('hidden');
                shortcutsFooter.classList.remove('hidden');
                renderSubtitles();
            } else {
                 alert('Could not parse the SRT file. It might be empty or invalid.');
            }
        };
        reader.readAsText(file, 'UTF-8');
    }

    function renderSubtitles() {
        subtitleContainer.innerHTML = '';
        subtitles.forEach((sub, i) => {
            const item = document.createElement('div');
            item.className = 'subtitle-item';
            if (sub.selected) item.classList.add('selected');

            // CPS Calculation
            const durationSec = (timeToMilliseconds(sub.endTime) - timeToMilliseconds(sub.startTime)) / 1000;
            const cps = durationSec > 0 ? (sub.text.length / durationSec) : 0;
            let cpsWarningHTML = '';
            if (cps > CPS_THRESHOLD) {
                item.classList.add('has-warning');
                cpsWarningHTML = `
                    <div class="cps-warning" title="High Characters Per Second">!
                        <span class="tooltip">CPS: ${cps.toFixed(1)}. Reading may be too fast.</span>
                    </div>`;
            }

            // Visual Timeline Calculation
            const startPercent = (timeToMilliseconds(sub.startTime) / totalDurationMs) * 100;
            const widthPercent = (durationSec * 1000 / totalDurationMs) * 100;

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
                </div>
            `;
            
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                subtitles[i].selected = e.target.checked;
                item.classList.toggle('selected', e.target.checked);
                updateSelectAllCheckboxState();
            });

            item.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
            subtitleContainer.appendChild(item);
        });
        updateSelectAllCheckboxState();
    }
    
    function applyShift(direction, nudgeMs = 0) {
        let totalShift;
        if (nudgeMs > 0) {
            totalShift = nudgeMs * direction;
        } else {
            const h = parseInt(shiftInputs.h.value) || 0;
            const m = parseInt(shiftInputs.m.value) || 0;
            const s = parseInt(shiftInputs.s.value) || 0;
            const ms = parseInt(shiftInputs.ms.value) || 0;
            totalShift = (h * 3600000 + m * 60000 + s * 1000 + ms) * direction;
        }

        if (totalShift === 0) {
            if (nudgeMs === 0) alert("Please enter a time value to shift.");
            return;
        }

        const targetSubtitles = subtitles.filter(sub => sub.selected);
        if (targetSubtitles.length === 0) {
            if (nudgeMs > 0) { // Don't alert for nudging if nothing is selected
                return;
            }
            if (confirm("No subtitles are selected. Apply shift to ALL subtitles?")) {
                subtitles.forEach(sub => shiftTime(sub, totalShift));
            }
        } else {
            targetSubtitles.forEach(sub => shiftTime(sub, totalShift));
        }
        renderSubtitles();
    }
    
    function shiftTime(sub, shiftMs) {
        sub.startTime = millisecondsToTime(timeToMilliseconds(sub.startTime) + shiftMs);
        sub.endTime = millisecondsToTime(timeToMilliseconds(sub.endTime) + shiftMs);
    }
    
    function saveSrtFile() {
        const srtContent = subtitles.map(sub => {
            return `${sub.index}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}`;
        }).join('\n\n') + '\n\n';
        
        const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // --- Keyboard Shortcuts ---
    
    function handleKeyboardShortcuts(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            selectAllCheckbox.checked = !selectAllCheckbox.checked;
            handleSelectAll();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveButton.click();
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            applyShift(1, 100); // Nudge forward 100ms
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            applyShift(-1, 100); // Nudge backward 100ms
        }
    }
    
    // --- Helper Functions ---

    function handleSelectAll() {
        subtitles.forEach(sub => sub.selected = selectAllCheckbox.checked);
        renderSubtitles();
    }
    
    function updateSelectAllCheckboxState() {
        const totalCount = subtitles.length;
        const selectedCount = subtitles.filter(sub => sub.selected).length;
        if (totalCount > 0 && selectedCount === totalCount) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedCount > 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    }

    function timeToMilliseconds(timeStr) {
        const parts = timeStr.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (!parts) return 0;
        return parseInt(parts[1]) * 3600000 + parseInt(parts[2]) * 60000 + parseInt(parts[3]) * 1000 + parseInt(parts[4]);
    }

    function millisecondsToTime(ms) {
        if (ms < 0) ms = 0;
        const h = Math.floor(ms / 3600000);
        ms %= 3600000;
        const m = Math.floor(ms / 60000);
        ms %= 60000;
        const s = Math.floor(ms / 1000);
        const msec = ms % 1000;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(msec).padStart(3, '0')}`;
    }

    function parseSrt(data) {
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
});
