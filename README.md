# Sub Tools 🛠️

[![Project Status: Active](https://img.shields.io/badge/status-active-success.svg)](https://github.com/your-username/Sub-Tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive, 100% browser-based suite of powerful utilities for all your subtitle needs. This project bundles four distinct applications into a single, cohesive web interface. All file processing is performed directly in your browser, meaning your files are **never uploaded to a server**. This ensures complete privacy, exceptional speed, and offline functionality.

## About The Project

Sub Tools was created to provide a seamless, all-in-one workflow for subtitle editors, translators, and media enthusiasts. Instead of juggling multiple websites or desktop applications, you can handle everything from timing adjustments and translation to format conversion and extraction from video files in one place. The project is built with modern web technologies, focusing on performance, usability, and privacy.

## ✨ Key Features

* **Four Powerful Tools in One Interface:**
    * **Timeline Coordinator:** Adjust subtitle timing with precision.
    * **Subtitle Translator:** A professional side-by-side translation editor.
    * **Format Converter:** Convert between all major subtitle formats.
    * **Video Subtitle Extractor:** Pull embedded subtitle tracks directly from video files.
* **Privacy-First Architecture:** All operations happen on your machine. Your files are never sent over the network.
* **Advanced Functionality:**
    * Batch processing for converting multiple files at once.
    * On-the-fly format conversion during video extraction.
    * Drag-and-drop support for an intuitive user experience.
* **Modern & Responsive:** A clean, easy-to-use interface that works flawlessly on both desktop and mobile devices.

---

## 🚀 The Tools in Detail

#### 1. Timeline Coordinator
A precision tool for synchronizing `.srt` subtitle files. Perfect for fixing subtitles that are out of sync with your video.
* **Global Time Shift:** Adjust the timing of all subtitle lines at once.
* **Selective Adjustment:** Select and shift the timing of single or multiple lines.
* **Intuitive Controls:** Easily add or subtract time in hours, minutes, seconds, and milliseconds.

#### 2. Subtitle Translator
A professional, two-column editor designed for efficient subtitle translation, equipped with advanced editing features.
* **Side-by-Side View:** Displays original text and an editable translation field for a clear workflow.
* **Line Management:** Add new lines with smart timing that automatically fills gaps, or delete unwanted lines.
* **Productivity Tools:** Includes Find & Replace, character counters, and auto-saving of progress to your browser's local storage.

#### 3. Format Converter
A versatile utility for converting subtitle files between the most popular formats.
* **Broad Format Support:** Convert between **SRT, VTT, ASS/SSA, and plain TXT**.
* **Batch Conversion:** Upload multiple files at once and download them all in a single, organized `.zip` archive.
* **Styling Control:** An option to strip complex styling tags (e.g., `{\i1\b0}`) when converting from formats like ASS to simpler ones like SRT.

#### 4. Video Subtitle Extractor
An advanced tool that pulls embedded (soft) subtitle tracks directly from video files using the power of WebAssembly.
* **Powerful Engine:** Uses **FFmpeg.wasm** to process video files like **MKV, MP4, and AVI** right in the browser.
* **Automatic Track Detection:** Scans any video and lists all available embedded subtitle tracks with language and format information.
* **On-the-Fly Conversion:** Extract a track in one format (e.g., ASS) and save it directly as another (e.g., SRT).
* **Batch Extraction & Previews:** Select and extract multiple tracks at once, and preview their content before downloading.

---

## 📂 Project Structure

The repository is organized to keep each tool's code modular and maintainable.

```
Sub-Tools/
├── index.html         # The main hub page that hosts all tools
├── style.css          # Main CSS for the hub layout and navigation
├── script.js          # Main JS for hub navigation (tab switching)
│
└─── tools/            # Folder containing the assets for each tool
    ├── 1-coordinator/
    ├── 2-translator/
    ├── 3-converter/
    └── 4-extractor/
        └── coi-serviceworker.js # Special file for the extractor
```

---

## 📄 License

This project is distributed under the MIT License. See the `LICENSE` file for more information.

---

Created with ❤️ by GeekNeuron
