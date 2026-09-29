# MediAssist AI

**Smart Prescription & Medication Assistant**

An AI-powered web application that interprets medical prescriptions and assists users in managing their medications effectively.

---

## Features

### 1. Prescription Upload & OCR
- Upload prescription images (JPG, PNG, PDF)
- **Dual-engine OCR**: a local Python Tesseract microservice is used first for fast, accurate extraction, with automatic fallback to in-browser Tesseract.js
- Automatic image preprocessing (grayscale, sharpen, upscale, contrast, binarise)
- Automatic identification of medicines, dosages, and instructions
- Active OCR engine and confidence score shown on the results header
- Downloadable prescription reports

### 2. Medication Management
- Add and track current medications
- Set dosage schedules and frequencies
- Mark doses as taken
- Track medication adherence
- Optional stock quantity per medication, automatically reduced when a dose is taken

### 3. Refill Assistance
- Dedicated Refill Center page with per-medication stock tracking
- Automatic estimate of days of supply from the dosing schedule
- Refill status levels: In stock, Running low, Refill now, Out of stock
- Refill alerts on the dashboard and in the Refill Center
- Record refills with quantity, unit, and date; full refill history per medication
- Refill threshold configurable per medication

### 4. Drug Interaction Checker
- Check interactions between multiple medications
- Severity-based warnings (Severe/Moderate/Mild)
- Comprehensive drug interaction database
- Manual drug entry or select from your medications

### 5. Smart Reminders
- Push notification reminders for medication times
- Daily/weekly/specific day scheduling
- Before/after meal indicators
- Mark doses as taken directly from notifications

### 6. Medicine Lookup
- Search detailed medicine information
- Dosage guidelines and forms
- Side effects and warnings
- Price estimation (INR)
- Substitute medicine recommendations

### 7. Multilingual Audio Support
- Text-to-speech for prescription details
- Audio explanations for accessibility

### 8. Offline Functionality
- Service Worker for offline access
- Local data persistence with localStorage
- Works without internet connection

### 9. Wearable simulation
- simulate the health readings from a smart watch
- in emergency cases notify the emergency contact


---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Backend | Node.js + Express (static server, Twilio, OCR proxy) |
| OCR service | Python 3 + Flask + Tesseract (Pillow preprocessing) |
| OCR fallback | Tesseract.js 5 (in-browser) |
| Styling | Custom CSS with CSS Variables |
| Icons | Font Awesome 6.4 |
| Fonts | Google Fonts (Inter) |
| Storage | LocalStorage (client-side) |
| AI | Rule-based system (ready for API integration) |
| Offline | Service Worker API |
| Notifications | Web Notifications API + Twilio SMS |

---

## Project Structure

```
MediAssistAI/
├── index.html              # Main HTML file (SPA)
├── manifest.json           # PWA manifest
├── service-worker.js       # Service worker for offline
├── package.json            # Project configuration
├── server.js               # Express server: static files, Twilio, OCR proxy
├── .env.example            # Twilio credentials template
├── css/
│   └── styles.css          # Complete stylesheet
├── js/
│   ├── app.js              # Core app logic & state
│   ├── auth.js             # Authentication module
│   ├── firebase.js         # Firebase configuration
│   ├── prescription.js     # Upload, OCR engine selection & parsing
│   ├── medications.js      # Medication management
│   ├── refills.js          # Refill tracking & alerts
│   ├── interactions.js     # Drug interaction checker
│   ├── reminders.js        # Pill reminders
│   ├── wearable.js         # Smart watch simulation
│   └── medicine-info.js    # Medicine lookup
├── ocr-service/
│   ├── app.py              # Flask OCR API
│   ├── ocr_engine.py       # Preprocessing + Tesseract wrapper
│   └── requirements.txt    # Python dependencies
├── assets/
│   └── images/             # Image assets
└── pages/                  # (Optional separate pages)
```

---

## OCR Architecture

Prescription text extraction runs through two engines, tried in order:

1. **Python OCR service (preferred)** - a local Flask service wrapping the
   native Tesseract binary. Faster and more accurate than the browser build.
2. **Tesseract.js (fallback)** - used automatically when the Python service is
   offline, unreachable, or returns no text.

```
Browser  --POST /api/py-ocr-->  Express  --POST /api/ocr/process-->  Flask  -->  Tesseract
   ^                                                                              |
   |------------------ fallback to Tesseract.js if this path fails ---------------|
```

The results header shows which engine was used and the confidence score.

### Python OCR Service Setup

```bash
# Install Tesseract (Windows / MSYS2)
pacman -S mingw-w64-x86_64-tesseract mingw-w64-x86_64-tesseract-data-eng

# Create a virtual environment and install dependencies
cd ocr-service
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt

# Start the service
python app.py            # or: npm run ocr from the project root
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `OCR_PORT` | `5001` | Port for the Flask service |
| `TESSERACT_CMD` | auto-detected | Explicit path to the Tesseract binary |
| `OCR_SERVICE_URL` | `http://127.0.0.1:5001` | URL the Express server uses to reach the service |

### Service Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ocr/health` | Python service health and Tesseract version |
| `GET` | `/api/ocr/languages` | Installed Tesseract languages |
| `POST` | `/api/ocr/process` | Extract text and confidence from an image |
| `GET` | `/api/py-ocr/health` | Express proxy health (includes service reachability) |
| `POST` | `/api/py-ocr` | Express proxy for `/api/ocr/process` |
| `GET` | `/api/health` | Express server health |

---

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Node.js (for the development server)
- Python 3.9+ and Tesseract (optional, for higher-quality OCR; the app falls back to Tesseract.js without it)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/MediAssistAI.git

# Navigate to project directory
cd MediAssistAI

# Install dependencies
npm install

# Start the Express development server (port 4000)
npm start
```

### Optional: start the Python OCR service

Run this in a second terminal for faster, more accurate OCR:

```bash
npm run ocr
```

Check that both services are reachable:

```bash
npm run ocr:health
```

### Direct Usage
Simply open `index.html` in any modern web browser. The browser OCR fallback
works without any backend, but the Python service and Twilio SMS alerts require
the Express server.

---

## Usage Guide

### 1. Register/Login
- Create an account or use demo login
- Data is stored locally in your browser

### 2. Upload Prescription
- Click "Upload Prescription" in the sidebar
- Drag & drop or click to upload an image
- Click "Process with AI" to analyze
- The app uses the Python OCR service when it is running, otherwise it falls back to browser OCR automatically
- Check the badge on the results header to see which engine was used and the confidence score
- View extracted medications and add to your list

### 3. Add Medications
- Go to "My Medications" → "Add Medication"
- Enter medicine details and schedule
- Optionally enter a quantity in stock to enable refill tracking
- Set up automatic reminders

### 4. Track Refills
- Go to "Refill Center"
- See an overview of every tracked medication, its stock, and estimated days of supply
- Use "Record refill" when you collect a new pack; the history is kept per medication
- Use "Update stock" to correct the quantity you currently have on hand
- Low-stock and out-of-stock medications also appear as alerts on the dashboard

### 5. Check Interactions
- Go to "Drug Interactions"
- Select from your medications or enter manually
- View severity-based interaction warnings

### 6. Set Reminders
- Go to "Reminders" → "Add Reminder"
- Select medication and time
- Enable browser notifications for alerts

### 7. Look Up Medicine
- Go to "Medicine Lookup"
- Search by medicine name
- View detailed information, prices, and substitutes

---

## Data Storage

All data is stored locally in the browser using localStorage:
- `mediassist_user` - Current user profile
- `mediassist_medications` - User's medications
- `mediassist_prescriptions` - Uploaded prescriptions
- `mediassist_reminders` - Medication reminders
- `mediassist_history` - Activity history
- `mediassist_users` - Registered user accounts

---

## API Integration (Production)

For production deployment, integrate with:

| Service | Purpose |
|---------|---------|
| Firebase Auth | User authentication |
| Firebase Storage | Prescription image storage |
| Tesseract (Python) | Primary OCR engine |
| Tesseract.js | Client-side OCR fallback |
| RxNav API | Drug information |
| OpenFDA API | Drug data & interactions |
| Google Cloud Vision | Enhanced OCR (optional upgrade) |
| Text-to-Speech API | Multilingual audio |

---

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

---

## Security Notes

- Health data is stored locally in the browser; the OCR services run on your own machine
- Prescription images are sent to the local Python OCR service when it is running
- No sensitive data is logged by the OCR services
- Twilio credentials are read from environment variables (`.env`), which is git-ignored; `.env.example` documents the required keys
- Passwords are stored in localStorage (use proper hashing for production)
- HIPAA compliance requires additional measures for production

---

## Future Enhancements

- [x] Python Flask OCR microservice with Tesseract
- [x] Tesseract.js browser fallback
- [x] Medication refill tracking and alerts
- [ ] PDF rasterisation so scanned PDFs can be read by the Python engine
- [ ] Firebase integration for cloud sync
- [ ] RxNav/OpenFDA API integration
- [ ] Pharmacy / ordering integration from the Refill Center
- [ ] Multilingual support (Hindi, Tamil, Telugu, etc.)
- [ ] Barcode scanning for medicines
- [ ] Pharmacy price comparison
- [ ] Doctor consultation booking
- [ ] Family member medication management
- [ ] Push notification channel for refill alerts

---

## License

MIT License

---

## Disclaimer

This application is for educational and informational purposes only. Always consult a qualified healthcare professional for medical advice, diagnosis, and treatment.
