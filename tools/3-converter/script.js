// Create a namespace for our tools to avoid global scope conflicts
window.SubTools = window.SubTools || {};

// Define the module for the Format Converter tool
window.SubTools.converter = {
    // Module-level properties
    toolContainer: null,
    elements: {},
    filesToProcess: [],

    // The init method is called by the main hub script to start the tool
    init: function(containerId) {
        this.toolContainer = document.getElementById(containerId);
        if (!this.toolContainer) {
            console.error(`Container with id "${containerId}" not found for Converter tool.`);
            return;
        }

        // Scope all element queries to the tool's container
        this.elements = {
            fileInput: this.toolContainer.querySelector('#file-input'),
            uploadArea: this.toolContainer.querySelector('#upload-area'),
            fileNameDisplay: this.toolContainer.querySelector('#file-name'),
            outputFormatSelect: this.toolContainer.querySelector('#output-format'),
            convertBtn: this.toolContainer.querySelector('#convert-btn'),
            statusMessage: this.toolContainer.querySelector('#status-message'),
            stylingOptions: this.toolContainer.querySelector('#styling-options'),
            removeStylingCheckbox: this.toolContainer.querySelector('#remove-styling')
        };

        // Bind event listeners
        this.elements.fileInput.addEventListener('change', (e) => this.processFiles(e.target.files));
        this.elements.convertBtn.addEventListener('click', this.handleConvert.bind(this));

        // Setup Drag & Drop listeners
        const preventDefaults = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.elements.uploadArea.addEventListener(eventName, preventDefaults, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            this.elements.uploadArea.addEventListener(eventName, () => this.elements.uploadArea.classList.add('drag-over'), false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            this.elements.uploadArea.addEventListener(eventName, () => this.elements.uploadArea.classList.remove('drag-over'), false);
        });
        this.elements.uploadArea.addEventListener('drop', (e) => this.processFiles(e.dataTransfer.files), false);
        
        console.log('Converter tool initialized.');
    },

    // The destroy method is called when switching to another tool
    destroy: function() {
        // Reset state and UI for a clean start next time
        this.filesToProcess = [];
        this.elements.fileNameDisplay.textContent = "No files selected";
        this.elements.statusMessage.textContent = "";
        this.elements.convertBtn.disabled = true;
        this.elements.stylingOptions.classList.add('hidden');
        this.elements.fileInput.value = ''; // Clear file input
        console.log('Converter tool destroyed.');
    },

    // --- Core Application Logic ---

    processFiles: async function(files) {
        if (files.length === 0) return;
        this.filesToProcess = [];
        this.elements.stylingOptions.classList.add('hidden'); // Reset styling option
        
        const fileReadPromises = Array.from(files).map(file => {
            return new Promise((resolve) => {
                const extension = file.name.split('.').pop().toLowerCase();
                if (!['srt', 'vtt', 'ass', 'ssa', 'sub'].includes(extension)) {
                    alert(`Unsupported file format: ${file.name}`);
                    return resolve(null);
                }
                if (['ass', 'ssa'].includes(extension)) {
                    this.elements.stylingOptions.classList.remove('hidden');
                }
                const reader = new FileReader();
                reader.onload = (e) => resolve({ name: file.name, format: extension, content: e.target.result });
                reader.onerror = () => resolve({ error: `Error reading file ${file.name}` });
                reader.readAsText(file);
            });
        });

        const results = await Promise.all(fileReadPromises);
        this.filesToProcess = results.filter(file => file && !file.error);
        const errors = results.filter(file => file && file.error);

        if (errors.length > 0) {
            this.elements.statusMessage.className = 'status error';
            this.elements.statusMessage.textContent = errors.map(e => e.error).join(', ');
        } else {
            this.elements.statusMessage.className = 'status';
            this.elements.statusMessage.textContent = '';
        }

        if (this.filesToProcess.length > 0) {
            this.elements.fileNameDisplay.textContent = `${this.filesToProcess.length} file(s) selected.`;
            this.elements.convertBtn.disabled = false;
        } else {
            this.elements.fileNameDisplay.textContent = "No files selected";
            this.elements.convertBtn.disabled = true;
        }
    },

    handleConvert: async function() {
        if (this.filesToProcess.length === 0) {
            alert("Please select one or more files to convert.");
            return;
        }
        const outputFormat = this.elements.outputFormatSelect.value;
        const removeStyling = this.elements.removeStylingCheckbox.checked;
        this.elements.statusMessage.className = 'status';
        this.elements.statusMessage.textContent = 'Converting...';

        try {
            const processSingleFile = (file) => {
                const subtitles = this.parseFile(file.content, file.format, removeStyling);
                const outputContent = this.buildFile(subtitles, outputFormat);
                const outputFileName = file.name.replace(/\.[^/.]+$/, `.${outputFormat}`);
                return { name: outputFileName, content: outputContent };
            };

            if (this.filesToProcess.length === 1) {
                const result = processSingleFile(this.filesToProcess[0]);
                this.triggerDownload(result.content, result.name);
            } else {
                const zip = new JSZip();
                for (const file of this.filesToProcess) {
                    const result = processSingleFile(file);
                    zip.file(result.name, result.content);
                }
                const zipBlob = await zip.generateAsync({ type: "blob" });
                this.triggerDownload(zipBlob, `converted_subtitles.zip`);
            }
            this.elements.statusMessage.className = 'status success';
            this.elements.statusMessage.textContent = `${this.filesToProcess.length} file(s) converted successfully.`;
        } catch (error) {
            this.elements.statusMessage.className = 'status error';
            this.elements.statusMessage.textContent = `Error: ${error.message}`;
            console.error(error);
        }
    },
    
    // --- Universal Parser & Builder ---

    parseFile: function(content, format, removeStyling) {
        switch (format) {
            case 'srt':
            case 'sub': // Assuming .sub is the common SubRip text format
                return this.parseSrt(content);
            case 'vtt':
                return this.parseVtt(content);
            case 'ass':
            case 'ssa':
                return this.parseAss(content, removeStyling);
            default:
                throw new Error(`Unsupported input format: ${format}`);
        }
    },
    
    buildFile: function(subtitles, format) {
        switch (format) {
            case 'srt':
                return this.buildSrt(subtitles);
            case 'vtt':
                return this.buildVtt(subtitles);
            case 'txt':
                return this.buildTxt(subtitles);
            default:
                throw new Error(`Unsupported output format: ${format}`);
        }
    },

    // --- Format-Specific Functions ---

    parseSrt: function(data) {
        const subs = [];
        const blocks = data.trim().replace(/\r/g, '').split('\n\n');
        for (const [i, block] of blocks.entries()) {
            const lines = block.split('\n');
            if (lines.length < 2) continue;
            if (!lines[1].match(/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/)) {
                throw new Error(`Invalid timestamp format in block #${i + 1} of SRT file.`);
            }
            const [startTime, endTime] = lines[1].split(' --> ');
            subs.push({
                startTime: startTime.replace(',', '.'),
                endTime: endTime.replace(',', '.'),
                text: lines.slice(2).join('\n')
            });
        }
        return subs;
    },
    
    parseVtt: function(data) {
        const subs = [];
        const blocks = data.trim().replace(/\r/g, '').split('\n\n');
        const startIndex = blocks[0].toUpperCase().startsWith('WEBVTT') ? 1 : 0;
        for (let i = startIndex; i < blocks.length; i++) {
            const lines = blocks[i].split('\n');
            const timeLineIndex = lines.findIndex(line => line.includes('-->'));
            if (timeLineIndex !== -1) {
                 const [startTime, endTime] = lines[timeLineIndex].split(' --> ');
                 subs.push({ startTime: startTime.trim(), endTime: endTime.trim(), text: lines.slice(timeLineIndex + 1).join('\n') });
            }
        }
        return subs;
    },

    parseAss: function(data, removeStyling) {
        const subs = [];
        const lines = data.trim().split(/\r?\n/);
        const eventLines = lines.filter(line => line.startsWith('Dialogue:'));
        for (const [i, line] of eventLines.entries()) {
            const parts = line.split(',');
            if (parts.length < 10) {
                 throw new Error(`Invalid Dialogue format on line #${i + 1} of ASS/SSA file.`);
            }
            let text = parts.slice(9).join(',');
            if (removeStyling) {
                text = text.replace(/{.*?}/g, ''); // Remove styling tags like {\i1}
            }
            subs.push({
                startTime: this.formatAssTime(parts[1]),
                endTime: this.formatAssTime(parts[2]),
                text: text.replace(/\\N/g, '\n') // Replace \N with newline
            });
        }
        return subs;
    },
    
    formatAssTime: function(time) {
        const [h, m, s_cs] = time.split(':');
        const [s, cs] = s_cs.split('.');
        return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${(cs || '0').padEnd(3, '0')}`;
    },

    buildSrt: function(subtitles) {
        return subtitles.map((sub, index) => {
            const startTime = sub.startTime.replace('.', ',');
            const endTime = sub.endTime.replace('.', ',');
            return `${index + 1}\n${startTime} --> ${endTime}\n${sub.text}`;
        }).join('\n\n') + '\n\n';
    },

    buildVtt: function(subtitles) {
        const content = subtitles.map(sub => `${sub.startTime} --> ${sub.endTime}\n${sub.text}`).join('\n\n');
        return 'WEBVTT\n\n' + content + '\n\n';
    },
    
    buildTxt: function(subtitles) {
        return subtitles.map(sub => sub.text).join('\n');
    },

    triggerDownload: function(content, fileName) {
        const blob = (typeof content === 'string') ? new Blob([content], { type: 'text/plain;charset=utf-8' }) : content;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }
};
