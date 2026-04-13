# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ExpenSync - AI-powered expense tracker with SMS parsing and split expense management.

## Architecture

**Backend (BACKEND/)**: FastAPI server with JSON-file database
- `main.py` - FastAPI app with REST endpoints for expenses, people, settlements, and SMS parsing
- `sms_parser.py` - Regex + Ollama (gemma:2b) engine for parsing bank SMS into structured expense data

**Frontend (FRONTEND/)**: Vanilla JavaScript SPA
- `js/app.js` - Router handling dashboard/add-expense/settlements views
- `js/models/schema.js` - API client layer (fetch to localhost:8000)
- `js/views/*.js` - View renderers and event handlers

Data flows: Frontend → FastAPI API → db.json (JSON file storage)

## Commands

```bash
# Start backend (from BACKEND/)
cd BACKEND
.\.venv\Scripts\activate
uvicorn main:app --reload

# Run SMS parser CLI (from BACKEND/)
python sms_parser.py
```

## Key Dependencies

**Backend**: fastapi, uvicorn, httpx (for Ollama), python-dotenv, rich (CLI)
**Frontend**: None (vanilla JS, FontAwesome icons, Google Fonts)

## SMS Parser

The parser extracts amount, currency, merchant, date, and direction from bank SMS using regex patterns, then classifies category via keyword matching or Ollama's gemma:2b model as fallback. Requires Ollama running locally at port 11434.
