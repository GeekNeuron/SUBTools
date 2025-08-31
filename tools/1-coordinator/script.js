window.SubTools = window.SubTools || {};
window.SubTools.coordinator = {
    toolContainer: null, subtitles: [], originalFileName: 'edited.srt', elements: {}, keyboardHandler: null,
    init: function(containerId) {
        this.toolContainer = document.getElementById(containerId);
        if (!this.toolContainer) return;
        this.elements = {
            fileInput: this.toolContainer.querySelector('#coordinator-fileInput'),
            fileNameSpan: this.toolContainer.querySelector('#coordinator-file-name'),
            saveButton: this.toolContainer.querySelector('#coordinator-saveButton'),
            subtitleContainer: this.toolContainer.querySelector('#coordinator-subtitle-container'),
            selectAllCheckbox: this.toolContainer.querySelector('#coordinator-selectAllCheckbox'),
            shiftInputs: {
                h: this.toolContainer.querySelector('#coordinator-shiftHours'),
                m: this.toolContainer.querySelector('#coordinator-shiftMinutes'),
                s: this.toolContainer.querySelector('#coordinator-shiftSeconds'),
                ms: this.toolContainer.querySelector('#coordinator-shiftMilliseconds')
            },
            shiftForwardButton: this.toolContainer.querySelector('#coordinator-shiftForwardButton'),
            shiftBackwardButton: this.toolContainer.querySelector('#coordinator-shiftBackwardButton'),
        };
        this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.elements.saveButton.addEventListener('click', this.saveSrtFile.bind(this));
        this.elements.shiftForwardButton.addEventListener('click', () => this.applyShift(1));
        this.elements.shiftBackwardButton.addEventListener('click', () => this.applyShift(-1));
        this.elements.selectAllCheckbox.addEventListener('change', this.handleSelectAll.bind(this));
        this.keyboardHandler = this.handleKeyboardShortcuts.bind(this);
        document.addEventListener('keydown', this.keyboardHandler);
        console.log('Coordinator tool initialized.');
    },
    destroy: function() {
        document.removeEventListener('keydown', this.keyboardHandler);
        this.subtitles = []; this.originalFileName = 'edited.srt';
        if(this.elements.fileNameSpan) this.elements.fileNameSpan.textContent = "No file selected.";
        if(this.elements.subtitleContainer) this.elements.subtitleContainer.innerHTML = "";
        console.log('Coordinator tool destroyed.');
    },
    handleFileSelect: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        this.originalFileName = file.name.replace('.srt', '_edited.srt');
        this.elements.fileNameSpan.textContent = file.name;
        this.elements.saveButton.disabled = true;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.subtitles = this.parseSrt(e.target.result);
            if (this.subtitles.length > 0) {
                this.elements.saveButton.disabled = false;
                this.renderSubtitles();
            } else { alert('Could not parse SRT file.'); }
        };
        reader.readAsText(file, 'UTF-8');
    },
    renderSubtitles: function() {
        this.elements.subtitleContainer.innerHTML = '';
        this.subtitles.forEach((sub, i) => {
            const item = document.createElement('div');
            item.className = 'subtitle-item';
            if (sub.selected) item.classList.add('selected');
            item.innerHTML = `<input type="checkbox" data-index="${i}" ${sub.selected ? 'checked' : ''}><span class="subtitle-time">${sub.startTime} --> ${sub.endTime}</span><span class="subtitle-text">${sub.text.replace(/\n/g, '<br>')}</span>`;
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                this.subtitles[i].selected = checkbox.checked;
                item.classList.toggle('selected', checkbox.checked);
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
    applyShift: function(direction) {
        const h = parseInt(this.elements.shiftInputs.h.value) || 0;
        const m = parseInt(this.elements.shiftInputs.m.value) || 0;
        const s = parseInt(this.elements.shiftInputs.s.value) || 0;
        const ms = parseInt(this.elements.shiftInputs.ms.value) || 0;
        const totalShift = (h * 3600000 + m * 60000 + s * 1000 + ms) * direction;
        if (totalShift === 0) { alert("Please enter a time value."); return; }
        const targets = this.subtitles.filter(s => s.selected);
        const subjects = targets.length > 0 ? targets : this.subtitles;
        if (targets.length === 0 && !confirm("No lines selected. Apply to all?")) return;
        subjects.forEach(sub => this.shiftTime(sub, totalShift));
        this.renderSubtitles();
    },
    shiftTime: function(sub, shiftMs) {
        sub.startTime = this.millisecondsToTime(this.timeToMilliseconds(sub.startTime) + shiftMs);
        sub.endTime = this.millisecondsToTime(this.timeToMilliseconds(sub.endTime) + shiftMs);
    },
    saveSrtFile: function() {
        const srtContent = this.subtitles.map(s => `${s.index}\n${s.startTime} --> ${s.endTime}\n${s.text}`).join('\n\n') + '\n\n';
        this.triggerDownload(srtContent, this.originalFileName);
    },
    handleKeyboardShortcuts: function(e) { /* Simplified for brevity */ },
    handleSelectAll: function() {
        this.subtitles.forEach(sub => sub.selected = this.elements.selectAllCheckbox.checked);
        this.renderSubtitles();
    },
    updateSelectAllCheckboxState: function() {
        const total = this.subtitles.length;
        const selected = this.subtitles.filter(s => s.selected).length;
        this.elements.selectAllCheckbox.checked = total > 0 && selected === total;
        this.elements.selectAllCheckbox.indeterminate = selected > 0 && selected < total;
    },
    timeToMilliseconds: (t) => { const p = t.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/); return p ? (p[1]*36e5 + p[2]*6e4 + p[3]*1e3 + +p[4]) : 0; },
    millisecondsToTime: (ms) => { if(ms<0)ms=0; let h=Math.floor(ms/36e5);ms%=36e5;let m=Math.floor(ms/6e4);ms%=6e4;let s=Math.floor(ms/1e3); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1e3).padStart(3,'0')}`; },
    parseSrt: (d) => d.trim().replace(/\r/g,'').split('\n\n').map(b => { const l=b.split('\n'); if(l.length>=3){ const t=l[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/); if(t) return {index:parseInt(l[0]),startTime:t[1],endTime:t[2],text:l.slice(2).join('\n'),selected:false}; } return null; }).filter(Boolean),
    triggerDownload: (content, fileName) => { const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));a.download=fileName;document.body.appendChild(a);a.click();document.body.removeChild(a); }
};
