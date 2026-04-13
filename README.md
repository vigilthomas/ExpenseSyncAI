# ⚡ ExpenSync AI

**Track Expenses Like a Hacker.**  
An AI-powered, local-first expense tracker that turns messy bank SMS alerts into structured financial data. Built for privacy, speed, and zero manual entry.

![Version](https://img.shields.io/badge/version-1.0.0-black?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-black?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Ready-black?style=for-the-badge)

---

## ✨ Features

- **🤖 AI SMS Parsing**: Forward your bank's transaction SMS and let the Regex + Ollama (Gemma 2B) engine extract the amount, merchant, and category automatically.
- **📊 Interactive Dashboard**: Visualize your spending trends with Chart.js and track your "Net Expense" after settlements.
- **👥 Intelligent Splits**: Divide bills with friends. Track who owes what and mark settlements with a single click.
- **📱 PWA Ready**: Install it as a standalone app on your Desktop, Android, or iOS device. Works offline.
- **🔒 Privacy First**: Your data stays in a local `db.json` file. No cloud, no tracking, no third parties.
- **🎨 Modern UI**: A sleek, responsive interface with animated icons, toasts, and a mobile-drawer navigation.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python 3.10+**
- **Node.js** (optional, for serving frontend)
- **Ollama** (Required for AI categorization: [ollama.com](https://ollama.com))
  - Run `ollama pull gemma:2b` after installing.

### 2. Backend Setup
```bash
cd BACKEND
python -m venv .venv
.\.venv\Scripts\activate  # Windows
# source .venv/bin/activate # Linux/Mac

pip install -r requirements.txt
uvicorn main:app --reload
```
*Backend runs at `http://localhost:8000`*

### 3. Frontend Setup
In a new terminal:
```bash
cd FRONTEND
python -m http.server 3000
```
*Access the app at `http://localhost:3000`*

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES6+), CSS Grid/Flexbox, Chart.js |
| **Backend** | FastAPI (Python), Pydantic |
| **AI Engine** | Ollama (Gemma 2B), Regex Pattern Matching |
| **Database** | Local JSON File (`db.json`) |
| **Platform** | Service Workers (PWA), Web App Manifest |

---

## 📱 Mobile Installation

1. Open the app URL in your mobile browser.
2. Select **"Add to Home Screen"** from the browser menu.
3. Launch **ExpenSync AI** from your app drawer for a full-screen, native experience.

---

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="center">
  Built with ❤️ for the privacy-conscious hacker.
</p>
