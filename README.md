# MediAssist AI

**Smart Prescription & Medication Assistant**

An AI-powered web application that interprets medical prescriptions and assists users in managing their medications effectively.

---

## Features

### 1. Prescription Upload & OCR
- Upload or capture prescription images (JPG, PNG, PDF)
- AI-powered text extraction and analysis
- Automatic identification of medicines, dosages, and instructions
- Downloadable prescription reports

### 2. Medication Management
- Add and track current medications
- Set dosage schedules and frequencies
- Mark doses as taken
- Track medication adherence

### 3. Drug Interaction Checker
- Check interactions between multiple medications
- Severity-based warnings (Severe/Moderate/Mild)
- Comprehensive drug interaction database
- Manual drug entry or select from your medications

### 4. Smart Reminders
- Push notification reminders for medication times
- Daily/weekly/specific day scheduling
- Before/after meal indicators
- Mark doses as taken directly from notifications

### 5. Medicine Lookup
- Search detailed medicine information
- Dosage guidelines and forms
- Side effects and warnings
- Price estimation (INR)
- Substitute medicine recommendations

### 6. Pill Identifier
- Identify unknown pills by color, shape, size, and imprint
- Confidence-based matching
- Common medication database

### 7. Multilingual Audio Support
- Text-to-speech for prescription details
- Audio explanations for accessibility

### 8. Offline Functionality
- Service Worker for offline access
- Local data persistence with localStorage
- Works without internet connection

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Styling | Custom CSS with CSS Variables |
| Icons | Font Awesome 6.4 |
| Fonts | Google Fonts (Inter) |
| Storage | LocalStorage (client-side) |
| OCR | Simulated (ready for Tesseract.js integration) |
| AI | Rule-based system (ready for API integration) |
| Offline | Service Worker API |
| Notifications | Web Notifications API |

---

## Project Structure

```
MediAssistAI/
├── index.html              # Main HTML file (SPA)
├── manifest.json           # PWA manifest
├── service-worker.js       # Service worker for offline
├── package.json            # Project configuration
├── css/
│   └── styles.css          # Complete stylesheet
├── js/
│   ├── app.js              # Core app logic & state
│   ├── auth.js             # Authentication module
│   ├── prescription.js     # Upload & OCR processing
│   ├── medications.js      # Medication management
│   ├── interactions.js     # Drug interaction checker
│   ├── reminders.js        # Pill reminders
│   └── medicine-info.js    # Medicine lookup & pill ID
├── assets/
│   └── images/             # Image assets
└── pages/                  # (Optional separate pages)
```

---

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Node.js (optional, for development server)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/MediAssistAI.git

# Navigate to project directory
cd MediAssistAI

# Install dependencies (optional)
npm install

# Start development server
npm start
```

### Direct Usage
Simply open `index.html` in any modern web browser.

---

## Usage Guide

### 1. Register/Login
- Create an account or use demo login
- Data is stored locally in your browser

### 2. Upload Prescription
- Click "Upload Prescription" in the sidebar
- Drag & drop or click to upload an image
- Click "Process with AI" to analyze
- View extracted medications and add to your list

### 3. Add Medications
- Go to "My Medications" → "Add Medication"
- Enter medicine details and schedule
- Set up automatic reminders

### 4. Check Interactions
- Go to "Drug Interactions"
- Select from your medications or enter manually
- View severity-based interaction warnings

### 5. Set Reminders
- Go to "Reminders" → "Add Reminder"
- Select medication and time
- Enable browser notifications for alerts

### 6. Look Up Medicine
- Go to "Medicine Lookup"
- Search by medicine name
- View detailed information, prices, and substitutes

### 7. Identify Pills
- Go to "Pill Identifier"
- Enter pill characteristics (color, shape, imprint)
- View matching medications with confidence scores

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
| Tesseract.js | Client-side OCR |
| RxNav API | Drug information |
| OpenFDA API | Drug data & interactions |
| Google Cloud Vision | Enhanced OCR |
| Text-to-Speech API | Multilingual audio |

---

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

---

## Security Notes

- All data is stored locally (no server transmission)
- No sensitive data is logged
- Passwords are stored in localStorage (use proper hashing for production)
- HIPAA compliance requires additional measures for production

---

## Future Enhancements

- [ ] Backend API with Python (Flask/FastAPI)
- [ ] Firebase integration for cloud sync
- [ ] Tesseract.js for real OCR processing
- [ ] RxNav/OpenFDA API integration
- [ ] Multilingual support (Hindi, Tamil, Telugu, etc.)
- [ ] Barcode scanning for medicines
- [ ] Pharmacy price comparison
- [ ] Doctor consultation booking
- [ ] Family member medication management
- [ ] Health metrics tracking

---

## License

MIT License

---

## Disclaimer

This application is for educational and informational purposes only. Always consult a qualified healthcare professional for medical advice, diagnosis, and treatment.
